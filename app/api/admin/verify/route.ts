export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { password } = await request.json() as { password: string }

  if (password === process.env.ADMIN_PASSWORD) {
    return Response.json({ success: true })
  }

  return Response.json({ success: false }, { status: 401 })
}
