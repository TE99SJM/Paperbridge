# Paperbridge: Install for personal use

This download contains the ready-built extension, not a store submission. Use it directly in your own browser; do not upload it to the Opera Add-ons website.

## Install in Opera GX on Windows

1. Download `Paperbridge-Local-Install-v0.0.2.zip` from the [Build and test workflow](https://github.com/TE99SJM/Paperbridge/actions/workflows/ci.yml). Start a run for the intended branch. From the successful run, download and extract the `paperbridge-verified-downloads` artifact, then use the personal-install ZIP inside it.
2. Extract the ZIP to a permanent folder. For example, choose a folder named `Paperbridge-Local-Install-v0.0.2` inside Documents.
3. Open the extracted folder and confirm that `manifest.json` is directly inside it. This is the folder you will select; you do not need to select individual files.
4. In Opera GX, press **Ctrl + L**, type `opera://extensions`, and press **Enter**. Type this into the address bar, not into a search box; Opera documents this built-in page as its extension manager ([Opera Help](https://help.opera.com/en/extensions/testing/)).
5. Enable **Developer mode**, click **Load unpacked** or **Load unpacked extension**, and select the folder from step 3 ([Opera Help](https://help.opera.com/en/extensions/testing/)).
6. Confirm the folder selection. Keep that folder in place after installation.

If you see “Upload new add-on,” “Select files,” or a `persona.ini` error on a website, leave that page. Return to the browser's own `opera://extensions` page; this installation does not use the publishing website.

If Opera says the manifest is missing, you selected the wrong folder or did not extract the ZIP. With the full project ZIP, select its inner `extension` folder instead; a GitHub source checkout needs a build before it can be loaded.

## First use

1. Open an ordinary application webpage and click Paperbridge's toolbar icon. The extension opens in the browser side panel where supported, with a narrow-window fallback otherwise. You may need to find the icon in the browser's extensions menu first.
2. Create a local passphrase of at least 12 characters. This protects the extension's saved data; it is not your AI account password.
3. Leave **AI connection → AI chat website** selected. The existing-chat workflow needs no API key, Node.js, or local helper.
4. Click **Scan visible fields**, then **Prepare AI prompt**.
5. Review and copy the prompt into your existing AI conversation containing your resume and background.
6. Paste the AI's JSON reply into **Review answers**, validate it, review the values, and approve only the answers you want filled.
7. Click **Fill approved answers** and confirm the target website. Return to the application and check every filled value.

This is a manual copy-and-paste bridge for an existing AI chat, not automatic access to chat history. Direct provider and optional ChatGPT-account integrations are available separately in AI connection. You do not need to upload the same documents again.

## Important limits

- **Your statements:** Supply eligibility, authorization, sponsorship, and employer-contact answers yourself. AI is not allowed to guess them.
- **No automatic submission:** You click Next, Save and Continue, and Submit yourself. The application website may still autosave values as they change.
- **Local storage:** Remember your vault passphrase and use encrypted backups. There is no forgotten-passphrase recovery.
- **Optional features:** This smaller download does not include the local ChatGPT account helper or practice server. Those are included in `Paperbridge-Opera-GX-v0.0.2.zip` in the same workflow artifact; use AI chat website mode to get started now.
- **Testing:** The personal-install runtime is checked against the full package for this version. Chromium loading is tested, but actual Opera GX behavior on your computer and your specific Workday page still need a local check.

Read the included `PRIVACY.md` and `SECURITY.md` before adding sensitive information. If installation reports an error, capture the error and describe the folder you selected, without exposing account details, personal paths, or documents.
