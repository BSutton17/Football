// 32-char alphabet — omits visually ambiguous characters (I, O, 0, 1)
// 32 divides 256 evenly so crypto bytes map with zero modulo bias
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
const VALID_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/

// 32^6 = ~1 billion possible codes
export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export function isValidRoomCode(code: string): boolean {
  return VALID_CODE_RE.test(code)
}
