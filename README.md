# Paperbridge

Paperbridge makes online paperwork less repetitive without handing over the final say. This Manifest V3 extension for desktop Opera GX and Chromium helps fill job applications using your existing AI conversation, your saved answers, or optional direct AI integrations.

Choose **Fill automatically with ChatGPT** to scan the selected form, send its fields and selected background to an open ChatGPT conversation, read the new structured reply, and fill supported empty fields without per-answer approval. Paperbridge never submits the application. Manual copy/paste, review, and API/helper workflows remain available.

## Automatic ChatGPT tab bridge (experimental)

1. Open the application in one tab and your signed-in ChatGPT conversation in another. Use the conversation with your background, or select documents in Paperbridge.
2. Click the Paperbridge toolbar icon on the application and unlock the workspace.
3. Click **Fill automatically with ChatGPT**, allow access to `chatgpt.com`, choose the conversation, and click **Start automatic fill**.
4. Keep both tabs and the workspace open. Paperbridge sends one prompt, waits for a stable structured reply, and fills every supported empty field with a valid, sourced answer. No API key or local helper is used by this workflow.
5. Review the completed application and submit it yourself. Missing facts, unsupported controls, existing values, and unsupplied eligibility answers remain unchanged. Exact saved user answers can fill eligibility fields. Undo is available for the completed batch.

The bridge inserts text into ChatGPT's composer and clicks its Send button; it reads only newly rendered assistant replies for that run and does not export prior conversation text or credentials. It refuses to overwrite an unsent chat draft or interrupt an existing response. Cancel prevents subsequent filling but cannot recall a sent message. Website changes, rate limits, refusals, and long-running responses can stop the workflow; there are no automatic message retries. A browser fixture covers the integration mechanics, but local execution was blocked by an unavailable Chromium download. A real signed-in ChatGPT session has not been tested.

[![Build and test](https://github.com/TE99SJM/Paperbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/TE99SJM/Paperbridge/actions/workflows/ci.yml)

## Install in Opera GX

Download the [ready-to-install ZIP](https://github.com/TE99SJM/Paperbridge/releases/download/v1.0.0/Paperbridge-Local-Install-v1.0.0.zip) from the [latest release](https://github.com/TE99SJM/Paperbridge/releases/latest). Existing-chat mode requires no Node.js, API key, or local helper.

1. Right-click the downloaded ZIP and choose **Extract All**. Extract it into a permanent folder, such as a Paperbridge folder inside Documents.
2. Open the extracted folder and check that `manifest.json` is directly inside it.
3. In Opera GX, press **Ctrl + L**, type `opera://extensions`, and press **Enter**.
4. Enable **Developer mode**, click **Load unpacked**, and select the folder from step 2. Choose the folder, not the ZIP or the individual manifest file ([Opera's installation instructions](https://help.opera.com/en/extensions/testing/)).
5. Open an application webpage, expand the section you want to fill, and click Paperbridge's toolbar icon.
6. Create a local vault passphrase of at least 12 characters. Leave **AI connection → AI chat website** selected to use your normal AI conversation.

Keep the extracted folder in place after installation. This is a local installation, not a submission to the Opera Add-ons website; no `persona.ini` file or store account is needed.

For the complete click-by-click workflow, read [Start here](START_HERE.md). For just the installation steps, read [Install for personal use](LOCAL_INSTALL.md).

## Choose the right download

| Download | What it contains | Folder to load |
| --- | --- | --- |
| [Personal-install ZIP](https://github.com/TE99SJM/Paperbridge/releases/download/v1.0.0/Paperbridge-Local-Install-v1.0.0.zip) | Recommended: built extension and essential instructions | The extracted folder itself; `manifest.json` is at its root |
| [Full project ZIP](https://github.com/TE99SJM/Paperbridge/releases/download/v1.0.0/Paperbridge-Opera-GX-v1.0.0.zip) | Built extension, editable source, optional helper, practice pages, and tests | The inner `extension/` folder |
| GitHub's **Code → Download ZIP**, or a Git clone | Source code; generated bundles are intentionally not committed | Run the source build below first, then load `extension/` |

Both release ZIPs include internal file checksums and have a separate `.zip.sha256` asset. Do not load GitHub's automatically generated source ZIP as though it were the ready-built release.

## What is included

| Path | Purpose |
| --- | --- |
| `extension/` | Extension shell and generated runtime files. Ready-built in release ZIPs; a Git checkout needs `npm run build` first. |
| `src/` | Editable UI, scanner, provider adapters, encrypted vault, and answer-matching code. |
| `helper/` | Optional local ChatGPT sign-in helper source and OS launchers. The build or full release supplies its bundle. |
| `examples/` | Fictional native, Workday-style, and React-controlled practice pages. |
| `tests/` | Unit, mocked-protocol, and browser acceptance tests. |
| `scripts/` | Build, cross-platform ZIP packaging, and extracted-release verification scripts. |
| `.github/` | Automated build/test workflow and a privacy-conscious bug-report form. |
| `LOCAL_INSTALL.md` | Short instructions for the recommended personal-install ZIP. |
| `START_HERE.md` | Installation and everyday workflow. |
| `PRIVACY.md`, `SECURITY.md` | Data handling, threat boundaries, and recovery. |
| `VALIDATION.md`, `FLOWS.md` | Test evidence, exclusions, and acceptance inventory. |
| `CONTRIBUTING.md`, `CHANGELOG.md` | Contribution guidance and release history. |
| `CHECKSUMS.sha256` | File integrity list generated inside each release archive; not a source file. |

## Main workflow

- **Application:** Select a page by clicking the extension toolbar icon, then scan visible fields. No background browsing monitor or permanent content script is installed. The automatic workflow also accesses only the ChatGPT tab explicitly selected for that run.
- **Existing AI conversation:** Copy the reviewed form prompt into the conversation that already has your resume. Paste the full JSON reply back; no duplicate local upload is required.
- **Review answers:** Validate, edit, and approve each answer. A quoted-text match means the quote exists, not that the conclusion is correct.
- **Saved answers:** Reuse your own answers only for exactly matching questions, optionally scoped to a site and section. Conflicting matches require your input.
- **Fill:** Confirm the target site and autosave warning. Existing values are preserved unless you expressly allow overwriting values that were already present when scanned.
- **Undo:** Restore the last fill where possible without overwriting later changes. Per-field failures stay visible.

This project does not edit documents, fill PDF forms, submit applications, create missing job/school entries, or advance application steps. The optional Background page extracts text for direct model requests; it is not a document editor.

## AI connection choices

| Mode | Uses an existing chat's background? | Needs local background in Paperbridge? | Integration status |
| --- | --- | --- | --- |
| AI chat website | Yes, when you paste into that same conversation and the AI can still access its context | No, when “Use the resume and background already in my AI conversation” is selected | Manual handoff or experimental automatic ChatGPT tab bridge; synthetic browser fixture provided (not locally executed) |
| Your provider API | No | Yes: notes, pasted text, or selected files | Request/response adapters tested with mocked services |
| ChatGPT account helper | No | Yes | Official-preview protocol implemented and mock-tested; real account flow untested |

API presets are OpenAI Responses, Anthropic Messages, Google Gemini's OpenAI-compatible endpoint, OpenRouter, and local Ollama. Custom endpoints use `/chat/completions`; preset model names are not hard-coded, and you must choose a compatible text model.

The helper implements the published dynamic-agent registration flow, PKCE, state/nonce checks, verified ID tokens, refresh, model discovery, streamed Responses, and revocation attempts ([OpenAI registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)). It sends `store:false` and `stream:true` and includes request context directly, matching the documented preview requirements ([OpenAI preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)).

Provider policies, model access, limits, and billing still apply. ChatGPT and API billing are separate products ([OpenAI billing guidance](https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api)).

## Supported forms and boundaries

- **Native controls:** Text, email, telephone, date, number, textarea, single/multiple select, radio, and non-sensitive checkboxes. Only visible, enabled, writable controls are eligible.
- **Custom dropdowns:** Recognized single-choice button listboxes and readonly input comboboxes, with uniquely identifiable menus and exact visible choice labels. Reading choices is a separate confirmed operation.
- **Repeated history:** Workday-style job and school containers preserve section labels and entry numbers. From/To month and year components get separate labels.
- **Embedded controls:** Same-origin iframes and open shadow roots are supported by the scanner. Protected/cross-origin frames and closed shadow roots are not traversed.
- **Manual-only fields:** Passwords, identity and financial information, medical/demographic declarations, signatures, agreements, uploads, CAPTCHAs, rich-text editors with unsupported markup, ambiguous options, and searchable taxonomy widgets.
- **User-only answers:** Supported eligibility and employer-permission questions can be filled after you supply and approve the answer. AI-proposed values for those detected questions are rejected.
- **Limits:** At most 120 fields per scan, 200 saved answers, 25 optional documents, 10 MB per optional file, 60 PDF pages, 250,000 extracted characters per document, and 140,000 characters per prompt.

Detection is conservative but not a guarantee that every sensitive question will be recognized. Always inspect the labels, proposed values, and target page yourself, especially non-English forms, reordered entries, unusual custom widgets, or scripts that change a form after scanning.

The UI preview uses fictional in-memory data and simulated fills. It cannot access application tabs, sign in, or call AI providers; use the installed extension for real work and never enter secrets in the preview.

## Build from source

Install a maintained Node.js LTS release from the [official Node.js downloads](https://nodejs.org/en/download). The project's minimum supported runtime is Node.js 20.19; the supplied built extension itself does not require Node.js.

From a Git checkout, GitHub source ZIP, or the extracted full project folder:

```sh
npm ci
npm test
npm run build
```

Load `extension/` as an unpacked extension. The build bundles local JavaScript, icons, fonts, optional PDF/DOCX readers, the helper, and the React test fixture; it also creates a fictional `preview/` folder.

For browser acceptance tests:

```sh
npx playwright install chromium
npm run test:browser
```

The tests create an isolated browser profile and a copied manifest with a localhost-only host permission. This is a headless testing workaround; that permission and all test profiles are excluded from the shipped extension.

For a new source-and-built release:

```sh
npm run build
npm test
npm run test:browser
npm audit
npm audit --omit=dev
npm run package
npm run verify:release
```

Packaging validates required files, release permissions, ZIP CRCs, and byte-for-byte contents. It creates `release/Paperbridge-Opera-GX-v1.0.0.zip` and an adjacent SHA-256 file, and does not upload anything.

`verify:release` extracts that ZIP into an isolated QA directory, verifies its file hashes, opens its actual built extension in Chromium, and checks the bundled helper's loopback health route with a temporary configuration. It does not authorize an AI account.

After the full archive exists, create and verify the simpler personal-install package:

```sh
npm run package:local
npm run verify:local
```

The personal-install package contains the same complete runtime at the ZIP root, plus installation, privacy, security, and licensing information. Its packager rejects missing, additional, or changed runtime files relative to the full archive.

The [GitHub Actions workflow](https://github.com/TE99SJM/Paperbridge/actions/workflows/ci.yml) runs a clean install, unit/protocol tests, build, browser acceptance tests, dependency checks, and both package verifiers. It uses fictional fixtures and does not sign in to a real AI account or submit a real application.

## Update without losing your vault

1. Export an encrypted backup and keep the passphrase separately. If you use the helper, sign out and stop it before replacing helper code.
2. Extract the new release into a temporary folder and read its change notes.
3. Close the Paperbridge workspace, replace the files inside your existing project/extension location, and reload the existing extension entry in `opera://extensions`. Opera documents reloading unpacked extensions after code changes ([Opera Help](https://help.opera.com/en/extensions/testing/)).
4. Unlock and check your saved answers. Test on the fictional page before continuing a real application.

Do not remove the extension as the first upgrade step. Loading it from a new path or a new browser profile may create a different extension identity and separate storage; use your encrypted backup if that happens, and re-pair the optional helper if necessary.

## Troubleshooting

- **“Manifest file is missing or unreadable”:** Select the folder with `manifest.json` directly inside it. In the personal-install ZIP this is the extracted folder; in the full project ZIP it is `Paperbridge-Opera-GX-v1.0.0/extension`, possibly one folder deeper than Windows' extraction folder.
- **“Could not load” a script or service worker:** A GitHub source checkout is not the ready-built download. Use the personal-install release asset, or run `npm ci` and `npm run build` before loading `extension/`.
- **“Upload new add-on” or `persona.ini` error:** You are on the publishing website, not the local extension manager. Enter `opera://extensions` directly in the browser's address bar and use Load unpacked ([Opera Help](https://help.opera.com/en/extensions/testing/)).
- **No application selected:** Return to the actual HTTP/HTTPS form and click the Paperbridge toolbar icon there. Opening the workspace on a browser settings page does not grant access to an application.
- **No fields found:** Expand the relevant section, close blocking overlays, and rescan. Some embedded forms need to be opened in their own tab; protected pages and built-in PDF viewers cannot be filled.
- **Dropdown did not respond:** Choose it manually. Do not keep retrying an ambiguous menu; after changing a field manually, rescan before using the extension again.
- **Wrong or stale JSON:** Copy the complete response, including `scanId` and `answers`. If you rescanned or changed application steps, prepare a new prompt.
- **AI cannot see earlier files:** Use the same conversation, or paste the necessary facts into that chat. Paperbridge cannot recover inaccessible AI conversation context.
- **Filling skipped a field:** Read its per-field result. Changed controls, post-scan edits, existing values, unsupported choices, and browser constraints are intentionally not forced.
- **Form looks filled but does not save:** Verify the page itself. Site/framework behavior varies, and server-side validation can still reject a value later.
- **Cannot reach helper:** Start the bundled helper and keep its window open. It listens only on `127.0.0.1:47821`; do not change the extension's endpoint or expose this port to the network.
- **Port already in use:** Check whether the helper is already running. Stop only your known duplicate process, not an unidentified process.
- **AI permission or model error:** Review the selected endpoint and account, refresh model availability, and use chat-website mode as the fallback. Do not paste account passwords into Paperbridge.
- **Forgotten vault passphrase:** There is no recovery backdoor. An encrypted backup still needs its own passphrase; reset only if you accept losing the current vault.

## Contributing, security, and license

Read [Contributing](CONTRIBUTING.md) before changing the scanner, AI adapters, or safety checks. Use fictional reproductions in [bug reports](https://github.com/TE99SJM/Paperbridge/issues), and follow [Security](SECURITY.md) for confidential vulnerability reports.

This is an independent open-source project, not an Opera, OpenAI, Anthropic, Google, or Workday product. It is provided under the [MIT license](LICENSE), with third-party notices included in built releases; no store listing or automatic update service is included.
