# DS LAB automated releases

## One-time Windows setup

Run this in a normal Windows PowerShell window under the account that already uses GitHub for DS LAB.

    & 'D:\10_PROJECTS\ds-lab-publish\scripts\install-ds-lab-release.ps1'

The installer needs Node.js 24+, npm, Git and authenticated GitHub CLI on that account's PATH. Git HTTPS push credentials must already be available. The worker provisions the required Playwright Chromium version as needed. The actual Scheduled Task checks GitHub access and runs a Git push dry run during setup. The first release is the first write test.

The least-privilege task checks the queue every minute while the account is signed in and Windows is awake. The installed worker lives outside the checkout. To intentionally upgrade it, remove the old task and run the installer again.

## Handoff

Codex runs this after finishing, reviewing and testing a milestone, passing each exact approved path as a separate argument.

    node scripts/release-manifest.mjs "feat: describe the completed milestone" src/Example.tsx

The manifest records the base commit, message and SHA-256 of each file. A null fingerprint means deletion. Keep Codex, editors and other Git operations out of the checkout until the manifest clears. This reservation relies on cooperating writers. The worker rechecks the source fingerprints and pushes the isolated tested tree.

The mailbox holds one pending release. The generator flushes a uniquely named temporary file in `.ds-lab-release`, then publishes it as `ready.json` using a same-directory Windows file move that refuses to replace an existing entry. Concurrent submissions cannot overwrite a pending release. If the generator is interrupted before publication, the worker ignores the temporary file. The installed worker reads the same manifest and requires no upgrade for this producer change.

The source allowlist excludes workflow files, credential paths and generated outputs. Review all selected material for secrets. The scanner detects common credential patterns and can miss arbitrary confidential text. The worker runs reviewed build and test code under the signed-in account.

The release requires the static desktop and mobile suites and the three live Pyodide tests on desktop. This preserves the existing suite's desktop-only live runtime policy and verifies those three tests separately from the static suite. Any other test skip, failure or retry blocks publication. The live runtime tests require access to the Pyodide CDN. The worker runs its live test server on port 5175, separate from local Playwright runs on port 5174. Finish any local dry run before queuing a release because it uses the worker's test configuration.

Read .ds-lab-release/last-result.json for the outcome. Detailed results and command logs are in %LOCALAPPDATA%\DSLabRelease. The worker watches the Pages workflow for the exact SHA and verifies the live homepage. Failed, interrupted and uncertain releases are recorded without another push attempt. Reconcile the checkout if the recorded commit was pushed but local synchronization failed.

## No-push validation

The dry run validates the same isolated snapshot. It leaves the canonical Git index and remote untouched.

    node scripts/release-service.mjs --dry-run "test: verify milestone" src/Example.tsx
