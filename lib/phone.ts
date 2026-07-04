export function toNumericPhoneInput(value: string) {
  return value.replace(/\D/g, '')
}

// Browser autofill (Google) often injects the full international number even
// when we ask for the national part, and can even stack the country code more
// than once (e.g. "+30 +30 69..."). Strip every leading country-code variation
// (+30 / 0030 / 30) down to the bare 10-digit national number. Greek mobiles
// start with 69, never 30, so this never eats into the subscriber number.
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

// Keeps the visible input clean: returns just the national digits, so autofill's
// leading "+30"/"0030" never stacks on top of the fixed "+30" prefix we render.
export function toNationalPhoneInput(value: string) {
  return stripLeadingGreekCountryCode(toNumericPhoneInput(value))
}

export function normalizeGreekMobilePhone(value: string) {
  const digits = stripLeadingGreekCountryCode(toNumericPhoneInput(value))

  if (!/^\d{10}$/.test(digits)) return null

  return `+30${digits}`
}
