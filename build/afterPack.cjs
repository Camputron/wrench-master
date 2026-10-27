// Runs after electron-builder packages the app for each platform/architecture.
// better-sqlite3 ships prebuilt binaries for every OS; keep only the one this build targets
// (e.g. win32-x64.node). Fails the build if that binary is missing, rather than shipping an app
// that can't open its database.
const fs = require('fs')
const path = require('path')
const { Arch } = require('builder-util')

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName // darwin | win32 | linux
  const arch = Arch[context.arch] // x64 | arm64 | ...
  const resources = platform === 'darwin' ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources') : path.join(context.appOutDir, 'resources')
  const dir = path.join(resources, 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'prebuilds')
  const keep = `${platform}-${arch}.node`
  if (!fs.existsSync(path.join(dir, keep))) throw new Error(`better-sqlite3 has no prebuilt binary for ${platform}-${arch} (looked for ${path.join(dir, keep)})`)
  for (const file of fs.readdirSync(dir)) if (file !== keep) fs.rmSync(path.join(dir, file))
  console.log(`  • kept better-sqlite3 binary ${keep}`)
}
