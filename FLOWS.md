# Paperbridge acceptance flows

These checks describe the shipped application-filling workflow. This file is not deployed with the preview.

## Private workspace

- Start: installed extension, new browser profile.
- Steps: create a passphrase, add fictional text, lock, reject a wrong passphrase, unlock again.
- Expect: documents and settings survive encrypted; no plaintext document or API key appears in extension storage.

## Optional background material

- Start: Background.
- Steps: import a text resume, inspect its extracted text, select or deselect it, save personal notes, remove a document with confirmation.
- Expect: only selected context appears in an outgoing request; no document editor or PDF-filling workflow is added.

## Existing AI chat handoff

- Start: a scanned application, AI chat website mode.
- Steps: use existing chat context, prepare the form prompt without importing a document, copy it, paste a fictional JSON reply into Review answers.
- Expect: no requirement to recreate documents in the extension; chat-derived facts are visibly not locally verified.

## Application scan

- Start: a regular application page.
- Steps: select it with the toolbar, scan native fields, inspect the page and section labels.
- Expect: hidden fields, passwords, uploads, signatures, and declarations are not automated; changed pages and fields are rejected.

## Workday-style controls

- Start: a synthetic Workday-style multistep form, without using the user's private screenshot as an asset.
- Steps: scan button-based dropdowns; explicitly read options; fill reviewed exact choices.
- Expect: the correct newly opened or aria-associated listbox is used, including portal menus and inner option click targets; no Save and Continue, Next, Add, Submit, or agreement button is clicked.

## User-provided eligibility and employer answers

- Start: Saved answers or a scanned eligibility question.
- Steps: explicitly save age eligibility, work authorization, sponsorship, or a former-employer answer; return to Review.
- Expect: no default Yes/No, no AI inference, exact question and optional site/section matching, fresh approval required for each application.

## Work and education history

- Start: visible repeated work-history and education sections.
- Steps: scan multiple job/school entries, review AI answers prepared from existing chat or selected resume context, fill dates and fields.
- Expect: section number and From/To labels distinguish repeated fields; unsupported searchable taxonomy widgets stay manual; users add entries and advance pages themselves.

## Review, edit, fill, undo

- Start: Review answers.
- Steps: validate model JSON, reject unknown or duplicate IDs, edit a value, approve selected answers, confirm the target, fill, undo.
- Expect: no defaults to approved; existing values and post-scan edits are preserved; per-field failures are visible; undo does not clobber user edits.

## AI connection options

- Start: AI connection.
- Steps: switch among ChatGPT account, API provider, and chat website.
- Expect: API base/provider changes clear old keys; unsupported host permissions fail cleanly; ChatGPT official registration is mocked in tests and never claimed to be live-authenticated.

## Presentation and delivery

- Start: every page at desktop width and 375px width.
- Steps: navigate all sections, open dialogs, inspect console, test the deployed fictional preview in a fresh context.
- Expect: no horizontal page overflow, no new console errors, preview clearly labeled, no private user data or credentials in deployment or archive.

## DOM and framework boundaries

- Start: synthetic frame/shadow, sensitive-dropdown, and actual React-controlled fixtures.
- Steps: scan and fill through the workspace; inspect the framework's displayed state; undo; inspect manual-only rows.
- Expect: same-origin frames/open shadows work, protected frames are reported, sensitive choices remain manual, React state matches filled values, and an originally unselected radio group reports its undo limitation.

## Exploratory checks

- Change a field's DOM identity between scanning and filling; expect a visible skip rather than a write.
- Manually edit a filled value before undo; expect it to remain untouched.
- Switch views after scrolling to the bottom; expect the next section to start at its heading.
- Resize the same preview from desktop to 375px and back; expect navigation, dialogs, and selected modes to stay usable.

## Delivery checks

- Extract the final ZIP to a fresh directory, verify all recorded hashes, and open its actual built extension.
- Confirm the packaged manifest has no test host permission and the archive contains no browser profiles, session files, private screenshot, credentials, or node_modules.
- Start the packaged helper with an isolated temporary configuration and check only its loopback health response, without authentication.
- Open the deployed fictional preview in a fresh browser context and exercise scan, draft, approval, simulated fill, and undo.
