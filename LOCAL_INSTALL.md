# Paperbridge: Install for personal use

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


This download contains the ready-built extension, not a store submission. Use it directly in your own browser; do not upload it to the Opera Add-ons website.

## Install in Opera GX on Windows

1. Download `Paperbridge-Local-Install-v1.0.2.zip` from the attached build or the draft pull request’s verified CI artifacts. Choose this release asset, not GitHub's automatic source ZIP.
2. Extract the ZIP to a permanent folder. For example, choose a folder named `Paperbridge-Local-Install-v1.0.2` inside Documents.
3. Open the extracted folder and confirm that `manifest.json` is directly inside it. This is the folder you will select; you do not need to select individual files.
4. In Opera GX, press **Ctrl + L**, type `opera://extensions`, and press **Enter**. Type this into the address bar, not into a search box; Opera documents this built-in page as its extension manager ([Opera Help](https://help.opera.com/en/extensions/testing/)).
5. Enable **Developer mode**, click **Load unpacked** or **Load unpacked extension**, and select the folder from step 3 ([Opera Help](https://help.opera.com/en/extensions/testing/)).
6. Confirm the folder selection. Keep that folder in place after installation.

If you see “Upload new add-on,” “Select files,” or a `persona.ini` error on a website, leave that page. Return to the browser's own `opera://extensions` page; this installation does not use the publishing website.

If Opera says the manifest is missing, you selected the wrong folder or did not extract the ZIP. With the full project ZIP, select its inner `extension` folder instead; a GitHub source checkout needs a build before it can be loaded.

## First use

1. Open an ordinary application webpage and click Paperbridge's toolbar icon. You may need to find the icon in the browser's extensions menu first.
2. Create a local passphrase of at least 12 characters. This protects the extension's saved data; it is not your AI account password.
3. Leave **AI connection → AI chat website** selected. The existing-chat workflow needs no API key, Node.js, or local helper.
4. Click **Scan visible fields**, then **Prepare AI prompt**.
5. Review and copy the prompt into your existing AI conversation containing your resume and background.
6. Paste the AI's JSON reply into **Review answers**, validate it, review the values, and approve only the answers you want filled.
7. Click **Fill approved answers** and confirm the target website. Return to the application and check every filled value.

The numbered first-use path above is the optional manual handoff. **Fill automatically with ChatGPT** scans, sends one prompt to your chosen open chat, reads its new reply and fills supported empty fields. You do not need to upload the same documents again.

## Important limits

- **Your statements:** Supply eligibility, authorization, sponsorship, and employer-contact answers yourself. AI is not allowed to guess them.
- **No automatic submission:** You click Next, Save and Continue, and Submit yourself. The application website may still autosave values as they change.
- **Local storage:** Remember your vault passphrase and use encrypted backups. There is no forgotten-passphrase recovery.
- **Optional features:** This smaller download does not include the local ChatGPT account helper or practice server. Those are included in `Paperbridge-Opera-GX-v1.0.2.zip` on the same release page; use AI chat website mode to get started now.
- **Testing:** See VALIDATION.md in the repository for automated results. Actual Opera GX, signed-in ChatGPT and your specific application still need a live test.

Read the included `PRIVACY.md` and `SECURITY.md` before adding sensitive information. If installation reports an error, capture the error and describe the folder you selected, without exposing account details, personal paths, or documents.
