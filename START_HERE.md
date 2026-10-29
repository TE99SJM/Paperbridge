## Automatic ChatGPT filling

## v1.0.2 docked workspace (unreleased)

- **Opera GX:** the toolbar icon toggles an in-page dock on the selected form. This is a DOM-based dock, not Opera's native sidebar. It reserves up to 420px beside the page and restores the previous margin when closed. Some sites' fixed layouts or frame CSP may obstruct it; no separate-window fallback is used. Browser settings, stores and protected pages cannot host the dock; the icon shows `!` with an explanatory tooltip.
- **Chromium:** browsers exposing `chrome.sidePanel.open` use a native window-level side panel. Chrome 120+ is the build target. Browsers without that API use the explicit in-page dock. Opera is deliberately routed to the dock rather than assuming Chromium API compatibility.
- **Why this approach:** [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) documents toolbar/user-gesture opening (Chrome 116+). [Opera sidebarAction](https://help.opera.com/en/extensions/sidebar-action-api/) documents `sidebar_action`/`opr.sidebarAction`, an MV2 example, setters and focus events, but no programmatic `open` method. Those documents do not establish current GX MV3 compatibility. The dock uses [programmatic content scripts and DOM](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) plus an extension-origin iframe. Native Opera sidebar support is not claimed.
- **Pinned application:** tab activation never changes the application. Clicking Paperbridge on another ordinary form explicitly changes it and cancels the previous run. Clicking on ChatGPT never replaces it. In Opera, switch back to the original form to see its dock; the automatic run can continue while ChatGPT is visible.
- **Close/cancel:** runs belong to the panel, not the background worker. Closing/removing the dock, native panel closure/hiding, changing the application, or Cancel revokes the write connection. The scanner checks it before each field and again before a delayed custom-dropdown choice. No run resumes on reopening. An input operation already executing can finish; previously written fields remain. A sent AI prompt cannot be recalled. Undo remains available on reopening while the same form document is alive and access is still granted. Reloading/navigating the form loses in-memory undo. Closing a native panel currently stops all Paperbridge panel write connections across windows, conservatively.
- **Storage:** encrypted vault format and storage key are unchanged. Wait for “Encrypted locally” before closing, and keep an encrypted backup. Document import, saved answers, overwrite protection, cancellation and undo retain their existing rules. Forms are never submitted and Next is never clicked.

### Update without losing your vault

1. In your existing Paperbridge installation, unlock it and choose **Encrypted backup**. Keep the JSON and your passphrase. The backup control is now visible at dock widths too.
2. Extract `Paperbridge-Local-Install-v1.0.2.zip` somewhere temporary. Copy its contents **over the files in the exact folder your installed extension already uses**. Keep that folder path unchanged.
3. At `opera://extensions` (or `chrome://extensions`), click **Reload** on the existing Paperbridge card. **Do not Remove it or load a second copy from a different folder.** Verify the extension ID stays the same. A changed ID/path uses separate browser storage; restore the encrypted backup if necessary.
4. Reload the form tab to clear old injected scripts. Click the toolbar icon on the form, unlock with your existing passphrase, and choose your signed-in ChatGPT tab under **Fill automatically with ChatGPT**. Check the form yourself; advance and submit manually.

No release is published for 1.0.2. Use the attached built ZIP or verified draft-PR CI artifacts. GitHub's automatic source ZIP is not a ready-built installation.


Open your application and ChatGPT conversation in separate tabs. Click Paperbridge on the application, unlock, then choose **Fill automatically with ChatGPT**. Allow ChatGPT access, select the conversation, and start. Keep both tabs open. Supported empty fields fill from the new reply and saved user answers, without approving each answer. Review the website and submit it yourself. Missing facts and unsupported controls stay unchanged. This experimental website bridge requires no API key or helper and has not been validated in a real signed-in ChatGPT session.

The instructions below describe the optional manual workflow.

# Paperbridge for Opera GX: Start here

Paperbridge fills application webpages after you review and approve the answers. Keep using the resume and background already in your AI conversation; you do not need to upload them again into the extension.

## Install the ready-built extension

1. Download `Paperbridge-Local-Install-v1.0.2.zip` from the [Build and test workflow](https://github.com/TE99SJM/Paperbridge/actions/workflows/ci.yml). Extract it into a permanent folder, such as your Documents folder; do not run it from inside the ZIP.
2. In Opera GX, enter `opera://extensions` in the address bar.
3. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder with `manifest.json` directly inside it. Select the folder, not the ZIP or an individual file; these are Opera's documented unpacked-extension installation steps ([Opera Help](https://help.opera.com/en/extensions/testing/)).
4. Pin Paperbridge's icon in the browser's extensions menu if you want easy access. Leave the extracted folder in place after installation.
5. Open an ordinary application webpage and click the Paperbridge toolbar icon. Its docked workspace will open beside the form.
6. Create a local vault passphrase of at least 12 characters. This is not your AI password, and there is no forgotten-passphrase recovery.

The personal-install release is already built. You do not need Node.js, npm, an API key, or the optional helper for the existing-chat workflow.

If you downloaded the full `Paperbridge-Opera-GX-v1.0.2.zip` instead, select its inner `extension` folder, not the outer project folder. GitHub's automatic source ZIP and Git clones require a build first; see [Build from source](README.md#build-from-source).

## Use the AI conversation you already have

1. Sign in to ChatGPT, Claude, Gemini, or your preferred AI website as you normally do. Use the conversation containing your resume, work history, education, and other background.
2. On the application page, expand the section you want to fill and click Paperbridge's toolbar icon. In its workspace, click **Scan visible fields**.
3. If custom dropdowns are detected, choose **Read dropdown choices** and confirm. This opens and closes supported menus to read their choices, then makes a fresh scan.
4. Click **Prepare AI prompt**, review the exact text, check the confirmation, and click **Copy prompt**. Leave “Also open…” unchecked if your existing conversation is already open.
5. Paste the prompt into that AI conversation and send it yourself. The prompt tells the AI to return a JSON answer block and to leave unsupported facts blank.
6. Copy the entire JSON reply back into **Review answers**. Click **Validate pasted answers**.
7. Read and edit every proposed answer, including dates and which employer or school it belongs to. Check only the approval boxes for answers you want filled.
8. Click **Fill approved answers**, review the target site and autosave warning, check the confirmation, and fill.
9. Return to the actual application and verify the values. You alone click Next, Save and Continue, or Submit.

This is a copy-and-paste handoff, not automatic access to your AI chat or its uploaded files. Paperbridge cannot verify earlier-chat evidence itself, so those answers are labeled “Chat: not verified locally.”

## Eligibility and employer questions

- **Your own statements:** Age eligibility, work authorization, sponsorship, previous-employer status, and permission to contact an employer start blank. Paperbridge does not let AI infer these answers.
- **Saved answers:** Enter an answer yourself in Review answers and choose **Save for reuse**, or use **Saved answers** to add one. Confirm the exact question and your chosen answer.
- **Exact matching:** Saved answers match wording apart from punctuation, spacing, and capitalization. They do not translate “authorized to work” into a sponsorship answer.
- **Employer-specific permission:** Keep the site and section restrictions when saving permission to contact an employer. Always recheck which employer the section currently represents.
- **Fresh approval:** Reused answers are never automatically approved. Every application needs another review.

Do not take a sample Yes or No as advice about your situation. No real eligibility answers are bundled in the installed extension.

## Workday-style applications

Add work-experience and education entries yourself, then scan the expanded fields. Paperbridge distinguishes repeated entries and separate From/To month/year inputs, and supports a subset of button-based dropdowns.

Searchable school/degree taxonomy widgets, unsupported menus, uploads, signatures, consent, identity/payment fields, and CAPTCHAs remain manual. After you move to another step yourself, rescan; real Workday tenants vary, and compatibility with a specific live application is not guaranteed.

## Practice before using a real application

Practice pages are included in the full project ZIP, not the smaller personal-install ZIP, and use fictional information only. The optional local practice server needs Node.js; install a maintained LTS release from the [official Node.js download page](https://nodejs.org/en/download) if needed.

On Windows, double-click `examples/start-practice.bat`. On macOS or Linux, open a terminal in the extracted folder and run:

```sh
node examples/serve-practice.mjs
```

Then enter these addresses in Opera GX:

```text
http://127.0.0.1:47822
http://127.0.0.1:47822/workday-style-practice.html
http://127.0.0.1:47822/react-practice.html
```

Click Paperbridge on that page and try a few made-up values. Keep the server window open while practicing; Ctrl+C stops it.

## Optional integrated drafting

The helper launchers below are included in the full project ZIP. If using a source checkout instead, run the build first; the personal-install ZIP alone is sufficient for AI chat website mode.

- **Your provider API:** In AI connection, select a provider, supply your own key or local endpoint, and choose a text model. Add only the factual background you want sent under Background, then explicitly review and approve each request.
- **ChatGPT account helper:** Start `helper/start-helper.bat` on Windows, `helper/start-helper.command` on macOS, or `sh helper/start-helper.sh` on Linux. In AI connection → ChatGPT account, paste the helper's pairing code, pair, choose Continue with ChatGPT, and finish authorization on OpenAI's website.
- **Returning after sign-in:** Click Refresh account and select an available model. This optional integration follows OpenAI's preview flow, but real account sign-in has not been tested in this delivery ([OpenAI sign-in documentation](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)).
- **Background is separate:** Integrated helper/API drafting does not read your existing ChatGPT conversation or uploads. Use the copy-and-paste workflow above if that conversation already has the information.

The bundled helper needs Node.js 20.19 or newer; a maintained LTS release is recommended. API billing is separate from ChatGPT subscription billing, while the helper's eligible plan access depends on OpenAI authorization ([OpenAI billing guidance](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api), [OpenAI sign-in documentation](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)).

## Important limits and recovery

- **Autosave:** The website may transmit values immediately after a field changes, even though Paperbridge never clicks Submit. Fill only when you authorize sharing those values with that site.
- **Undo:** Undo restores unchanged fields in the last batch. It cannot undo data the website already received, reliably clear a radio group that originally had no selection, or reset a custom menu without an empty choice.
- **Save and lock:** Wait for “Encrypted locally” before closing. The workspace locks when closed or after roughly 10 minutes of inactivity, checked at 30-second intervals.
- **Backups:** Use **Encrypted backup** in the sidebar before updating or removing the extension. On the unlock screen, use **Restore encrypted backup** and the backup's passphrase.
- **Separate helper session:** Locking the vault does not sign out the helper. Use its Sign out action when finished, and close the helper window if you do not need it.
- **Testing limits:** Chromium tests used fictional local pages and mocked AI protocols. Actual Opera GX installation, your employer's page, authenticated AI calls, and Windows/macOS helper behavior still require testing on your computer.

For troubleshooting, source builds, and updates, see [README](README.md). Read [Privacy](PRIVACY.md), [Security](SECURITY.md), and [Validation](VALIDATION.md) before using sensitive background.
