export function toTechnicalDisplay(bankName: string, last4: string): string {
  if (bankName && last4) return `${bankName} ••${last4}`;
  if (bankName) return bankName;
  if (last4) return `••${last4}`;
  return '';
}
