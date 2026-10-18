import { createHash, randomBytes } from 'node:crypto'
import { prisma } from './prisma'

export const UNLOCK_HEADER = 'x-admin-unlock'
export function hashUnlock(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function passkeyLockEnabled() {
  return (await prisma.adminPasskey.count()) > 0
}

export async function validUnlock(token: string | null, session: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false
  const grant = await prisma.adminUnlock.findUnique({ where: { tokenHash: hashUnlock(token) } })
  return Boolean(grant && grant.binding === hashUnlock(session) && grant.expiresAt > new Date())
}

export async function issueUnlock(session: string) {
  const token = randomBytes(32).toString('hex')
  await prisma.adminUnlock.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  await prisma.adminUnlock.create({ data: {
    tokenHash: hashUnlock(token), binding: hashUnlock(session),
    expiresAt: new Date(Date.now() + 12 * 60 * 60_000),
  } })
  return token
}
