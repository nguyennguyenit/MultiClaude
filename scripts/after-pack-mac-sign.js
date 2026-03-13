// afterPack hook: ad-hoc sign the entire .app bundle on macOS
// Fixes: "code has no resources but signature indicates they must be present"
// Root cause: Electron framework binaries have pre-existing signatures from upstream,
// but electron-builder with identity:null doesn't re-sign the full bundle,
// leaving inconsistent signatures that fail ShipIt validation during auto-update.
//
// Note: --requirements flag is NOT supported with ad-hoc signing (--sign -).
// Squirrel.Mac signature validation failures are handled gracefully in the updater.

import { execSync } from 'node:child_process'
import { join } from 'node:path'

/** @param {import('electron-builder').AfterPackContext} context */
export default async function afterPack(context) {
  if (process.platform !== 'darwin') return

  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )

  console.log(`[after-pack] Ad-hoc signing: ${appPath}`)

  try {
    // Deep-sign all nested frameworks/helpers with ad-hoc identity
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
    console.log('[after-pack] Ad-hoc signing complete')
  } catch (error) {
    console.error('[after-pack] Ad-hoc signing failed:', error.message)
    throw error
  }
}
