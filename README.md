# PROD GATE

A lightweight, single-file web app for managing test cases, bugs, and production readiness in software projects. No frameworks, no build step—just open `app.html` in your browser.

---

## Features

- **Project & Issue Management**
  - Create, rename, and delete projects
  - Add issues/features to projects
  - Hierarchical sidebar navigation

- **Test Case Tracking**
  - Add test cases to issues with area/module, priority, and steps
  - Mark test cases as PASS, FAIL, BLOCKED, or PENDING
  - Inline notes for each test case
  - All test cases auto-appear in the Prod Gate

- **Bug Logging**
  - Log bugs with severity, environment, description, and screenshots
  - Link bugs to issues (optional)
  - Track bug status: OPEN → FIXED QA → CHECK PROD → ✓ PROD
  - Add notes and attach images to bugs
  - Bugs from QA/Prod auto-appear in the Prod Gate

- **Prod Gate**
  - Unified checklist of all test cases, bugs, and manual checks
  - Grouped by issue and project
  - Progress bar and status tracking
  - Mark items as verified for production
  - Add custom manual checks

- **Areas/Modules**
  - Manage custom areas/modules for test cases
  - Add/remove areas dynamically

- **Session/Sprint Naming**
  - Set a session or sprint name for context

- **Modals & UI**
  - All actions use custom modals (no native alerts)
  - Consistent, modern UI with CSS variables for theming
  - Keyboard and backdrop close for all modals
  - Toast notifications for feedback

- **Persistence**
  - All data stored in `localStorage` under the `pg_mvp2` key
  - No backend required

---

## Usage

1. **Open** `app.html` in your browser (Chrome/Edge/Firefox recommended).
2. **Create a project** via the sidebar.
3. **Add issues** to your project.
4. **Add test cases** and log bugs for each issue.
5. **Track progress** in the Prod Gate tab.
6. **Verify** all items before production release.

---

## Data Model

- `S` (global state object):
  - `session`: Current session/sprint name
  - `projects`: [{id, name, color, open}]
  - `issues`: [{id, projId, name}]
  - `tests`: [{id, issueId, projId, title, area, priority, steps, status, note, created}]
  - `bugs`: [{id, issueId, title, severity, desc, env, status, images, notes, prodVerified, created}]
  - `gateItems`: [{id, type, refId, label, checked, issueId}]
  - `areas`: [string]
  - `activeProj`, `activeIssue`, `openTc`: UI state

---

## Architecture

- **Single HTML file**: All logic, styles, and markup in `app.html`
- **No dependencies**: Pure HTML, CSS, and JavaScript
- **Persistence**: Uses `localStorage` for all data
- **UI**: Responsive, modern, and accessible
- **Modals**: Custom overlay/modal system for all dialogs
- **No build step**: Just open and use

---

## Customization

- **Theming**: Edit CSS variables at the top of `app.html` for colors and fonts
- **Areas/Modules**: Add/remove via the UI or edit the default list in the state object

---

## File Overview

- `app.html`: Main application (use this file)
- `app2.html`: Reference/legacy version (do not use)
- `index.html`: Optional landing page or redirect

---

## License

MIT. Use, modify, and share freely.
