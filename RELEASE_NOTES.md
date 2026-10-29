# Paperbridge v0.0.2

Paperbridge helps fill application webpages using your existing AI conversation and answers you explicitly approve. It does not automatically read your chat history or submit an application.

## Choose a download

- **Paperbridge-Local-Install-v0.0.2.zip:** Recommended for normal personal use. Extract it, then load the extracted folder containing `manifest.json`; no Node.js, API key, or helper is needed for AI chat website mode.
- **Paperbridge-Opera-GX-v0.0.2.zip:** Full project bundle, including the ready-built extension, editable source, optional helper, practice pages, and tests. Load its inner `extension` folder.
- **Adjacent SHA-256 files:** Use the matching `.zip.sha256` asset to verify a downloaded archive. Both ZIPs also contain internal file checksums.

GitHub's automatic “Source code” ZIP/tar.gz downloads are not prebuilt extension packages. Use one of the named release assets above unless you plan to run the source build.

## Install and start

1. Extract the selected ZIP into a permanent folder.
2. In Opera GX's address bar, enter `opera://extensions`.
3. Enable Developer mode and use Load unpacked to select the folder with `manifest.json` directly inside it ([Opera Help](https://help.opera.com/en/extensions/testing/)).
4. Open an application webpage, click Paperbridge's toolbar icon, and create a local passphrase of at least 12 characters.
5. Leave AI chat website selected, scan visible fields, and prepare a prompt for the AI conversation that already has your background.
6. Paste the AI's JSON reply back into Review answers, validate, inspect, and approve the values before filling.

Do not use the Opera Add-ons publishing website or select an outer project folder. If the manifest is missing, check the folder level rather than adding or renaming files.

## Validation and limits

The local checks cover 37 unit/protocol tests, 14 grouped browser acceptance checks, and loading/unlocking both extracted production packages in Chromium. These tests use fictional forms and mock AI services, not real account authorization or application submission.

Actual Opera GX installation and behavior on a particular employer's website still require a local check. Complete unsupported controls yourself, supply eligibility and employer-permission answers personally, and verify every filled value before manually continuing or submitting.
