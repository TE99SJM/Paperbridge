# Paperbridge security boundaries

Paperbridge is review-first automation, not a security boundary against a malicious application website or a guarantee of accurate AI output. Its safeguards reduce accidental filling and credential exposure, but you must still inspect the page and every proposed answer.

## Permissions and execution

| Permission | Why it is requested |
| --- | --- |
| `activeTab` | Temporary access to the page explicitly selected with the toolbar. |
| `scripting` | Inject the local scanner/filler into that selected tab's isolated world. |
| `storage` | Store the encrypted vault and temporary target metadata. |
| `clipboardWrite` | Copy a prompt after explicit confirmation. |
| Optional HTTPS/loopback hosts | Reach a provider endpoint/local helper, or access the explicitly selected ChatGPT tab after you allow that host. |

The release has no always-on `host_permissions`, no permanent content script, no `externally_connectable` interface, and no cookies/history permissions. Optional host patterns are broad enough to support user-selected providers, but actual requests are host-scoped and need approval; Chromium host grants are not port-scoped.

The workspace uses bundled local scripts and fonts with `script-src 'self'`. AI replies are parsed as JSON and rendered as escaped text, never executed as JavaScript or interpreted as selectors.

## Fill safeguards

- **Automatic bridge:** Starting a run authorizes sending its form/background to the chosen ChatGPT conversation and filling supported empty fields without per-answer approval. Replies must match the current scan and pass normal field validation. Chat-context quotations remain unverified locally. Missing or unsupported answers are skipped.
- **Manual review boundary:** All model and saved answers begin unapproved. Editing revokes approval, and filling requires a separate target-site/autosave confirmation.
- **Field identity:** A fill checks the scan ID, document URL, original element identity, labels, type, section, constraints, supported options, and whether the field changed since scanning.
- **No silent overwrites:** Existing values are skipped by default. The optional overwrite switch only applies to values present at scan time; post-scan edits are still preserved.
- **Sensitive questions:** Detected sensitive fields remain manual. Supported eligibility and employer-contact answers require user-originated values and explicit confirmation rather than AI inference.
- **Dropdown boundary:** A dropdown must have a uniquely identifiable associated/new menu and one exact matching reviewed choice. Ambiguous, searchable, unsupported, or unsafe controls are not forced.
- **Navigation boundary:** The engine does not use model-supplied code or click submit/navigation controls. A website can nevertheless attach additional behavior to a supported input or dropdown, so inspect the site and heed the autosave warning.
- **Undo boundary:** Undo preserves later edits, can fail if a site replaces the control, and cannot recall transmissions. Clearing an originally unselected radio group is intentionally left manual because a synthetic clear can disagree with framework state.

Label-based classification cannot prove that a page is safe. Do not approve unknown fields, financial or identity details, signatures, legal attestations, or a permission answer you do not fully understand, even if a site uses an innocuous-looking label.

## Optional ChatGPT helper

The helper implements the documented public-client flow with fresh PKCE/state/nonce values and a localhost callback; it verifies the ID-token signature, issuer, issued-client audience, expiry, and nonce before accepting an identity ([OpenAI sign-in documentation](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)). Its mock tests do not prove that every live account or workspace can use the preview.

- **Network binding:** `127.0.0.1:47821` only, with an exact Host check. Do not port-forward it, run it on a public interface, or expose it through a reverse proxy.
- **Extension pairing:** Non-callback API operations require the pairing secret and a validated extension origin; operations other than pairing also require that origin to be registered.
- **Token boundaries:** OAuth tokens stay in the helper's account records. The extension receives account/model metadata and generated text, not OAuth tokens.
- **Refresh/logout:** Refreshes are serialized per account; logout clears local tokens, attempts revocation, and preserves the verified registration and host ID. A failed revocation attempt is shown rather than claimed successful.
- **Discovery:** Production discovery/endpoints are restricted to the expected HTTPS OpenAI origins. Test injection hooks are in-process source APIs, not HTTP configuration routes.
- **Local trust:** Another process running as your OS user may be able to read local files, memory, or the pairing code. Loopback/origin checks do not protect a compromised computer.

## Helper session paths and recovery

| OS | Default path |
| --- | --- |
| Windows | `%APPDATA%\Paperbridge\session.json` |
| macOS | `~/Library/Application Support/Paperbridge/session.json` |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/Paperbridge/session.json` |

Windows file contents are protected for the current Windows user with DPAPI. Unix-family systems use a `0700` directory, `0600` session file, and atomic writes; their JSON token contents are not separately encrypted.

If a session cannot be read, stop the helper and keep the original file privately before making changes. Restore it only to the intended user/machine environment; DPAPI-protected files may not be portable to another Windows account.

If you must reset pairing or a damaged session, sign out/revoke access where possible first, then move the stopped helper's configuration directory aside and start it again. This creates a new local registration context; deleting a local file is not proof that the provider revoked access.

## Reporting and maintenance

This release has not received an independent security audit. Test on actual Opera GX builds and target sites, keep dependencies maintained, and use the documented approval and backup boundaries.

Report potential security vulnerabilities through [GitHub's private vulnerability reporting for Paperbridge](https://github.com/TE99SJM/Paperbridge/security/advisories/new), not a public issue. Include the version, affected component, impact, and a minimal fictional reproduction; do not include live credentials or personal documents.

For ordinary bugs, use the repository's issue form and remove identifying information first. Never attach an unredacted application screenshot, resume, encrypted vault plus passphrase, API key, pairing code, or helper session file.
