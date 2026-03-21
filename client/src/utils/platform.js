/** Platform detection — provides isMac flag and modifier key label for keyboard shortcuts */
export const isMac = typeof navigator !== 'undefined' &&
  (/Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? ''));

export const modKey = isMac ? '⌘' : 'Ctrl';
