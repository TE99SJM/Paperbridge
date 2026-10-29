# Paperbridge privacy and data handling

Paperbridge has no analytics service, telemetry endpoint, account database, or Paperbridge cloud backend. The installed extension keeps its workspace locally and sends selected context only after you approve a model request manually paste a prompt into an AI website, or start an automatic ChatGPT tab fill.

## Local storage

- **Encrypted vault:** Saved answers, optional extracted background, notes, API settings/keys, and the helper pairing code are encrypted with AES-256-GCM. A user passphrase derives the key with PBKDF2-SHA256, a random 16-byte salt, and 310,000 iterations; each save uses a random 12-byte IV.
- **Decrypted state:** The open workspace holds decrypted information in memory. Closing it or inactivity-locking discards its in-memory vault/key reference; this is not a promise of forensic memory erasure.
- **Application scans:** Field labels, current-page information, drafts, approvals, and undo state are temporary rather than saved in the vault. The page engine holds supported previous values in its isolated execution context for preservation/undo until the document is unloaded or scanned again.
- **Browser session metadata:** The selected tab ID, page title/origin, and workspace-window ID are kept in session storage so the toolbar can select the intended application.
- **No browsing history:** There is no history permission, cookie permission, permanent content script, or tab-monitoring background loop.

Browser-profile access, local malware, an unlocked workspace, or a compromised extension update can defeat these protections. Use a strong unique vault passphrase, maintain your computer, and do not use a shared unlocked browser session.

## What goes to an AI

- **Automatic ChatGPT tab bridge:** After you start a run, Paperbridge sends detected draftable field labels/options, page metadata, and selected background to your chosen ChatGPT conversation and reads its newly rendered assistant response. Prior conversation content and credentials are not collected; ChatGPT can use its existing conversation context. No API request is made by this workflow. Temporary isolated-tab state is cleared when the run finishes or is cancelled, unless the workspace closes unexpectedly; reloading that chat tab clears it. ChatGPT messages remain in your account history according to its settings.
- **Manual chat-website mode:** Paperbridge copies a prompt only after confirmation. You decide where to paste and send it; the extension does not read the conversation or its uploaded files.
- **Direct API/helper mode:** The approved request contains selected background text, personal notes, and draftable field labels/options plus page title/site/step. It does not include API keys as prompt content, saved answers, current field values, or detected manual/user-only fields.
- **Selected documents:** Selected text is sent verbatim, not automatically redacted. Remove private material you do not want the chosen provider to receive before approving the request.
- **Provider credentials:** An API key goes in the provider's authentication header, to the configured host. Helper OAuth tokens remain in the helper and are used against OpenAI's documented service; they are not handed to the application page.
- **Retention:** Provider-side storage, account history, training controls, logs, and usage policies are the provider's responsibility. `store:false` in the OpenAI request is not a blanket promise of zero retention; the sign-in preview documents the parameter as a requirement ([OpenAI preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)).

Existing-chat quotations are marked not locally verified. A local quote match only proves that text occurs in a selected source, not that an answer is truthful or appropriate.

## What goes to the application website

The manual workflow writes approved values after a second confirmation. The automatic tab bridge writes valid supported answers immediately under your authorization to start that run, without per-answer approval. Standard input/change events or supported control clicks notify the website, so its scripts may immediately save or transmit those values.

Paperbridge does not click Submit, Next, Save and Continue, Add-entry, signature, or agreement controls. Undo can change a current field but cannot recall data already transmitted or undo the site's own actions.

## Clipboard, backups, and optional helper

- **Clipboard:** Copy prompt replaces the current clipboard contents. Paperbridge does not read the clipboard or automatically clear it; clipboard history and other applications can retain what you copy.
- **Backups:** Exported backups are encrypted and need the vault passphrase. They do not contain the helper's separately stored ChatGPT tokens.
- **Helper storage:** The helper stores registrations, verified account information, token sets, pairing information, and its stable host ID under the current OS user's Paperbridge configuration directory. Windows uses current-user DPAPI; macOS/Linux use an owner-only directory and file, not additional file-content encryption.
- **Helper lifetime:** Locking or resetting the extension vault does not log the helper out. Use its Sign out action to remove local tokens and attempt revocation, then close the helper when not needed.
- **Helper logs:** Its startup window displays the pairing code for local setup. Prompts and document text are not written to helper logs or session storage.

## Remove or reset your information

Delete saved answers or optional background from the workspace, or use the confirmed local-vault reset from its unlock screen. Keep a backup before destructive changes and remember that local deletion cannot remove prior AI conversations or employer records.

For a complete helper reset, first sign out each connected registration and review connected access in ChatGPT if revocation could not be confirmed. Stop the helper before moving or deleting its protected session file; see `SECURITY.md` for its path and recovery notes.
