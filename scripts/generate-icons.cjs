// Generates every app icon file from build/icon.svg (run with `npm run icons`):
//   build/icon.icns  macOS (16-1024px)        build/icon.ico  Windows (16-256px)
//   build/icon.png   1024px, Linux/fallback   resources/icon.png  512px, window icon at runtime
// Each size is rendered from the vector by Chromium, so edges are as sharp as that size allows.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')

async function render(size) {
  const win = new BrowserWindow({ show: false, width: size, height: size, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  const page = path.join(os.tmpdir(), `wrench-master-icon-${size}.html`)
  fs.writeFileSync(page, `<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`)
  await win.loadFile(page)
  await new Promise((resolve) => setTimeout(resolve, 100))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  win.destroy()
  fs.rmSync(page)
  return image.resize({ width: size, height: size, quality: 'best' }).toPNG()
}

/** Windows .ico holding PNG images (supported since Vista). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4) // color planes
    header.writeUInt16LE(32, e + 6) // bits per pixel
    header.writeUInt32LE(png.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((i) => i.png)])
}

/** macOS .icns holding PNG images, by ICNS type code. */
function icns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(8 + chunks.reduce((n, c) => n + c.length, 0), 4)
  return Buffer.concat([head, ...chunks])
}

app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
  const png = {}
  for (const size of sizes) png[size] = await render(size)

  fs.writeFileSync(path.join(root, 'build', 'icon.png'), png[1024])
  fs.writeFileSync(path.join(root, 'resources', 'icon.png'), png[512])
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, png: png[size] }))))
  // icp4/5: 16/32; ic07-10: 128/256/512/1024; ic11-14: the @2x (Retina) variants of 16/32/128/256.
  const types = { icp4: 16, icp5: 32, ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512 }
  fs.writeFileSync(path.join(root, 'build', 'icon.icns'), icns(Object.entries(types).map(([type, size]) => ({ type, png: png[size] }))))
  console.log('Wrote build/icon.png, build/icon.ico, build/icon.icns, resources/icon.png')
  app.quit()
})
