/**
 * Google OAuth Auto-Configure via CDP Browser
 *
 * Flow:
 * 1. User clicks "Setup with Browser" → opens Google Cloud Console
 * 2. User logs in and selects/creates a project manually
 * 3. User clicks "Continue" → automated script handles:
 *    - Enable Google Calendar API
 *    - Configure OAuth consent screen
 *    - Create OAuth credentials with redirect URI
 *    - Extract client ID + secret
 *    - Save to PortOS
 */
import { findOrOpenPage, evaluateOnPage, getPages } from './messagePlaywrightSync.js';
import { saveCredentials, getAuthUrl } from './googleAuth.js';
import { navigateToUrl } from './browserService.js';

const GCP_CONSOLE_URL = 'https://console.cloud.google.com';
const REDIRECT_URI = 'http://localhost:5555/api/calendar/google/oauth/callback';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGcpPage() {
  const pages = await getPages();
  return pages.find(p => p.url?.includes('console.cloud.google.com'));
}

async function waitForPageReady(maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const page = await getGcpPage();
    if (page) {
      const ready = await evaluateOnPage(page, `document.readyState === 'complete'`);
      if (ready) return page;
    }
    await sleep(1000);
  }
  return null;
}

async function navigateAndWait(url, waitMs = 3000) {
  await navigateToUrl(url);
  await sleep(waitMs);
  return waitForPageReady();
}

async function clickButtonByText(page, textPatterns, maxWait = 10000) {
  const patterns = Array.isArray(textPatterns) ? textPatterns : [textPatterns];
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const clicked = await evaluateOnPage(page, `
      (function() {
        const patterns = ${JSON.stringify(patterns)};
        // Check buttons, a tags, and elements with role=button
        const candidates = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')];
        for (const pattern of patterns) {
          const lp = pattern.toLowerCase();
          const match = candidates.find(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            return text === lp || text.includes(lp) || aria.includes(lp);
          });
          if (match && !match.disabled) {
            match.click();
            return pattern;
          }
        }
        return null;
      })()
    `);
    if (clicked) return clicked;
    await sleep(1500);
  }
  return null;
}

async function fillInput(page, selector, value) {
  return evaluateOnPage(page, `
    (function() {
      const input = document.querySelector('${selector}');
      if (!input) return false;
      input.focus();
      input.value = '';
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, '${value}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
}

// === Public API ===

export async function startAutoConfig(io) {
  console.log('📅 Starting Google OAuth auto-configuration via CDP browser');
  io?.emit('calendar:google:autoconfig', { step: 'launching', message: 'Opening Google Cloud Console...' });

  const page = await findOrOpenPage(GCP_CONSOLE_URL);
  if (!page) {
    return { error: 'Failed to open browser. Ensure portos-browser is running.', status: 503 };
  }

  io?.emit('calendar:google:autoconfig', { step: 'login', message: 'Google Cloud Console opened. Log in and select a project, then click Continue.' });
  console.log('📅 Google Cloud Console opened in CDP browser');

  return {
    status: 'started',
    message: 'Google Cloud Console opened. Log in and select your project, then click Continue.'
  };
}

export async function runAutomatedSetup(io) {
  console.log('📅 Running automated Google OAuth setup via CDP');
  const errors = [];

  const emit = (step, message) => {
    io?.emit('calendar:google:autoconfig', { step, message });
    console.log(`📅 Auto-config: ${message}`);
  };

  // Verify GCP Console is open and user is logged in
  let page = await getGcpPage();
  if (!page) return { error: 'Google Cloud Console not open. Click "Setup with Browser" first.', status: 400 };

  // Step 1: Enable Google Calendar API
  emit('enable-api', 'Enabling Google Calendar API...');
  page = await navigateAndWait('https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', 4000);
  if (!page) { errors.push('Failed to load Calendar API page'); }
  else {
    // Check if already enabled
    const alreadyEnabled = await evaluateOnPage(page, `
      (function() {
        const text = document.body.innerText;
        return text.includes('API enabled') || text.includes('MANAGE') || text.includes('Manage');
      })()
    `);

    if (!alreadyEnabled) {
      const clicked = await clickButtonByText(page, ['Enable', 'ENABLE']);
      if (clicked) {
        emit('enable-api', 'Calendar API enable clicked, waiting...');
        await sleep(5000);
      } else {
        errors.push('Could not find Enable button for Calendar API');
      }
    } else {
      emit('enable-api', 'Calendar API already enabled');
    }
  }

  // Step 2: Configure OAuth Consent Screen
  emit('consent', 'Configuring OAuth consent screen...');
  page = await navigateAndWait('https://console.cloud.google.com/apis/credentials/consent', 4000);
  if (!page) { errors.push('Failed to load consent screen page'); }
  else {
    // Check if consent screen is already configured
    const consentState = await evaluateOnPage(page, `
      (function() {
        const text = document.body.innerText;
        if (text.includes('Edit App') || text.includes('EDIT APP')) return 'configured';
        if (text.includes('External') || text.includes('Internal')) return 'needs-setup';
        return 'unknown';
      })()
    `);

    if (consentState === 'needs-setup') {
      // Select External and click Create
      await evaluateOnPage(page, `
        (function() {
          // Find and click External radio
          const labels = [...document.querySelectorAll('label, [role="radio"], mat-radio-button')];
          const external = labels.find(l => (l.textContent || '').toLowerCase().includes('external'));
          if (external) external.click();
        })()
      `);
      await sleep(1000);
      await clickButtonByText(page, ['Create', 'CREATE']);
      await sleep(3000);
      page = await waitForPageReady();

      if (page) {
        // Fill in app name
        await evaluateOnPage(page, `
          (function() {
            const inputs = document.querySelectorAll('input[type="text"]');
            for (const input of inputs) {
              const label = input.closest('[class*="form"]')?.querySelector('label')?.textContent || '';
              if (label.toLowerCase().includes('app name') || label.toLowerCase().includes('application name')) {
                input.focus();
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(input, 'PortOS');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            // Fallback: fill the first empty text input
            const first = [...inputs].find(i => !i.value);
            if (first) {
              first.focus();
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(first, 'PortOS');
              first.dispatchEvent(new Event('input', { bubbles: true }));
              first.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })()
        `);
        await sleep(500);

        // Click Save and Continue through each page (up to 4 times)
        for (let i = 0; i < 4; i++) {
          await sleep(2000);
          const saved = await clickButtonByText(page, ['Save and Continue', 'SAVE AND CONTINUE', 'Save and continue'], 5000);
          if (!saved) {
            // Try just Continue or Back to Dashboard
            const alt = await clickButtonByText(page, ['Continue', 'CONTINUE', 'Back to Dashboard', 'BACK TO DASHBOARD'], 3000);
            if (!alt) break;
          }
          await sleep(2000);
          page = await waitForPageReady();
          if (!page) break;
        }
      }
      emit('consent', 'OAuth consent screen configured');
    } else if (consentState === 'configured') {
      emit('consent', 'OAuth consent screen already configured');
    } else {
      emit('consent', 'Could not determine consent screen state, continuing...');
    }
  }

  // Step 3: Create OAuth Client
  emit('credentials', 'Creating OAuth credentials...');
  page = await navigateAndWait('https://console.cloud.google.com/apis/credentials', 4000);
  if (!page) { errors.push('Failed to load credentials page'); }
  else {
    // Click "+ Create Credentials" then "OAuth client ID"
    const createClicked = await clickButtonByText(page, ['Create credentials', 'CREATE CREDENTIALS', '+ Create Credentials']);
    if (createClicked) {
      await sleep(2000);
      // Click "OAuth client ID" from dropdown menu
      const oauthClicked = await clickButtonByText(page, ['OAuth client ID', 'OAuth Client ID']);
      if (oauthClicked) {
        await sleep(3000);
        page = await waitForPageReady();
      }
    }

    if (!page) {
      // Fallback: navigate directly to create page
      page = await navigateAndWait('https://console.cloud.google.com/apis/credentials/oauthclient', 4000);
    }

    if (page) {
      // Select "Web application" type
      await sleep(2000);
      await evaluateOnPage(page, `
        (function() {
          // Look for application type dropdown/select and choose "Web application"
          const selects = document.querySelectorAll('select, [role="listbox"], mat-select');
          for (const sel of selects) {
            sel.click();
          }
          // Also try clicking any dropdown that mentions "Application type"
          const dropdowns = [...document.querySelectorAll('[aria-label*="pplication type"], [class*="select"], [class*="dropdown"]')];
          for (const d of dropdowns) d.click();
        })()
      `);
      await sleep(1500);
      await clickButtonByText(page, ['Web application', 'Web Application']);
      await sleep(2000);
      page = await waitForPageReady();

      if (page) {
        // Add redirect URI
        emit('credentials', 'Adding redirect URI...');

        // Click "Add URI" button in the redirect URIs section
        await clickButtonByText(page, ['Add URI', 'ADD URI', '+ Add URI']);
        await sleep(1000);

        // Fill in the redirect URI
        await evaluateOnPage(page, `
          (function() {
            const redirectUri = '${REDIRECT_URI}';
            // Find input fields - look for the one near "Authorized redirect URIs"
            const inputs = [...document.querySelectorAll('input[type="text"], input[type="url"]')];
            // Find empty inputs (the newly added one)
            const emptyInput = inputs.reverse().find(i => !i.value);
            if (emptyInput) {
              emptyInput.focus();
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(emptyInput, redirectUri);
              emptyInput.dispatchEvent(new Event('input', { bubbles: true }));
              emptyInput.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            return false;
          })()
        `);
        await sleep(1000);

        // Click Create
        emit('credentials', 'Creating OAuth client...');
        await clickButtonByText(page, ['Create', 'CREATE']);
        await sleep(5000);
        page = await waitForPageReady();
      }
    }
  }

  // Step 4: Capture credentials from the creation dialog
  emit('capturing', 'Capturing OAuth credentials...');
  await sleep(2000);
  const captureResult = await captureCredentials(io);

  if (captureResult.error) {
    errors.push(captureResult.error);
    return {
      status: errors.length > 0 ? 'partial' : 'error',
      errors,
      message: 'Automated setup completed with issues. You may need to manually complete some steps.'
    };
  }

  emit('done', 'Google OAuth setup complete!');
  return {
    status: 'success',
    clientId: captureResult.clientId,
    authUrl: captureResult.authUrl,
    errors: errors.length > 0 ? errors : undefined
  };
}

export async function captureCredentials(io) {
  const page = await getGcpPage();
  if (!page) return { error: 'Google Cloud Console not open in browser', status: 404 };

  io?.emit('calendar:google:autoconfig', { step: 'capturing', message: 'Scanning for credentials...' });

  const credentials = await evaluateOnPage(page, `
    (function() {
      const allText = document.body.innerText;
      const clientIdMatch = allText.match(/([0-9]+-[a-zA-Z0-9_]+\\.apps\\.googleusercontent\\.com)/);
      const secretMatch = allText.match(/(GOCSPX-[a-zA-Z0-9_-]+)/);
      if (clientIdMatch && secretMatch) return { clientId: clientIdMatch[1], clientSecret: secretMatch[1] };

      const inputs = document.querySelectorAll('input[readonly], input[type="text"], textarea');
      let clientId = null, clientSecret = null;
      for (const input of inputs) {
        const val = input.value || input.textContent || '';
        if (val.includes('.apps.googleusercontent.com')) clientId = val.trim();
        if (val.startsWith('GOCSPX-')) clientSecret = val.trim();
      }
      if (clientId && clientSecret) return { clientId, clientSecret };

      return clientId ? { clientId, clientSecret: null, partial: true } : null;
    })()
  `);

  if (!credentials) {
    return { error: 'Could not find credentials on the page. The OAuth creation dialog may not be visible.', status: 404 };
  }

  if (!credentials.clientSecret) {
    return { error: 'Found Client ID but not secret. You may need to create a new OAuth client.', clientId: credentials.clientId, status: 404 };
  }

  await saveCredentials(credentials);
  io?.emit('calendar:google:autoconfig', { step: 'captured', message: 'Credentials captured and saved!' });
  console.log('📅 OAuth credentials captured and saved');

  const authResult = await getAuthUrl();
  return { status: 'captured', clientId: credentials.clientId, authUrl: authResult.url || null };
}
