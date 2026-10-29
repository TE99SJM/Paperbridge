# Paperbridge changelog

This file records user-visible changes to Paperbridge. Release archives include their own checksums; documentation-only repackaging can change an archive hash without changing the runtime version.

## v1.0.2 · 2026-10-29 (unreleased)

- Replace the separate popup window with a native Chromium side panel or explicit Opera GX in-page dock; no window fallback.
- Preserve all fixes through latest 1.0.1 commit d1ad47c and its automatic dual-tab workflow; keep ChatGPT from becoming the target.
- Add revocable panel write leases, narrow-width navigation and backup controls, and reopening access to last-fill undo.
- Update workspace, manifest, package and helper identifiers, packaging assertions and installation instructions.
- Keep encrypted vault format and existing-value safeguards unchanged. Never submit or click Next.
- This branch is for testing; no release is published.

## v0.0.2 (formerly v1.0.1) · 2026-10-29

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
