export const number = new Intl.NumberFormat('en-GB');
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

export function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseDate(value) {
  const parsed = new Date(value);
  requireCondition(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value,
    `Invalid date: ${value}`,
  );
  return parsed;
}

export function dateLabel(value) {
  return `<time datetime="${value}">${date.format(parseDate(value))}</time>`;
}
