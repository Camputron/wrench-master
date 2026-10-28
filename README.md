# Wrench Master

Invoices and work orders for auto repair shops. A desktop app (Electron) for Windows and macOS, rebuilt from the JavaFX app _Autoshop Invoice Manager_, and able to import its data.

Everything is stored locally in a SQLite database on the computer running the app.

## Features

- **Work orders:** the customer and vehicle, parts and labor (several labor lines allowed), payments, and totals with sales tax. Undo/redo, unsaved-change prompts, and open work orders that reopen in tabs after a restart.
- **Estimates:** quotes with a valid-until date and a customer authorization line. **Accept** turns one into a work order with the same lines; the estimate is then kept, locked, as the record of the quote.
- **Invoices:** print, or save as PDF, with the totals at the bottom of the page. Estimates print the same way.
- **Customers and vehicles:** search, VIN decoding (NHTSA, needs internet), and each customer's work orders and estimates.
- **Dashboard:** open and recent work orders, unpaid balances, and income by month.
- **Voiding:** work orders with payments can't be deleted. Voiding keeps them for the records but leaves them out of totals, and they can be restored.
- **Backups:** automatic daily backups, plus back up and restore on demand.
- **Excel export:** customers, vehicles, work orders (with parts, labor, and payments sheets), estimates, and the parts catalog.
- **Import from the Java app:** File › Import from Autoshop Invoice Manager.

## Getting started

You need [Node.js](https://nodejs.org) 24 (what the project is built and tested with) and npm.

```bash
npm install        # also fetches the right native SQLite build for Electron
npm run db:seed    # optional: demo data to click around with
npm run dev        # starts the app with hot reload
```

> **VS Code terminal:** `ELECTRON_RUN_AS_NODE` may be set there, which stops Electron from starting as an app. If `npm run dev` or the `db:` commands fail with an error about `isPackaged`, run `unset ELECTRON_RUN_AS_NODE` first.

## Commands

### Running

| Command         | What it does                                                                               |
| --------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`   | Starts the app with hot reload. Changes to the interface show up immediately.              |
| `npm start`     | Runs the last build (`out/`) without hot reload, which is closer to the installed app.     |
| `npm run build` | Typechecks, then builds the app into `out/` (no installer; see [Installers](#installers)). |

### Demo data

Development runs (`npm run dev`, `npm start`, and these commands) keep their data in a separate folder, so they never touch the data of an installed copy of the app.

| Command            | What it does                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `npm run db:seed`  | Fills the dev database with demo data (below). Refuses if the dev database already has data.              |
| `npm run db:drop`  | Deletes the dev database and the list of open and recent work orders and estimates. Preferences are kept. |
| `npm run db:reset` | Drop, then seed. Use this after pulling changes to the demo data.                                         |

Run these while the app is closed. The demo data is the same every time, with dates relative to today, so the dashboard always shows recent activity. It includes:

- 28 customers (some companies) with about 48 vehicles, and a 13-part catalog;
- about 18 months of work orders: some open, some unpaid, and a few voided;
- about 25 estimates: open, expired, accepted (each with its finished work order), and declined;
- three work orders dated today for checking the printed invoice: a semi-filled one, an empty one, and a long one that runs to two pages. The command prints their numbers, and they're under **Recently saved** on the dashboard.

### Checks

| Command              | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `npm test`           | Unit and integration tests (Vitest, about a second). See [Tests](#tests). |
| `npm run test:watch` | The same, re-running as files change.                                     |
| `npm run test:e2e`   | Builds the app and drives it end to end with Playwright (about a minute). |
| `npm run typecheck`  | TypeScript checks for the main process, the interface, and the tests.     |
| `npm run lint`       | ESLint, fixing what it can.                                               |
| `npm run format`     | Prettier on every file.                                                   |

Before committing, `npm run typecheck`, `npm run lint`, and `npm test` should all pass; run `npm run test:e2e` too for changes to the interface.

### Installers

| Command                | Output (in `dist/`)                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run build:win`    | `wrench-master-<version>-setup.exe` (Windows x64 installer)                  |
| `npm run build:mac`    | `wrench-master-<version>-arm64.dmg` and `-x64.dmg` (Apple silicon and Intel) |
| `npm run build:linux`  | AppImage and `.deb`                                                          |
| `npm run build:unpack` | The packaged app without an installer, for a quick look at a packaged build  |

The Windows installer can be built on a Mac. Builds aren't code-signed yet, so Windows SmartScreen and macOS Gatekeeper warn the first time the app is opened. The version comes from `version` in `package.json`.

### Other

| Command         | What it does                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run icons` | Regenerates the app icons (`build/icon.icns`, `icon.ico`, `icon.png`) from the vector `build/icon.svg`. |

## Where data is kept

| OS      | Installed app                                 | Development                                         |
| ------- | --------------------------------------------- | --------------------------------------------------- |
| macOS   | `~/Library/Application Support/Wrench Master` | `~/Library/Application Support/Wrench Master (Dev)` |
| Windows | `%APPDATA%\Wrench Master`                     | `%APPDATA%\Wrench Master (Dev)`                     |
| Linux   | `~/.config/Wrench Master`                     | `~/.config/Wrench Master (Dev)`                     |

Each folder holds:

- `autoshop.db`: the database (customers, vehicles, work orders, estimates, parts catalog);
- `settings.json`: preferences (shop details, labor and tax rates, theme, backup folder);
- `session.json`: which work orders and estimates are open, and recently saved work orders;
- `Backups/`: backups, unless another folder is chosen in Preferences.

Uninstalling doesn't delete this folder. **About Wrench Master** (in the Wrench Master menu on macOS, the Help menu on Windows) shows the database's location.

**Java app compatibility:** the database keeps the Java app's tables and formats, and new features use tables of their own (`work_order_void`, `estimate`, `estimate_item`, `estimate_labor`). So a database from this app still opens in the Java app, which ignores voids and estimates.

### Backups

- **Automatic:** once a day while the app is open, keeping the last 14.
- **On demand:** **File › Back Up Now**, also in **Preferences › Backups**, where the backup folder can be changed. A folder on another drive, or one that cloud storage syncs, protects against losing the computer.
- **Restore:** **File › Restore from Backup…** replaces all data with the chosen backup, after backing up the current data.
- Backups are ordinary copies of the database, named by date and reason, e.g. `autoshop-20261027-093000-auto.db`. Manual backups, and the ones made before an import or restore, are never deleted automatically.

## Keyboard shortcuts

Cmd on macOS, Ctrl on Windows and Linux.

| Shortcut              | Does                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| Cmd+N                 | New work order                                                            |
| Shift+Cmd+N           | New estimate                                                              |
| Cmd+S                 | Save the work order or estimate on screen                                 |
| Cmd+P                 | Print it (preview, then print or save as PDF)                             |
| Cmd+W                 | Close its tab, asking first if there are unsaved changes                  |
| Cmd+Z / Shift+Cmd+Z   | Undo / redo typing in a field, or line changes (Ctrl+Y redoes on Windows) |
| Delete or Backspace   | Remove the selected part, labor, or payment line                          |
| Cmd+F                 | Jump to the search box of the customer, work order, or estimate list      |
| Cmd+1 / 2 / 3 / 4     | Dashboard / Customers / Work Orders / Estimates                           |
| Cmd+= / Cmd+- / Cmd+0 | Bigger / smaller / actual size                                            |
| Cmd+,                 | Preferences (Settings on macOS)                                           |

## Tests

- **Unit and integration** (`tests/unit`, Vitest):
  - the database layer, run against a database written the way the Java app wrote it;
  - billing, estimates (including turning them into work orders), voiding, and backups;
  - the printed invoice and estimate, Excel export, and the Java import;
  - VIN decoding, from recorded NHTSA responses (no network);
  - settings, session, menus, demo data, and the editors' state.
- **End to end** (`tests/e2e`, Playwright), the built app driven the way a user would:
  - the dashboard, customers, and search;
  - building, saving, voiding, and printing work orders, and estimates from quote to work order;
  - undo/redo, unsaved-change prompts, and keyboard shortcuts;
  - PDF and Excel export, preferences, backups and restore, and the Java import.

End-to-end tests launch the app with a temporary data folder, so they never touch dev or installed data. Native dialogs (save, open, print, confirmations) are replaced with stubs that return set answers.

## Project layout

| Path                 | What's there                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/main/`          | The main process: window and menu, IPC handlers, printing, Excel export, backups, the Java import, demo data    |
| `src/main/db/`       | The SQLite schema and repositories (customers, vehicles, parts, work orders, estimates)                         |
| `src/preload/`       | Exposes the main process's API to the interface as `window.api`                                                 |
| `src/renderer/src/`  | The interface (React 19, HeroUI v3, Tailwind 4, TanStack Query): pages, components, and the open editors' state |
| `src/shared/`        | Code both sides use: types, the IPC contract (`api.ts`), billing math, estimate helpers                         |
| `tests/`             | Unit tests, end-to-end tests, and fixtures                                                                      |
| `build/`, `scripts/` | Icons and packaging (electron-builder; `build/afterPack.cjs` keeps only the target platform's SQLite build)     |

The interface never touches the database directly. It calls `window.api.<area>.<method>()`, which the preload script sends over IPC to the handlers in `src/main/ipc.ts`. To add a call, add it to `Api` and `API_METHODS` in `src/shared/api.ts`; TypeScript then requires its handler in `ipc.ts`.

## License

MIT
