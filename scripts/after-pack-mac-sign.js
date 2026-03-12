// afterPack hook: ad-hoc sign the entire .app bundle on macOS
// Fixes: "code has no resources but signature indicates they must be present"
// Root cause: Electron framework binaries have pre-existing signatures from upstream,
// but electron-builder with identity:null doesn't re-sign the full bundle,
// leaving inconsistent signatures that fail ShipIt validation during auto-update.

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
    // Step 1: Deep-sign all nested frameworks/helpers with ad-hoc identity
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })

    // Step 2: Re-sign only the outer .app with a stable Designated Requirement (DR).
    // Without this, the DR defaults to `cdhash H"<binary-hash>"` which is unique per
    // build. ShipIt (Squirrel.Mac) validates the new update against the RUNNING app's
    // DR — a hash-based DR always fails because the update binary has a different hash.
    // Setting DR to `identifier "com.multiclaude.app"` makes ShipIt only check the
    // bundle identifier, which stays constant across versions.
    execSync(
      `codesign --force --sign - \
        --requirements 'designated => identifier "com.multiclaude.app"' \
        "${appPath}"`,
      { stdio: 'inherit' }
    )
    console.log('[after-pack] Ad-hoc signing with stable DR complete')
  } catch (error) {
    console.error('[after-pack] Ad-hoc signing failed:', error.message)
    throw error
  }
}
