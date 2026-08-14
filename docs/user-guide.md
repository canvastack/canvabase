# 📖 CanvaBase End-User Guide

Welcome to the **CanvaBase User Guide**. CanvaBase is a modern, high-performance database management desktop application developed by **CanvaStack**. This guide will help database administrators, developers, and analysts effectively configure, query, design, and manage databases using CanvaBase.

---

## 📑 Table of Contents
1. [Overview & System Requirements](#1-overview--system-requirements)
2. [Installation & First Launch](#2-installation--first-launch)
3. [Connection Management](#3-connection-management)
   - [Creating a New Connection](#creating-a-new-connection)
   - [Configuring SSL/TLS & SSH Tunnels](#configuring-ssltls--ssh-tunnels)
   - [Connection Groups](#connection-groups)
   - [How Passwords Are Secured](#how-passwords-are-secured)
4. [Exploring Databases with Object Browser](#4-exploring-databases-with-object-browser)
5. [Mastering the Query Editor](#5-mastering-the-query-editor)
   - [Multi-Tab Workspace](#multi-tab-workspace)
   - [Autocomplete & Formatting](#autocomplete--formatting)
   - [Executing & Stopping Queries](#executing--stopping-queries)
   - [Saved Queries](#saved-queries)
6. [Data Viewing & Inline Editing (Result Grid)](#6-data-viewing--inline-editing-result-grid)
   - [Virtual Scrolling (1M+ Rows)](#virtual-scrolling-1m-rows)
   - [Editing Cells & Row Operations](#editing-cells--row-operations)
   - [Filtering & Sorting Data](#filtering--sorting-data)
7. [Visual Table Designer](#7-visual-table-designer)
   - [Managing Columns & Data Types](#managing-columns--data-types)
   - [Indexes & Foreign Keys](#indexes--foreign-keys)
   - [Previewing DDL SQL](#previewing-ddl-sql)
8. [ERD Diagram Canvas](#8-erd-diagram-canvas)
   - [Generating Schema Diagrams](#generating-schema-diagrams)
   - [Interacting & Exporting (PNG/SVG)](#interacting--exporting-pngsvg)
9. [Import, Export & Backup Wizard](#9-import-export--backup-wizard)
   - [Exporting Data (CSV, SQL, JSON)](#exporting-data-csv-sql-json)
   - [Importing Datasets Safely](#importing-datasets-safely)
   - [Backup & Restore (Export-Based)](#backup--restore-export-based)
10. [Database Dashboard & Inspector](#10-database-dashboard--inspector)
11. [Theming & Personalization](#11-theming--personalization)
12. [Security, Privacy & UU PDP Compliance](#12-security-privacy--uu-pdp-compliance)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)

---

## 1. Overview & System Requirements

CanvaBase provides a local-first GUI client for **MySQL / MariaDB**, **PostgreSQL**, and **SQLite**.

### Minimum System Requirements:
- **Windows**: Windows 10 or Windows 11 (64-bit)
- **macOS**: macOS 12 Monterey or newer (Intel & Apple Silicon native)
- **Linux**: Ubuntu 20.04+, Fedora 36+, Debian 11+ (AppImage, `.deb`, `.rpm`)
- **RAM**: Minimum 4 GB (8 GB recommended for 1M+ row datasets)
- **Disk Space**: 250 MB for installation

---

## 2. Installation & First Launch

1. **Download**: Obtain the installation package for your OS from the official CanvaStack release page:
   - Windows: `CanvaBase-Setup-x64.exe`
   - macOS: `CanvaBase-x64.dmg` or `CanvaBase-arm64.dmg`
   - Linux: `CanvaBase-x64.AppImage` or `canvabase_amd64.deb`
2. **Welcome Screen**: On first startup, CanvaBase menampilkan **Welcome Screen** — hero brand + versi, quick actions (**New Connection** / **New Query** / **ERD**), daftar saved connections untuk connect 1-klik, dan ringkasan shortcuts (Ctrl+Enter run query, Ctrl+Space autocomplete, double-click grid cell untuk edit, right-click tabel untuk konteks menu). (Telemetry opt-in **belum diimplementasikan** — roadmap.)

> [!NOTE]
> CanvaBase operates **locally**. No database connection strings or query results are ever transmitted to cloud servers.

---

## 3. Connection Management

### Creating a New Connection

1. Click the **`+ New Connection`** button in the top left header or Object Browser.
2. Select your target database engine:
   - 🐬 **MySQL / MariaDB**
   - 🐘 **PostgreSQL**
   - 📁 **SQLite**
3. Enter connection details:
   - **Connection Name**: Display label (e.g., `Production Postgres Main`).
   - **Host & Port**: Server hostname/IP and port (default MySQL: `3306`, Postgres: `5432`).
   - **Database Name**: Default database to open upon connecting (for SQLite, browse to select the `.sqlite` / `.db` file).
   - **Username & Password**: Database user credentials.

### Configuring SSL/TLS & SSH Tunnels

- **SSL/TLS Tab**: Select SSL Mode (`Required`, `Verify-CA`) untuk koneksi terenkripsi.
- **SSH Tunnel Tab**: Tab SSH di form koneksi saat ini **di-disable** (badge "v1.1") karena backend tunneling belum diimplementasikan di v0.1.0-mvp — mencegah user mengaktifkan setting yang tidak berfungsi. SSH tunneling akan aktif di rilis v1.1.

### Connection Groups

Folder groups untuk mengorganisasi koneksi (*Production*, *Staging*, *Local Dev*) **belum tersedia** di v0.1.0-mvp — dijadwalkan v1.1.

### How Passwords Are Secured

CanvaBase enforces enterprise-grade credential security:
- **OS Keychain Integration**: Passwords are encrypted using Electron's `safeStorage` API backed by **Windows Credential Manager**, **macOS Keychain**, or **Linux libsecret**.
- **No Plaintext Storage**: Connection profiles saved to disk contain only non-sensitive metadata (`host`, `username`, `port`) and a secure pointer `keychain_ref`.
- **Fallback**: Jika OS keychain unavailable (misal Linux tanpa `libsecret`), credential dienkripsi **AES-256-GCM** dengan machine-bound key file (`keychain.key`, permission ketat) — tanpa prompt, otomatis di `init()`.

---

## 4. Exploring Databases with Object Browser

The **Object Browser** sidebar displays a live tree structure of your database resources:

```
▼ 🐘 Postgres Production
  ▼ 📁 public (schema)
    ► 📑 Tables (24)
    ► 👁️ Views (8)
    ► ⚡ Functions & Procedures (12)
    ► 🔔 Triggers (4)
  ► 👥 Users & Roles (5)
```

- **Capability Detection**: Menu options and tree nodes automatically adjust based on your database engine. For example, Foreign Keys and Triggers appear for relational engines, while non-supported engine features remain hidden cleanly.
- **Deep Tree Subfolders**: Tipe objek bersarang (misal index, foreign key, kolom) ditampilkan sebagai subfolder ekspandable di bawah node tabel/induk.
- **Search Filter**: Use the filter bar at the top of the browser to search for table or column names across large schemas.
- **Context Menus**: Right-click any object to access quick actions: *Select Top 1000 Rows*, *Design Table*, *Truncate*, *Drop*, *Generate ERD*, atau membuka objek spesifik (users/roles, views, dsb).

---

## 5. Mastering the Query Editor

### Multi-Tab Workspace
Open multiple SQL query tabs simultaneously. Tabs retain individual connection contexts, selected databases, cursor positions, and unsaved changes.

### Autocomplete & Highlighting
- **Context-Aware Autocomplete**: Press `Ctrl+Space` (or `⌘Space`) to trigger suggestions for SQL keywords, table names, schema objects, and column names.
- **Syntax Highlighting**: The editor ships with a built-in zero-dependency SQL highlighter (no external editor engine). Auto-formatting (`Format` / `Shift+Alt+F`) belum tersedia di v0.1.0-mvp.

### Executing & Stopping Queries
- **Execute**: Highlight specific SQL statements or run the entire editor contents by clicking **Run** (`Ctrl+Enter` / `⌘Enter`).
- **Cancel Query**: For long-running queries, click the **Stop** button. CanvaBase dispatches an instant `AbortController` cancellation signal to the database engine to terminate server-side query processing immediately.

### Saved Queries
- **Saved Queries**: Click the **Save** icon to save frequently used SQL scripts locally, lalu buka kembali dari panel *Saved*. (Execution history panel belum tersedia di v0.1.0-mvp.)

---

## 6. Data Viewing & Inline Editing (Result Grid)

### Virtual Scrolling (1M+ Rows)
CanvaBase utilizes **TanStack Virtual** row virtualization. Result sets containing hundreds of thousands or over 1,000,000 rows scroll smoothly while keeping memory consumption under 400 MB (terverifikasi di CI benchmark). Pagination tersedia untuk menavigasi hasil dalam halaman-halaman kecil.

### Editing Cells & Row Operations
- **Inline Cell Edit**: Double-click any cell in the result grid to edit values directly. Modified cells highlight in yellow.
- **Insert Row**: Click **`+ Add Row`** at the bottom of the grid to insert new records.
- **Delete Row**: Select rows (single or multi-select) and click **`Delete Selected`**.
- **Apply Changes**: Click **Apply Changes** (`Ctrl+S` / `⌘S`). CanvaBase constructs parameterized `UPDATE`, `INSERT`, or `DELETE` statements locked by primary key identifiers.
- **Form View**: Toggle ke mode **Form View** untuk melihat & mengedit satu record per baris dalam layout form (berguna untuk tabel dengan kolom banyak).

### Filtering & Sorting Data
- **Quick Sort**: Click any column header to toggle ascending or descending order.
- **Filter Bar**: Click **Filter** to create multi-condition visual rules (e.g., `status EQUALS 'active'` AND `created_at GREATER_THAN '2026-01-01'`).

---

## 7. Visual Table Designer

To open the Table Designer, right-click any table in the Object Browser and select **Design Table**, or click **Create Table**.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Column Name    │ Data Type    │ Length │ Nullable │ PK │ AutoInc │ Default│
├────────────────┼──────────────┼────────┼──────────┼────┼─────────┼────────┤
│ id             │ BIGINT       │ —      │ ☐       │ ☑  │ ☑       │ NULL   │
│ email          │ VARCHAR      │ 255    │ ☐       │ ☐  │ ☐       │ NULL   │
│ created_at     │ TIMESTAMP    │ —      │ ☐       │ ☐  │ ☐       │ NOW()  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Managing Columns & Data Types
Add, remove, or reorder table columns. Select data types from engine-specific drop-down lists (e.g., `VARCHAR`, `INT`, `UUID`, `JSON`, `TEXT`).

### Indexes & Foreign Keys
- **Indexes Tab**: Define single-column or composite indexes, set `UNIQUE` constraints, and choose index types (e.g., `BTREE`, `HASH`).
- **Foreign Keys Tab**: Configure relational constraints linking child columns to parent reference tables with `ON DELETE` and `ON UPDATE` actions (`CASCADE`, `SET NULL`, `RESTRICT`).

### Previewing DDL SQL
Click **Preview DDL** before saving. CanvaBase displays the exact, dialect-formatted SQL migration script (`CREATE TABLE` or `ALTER TABLE`) for audit review before running it on the server.

---

## 8. ERD Diagram Canvas

Visualizing complex relational database structures is seamless with CanvaBase's built-in ERD engine powered by **React Flow (@xyflow/react)**.

### Generating Schema Diagrams
1. Right-click a database schema in the Object Browser and select **Generate ERD Canvas**.
2. CanvaBase inspects foreign keys and table structures to generate interactive table nodes connected by foreign key relationship connectors.

### Interacting & Exporting (PNG/SVG)
- **Navigation**: Drag table cards, zoom in/out with the mouse wheel, and click any table to highlight its connections.
- **Exporting**: Click **Export Diagram** in the canvas top bar to save high-resolution vector diagrams as **PNG** or **SVG** image files.

---

## 9. Import, Export & Backup Wizard

### Exporting Data (CSV, SQL, JSON)
1. Click **Export Data** from a table context menu or result grid header.
2. Select your preferred output format:
   - **CSV**: Configurable delimiter (comma, tab, semicolon), quote character, and header row toggle.
   - **SQL**: Generates standard SQL `INSERT` statement batch dumps.
   - **JSON**: Dumps records into formatted JSON arrays.
3. Operations run asynchronously with streaming I/O di background, preventing UI freeze even during multi-gigabyte transfers.

### Importing Datasets Safely
1. Click **Import Data** and select a source `.csv` or `.json` file.
2. **Column Mapping**: Map source file columns to target table columns.
3. **Data Validation**: CanvaBase sanitizes CSV headers against SQL injection keywords and validates data types (e.g., coercing numeric strings to integer targets) before performing batch inserts.

### Backup & Restore (Export-Based)
- **Backup**: Dari menu database/table, pilih **Backup** untuk mengekspor seluruh database atau satu tabel ke file `CSV`, `SQL`, atau `TXT`.
- **Restore**: Pilih **Restore** dan arahkan ke file backup untuk mengimpor kembali data.
- Fitur ini berbasis export (F-10 partial). Native wrapper `mysqldump`/`pg_dump` dijadwalkan v1.x (Pro Edition).

---

## 10. Database Dashboard & Inspector

Saat memilih database di Object Browser, CanvaBase menampilkan **Database Dashboard** dengan **3 view modes** (toggle di bottom bar):

- **Cards**: kartu per tabel/view/procedure/trigger (nama, engine, metadata pill).
- **List** (Dense List): daftar ringkas tanpa gambar.
- **Details** (Details Table): tabel sortable ala Windows Explorer — klik header kolom untuk mengurutkan (Name, Type, Rows, Cols, Indexes, FKs, Size, Date Modified).

**Master-Detail Navigation**:
- Klik root **Tables** → dashboard tampil di area utama.
- Klik **tabel** → metadata tersinkron di panel Inspector.
- Klik subfolder **Fields / Indexes / FK** → langsung menuju section terkait di Table Designer.
- **Double-click** pada tabel/view → membuka data tabel (query `SELECT * ... LIMIT 500`) di tab baru.

Panel **Inspector** di sisi kanan menyediakan tab:
- **Info**: Metadata object yang sedang dipilih (engine, size, created/updated, dsb).
- **DDL**: SQL definisi object (CREATE statement) + tombol copy.
- **AI**: Asisten AI untuk menjelaskan struktur atau DDL object.

---

## 11. Theming & Personalization

Tailor CanvaBase's UI to match your desktop aesthetic via **Settings → Appearance**:

- **Color Mode**: Switch between **Dark Mode**, **Light Mode**, or **System Synchronized**.
- **Accent Palette**: Select custom accent highlights (Indigo, Emerald, Crimson, Amber, Slate, Violet).
- **Grid Density**: Toggle between **Compact** (maximum visible rows) and **Comfortable** (spacious padding).
- **Custom Fonts**: Set your favorite UI font (e.g., *Inter*, *Roboto*) and Monospaced code font (e.g., *JetBrains Mono*, *Fira Code*).
- **Toolbar Display**: Pilih gaya toolbar (icon/label).
- **Theme Profile (JSON)**: Ekspor tema saat ini sebagai file JSON (`⬇️ Export Theme`) atau impor kembali (`⬆️ Import Theme`) untuk berbagi/pindah antar perangkat.
- Preferensi density & toolbar tersimpan per koneksi.

---

## 12. Security, Privacy & UU PDP Compliance

CanvaBase adheres to strict security standards and privacy regulations (including **UU PDP Indonesia** & **GDPR**):

- 🔒 **Data Minimization**: Non-telemetry metadata is strictly local.
- 🗑️ **Right to Erasure**: Deleting a connection entry immediately purges its encrypted keychain record and app-state metadata.
- 📝 **Audit Logging**: Sensitive operations—such as dropping tables, executing high-risk DDL statements, or conducting bulk exports—are recorded in an internal append-only audit log for security compliance.
- 🛡️ **Zero Plaintext Logs**: All internal application logs scrub credentials, tokens, and raw passwords automatically.

---

## 13. Troubleshooting & FAQ

### Q: Why is my password stored in an encrypted file instead of the keychain?
**A**: If your Linux system does not have `libsecret` or `gnome-keychain` installed, Electron's `safeStorage` cannot use the OS keychain, and CanvaBase falls back to **AES-256-GCM encryption** with a machine-bound key file (`keychain.key`). Installing `libsecret-1-0` enables proper OS-keychain encryption on the next launch.

### Q: Can I cancel a long-running query without killing the app?
**A**: Yes! Clicking the **Stop** button in the Query Editor sends an `AbortController` cancellation signal over the driver connection to terminate query execution server-side without crashing CanvaBase.

### Q: How do I move my database connections to a new computer?
**A**: Saat ini koneksi tersimpan lokal di app-state (metadata) dengan kredensial terenkripsi di keychain/`keychain.key` mesin tersebut — belum ada fitur export/import profile koneksi di v0.1.0-mvp (roadmap). Untuk pindah, buat ulang koneksi di mesin baru. Catatan keamanan: password tidak pernah disimpan plaintext dan terkunci pada mesin asal.

---

*Need developer technical details or interested in contributing? Check out the [Developer & Contributor Guide](developer-guide.md).*
