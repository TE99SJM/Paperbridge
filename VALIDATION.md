# v1.0.2 validation

Base: latest 1.0.1 at `d1ad47c43bef5a1b3919e5ee1a03c4a5ea77b5dc` (includes the Chromium paragraph-rendering fix). No vault-format migration or credential changes.

## Local automated results

- 44 unit / protocol tests passed, including native toolbar opening, ChatGPT target preservation, Opera dock routing, unauthorized-frame rejection and write-lease revocation.
- Build passed for extension, scanner, background, helper and practice fixtures.
- Browser ChatGPT fixture passed using available Chromium 153 headless shell: composer insertion, multiline verification, single send, streaming wait, response collection, cleanup and draft preservation.
- Browser DOM/preview tests passed at 320, 375 and 420px across five views; backup controls remain reachable. Dock insertion, toggle/removal and margin restoration passed.
- Both ZIP packaging checks passed: CRC, per-file SHA-256, root manifest, exact runtime parity, no permanent host grants, no QA credentials/profile or test permissions.
- Dependency audit: zero known vulnerabilities.

## CI and installed extension checks

The default Playwright Chromium download in this environment returned a truncated archive. The available Chromium headless shell does not load extension service workers, so the installed-extension acceptance suite and extracted-package native-panel checks cannot run locally. This is an environment limitation, not a passing result.

The draft pull request runs the existing Build and test workflow with full Playwright Chromium. It runs unit tests, builds, browser acceptance (including dropdowns, existing values, frameworks, undo, documents and vault operations), packages both downloads and loads/unlocks each extracted production package. v1.0.2 adds native sidePanel open/close from a real click gesture. An API-open success is not a visual inspection of the browser's native panel chrome. Check the draft PR's current CI result before relying on those results.

## Live Opera GX checks still needed

No live Opera GX or signed-in ChatGPT session was tested here. In particular, validate GX's MV3 manifest handling, activeTab grant and iframe permissions, vault persistence after reload, dock placement on the real application, and its site CSP/fixed layouts. The DOM dock is explicitly distinct from Opera's native sidebar.

Test one step at a time: first export an encrypted backup from the existing installation. Then update the same folder/card, confirm the same extension ID, open a harmless test form, verify the dock, unlock the old vault, scan, select a ChatGPT tab, run with fictional data, switch tabs and confirm target retention. Close during reply generation and confirm no later writes; reopen and explicitly start a fresh run. Test Cancel and Undo; confirm existing fields and Submit/Next stay untouched. No real application submission is part of testing.
