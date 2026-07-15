import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export const DEFAULT_SHOP_SLUG = 'twins-bros'
export const SHOP_QUERY_PARAM = 'shop'

export type ShopContext = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  primaryColor: string
  bookingSubtitle: string | null
  workingPeriods: {
    dayOfWeek: number
    startTime: string
    endTime: string
  }[]
}

function normalizeShopSlug(value: string | null | undefined) {
  const slug = value?.trim().toLowerCase()
  return slug || DEFAULT_SHOP_SLUG
}

export function getShopSlugFromUrl(url: string) {
  const { searchParams } = new URL(url)
  const explicitShop = searchParams.get(SHOP_QUERY_PARAM) ?? searchParams.get('shopSlug')
  return explicitShop ? normalizeShopSlug(explicitShop) : null
}

export function getShopSlugFromFormData(formData: FormData) {
  const value = formData.get(SHOP_QUERY_PARAM) ?? formData.get('shopSlug')
  return normalizeShopSlug(typeof value === 'string' ? value : null)
}

// The admin session cookie is stored as `shopSlug:token` (see admin-auth's
// encodeSessionCookieValue). Pull the active shop straight off it so the admin
// UI never has to guess the tenant from the URL.
export function getShopSlugFromSessionCookie(
  cookieValue: string | null | undefined,
): string | null {
  if (!cookieValue) return null
  const separator = cookieValue.indexOf(':')
  const slug = separator === -1 ? cookieValue : cookieValue.slice(0, separator)
  return slug ? normalizeShopSlug(slug) : null
}

export async function getShopBySlug(slug: string): Promise<ShopContext | null> {
  return prisma.shop.findUnique({
    where: { slug: normalizeShopSlug(slug) },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      bookingSubtitle: true,
      workingPeriods: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  })
}

function normalizeHostname(value: string | null | undefined) {
  return value
    ?.split(',')[0]
    ?.trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
}

export async function getShopByHostname(
  hostname: string | null | undefined,
): Promise<ShopContext | null> {
  const normalized = normalizeHostname(hostname)
  if (!normalized || normalized === 'localhost' || normalized === '127.0.0.1') {
    return null
  }

  const domain = await prisma.shopDomain.findUnique({
    where: { hostname: normalized },
    select: {
      shop: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          bookingSubtitle: true,
          workingPeriods: {
            select: { dayOfWeek: true, startTime: true, endTime: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
      },
    },
  })

  return domain?.shop ?? null
}

export async function resolveShop(options: {
  explicitSlug?: string | null
  hostname?: string | null
}): Promise<ShopContext | null> {
  if (options.explicitSlug) return getShopBySlug(options.explicitSlug)

  const shopByHostname = await getShopByHostname(options.hostname)
  if (shopByHostname) return shopByHostname

  return getShopBySlug(DEFAULT_SHOP_SLUG)
}

// The booking page and its metadata need the same shop. React cache keeps that
// lookup to one database request during a single server render.
export const resolveBookingPageShop = cache(
  (explicitSlug: string | null, hostname: string | null) =>
    resolveShop({ explicitSlug, hostname }),
)

export async function requireShop(request: Request): Promise<
  | { shop: ShopContext; response?: never }
  | { shop?: never; response: Response }
> {
  const url = new URL(request.url)
  const shop = await resolveShop({
    explicitSlug: getShopSlugFromUrl(request.url),
    hostname: request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host,
  })

  if (!shop) {
    return {
      response: Response.json({ error: 'Shop not found' }, { status: 404 }),
    }
  }

  return { shop }
}

export function withShopParam(path: string, shopSlug: string) {
  const url = new URL(path, 'http://local')
  url.searchParams.set(SHOP_QUERY_PARAM, normalizeShopSlug(shopSlug))
  return `${url.pathname}${url.search}`
}
