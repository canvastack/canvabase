<div align="center">

# 🗄️ CanvaBase

**Next-Generation Database Management Desktop App for Developers & DBAs**

*Empowering developers with a modern, fast, secure, and beautiful Navicat alternative.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Monorepo](https://img.shields.io/badge/Architecture-Monorepo%20(npm%20workspaces)-informational.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.x-blue.svg)]()
[![Electron](https://img.shields.io/badge/Electron-33%2B-47848F.svg)]()
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB.svg)]()

[Features](#-key-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture-overview) • [Security](#-security--privacy) • [User Guide](docs/user-guide.md) • [Developer Guide](docs/developer-guide.md)

</div>

---

## 📌 Overview

**CanvaBase** is a high-performance desktop database client developed under the **CanvaStack** ecosystem. Designed to solve the pain points of expensive commercial database GUI tools (such as Navicat) and outdated legacy free tools, CanvaBase provides a state-of-the-art, local-first database management experience equipped with rich visuals, ultra-fast data virtualization, visual schema modeling, and enterprise-grade security.

Whether managing local SQLite databases, cloud PostgreSQL clusters, or production MySQL servers, CanvaBase delivers a slick, modern user interface without compromising performance or privacy.

---

## ✨ Key Features (MVP v1.0)

### 🚀 0. Welcome Screen
- Hero brand + versi, quick actions (**New Connection / New Query / ERD**), saved connections 1-click connect, ringkasan user guide (shortcuts & highlights) — ala VS Code/Navicat saat app dibuka tanpa tab aktif.

### 🔑 1. Connection Manager (PRD-F-01)
- **Multi-Engine Support**: Native connection support for **MySQL / MariaDB**, **PostgreSQL**, and **SQLite**.
- **Secure Authentication**: Credentials are encrypted using native OS Keychains (`safeStorage`) — **zero plaintext passwords stored in database or configuration files**.
- **Encrypted Tunnels**: TLS/SSL mode configuration (`disabled`, `required`, `verify`). SSH tunnel tab di-disable (backend dijadwalkan v1.1).
- **Group Management**: Tree-structured Connection Groups dijadwalkan v1.1.

### 🌳 2. Object Browser (PRD-F-02)
- Deep tree exploration of schemas, tables, views, stored procedures, functions, triggers, users/roles, dan nested subfolder object types.
- **Capability Detection**: Adapts UI elements dynamically based on engine capabilities rather than static driver checks.

### 📝 3. Query Editor (PRD-F-03)
- Custom zero-dependency SQL tokenizer & syntax highlighter (`sqlHighlighter.ts`).
- Multi-tab editing, context-aware autocomplete, saved queries, dan real-time query cancellation backed by `AbortController` signals.

### 📊 4. Virtualized Result Grid (PRD-F-04 & PRD-F-05)
- **1M+ Rows**: Smooth virtualized scrolling powered by **TanStack Virtual** (memori grid terverifikasi <400MB di CI).
- **Inline Editing & Direct CRUD**: Modify cell values, add rows, dan delete records langsung dari grid dengan automatic SQL generation dan primary-key safety.
- **Form View**: edit record satu per satu dalam layout form.
- Instant column sorting, dynamic multi-field filtering, multi-row selection, dan pagination.

### 📐 5. Visual Table Designer (PRD-F-06)
- Visually create database table structures.
- Manage columns, data types, nullability, auto-increment, default values, primary keys, indexes, dan foreign key constraints.
- **DDL Preview**: Review exact generated SQL scripts sebelum applying changes (CREATE-only; ALTER dijadwalkan v1.1).

### 🎨 6. Interactive ERD Canvas (PRD-F-07)
- Automatically generate Entity-Relationship Diagrams (ERD) dari live schema metadata menggunakan **React Flow (`@xyflow/react`)**.
- Drag-and-drop table layouts, relationship path highlighting, dan export PNG/SVG.

### ⚡ 7. Streaming Import & Export (PRD-F-08)
- Data transfer untuk **CSV**, **SQL dump**, dan **JSON** files — streamed di main process dengan backpressure handling untuk dataset besar.
- Backup/Restore export-based (CSV/SQL/TXT); native `mysqldump`/`pg_dump` wrappers dijadwalkan v1.x (Pro).

### 🖥️ 8. Database Dashboard & Inspector (post-MVP)
- **Database Dashboard**: tampilan database sebagai **3 view modes** — Cards, Dense List, dan Details Table (sortable per kolom: Name/Type/Rows/Cols/Idx/FK/Size/Date Modified ala Windows Explorer). Double-click tabel membuka datanya langsung.
- **Master-Detail Navigation**: klik root *Tables* → dashboard, klik tabel → Inspector sync metadata, klik *Fields/Indexes/FK* → langsung menuju section terkait di Table Designer.
- **Inspector tabs**: Info, DDL, dan AI Assistant untuk menjelaskan struktur/DDL.

### 🌙 9. Custom Design System & Theming (PRD-NFR-01)
- **Light**, **Dark**, dan **System Sync** themes.
- Custom accent color, UI & monospaced font pickers, grid density toggles (`compact` vs `comfortable`), dan toolbar display style.

---

## 🏗️ Architecture Overview

CanvaBase is structured as a modular **Monorepo** using native **npm workspaces** following Hexagonal Architecture (Ports & Adapters) principles:

```
canvabase/
├── packages/
│   ├── dialects/      # Database Ports & Adapters (mysql2, pg, node:sqlite)
│   ├── contracts/     # Versioned IPC Zod schemas & client interfaces
│   ├── desktop/       # Electron Main process (Node.js) & Renderer UI (React)
│   └── shared/        # Shared utilities, types, and sanitizers
├── docs/              # End-User & Developer Documentation
├── scripts/           # Repo scanner & Waypoint SDLC check tools
└── tests/             # Cross-package contract test suites
```

### Key Technical Highlights:
- **`packages/dialects` (`DialectPort`)**: Standardized interface for database drivers. Adapters expose capability flags (`ssl`, `sshTunnel`, `streaming`, `cancellation`, `editableGrid`, `tableSchema`, `ddl`, `userManagement`, `nativeJson`, `databases`, `views`, `procedures`, `triggers`), allowing seamless future engine additions (MSSQL & MongoDB in v2.0) without core refactoring.
- **`packages/contracts`**: Single source of truth for IPC communication contracts between Electron Main and Renderer processes using strict Zod schemas.
- **Client Abstraction Interface (`Client`)**: Feature code in the UI interacts exclusively through a typed `Client` interface, ensuring **Web-Ready** decoupling (Desktop IPC ↔ HTTP/WebSocket mapping).

---

## 🔒 Security & Privacy

Security and data privacy (in compliance with **UU PDP Indonesia** & **GDPR**) are hardwired into CanvaBase:

- 🛡️ **Zero Plaintext Passwords**: Password credentials are encrypted using Electron's `safeStorage` API backed by **Windows Credential Manager**, **macOS Keychain**, or **Linux libsecret**. Jika OS keychain unavailable, CanvaBase otomatis memakai **AES-256-GCM encrypted file mode** (`KeychainCrypto.ts`): key 32-byte machine-bound (`keychain.key`, mode 0o600), format `cb1.<iv>.<tag>.<cipher>` — tanpa prompt.
- 💉 **SQL Injection Prevention**: All SQL values generated internally or executed via drivers use **parameterized binding** (`?` / `$1`). Raw string concatenation of user values is strictly prohibited.
- ⚡ **Electron Hardening**: Strict process isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`), strict Content Security Policy (CSP), and sanitized text-based grid rendering to neutralize XSS attacks.
- 🔍 **Log Sanitization**: Application logs scrub credentials, private keys, connection strings, and sensitive payloads automatically.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.x`, `v22.x`, or `v24.x` (LTS recommended)
- **npm**: `v9.x` or `v10.x`
- **Git**

### Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/canvastack/canvabase.git
   cd canvabase
   ```

2. **Install Workspace Dependencies**:
   ```bash
   npm install
   ```

3. **Build Shared Packages**:
   ```bash
   npm run build:packages
   ```

4. **Launch Application in Development Mode**:
   ```bash
   npm run dev
   ```

### Running Test Suites
```bash
# Run unit & contract test suites
npm run test

# Run tests with coverage reports
npm run test:coverage
```

### Packaging for Production
```bash
# Build desktop packages for target OS (Windows, macOS, Linux)
npm run package
```

---

## 💎 Community vs Pro Tier

CanvaBase is committed to offering a feature-rich, permanent **Free & Open Source Community Edition** for individual developers, students, and DBAs.

| Feature Area | Community Edition (FOSS) | Pro Edition |
| :--- | :---: | :---: |
| **Core SQL Engines** (MySQL, Postgres, SQLite) | ✅ | ✅ |
| **Connection Manager & Keychain Security** | ✅ | ✅ |
| **Object Browser & Query Editor** | ✅ | ✅ |
| **Virtual Result Grid (1M+ Rows)** | ✅ | ✅ |
| **Visual Table Designer & ERD Canvas** | ✅ | ✅ |
| **Import / Export** (CSV, SQL, JSON) | ✅ | ✅ |
| **Backup / Restore** (export-based, CSV/SQL/TXT) | ✅ (partial, F-10) | ✅ (native `mysqldump`/`pg_dump`, v1.x) |
| **SSH Tunneling & Connection Groups** | Planned (v1.1) | ✅ (v1.1) |
| **Full Custom Theming Engine** | ✅ | ✅ |
| **Advanced Engines** (MSSQL, MongoDB) | Planned (v2.0) | ✅ |
| **Visual Query Builder & Explain Plan** | — | ✅ (v1.x) |
| **Database Backup & Restore Tooling** | — | ✅ (v1.x) |
| **Data Sync & Schema Comparison** | — | ✅ (v1.x) |
| **Excel (.xlsx) & XML Transfer** | — | ✅ (v1.x) |
| **Team Collaboration & Shared Profiles** | — | ✅ (v2.x) |

---

## 📖 Documentation & Guides

For detailed instructions and technical documentation, refer to the guides in the `docs/` directory:

- 📘 **[End-User Guide](docs/user-guide.md)** — Step-by-step user manual covering connection setup, query execution, grid editing, table designer, ERD canvas, import/export, and customizing themes.
- 🛠️ **[Developer & Contributor Guide](docs/developer-guide.md)** — Complete developer handbook covering Hexagonal architecture, `DialectPort` implementation, Zod contract schemas, streaming backpressure, security compliance, testing, and contribution workflows.
- 📋 **[Changelog](CHANGELOG.md)** — Detailed record of releases, feature additions, security enhancements, and roadmap progress.

---

## 📄 License

CanvaBase Community Edition is released under the **MIT License**.

Designed & Developed by the **CanvaStack Team**.
