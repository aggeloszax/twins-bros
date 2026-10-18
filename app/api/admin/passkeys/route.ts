import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { isValidSessionToken, readSessionCookie, requireAdmin, verifyAdminPassword } from '@/lib/admin-auth'
import { hashUnlock, issueUnlock, passkeyLockEnabled, UNLOCK_HEADER } from '@/lib/admin-unlock'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const CHALLENGE_COOKIE = 'twins_passkey_challenge'
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/admin/passkeys', maxAge: 300 }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

function originFor(request: Request) {
  const url = new URL(request.url)
  const origin = process.env.ADMIN_PASSKEY_ORIGIN ||
    (process.env.NODE_ENV !== 'production' && url.hostname === 'localhost' ? url.origin : 'https://barber-booking-gr.vercel.app')
  return { origin, rpID: new URL(origin).hostname }
}

async function saveChallenge(challenge: string, purpose: string, session: string) {
  await prisma.adminPasskeyChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return prisma.adminPasskeyChallenge.create({ data: {
    id: randomBytes(32).toString('hex'), challenge, purpose,
    binding: hashUnlock(session), expiresAt: new Date(Date.now() + 300_000),
  } })
}

async function consumeChallenge(request: Request, purpose: string, session: string) {
  const id = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${CHALLENGE_COOKIE}=`))?.slice(CHALLENGE_COOKIE.length + 1)
  if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new Error('Missing challenge')
  const challenge = await prisma.adminPasskeyChallenge.findUnique({ where: { id } })
  if (!challenge || challenge.purpose !== purpose || challenge.binding !== hashUnlock(session) || challenge.expiresAt <= new Date()) throw new Error('Expired challenge')
  // Atomic consumption prevents concurrent requests from replaying a challenge.
  const consumed = await prisma.adminPasskeyChallenge.deleteMany({ where: { id } })
  if (consumed.count !== 1) throw new Error('Used challenge')
  return challenge.challenge
}

export async function GET(request: Request) {
  if (!(await isValidSessionToken(readSessionCookie(request)))) return json({ error: 'Access Denied' }, 401)
  return json({ enabled: await passkeyLockEnabled() })
}

export async function POST(request: Request) {
  const session = readSessionCookie(request)
  if (!session || !(await isValidSessionToken(session))) return json({ error: 'Access Denied' }, 401)
  const { origin, rpID } = originFor(request)
  if (request.headers.get('origin') !== origin) return json({ error: 'Invalid origin' }, 403)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.action !== 'string') return json({ error: 'Invalid request' }, 400)

  if (body.action === 'lock') {
    const token = request.headers.get(UNLOCK_HEADER)
    if (token) await prisma.adminUnlock.deleteMany({ where: { tokenHash: hashUnlock(token), binding: hashUnlock(session) } })
    return json({ ok: true })
  }

  const limited = await rateLimit(`admin-passkeys:${getClientIp(request.headers)}:${body.action === 'password' || body.action === 'register-options' || body.action === 'disable' ? 'password' : 'webauthn'}`, {
    limit: body.action === 'password' || body.action === 'register-options' || body.action === 'disable' ? 5 : 40,
    windowMs: 15 * 60_000,
  })
  if (!limited.allowed) return json({ error: 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.' }, 429)

  try {
    if (body.action === 'password' || body.action === 'register-options' || body.action === 'disable') {
      if (typeof body.password !== 'string' || !(await verifyAdminPassword(body.password)).valid) {
        return json({ error: 'Ο κωδικός διαχείρισης είναι λάθος.' }, 403)
      }
    }
    if (body.action === 'password') return json({ token: await issueUnlock(session) })

    if (body.action === 'disable' || body.action === 'register-options') {
      const denied = await requireAdmin(request)
      if (denied) return denied
    }

    if (body.action === 'disable') {
      await prisma.$transaction([
        prisma.adminPasskey.deleteMany(), prisma.adminPasskeyChallenge.deleteMany(), prisma.adminUnlock.deleteMany(),
      ])
      return json({ enabled: false })
    }

    if (body.action === 'register-options') {
      const keys = await prisma.adminPasskey.findMany({ select: { id: true } })
      const options = await generateRegistrationOptions({
        rpName: 'Twins Bros Admin', rpID, userName: 'Twins Bros Admin',
        // A different user handle lets additional devices create independent passkeys.
        userID: new Uint8Array(randomBytes(32)),
        attestationType: 'none', excludeCredentials: keys.map(k => ({ id: k.id })),
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
      })
      const challenge = await saveChallenge(options.challenge, 'register', session)
      const response = json(options)
      response.cookies.set(CHALLENGE_COOKIE, challenge.id, cookieOptions)
      return response
    }

    if (body.action === 'register-verify') {
      // The single-use registration challenge proves the password-verified
      // authorization from register-options, even if the OS prompt hid the tab.
      const expectedChallenge = await consumeChallenge(request, 'register', session)
      const result = await verifyRegistrationResponse({
        response: body.response as RegistrationResponseJSON, expectedChallenge,
        expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      })
      if (!result.verified || !result.registrationInfo) throw new Error('Registration failed')
      const credential = result.registrationInfo.credential
      await prisma.adminPasskey.create({ data: {
        id: credential.id, publicKey: Buffer.from(credential.publicKey), counter: BigInt(credential.counter),
      } })
      const response = json({ token: await issueUnlock(session) })
      response.cookies.set(CHALLENGE_COOKIE, '', { ...cookieOptions, maxAge: 0 })
      return response
    }

    if (body.action === 'authenticate-options') {
      const keys = await prisma.adminPasskey.findMany({ select: { id: true } })
      if (!keys.length) return json({ error: 'Δεν έχει ενεργοποιηθεί passkey.' }, 400)
      const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: keys.map(k => ({ id: k.id })) })
      const challenge = await saveChallenge(options.challenge, 'authenticate', session)
      const response = json(options)
      response.cookies.set(CHALLENGE_COOKIE, challenge.id, cookieOptions)
      return response
    }

    if (body.action === 'authenticate-verify') {
      const expectedChallenge = await consumeChallenge(request, 'authenticate', session)
      const assertion = body.response as AuthenticationResponseJSON
      if (typeof assertion?.id !== 'string') throw new Error('Invalid assertion')
      const key = await prisma.adminPasskey.findUnique({ where: { id: assertion.id } })
      if (!key) throw new Error('Unknown key')
      const result = await verifyAuthenticationResponse({
        response: assertion, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
        requireUserVerification: true,
        credential: { id: key.id, publicKey: new Uint8Array(key.publicKey), counter: Number(key.counter) },
      })
      if (!result.verified) throw new Error('Authentication failed')
      const updated = await prisma.adminPasskey.updateMany({
        where: { id: key.id, counter: key.counter }, data: { counter: BigInt(result.authenticationInfo.newCounter) },
      })
      if (updated.count !== 1) throw new Error('Credential changed')
      const response = json({ token: await issueUnlock(session) })
      response.cookies.set(CHALLENGE_COOKIE, '', { ...cookieOptions, maxAge: 0 })
      return response
    }
    return json({ error: 'Invalid action' }, 400)
  } catch {
    return json({ error: 'Η επαλήθευση δεν ολοκληρώθηκε. Δοκίμασε ξανά.' }, 400)
  }
}
