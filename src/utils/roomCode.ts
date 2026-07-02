// 4-digit numeric room code (e.g. "0427"). Short and easy to read out / type on a phone keypad.
const CODE_LENGTH = 4
const VALID_CODE_RE = /^\d{4}$/

// 10^4 = 10,000 possible codes. (Each byte mod 10 has a negligible modulo bias — fine for a
// non-security-critical pairing code.)
export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => String(b % 10)).join('')
}

export function isValidRoomCode(code: string): boolean {
  return VALID_CODE_RE.test(code)
}
