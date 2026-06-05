const HASH_ALGORITHM = 'pbkdf2_sha256'
const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const KEY_BYTES = 32

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64'))
}

function bytesToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: bytesToArrayBuffer(salt),
      iterations,
    },
    keyMaterial,
    KEY_BYTES * 8,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const key = await derivePasswordKey(password, salt, PBKDF2_ITERATIONS)
  return [
    HASH_ALGORITHM,
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(key),
  ].join('$')
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, keyValue] = storedHash.split('$')
  const iterations = Number(iterationsValue)

  if (
    algorithm !== HASH_ALGORITHM ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    !saltValue ||
    !keyValue
  ) {
    return false
  }

  const salt = base64ToBytes(saltValue)
  const expectedKey = base64ToBytes(keyValue)
  const actualKey = await derivePasswordKey(password, salt, iterations)
  return timingSafeEqual(actualKey, expectedKey)
}
