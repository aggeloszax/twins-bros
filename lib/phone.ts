export function toNumericPhoneInput(value: string) {
  return value.replace(/\D/g, '')
}

function stripLeadingGreekCountryCode(digits: string) {
  let previous: string

  do {
    previous = digits
    if (digits.startsWith('0030')) {
      digits = digits.slice(4)
    } else if (digits.startsWith('30')) {
      digits = digits.slice(2)
    }
  } while (digits !== previous && digits.length > 10)

  return digits
}

export function toNationalPhoneInput(value: string) {
  return stripLeadingGreekCountryCode(toNumericPhoneInput(value)).slice(0, 10)
}

export function normalizeGreekMobilePhone(value: string) {
  const digits = stripLeadingGreekCountryCode(toNumericPhoneInput(value))

  if (!/^69\d{8}$/.test(digits)) return null

  return `+30${digits}`
}
