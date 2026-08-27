/** The SMS parser has written the literal strings "null" and "undefined" into
 *  account_last4, so two alias rows render as "Amazon Pay ••null". Treat those
 *  as absent rather than printing them at the user. */
const PLACEHOLDERS = new Set(['null', 'undefined', 'nan', 'none', '-']);

export function cleanLast4(last4: string | null | undefined): string {
  const v = (last4 ?? '').trim();
  return PLACEHOLDERS.has(v.toLowerCase()) ? '' : v;
}

export function toTechnicalDisplay(
  bankName: string | null | undefined,
  last4: string | null | undefined,
): string {
  const name = (bankName ?? '').trim();
  const digits = cleanLast4(last4);
  if (name && digits) return `${name} ••${digits}`;
  if (name) return name;
  if (digits) return `••${digits}`;
  return '';
}
