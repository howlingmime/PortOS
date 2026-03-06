import { getDraft, updateDraft } from './messageDrafts.js';
import { getAccount } from './messageAccounts.js';

export async function sendDraft(draftId, io) {
  const draft = await getDraft(draftId);
  if (!draft) return { success: false, error: 'Draft not found' };
  if (draft.status !== 'approved') return { success: false, error: `Draft status is "${draft.status}", must be "approved"` };

  const account = await getAccount(draft.accountId);
  if (!account) return { success: false, error: 'Account not found' };

  await updateDraft(draftId, { status: 'sending' });
  console.log(`📧 Sending draft "${draft.subject}" via ${draft.sendVia}`);

  const dispatch = async () => {
    if (draft.sendVia === 'mcp') {
      const { sendGmail } = await import('./messageGmailSync.js');
      return sendGmail(account, draft);
    }
    const { sendPlaywright } = await import('./messagePlaywrightSync.js');
    return sendPlaywright(account, draft);
  };

  const result = await dispatch().catch(async (error) => {
    console.error(`📧 Draft send threw for "${draft.subject}": ${error.message}`);
    return { success: false, error: error.message };
  });

  if (result?.success) {
    await updateDraft(draftId, { status: 'sent' });
    io?.emit('messages:draft:sent', { draftId });
    io?.emit('messages:changed', {});
    console.log(`📧 Draft sent successfully: "${draft.subject}"`);
  } else {
    await updateDraft(draftId, { status: 'failed' }).catch(() => {});
    const errorMsg = result?.error ?? 'Unknown error sending draft';
    console.log(`📧 Draft send failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  return result;
}
