# Paperbridge changelog

This file records user-visible changes to Paperbridge. Release archives include their own checksums; documentation-only repackaging can change an archive hash without changing the runtime version.

## Version renumbering · 2026-10-29

- Set this code line’s internal version to `0.0.2`.
- Renumber the baseline as `0.0.1`, dual-tab update as `0.0.2`, and planned sidebar update as `0.0.3`.
- Generated package names, workspace version, manifest, helper, and documentation follow the new numbering. Historical published downloads keep their existing names until separately replaced.

## v0.0.2 · 2026-10-29

- Add the experimental automatic ChatGPT dual-tab filling workflow, without form submission.
- Update extension, workspace, package, and helper version identifiers to 0.0.2.
- This branch is for testing; no 0.0.2 release has been published.

## v0.0.1 · 2026-10-29

- **First release:** A review-first Opera GX/Chromium extension for application webpages, including work history, education, and supported employer questions.
- **Existing AI chat:** A copy-and-paste prompt/JSON workflow that reuses background already in an AI conversation without scraping the chat or uploading the same documents again.
- **User control:** Per-answer review and approval, conservative preservation and undo, manual eligibility statements, and no automatic submission or navigation.
- **Saved answers:** Exact-question matching, optional site/section scope, conflict rejection, and fresh approval on every application.
- **Local workspace:** An encrypted vault, inactivity locking, and encrypted backup/restore.
- **Optional integrations:** Provider API adapters, local-model support, and a separately bundled ChatGPT account helper; real account authorization and paid inference remain untested.
- **Downloads:** A recommended root-manifest personal-install ZIP and a separate full project ZIP with source, helper, fictional practice pages, and tests.
- **Repository:** Installation troubleshooting, privacy/security documentation, contribution guidance, and automated build, test, audit, and package checks.
