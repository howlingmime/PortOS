export const CRON_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 min' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 7 * * *', label: 'Daily at 7 AM' },
  { value: '0 7 * * 1-5', label: 'Weekdays at 7 AM' },
  { value: '0 9,12,15,18 * * *', label: 'Peak hours (9, 12, 3, 6)' },
  { value: '0 0 * * 0', label: 'Weekly Sun midnight' },
  { value: '0 0 1 * *', label: 'Monthly 1st at midnight' }
];

export function isCronExpression(val) {
  return typeof val === 'string' && val.trim().split(/\s+/).length === 5;
}

const DOW_MAP = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' };

export function describeCron(expr) {
  if (!expr) return '';
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  const segments = [];
  if (min === '0' && hour !== '*') {
    if (dow === '1-5') segments.push('Weekdays');
    else if (dow !== '*') segments.push(dow.split(',').map(d => DOW_MAP[d] || d).join(', '));
    if (dom !== '*') segments.push(`day ${dom}`);
    if (mon !== '*') segments.push(`month ${mon}`);
    segments.push(`at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`);
  } else if (min.startsWith('*/')) {
    segments.push(`every ${min.slice(2)} min`);
  } else if (hour.startsWith('*/')) {
    segments.push(`every ${hour.slice(2)} hours at :${min.padStart(2, '0')}`);
  } else {
    return expr;
  }
  return segments.join(' ');
}
