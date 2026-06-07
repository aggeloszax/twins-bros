export function toNumericPhoneInput(value: string) {
  return value.replace(/\D/g, '')
}

export function normalizeGreekMobilePhone(value: string) {
  let digits = toNumericPhoneInput(value)

  if (digits.startsWith('0030')) {
    digits = digits.slice(4)
  } else if (digits.startsWith('30')) {
    digits = digits.slice(2)
  }

  if (!/^\d{10}$/.test(digits)) return null

  return `+30${digits}`
}
