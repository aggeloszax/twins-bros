// Builds the app icons (admin home-screen app, notifications) from the shop
// logo. Run after changing public/logo.webp: node scripts/make-icons.mjs
import sharp from 'sharp'

const SOURCE = 'public/logo.webp'
const icons = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
]

for (const { file, size } of icons) {
  // A white square with the logo inset, so round logos look right on iOS.
  const inner = Math.round(size * 0.86)
  const logo = await sharp(SOURCE).resize(inner, inner, { fit: 'contain', background: '#ffffff' }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(file)
  console.log('wrote', file)
}
