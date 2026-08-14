# Changelog — CanvaBase

All notable changes to the **CanvaBase** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Post-G3 UI Polish (2026-08-14)
> Backfilled dari `docs/audit/walkthrough7*.md` — menyelesaikan siklus G3 Development.

#### Added
- **Master-Detail Navigation System** (Navicat UX): klik root *Tables* → tampil **Database Dashboard**; klik tabel → Inspector sync metadata; klik subfolder *Fields/Indexes/FK* → langsung menuju section terkait di Table Designer (`designerSection` store state).
- **Database Dashboard** 3 view modes: **Cards**, **Dense List**, dan **Details Table** (sortable per kolom — Name/Type/Rows/Cols/Idx/FK/Size/Date Modified; double-click buka data tabel).
- **Object metadata introspection nyata**: `objectNodeSchema` + `indexes`/`foreignKeys`/`engine`/`sizeBytes`/`updatedAt`/`createdAt`/`comment` via `ObjectBrowserService` (MySQL `information_schema`, Postgres `pg_*`, SQLite `PRAGMA`).
- **WelcomeScreen** (`WelcomeScreen.tsx`): hero brand + logo, quick actions (New Connection / New Query / ERD), saved connections 1-click connect, ringkasan shortcuts (Ctrl+Enter, Ctrl+Space, dll) & feature highlights.
- **Full-width StatusBar** dipindah dari dalam `.app-body` ke bawah `.app-shell` (100% width ala VS Code/Navicat) — memuat pagination (page size selectable), mode toggle Grid/Form (query view) dan Cards/List/Details (database view).

#### Changed
- **Tab lifecycle** (`store.ts`): `closeTab` set `activeTabId: ''` saat tab terakhir; `openTable` selalu menjamin tab aktif + `SELECT * FROM table LIMIT 500`.
- **Brand button**: logo CanvaBase di `HeaderToolbar` jadi tombol toggle Inspector sidebar (`.cb-brand-btn`); tombol terpisah dihapus.
- **Native theme sync**: IPC channel `themeSet` baru — `nativeTheme.themeSource` + `win.setBackgroundColor` + `setTitleBarOverlay` → titlebar Windows ikut dark/light.
- **Glassmorphism nyata**: buang `opacity 0.45` pada `.app-shell`, pakai `color-mix` + `var(--cb-surface-opacity)`/`--cb-glass-blur` + `backdrop-filter blur saturate(160%)` (teks/ikon tetap tajam, dark & light).
- **Logo asset**: `docs/audit/img/CanvaBase.png` → `assets/logo.png` (dipakai di splash, brand button, hero WelcomeScreen).

#### Fixed
- React error **#310** di `TableDesigner.tsx` (hook dipanggil di bawah conditional early return → pindah ke baris teratas komponen).
- Card overflow `.db-object-card` (flex-direction column + `.db-card-metadata` compact grid + `minmax(240px,1fr)`).

### Planned (Roadmap v1.x & v2.0)
- **v1.x (Pro & Community Enhancements)**:
  - SSH Tunneling backend + re-enable SSH tab di Connection form (tab saat ini di-disable karena backend belum ada) (v1.1).
  - Connection Groups untuk organisasi koneksi (v1.1).
  - `verify-full` SSL mode (v1.1).
  - Table Designer ALTER-mode support (v1.1).
  - Visual Query Builder & Graphical Explain Plan visualizer (PRD-F-09).
  - Native Backup & Restore wrappers untuk `mysqldump` dan `pg_dump` (PRD-F-10 — export-based partial sudah ada di Community).
  - Multi-database Schema Comparison & Data Synchronization (PRD-F-11).
  - Extended file formats: Excel (`.xlsx`) & XML import/export (PRD-F-12).
  - Quick Command Palette (`⌘K` / `Ctrl+K`) navigation (PRD-NFR-13).
  - Worker thread offloading untuk transfer data besar.
  - Opt-in telemetry (PRD-NFR-14).
- **v2.0 (Engine Expansion & Multi-Engine Support)**:
  - Microsoft SQL Server (MSSQL) adapter via `tedious` driver.
  - MongoDB document collection driver adapter via `mongodb` driver.
  - Web-Ready deployment model (Self-hosted 1-user Community & Hosted SaaS Pro).

---

## [0.1.0-mvp] - 2026-08-13

### Added
- **Connection Manager (PRD-F-01)**:
  - Multi-engine database connection support for **MySQL / MariaDB**, **PostgreSQL**, and **SQLite**.
  - Support for TLS/SSL connection modes (`disabled`, `required`, `verify`).
  - SSH Tunnel tab di-disable + badge "v1.1" (backend tunneling dijadwalkan v1.1, lihat roadmap).
  - Connection Groups dijadwalkan v1.1 (lihat roadmap).
- **Object Browser (PRD-F-02)**:
  - Hierarchical object tree displaying databases, schemas, tables, views, stored procedures, functions, triggers, and database users/roles.
  - Deep tree subfolders untuk nested object types.
  - Engine Capability Detection integration untuk dynamic UI rendering.
- **Query Editor (PRD-F-03)**:
  - Custom zero-dependency SQL tokenizer & syntax highlighter (`sqlHighlighter.ts`), multi-tab SQL workspace.
  - Context-aware autocomplete (keyword + schema object suggestion) dan saved queries.
  - Query execution cancellation menggunakan `AbortController` signals.
- **Virtualized Result Grid (PRD-F-04)**:
  - High-performance TanStack Virtual grid (1M+ rows — memori grid <400MB, benchmark terverifikasi; target 60fps scrolling).
  - Chunked result streaming dengan backpressure control.
  - Multi-column sorting, filtering, multi-row selection, dan pagination.
- **Data Viewer / Editor (PRD-F-05)**:
  - Direct inline cell editing dengan cell state diff tracking.
  - Add new record rows dan delete selected records dengan primary key protection.
  - Form View (grid display mode) untuk editing baris per baris.
- **Visual Table Designer (PRD-F-06)**:
  - Visual column schema management (name, data type, length, nullability, defaults, auto-increment).
  - Primary keys, multi-column indexes, dan Foreign Key relationship editor.
  - Real-time DDL SQL script preview sebelum applying (CREATE-only; ALTER deferred v1.1).
- **Interactive ERD Canvas (PRD-F-07)**:
  - Auto-generated Entity-Relationship Diagrams powered by **React Flow (`@xyflow/react`)**.
  - Interactive table node dragging, relationship highlighting, dan export PNG/SVG.
- **Streaming Import & Export (PRD-F-08)**:
  - Multi-format data export (CSV, SQL insert statements, JSON).
  - Streamed CSV/JSON data import dengan type coercion dan header validation (streaming di main process, bukan worker threads).
  - Backup/Restore export-based (CSV/SQL/TXT) — F-10 partial (native `mysqldump`/`pg_dump` wrappers: roadmap v1.x).
- **Database Dashboard & Inspector (post-MVP)**:
  - Dashboard: object counts, row counts, sample DDL.
  - Inspector tabs: Info, DDL, dan AI Assistant (query plan / SQL explanation).
- **Theming Engine (PRD-NFR-01)**:
  - Theme mode switcher (`light`, `dark`, `system`).
  - Custom accent color, UI font & monospace font picker, grid density toggles (`compact` vs `comfortable`), toolbar display style.
  - **Theme Profile JSON**: export (`⬇️ Export Theme`) & import (`⬆️ Import Theme`) tema sebagai file JSON (`ThemeProfile`).
  - Density & toolbar settings persist per connection.

### Security
- **OS Keychain Security (PRD-NFR-06)**:
  - Credentials encrypted at rest menggunakan Electron `safeStorage` (Windows Credential Manager, macOS Keychain, Linux `libsecret`).
  - Fallback AES-256-GCM (`KeychainCrypto.ts`): machine-bound key file (`keychain.key`, mode 0o600), format `cb1.<iv>.<tag>.<cipher>` — aktif otomatis tanpa prompt saat OS keychain unavailable.
  - Zero plaintext password storage di application SQLite database atau config files.
- **SQL Injection Prevention (PRD-NFR-07)**:
  - Enforced 100% parameterized query execution across all drivers (`?` dan `$1` parameter bindings).
  - Identifier sanitization dan strict identifier quoting di DDL generators.
- **Electron Process Hardening**:
  - Activated strict process isolation: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Implemented strict Content Security Policy (CSP) dan safe text-based grid rendering terhadap XSS.
- **Log Sanitization (PRD-NFR-12)**:
  - Log sanitization untuk scrub passwords, private keys, connection strings, dan tokens dari log.
- **UU PDP & GDPR Compliance**:
  - Implemented right-to-erasure (deleting connection clears keychain + app-state rows) dan audit logging untuk sensitive DDL & export operations.

### Changed
- **SSH Tunnel tab disabled** (`ConnectionModal`): tab SSH di-disable + badge "v1.1" karena backend tunnel belum diimplementasikan — mencegah user mengira SSH aktif padahal tidak berfungsi (roadmap v1.1).
- **SQLite dual-driver** (`sqlite-driver.ts`): feature-detect `node:sqlite` (primary) → `better-sqlite3` fallback (optionalDependency). Menghilangkan risiko crash koneksi SQLite di packaged app Electron 33 (Node 20.18 tanpa `node:sqlite`).

### Architecture & Performance
- **Monorepo Architecture**:
  - Established `npm workspaces` monorepo structure separating `packages/dialects`, `packages/contracts`, `packages/desktop`, and `packages/shared`.
- **Hexagonal Architecture (`DialectPort`)**:
  - Defined unified `DialectPort` abstraction interface ensuring zero UI refactoring when adding future database drivers.
- **Typed IPC Surface**:
  - Created versioned Zod schemas in `packages/contracts` for Electron Main ↔ Renderer IPC payload validation.
  - Standardized `ClientError` hierarchy (`NETWORK`, `TIMEOUT`, `BUSINESS`, `VALIDATION`) and `Result<T>` envelope response wrapper.
- **Web-Ready Design (`Client` Interface)**:
  - Abstracted renderer API access behind `Client` interface to enable 1:1 mapping between Desktop IPC and Web HTTP/WebSocket transports for future web releases.
- **Performance Benchmarking**:
  - Achieved strict memory budgets (Idle memory <200MB, virtualized grid memory <400MB).
  - Enforced bundle size limit (<250kB gzip renderer bundle).
- **Performance CI (`performance.yml`)**:
  - GitHub Actions workflow: size-limit check, memory budget check (idle + grid), dan grid benchmark (1M rows heap <400MB, filter 1M <5s, sort 200k <5s).
- **Query Engine**:
  - Multi-statement SQL parsing & execution (results per statement), pagination pada result grid.
- **Import/Export (main process streaming)**:
  - Transfer service streaming via Node streams (`createWriteStream` / `createReadStream`) di main process — bukan worker threads (worker threads: roadmap v1.1).
