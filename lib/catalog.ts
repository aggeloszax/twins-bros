// Groups services by category, in order of first appearance; services with
// no category come last. Shared by the booking page and the admin.
export function groupByCategory<T extends { category: string | null }>(items: T[]) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = item.category ?? ''
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups].sort(([a], [b]) => Number(a === '') - Number(b === ''))
}
