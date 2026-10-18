import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { isoCBOR } from '@simplewebauthn/server/helpers'

const db = vi.hoisted(() => ({
  adminCredential: { findUnique: vi.fn() },
  adminPasskey: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  adminPasskeyChallenge: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  adminUnlock: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/rate-limit', () => ({ getClientIp: () => 'test', rateLimit: async () => ({ allowed: true }) }))
vi.mock('@/lib/admin-password', () => ({ verifyPassword: async (password: string) => password === 'correct-password' }))

import { GET, POST } from '@/app/api/admin/passkeys/route'
import { computeSessionToken, requireAdmin } from '@/lib/admin-auth'
import { hashUnlock } from '@/lib/admin-unlock'

const origin = 'https://barber-booking-gr.vercel.app'
let session: string
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = pair.publicKey.export({ format: 'jwk' })
const keyId = randomBytes(32)
const cose = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x!, 'base64url'), Buffer.from('225820', 'hex'), Buffer.from(jwk.y!, 'base64url')])
const challengeId = 'c'.repeat(64)
let challenge: string

function request(body: object, options: { origin?: string; token?: string; session?: string } = {}) {
  return new Request(`${origin}/api/admin/passkeys`, {
    method: 'POST', headers: {
      origin: options.origin ?? origin, 'content-type': 'application/json',
      cookie: `twins_admin_session=${options.session ?? session}; twins_passkey_challenge=${challengeId}`,
      ...(options.token ? { 'x-admin-unlock': options.token } : {}),
    }, body: JSON.stringify(body),
  })
}
function clientData(type: string, customOrigin = origin) {
  return Buffer.from(JSON.stringify({ type, challenge, origin: customOrigin, crossOrigin: false }))
}
function authData(flags: number, counter = 1) {
  const count = Buffer.alloc(4); count.writeUInt32BE(counter)
  return Buffer.concat([createHash('sha256').update(new URL(origin).hostname).digest(), Buffer.from([flags]), count])
}
function assertion(options: { flags?: number; origin?: string; tamper?: boolean } = {}) {
  const client = clientData('webauthn.get', options.origin)
  const auth = authData(options.flags ?? 5)
  const signature = sign('sha256', Buffer.concat([auth, createHash('sha256').update(client).digest()]), pair.privateKey)
  if (options.tamper) signature[signature.length - 1] ^= 1
  return {
    id: keyId.toString('base64url'), rawId: keyId.toString('base64url'), type: 'public-key', clientExtensionResults: {},
    response: { clientDataJSON: client.toString('base64url'), authenticatorData: auth.toString('base64url'), signature: signature.toString('base64url') },
  }
}

beforeEach(async () => {
  vi.resetAllMocks()
  db.adminCredential.findUnique.mockResolvedValue({ passwordHash: 'stored-secret' })
  session = await computeSessionToken('stored-secret')
  challenge = randomBytes(32).toString('base64url')
  db.adminPasskey.count.mockResolvedValue(1)
  db.adminPasskey.findMany.mockResolvedValue([{ id: keyId.toString('base64url') }])
  db.adminPasskey.findUnique.mockResolvedValue({ id: keyId.toString('base64url'), publicKey: cose, counter: BigInt(0) })
  db.adminPasskey.updateMany.mockResolvedValue({ count: 1 })
  db.adminPasskeyChallenge.findUnique.mockResolvedValue({ id: challengeId, challenge, purpose: 'authenticate', binding: hashUnlock(session), expiresAt: new Date(Date.now() + 300_000) })
  db.adminPasskeyChallenge.deleteMany.mockResolvedValue({ count: 1 })
  db.adminPasskeyChallenge.create.mockImplementation(async ({ data }) => data)
  db.adminUnlock.create.mockImplementation(async ({ data }) => data)
  db.adminUnlock.deleteMany.mockResolvedValue({ count: 1 })
  db.adminUnlock.findUnique.mockResolvedValue(null)
})

describe('server-enforced admin lock', () => {
  it('rejects an unauthenticated session and a valid but locked session', async () => {
    expect((await requireAdmin(request({}, { session: 'invalid' })))?.status).toBe(401)
    expect((await requireAdmin(request({})))?.status).toBe(423)
  })
  it('accepts only an unexpired unlock bound to the current session', async () => {
    const token = 'd'.repeat(64)
    db.adminUnlock.findUnique.mockResolvedValue({ binding: hashUnlock(session), expiresAt: new Date(Date.now() + 60_000) })
    expect(await requireAdmin(request({}, { token }))).toBeNull()
    db.adminUnlock.findUnique.mockResolvedValue({ binding: 'another-session', expiresAt: new Date(Date.now() + 60_000) })
    expect((await requireAdmin(request({}, { token })))?.status).toBe(423)
    db.adminUnlock.findUnique.mockResolvedValue({ binding: hashUnlock(session), expiresAt: new Date(0) })
    expect((await requireAdmin(request({}, { token })))?.status).toBe(423)
  })
  it('keeps pre-enrollment access and returns an uncached status', async () => {
    db.adminPasskey.count.mockResolvedValue(0)
    expect(await requireAdmin(request({}))).toBeNull()
    const response = await GET(request({}))
    expect(await response.json()).toEqual({ enabled: false })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('requires the real password for fallback and registration', async () => {
    expect((await POST(request({ action: 'password', password: 'wrong' }))).status).toBe(403)
    expect((await POST(request({ action: 'register-options', password: 'wrong' }))).status).toBe(403)
    const unlocked = await POST(request({ action: 'password', password: 'correct-password' }))
    expect((await unlocked.json()).token).toMatch(/^[a-f0-9]{64}$/)
  })
  it('rejects cross-origin requests and revokes only the submitted grant', async () => {
    expect((await POST(request({ action: 'password', password: 'correct-password' }, { origin: 'https://evil.example' }))).status).toBe(403)
    const token = 'e'.repeat(64)
    expect((await POST(request({ action: 'lock' }, { token }))).status).toBe(200)
    expect(db.adminUnlock.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashUnlock(token), binding: hashUnlock(session) } })
  })
})

describe('real WebAuthn cryptographic verification', () => {
  it('registers a user-verified platform credential from a one-time enrollment challenge', async () => {
    db.adminPasskeyChallenge.findUnique.mockResolvedValue({ id: challengeId, challenge, purpose: 'register', binding: hashUnlock(session), expiresAt: new Date(Date.now() + 300_000) })
    const len = Buffer.alloc(2); len.writeUInt16BE(keyId.length)
    const data = Buffer.concat([authData(0x45, 0), Buffer.alloc(16), len, keyId, cose])
    const attestation = isoCBOR.encode(new Map<string, string | Map<string, string> | Uint8Array>([['fmt', 'none'], ['attStmt', new Map()], ['authData', data]]))
    const response = await POST(request({ action: 'register-verify', response: {
      id: keyId.toString('base64url'), rawId: keyId.toString('base64url'), type: 'public-key', clientExtensionResults: {},
      response: { clientDataJSON: clientData('webauthn.create').toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] },
    } }))
    expect(response.status).toBe(200)
    expect(db.adminPasskey.create).toHaveBeenCalledWith({ data: { id: keyId.toString('base64url'), publicKey: cose, counter: BigInt(0) } })
  })
  it('verifies an ES256 signature and issues a grant', async () => {
    const response = await POST(request({ action: 'authenticate-verify', response: assertion() }))
    expect(response.status).toBe(200)
    expect((await response.json()).token).toMatch(/^[a-f0-9]{64}$/)
    expect(db.adminPasskey.updateMany).toHaveBeenCalledWith({ where: { id: keyId.toString('base64url'), counter: BigInt(0) }, data: { counter: BigInt(1) } })
  })
  it.each([{ tamper: true }, { flags: 1 }, { origin: 'https://evil.example' }])('rejects invalid assertions: %j', async options => {
    expect((await POST(request({ action: 'authenticate-verify', response: assertion(options) }))).status).toBe(400)
    expect(db.adminUnlock.create).not.toHaveBeenCalled()
  })
  it('rejects expired, replayed, or session-mismatched challenges', async () => {
    db.adminPasskeyChallenge.findUnique.mockResolvedValueOnce({ challenge, purpose: 'authenticate', binding: hashUnlock(session), expiresAt: new Date(0) })
    expect((await POST(request({ action: 'authenticate-verify', response: assertion() }))).status).toBe(400)
    db.adminPasskeyChallenge.findUnique.mockResolvedValueOnce({ challenge, purpose: 'authenticate', binding: 'other', expiresAt: new Date(Date.now() + 300_000) })
    expect((await POST(request({ action: 'authenticate-verify', response: assertion() }))).status).toBe(400)
    db.adminPasskeyChallenge.deleteMany.mockResolvedValueOnce({ count: 0 })
    expect((await POST(request({ action: 'authenticate-verify', response: assertion() }))).status).toBe(400)
    expect(db.adminUnlock.create).not.toHaveBeenCalled()
  })
})
