# Paperbridge validation record

This record distinguishes tested local behavior from unverified real-service compatibility. All application data used for testing was fictional; no user account was authorized, no paid AI request was made, and no real application was submitted.

## Executed checks

- **Build:** `npm run build` completed with locally bundled extension scripts, optional helper, icons/fonts, and practice fixtures.
- **Unit/protocol tests:** `npm test` passed 37 tests covering vault encryption/authentication, prompt boundaries, answer parsing, eligibility rejection, scoped saved answers, option validation, provider adapters, and mocked helper authorization/streaming.
- **Browser acceptance:** `npm run test:browser` passed 14 grouped checks using Chromium 145.0.7632.6 on Linux. Earlier interactive checks also ran in Chromium 147.0.7727.15.
- **Dependency audit:** Full and production-only npm audits reported zero known vulnerabilities at the time checked on 2026-10-29. This is a point-in-time database result, not proof that the code is vulnerability-free.
- **Runtime:** Build/test environment used Node.js 20.20.2 and npm 10.8.2. End users should install a maintained LTS release for optional helper or source-building work.
- **Archive integrity:** `npm run package` verified required files, production manifest permissions, ZIP CRCs, and byte-for-byte file hashes. The archive includes an internal `CHECKSUMS.sha256`, with a separate archive SHA-256 file alongside the ZIP.
- **Extracted release:** `npm run verify:release` checked every file listed in the full archive's internal checksums, loaded the actual packaged extension without a QA host-permission modification, and created/unlocked a fictional vault. The packaged helper passed an isolated loopback-only health check without account authorization.
- **Clean source rebuild:** In a fresh extraction, `npm ci`, all 37 unit/protocol tests, and `npm run build` completed successfully. Users of the ready-built extension do not need to perform these development steps.
- **Deployed demonstration:** The separately deployed fictional preview was opened in a fresh browser context. Scan, draft selection, simulated fill, undo, blank eligibility templates, five narrow-layout sections, disabled live sign-in, and an outbound documentation link worked without application console errors.

## Simplified personal-install package

On 2026-10-29, a separate `Paperbridge-Local-Install-v0.0.1.zip` was prepared for direct personal installation. Its `manifest.json` is at the ZIP root, so the folder created by Windows extraction is the folder to select in Opera's Load unpacked dialog.

- **Runtime preservation:** All 201 runtime files matched the existing full release byte-for-byte. No extension functionality, permissions, or UI was changed.
- **Contents:** The archive contains 206 files, including installation instructions, privacy/security notes, licensing, and internal checksums. It excludes the source project, optional helper, practice server, QA screenshots, browser profiles, and `node_modules`.
- **Integrity:** ZIP CRCs and all 205 internal file hashes were checked. Each release build has an adjacent `.zip.sha256` file containing its exact archive hash; documentation changes or repackaging can change that hash without changing the extension runtime.
- **Fresh checks:** `npm test` passed all 37 tests again. `npm run verify:local` loaded the extracted production extension, created a fictional vault, and reached the Application screen; its screenshot was inspected.
- **Regression check:** `npm run verify:release` still passed for the original full archive, including its isolated helper health check.
- **Remaining local check:** These checks ran in Chromium, not the user's Opera GX. No real AI login or application submission was performed.

## Browser behavior exercised

- **Workspace:** Create a vault; start on Application; preserve encrypted state; reject a wrong passphrase; lock/unlock; export, reset, and restore a verified encrypted backup.
- **Existing-chat handoff:** Prepare and copy a prompt without local documents; paste a synthetic chat reply; reject unknown field IDs; label chat evidence not locally verified.
- **Native inputs:** Fill text, email, telephone, textarea, select, number, date, checkbox, and radio controls after UI approval and confirmation.
- **Preservation:** Leave existing values alone by default; allow a reviewed overwrite; reject changed DOM identity; preserve later manual edits during undo.
- **Workday-style fixture:** Read and fill portal dropdowns, an inner-option click target, separate repeated job/school fields, and From/To month/year inputs.
- **Saved answers:** Start eligibility fields blank; add, edit, delete, scope, and reuse explicit user answers; revoke prior approval on reuse; keep templates answer-free.
- **React state:** Verify that actual React-controlled text/select/checkbox/radio state changes, not just displayed DOM properties. Test restoration of a previous radio choice and the explicit limitation for originally unselected radio groups.
- **Protected fields:** Leave uploads, signatures, agreements, hidden/readonly controls, ambiguous options, and searchable taxonomy widgets alone.
- **DOM boundaries:** Fill supported same-origin iframe and open-shadow inputs; report a protected embedded frame; reclassify a dropdown as manual after reading sensitive option labels.
- **No unintended actions:** Fixture counters stayed zero for Submit, Save and Continue, Add, and an unrelated visible menu.
- **Provider settings:** Switch connection modes and ensure provider/base changes clear the old API key; import/review/select/remove fictional TXT background.
- **Error/network checks:** No browser console/page errors or real provider requests occurred during the acceptance run.
- **Fictional preview:** Scan, sample drafting, selection, simulated fill, undo, all five sections, and disabled live-account controls passed through the UI.

## Interactive and visual checks

The current build was inspected at 1280×900, 375×812, and a short 1280×540 window. All five sections had no page-level horizontal overflow, and the same page remained usable when resized from desktop to narrow layout and back.

- **States inspected:** Startup, populated review, manual-only fields, saved-answer and fill dialogs, help, optional background, and all three AI-connection modes.
- **Readability:** Computed small-text checks found no sub-12px labels or below-4.5:1 active text in the tested section/mode states after the final styling fixes. Disabled controls were excluded from the contrast threshold; this was not a full accessibility audit.
- **Exploratory controls:** Clear and restore selections, dismiss dialogs with Escape, navigate after scrolling, scroll the short-window sidebar, inspect the bottom of a dense review, and locate a real practice-page field by its highlight.
- **Documentation navigation:** Representative links opened their intended provider destinations from both the preview and installed extension. The billing destination presented a browser anti-bot challenge, so that click check does not claim verification of its rendered article content.

Visual inspection found no unintended horizontal scrolling, overlapping dialog actions, or inaccessible short-window sidebar controls in the checked states. Long forms and dialog bodies intentionally scroll; the preview uses only fictional data and cannot fill real browser tabs.

These grouped checks include multiple assertions; they are not a claim of exhaustive testing across every website. Test source and fixtures are included so you can rerun and extend them.

## Test harness caveat

Headless browser testing uses a copied manifest with a localhost-only host permission and stages the selected practice tab in session storage. This exercises the actual workspace controls and isolated scanner/filler, but it does not reproduce a person's Opera toolbar click granting `activeTab`.

The installed release manifest contains no permanent host permissions. QA copies, browser profiles, screenshots, backups, logs, and dependency folders are excluded from the release archive.

## Not tested or not promised

- **Opera GX on your computer:** Actual install, toolbar permission grant, and OS-specific behavior need a local smoke test.
- **Live employer applications:** Workday-style fixtures are synthetic, not a certification of compatibility with a specific tenant or employer. No real application answers, screenshots, or account data are included in the public source or release assets.
- **Live AI accounts:** Real ChatGPT OAuth, model availability, token refresh/revocation, provider billing, CORS/policy behavior, and paid inference remain untested. Protocol tests use mocked services.
- **Windows/macOS helper:** Launchers and Windows DPAPI code are provided, but were not run on those operating systems.
- **Every custom widget:** Virtualized/searchable controls, unrecognized listboxes, closed shadow roots, cross-origin frames, inaccessible pages, and site-specific validation may require manual entry.
- **All optional file formats:** The browser acceptance suite exercised TXT import. PDF/DOCX extraction code is bundled but was not comprehensively validated against real resume layouts; images/OCR and PDF form filling are not implemented.
- **Security certification:** No penetration test, independent audit, or guarantee against malicious websites/local malware is claimed.

## Local smoke test before real use

Install the extension in Opera GX and start the fictional practice server from `START_HERE.md` if you downloaded the full project bundle. Fill two made-up fields, check that no submit/navigation action occurred, try undo, and confirm your vault can lock and unlock.

On a real application, begin with a small non-sensitive section and verify the results yourself. Complete unsupported controls and final submission manually, and stop if a page behaves unexpectedly.
