export const isMac = typeof navigator !== 'undefined' &&
  (/Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform ?? navigator.platform ?? ''));

export const modKey = isMac ? '⌘' : 'Ctrl';
