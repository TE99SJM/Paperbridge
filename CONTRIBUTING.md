# Contributing to Paperbridge

Paperbridge prioritizes a person's review and control over the number of fields it can automate. Changes must preserve explicit run authorization (or per-answer approval in manual mode), privacy, field-identity checks, and the ability to stop safely when a website is unsupported.

## Local development

Use a maintained Node.js LTS release satisfying the minimum in `package.json`. Install the locked dependencies and build the runtime before loading `extension/`.

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Load the built `extension/` directory using Opera's Developer mode and Load unpacked controls ([Opera Help](https://help.opera.com/en/extensions/testing/)). Use the fictional practice pages in `examples/`; never test an automated submission against a real application.

## Safety rules for changes

- **Approval:** Manual model and saved answers must start unapproved, and edits must revoke prior approval. The automatic ChatGPT bridge uses explicit run authorization and must preserve all field validation.
- **User statements:** Eligibility, authorization, sponsorship, and employer-contact permission must not be inferred by AI.
- **Preservation:** Keep existing values, post-scan edits, identity checks, and conservative undo behavior intact.
- **Boundaries:** Do not add automatic submission, navigation, agreements, signatures, uploads, CAPTCHA handling. The explicit ChatGPT bridge may send a single prompt and read only the new reply in the selected tab; never collect prior chat history or credentials.
- **Credentials:** Never commit keys, tokens, pairing codes, sessions, browser profiles, resumes, or real application screenshots.
- **Evidence:** Add a fictional test fixture for scanner changes, including framework state where relevant, rather than claiming every employer's site is supported.

## Before opening a pull request

Explain the problem, the change, and the tests performed. For UI changes, use fictional screenshots at desktop and narrow widths; for network integrations, use mock services and document what remains untested against real accounts.

```sh
npm audit
npm audit --omit=dev
npm run package
npm run package:local
npm run verify:release
npm run verify:local
```

The full archive must be created before the personal-install package so its runtime can be checked against the complete release. Generated bundles, preview files, dependencies, QA output, and release archives are intentionally ignored by Git; distribute installable builds as release assets.

Read [Security](SECURITY.md) before reporting a vulnerability. Ordinary issues must use sanitized, reproducible examples and must not expose personal data.
