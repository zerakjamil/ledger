/**
 * The phone's keyboard speaks its locale: Arabic-Indic digits, a comma for the
 * decimal point, a unit typed after the number. The ledger stores a number, so
 * every one of those has to read the same.
 */
export function parseInputNumber(raw: string): number | null {
  const ascii = raw
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, '.')
    .replace(/\u066c/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  if (!ascii || ascii === '-' || ascii === '.') return null;
  const value = Number(ascii);
  return Number.isFinite(value) ? value : null;
}
