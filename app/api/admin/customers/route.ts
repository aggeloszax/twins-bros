import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeGreekMobilePhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'

const CUSTOMER_SELECT = { phone: true, notes: true, blocked: true, blockedReason: true } as const
const MAX_NOTES = 1000

type UpdateCustomerPayload = {
  phone?: unknown
  name?: unknown
  newPhone?: unknown
  email?: unknown
  notes?: unknown
  blocked?: unknown
  blockedReason?: unknown
}

function optionalText(value: unknown, max: number): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' || value.length > max) return false
  return value.trim() || null
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    return Response.json(await prisma.customer.findMany({ select: CUSTOMER_SELECT }))
  } catch (error) {
    console.error('Failed to fetch customers:', error)
    return Response.json({ error: 'Η φόρτωση των πελατών απέτυχε.' }, { status: 500 })
  }
}

// Updates a customer, identified by the phone stored on their bookings.
// Name, phone and email are rewritten on every booking of the customer;
// notes and blocking live on the Customer profile.
export async function PATCH(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let payload: UpdateCustomerPayload
  try {
    payload = (await request.json()) as UpdateCustomerPayload
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (typeof payload.phone !== 'string' || !payload.phone) {
    return Response.json({ error: 'Λείπει το κινητό του πελάτη.' }, { status: 400 })
  }
  const phone = payload.phone

  const notes = optionalText(payload.notes, MAX_NOTES)
  const blockedReason = optionalText(payload.blockedReason, 200)
  if (notes === false || blockedReason === false) {
    return Response.json({ error: 'Το κείμενο είναι πολύ μεγάλο.' }, { status: 400 })
  }
  if (payload.blocked !== undefined && typeof payload.blocked !== 'boolean') {
    return Response.json({ error: 'Invalid blocked value' }, { status: 400 })
  }

  let name: string | undefined
  if (payload.name !== undefined) {
    if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length > 100) {
      return Response.json({ error: 'Συμπλήρωσε όνομα.' }, { status: 400 })
    }
    name = payload.name.trim()
  }

  let email: string | null | undefined
  if (payload.email !== undefined) {
    const value = typeof payload.email === 'string' ? payload.email.trim() : payload.email
    if (value === null || value === '') email = null
    else if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200) email = value
    else return Response.json({ error: 'Μη έγκυρο email.' }, { status: 400 })
  }

  let newPhone: string | undefined
  if (payload.newPhone !== undefined) {
    const normalized = typeof payload.newPhone === 'string' ? normalizeGreekMobilePhone(payload.newPhone) : null
    if (!normalized) {
      return Response.json({ error: 'Το κινητό πρέπει να ξεκινά από 69 και να έχει 10 ψηφία.' }, { status: 400 })
    }
    newPhone = normalized
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const finalPhone = newPhone ?? phone

      if (name !== undefined || email !== undefined || finalPhone !== phone) {
        await tx.booking.updateMany({
          where: { customerPhone: phone },
          data: {
            ...(name !== undefined ? { customerName: name } : {}),
            ...(email !== undefined ? { customerEmail: email } : {}),
            ...(finalPhone !== phone ? { customerPhone: finalPhone } : {}),
          },
        })
      }

      // Moving to a phone that already has a profile merges the two.
      const previous = await tx.customer.findUnique({ where: { phone }, select: CUSTOMER_SELECT })
      let merged = previous
      if (finalPhone !== phone) {
        if (previous) await tx.customer.delete({ where: { phone } })
        const target = await tx.customer.findUnique({ where: { phone: finalPhone }, select: CUSTOMER_SELECT })
        merged = target && previous
          ? {
              phone: finalPhone,
              notes: [target.notes, previous.notes].filter(Boolean).join('\n') || null,
              blocked: target.blocked || previous.blocked,
              blockedReason: target.blockedReason ?? previous.blockedReason,
            }
          : (target ?? previous)
      }

      const data = {
        notes: notes !== undefined ? notes : (merged?.notes ?? null),
        blocked: typeof payload.blocked === 'boolean' ? payload.blocked : (merged?.blocked ?? false),
        blockedReason: blockedReason !== undefined ? blockedReason : (merged?.blockedReason ?? null),
      }
      if (!data.blocked) data.blockedReason = null

      return tx.customer.upsert({
        where: { phone: finalPhone },
        create: { phone: finalPhone, ...data },
        update: data,
        select: CUSTOMER_SELECT,
      })
    })

    return Response.json(customer)
  } catch (error) {
    console.error('Failed to update customer:', error)
    return Response.json({ error: 'Η αποθήκευση του πελάτη απέτυχε.' }, { status: 500 })
  }
}
