# Repairshop-Manager

## Overview

Repairshop-Manager is an application designed to manage auto repair shop operations including work orders, invoices, inventory, and available auto parts/cars for sale. Initially, all data is planned to be stored locally on the machine, with future plans to implement a backend for database storage. This will enable multiple instances of the application to manage auto repair shops across different machines.

## Planned Features

- **Work Orders**: Create, update, and manage work orders for repairs and services.
- **Invoices**: Generate invoices for completed work orders and track payment status.
- **Inventory Management**: Keep track of inventory for auto parts and manage stock levels.
- **Sales Management**: Maintain a catalog of cars and auto parts available for sale.
- **Customer and Vehicle Information**: Store customer details and vehicle information for efficient work order creation and management.
- **VIN Decoder**: Automatically decode VINs (Vehicle Identification Numbers) in work orders for quick identification and retrieval of vehicle details.
- **Backend Integration**: Design and implement backend to support database storage.
- **Multi-machine Support**: Enable synchronization and simultaneous usage across different machines.
- **Enhanced UI/UX**: Improve user interface and experience based on feedback and usability testing.

## Development

```bash
npm install
npm run dev
```

### Demo data

Development runs (`npm run dev`) keep their data in a separate folder, so they never touch the database of an installed copy of the app:

| OS      | Dev data folder                                     |
| ------- | --------------------------------------------------- |
| macOS   | `~/Library/Application Support/Wrench Master (Dev)` |
| Windows | `%APPDATA%\Wrench Master (Dev)`                     |
| Linux   | `~/.config/Wrench Master (Dev)`                     |

To try the app with realistic data:

| Command            | What it does                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:seed`  | Fills the dev database with demo customers, vehicles, parts, and about 18 months of work orders (some open, some unpaid). Refuses if the dev database already has data. |
| `npm run db:drop`  | Deletes the dev database and the list of open/recent work orders. Preferences are kept.                                                                                 |
| `npm run db:reset` | Drop, then seed.                                                                                                                                                        |

The demo data is the same every time, with dates relative to today, so the dashboard always shows recent activity. Run these while the app is closed.

> In VS Code's integrated terminal, `ELECTRON_RUN_AS_NODE` may be set, which stops Electron from starting as an app. If `npm run dev` or these commands fail with an error about `isPackaged`, run `unset ELECTRON_RUN_AS_NODE` first.

## Tests

| Command              | What it runs                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`           | Unit and integration tests (Vitest, about a second): the database layer against a database written the way the Java app wrote it, billing, invoices, Excel export, the Java import, VIN decoding (recorded NHTSA responses, no network), settings, menus, and the work order editor's state. |
| `npm run test:watch` | The same, re-running as files change.                                                                                                                                                                                                                                                        |
| `npm run test:e2e`   | Builds the app and drives it end to end with Playwright (about 35 seconds): dashboard, customers, building and saving work orders, undo/redo, unsaved-change prompts, printing, PDF and Excel export, preferences, and importing from the Java app.                                          |

End-to-end tests launch the real app with a temporary data folder, so they never touch your dev or installed data. Native dialogs (save, print, confirmations) are replaced with stubs that return set answers.

## Building installers

| Command               | Output (in `dist/`)                                                          |
| --------------------- | ---------------------------------------------------------------------------- |
| `npm run build:win`   | `wrench-master-<version>-setup.exe` (Windows x64 installer)                  |
| `npm run build:mac`   | `wrench-master-<version>-arm64.dmg` and `-x64.dmg` (Apple silicon and Intel) |
| `npm run build:linux` | AppImage and `.deb`                                                          |

The Windows installer can be built on a Mac. Builds aren't code-signed yet, so Windows SmartScreen and macOS Gatekeeper will warn the first time the app is opened.

An installed copy keeps its data (database, settings) in `Wrench Master` in the same locations as the dev folder above, without `(Dev)`. Uninstalling doesn't delete it. To move data over from the Java version, use **File › Import from Autoshop Invoice Manager**.

## License

[MIT License](LICENSE)
