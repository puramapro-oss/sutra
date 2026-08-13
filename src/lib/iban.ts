const SEPA_LENGTHS: Record<string, number> = {
  AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20,
  ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22,
  IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18,
  NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, VA: 22,
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

function ibanCheckMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let numeric = ''
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch
    else if (ch >= 'A' && ch <= 'Z') numeric += String(ch.charCodeAt(0) - 55)
    else return -1
  }
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7)
    remainder = Number(chunk) % 97
  }
  return remainder
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false
  if (iban.length < 15 || iban.length > 34) return false
  const expectedLength = SEPA_LENGTHS[iban.slice(0, 2)]
  if (!expectedLength || iban.length !== expectedLength) return false
  return ibanCheckMod97(iban) === 1
}
