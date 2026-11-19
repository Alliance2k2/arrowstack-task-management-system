> Current evidence: [2026-11-19 testing](testing-20261119.md) and [readiness](submission-readiness-20261119.md).

# Task 2 demonstration script (4-6 minutes)

Use disposable accounts and hide private environment files, connection strings, tokens and password input. Start the database/API/UI following README. Run tests separately before recording; do not run destructive tests on the demonstration database.

1. Introduce the problem: an individual needs one place to track their own work. Explain the official task title and that the personal ownership design is our implementation choice.
2. Register a new account, sign in, and show the empty dashboard. Create "Prepare submission" with HIGH priority, a deadline and description. Show persisted task, summary and reload restoration.
3. Edit it to IN_PROGRESS then DONE. Show overdue excludes completed tasks. Change priority and clear deadline. Explain UTC dates.
4. Search the title and apply status/priority filters. Show an empty result and restore filters. Explain 20-row pagination.
5. In a separate browser context register another account. It has an empty list and summary. Use the automated authorization test evidence to demonstrate cross-account detail/edit/delete return 404; do not expose bearer tokens on camera.
6. Delete the task after confirmation, sign out, reload and show login. Explain ten-minute access JWT expiry after refresh logout.
7. Show schema/migration files, atomic task audit writes and conditional version edit. Show actual backend/browser test results and the current dependency audit results, successful hosted CI and hosted Docker smoke results and production limitations.
8. Finish with the repository, README and API contract. Explain deferred team projects and notifications. Record the final URL and recording link in submission report after the actual recording exists.
