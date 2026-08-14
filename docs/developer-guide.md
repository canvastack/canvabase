# 🛠️ CanvaBase Developer & Contributor Guide

Welcome to the **CanvaBase Developer & Contributor Guide**. CanvaBase is designed and maintained by **CanvaStack** as a local-first, modular, high-performance database desktop client. This document details the technical architecture, development environment setup, database driver extensions, contract specifications, security enforcement, testing strategies, and contribution workflows.

---

## 📑 Table of Contents
1. [System Architecture](#1-system-architecture)
   - [Hexagonal Architecture (Ports & Adapters)](#hexagonal-architecture-ports--adapters)
   - [Electron Process Model](#electron-process-model)
   - [Web-Ready Design & Client Abstraction](#web-ready-design--client-abstraction)
2. [Monorepo Layout](#2-monorepo-layout)
3. [Environment Setup & Workflow](#3-environment-setup--workflow)
4. [Extending Database Adapters (`packages/dialects`)](#4-extending-database-adapters-packagesdialects)
   - [The `DialectPort` Interface](#the-dialectport-interface)
   - [Capability Detection Model](#capability-detection-model)
   - [Step-by-Step: Adding a New Database Engine](#step-by-step-adding-a-new-database-engine)
5. [IPC Contracts & Error Handling (`packages/contracts`)](#5-ipc-contracts--error-handling-packagescontracts)
   - [Contract Schema Structure](#contract-schema-structure)
   - [CredentialMode Security Pattern](#credentialmode-security-pattern)
   - [ClientError Hierarchy & Envelope](#clienterror-hierarchy--envelope)
6. [Streaming, Backpressure & Memory Cleanup](#6-streaming-backpressure--memory-cleanup)
   - [Async Iterator Streaming Spec](#async-iterator-streaming-spec)
   - [Backpressure (`pause` / `resume`)](#backpressure-pause--resume)
   - [Resource Cancellation (`AbortController`)](#resource-cancellation-abortcontroller)
7. [Security Standards & Hardening](#7-security-standards--hardening)
   - [OS Keychain & Fallback Encrypted Mode](#os-keychain--fallback-encrypted-mode)
   - [SQL Injection Prevention Rules](#sql-injection-prevention-rules)
   - [Import Validation & Sanitization Pipeline](#import-validation--sanitization-pipeline)
   - [Electron Security Configuration & CSP](#electron-security-configuration--csp)
   - [Log Sanitization](#log-sanitization)
8. [Testing & Quality Assurance](#8-testing--quality-assurance)
   - [Unit Testing](#unit-testing)
   - [Contract Test Suite (`dialectContractSuite`)](#contract-test-suite-dialectcontractsuite)
   - [Coverage Targets](#coverage-targets)
9. [Performance Budgets & Benchmarking](#9-performance-budgets--benchmarking)
10. [SDLC Workflow & Waypoint Hard Gates](#10-sdlc-workflow--waypoint-hard-gates)

---

## 1. System Architecture

CanvaBase follows **Hexagonal Architecture** (Ports & Adapters) to isolate database engine drivers, user interface components, and cross-process communication channels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CanvaBase Monorepo                               │
│                                                                             │
│  ┌───────────────────────────────┐     IPC     ┌─────────────────────────┐  │
│  │   RENDERER (React 19 SPA)   │ ──────────> │   MAIN (Node.js)        │  │
│  │   ───────────────────────── │  Preload    │   ────────────────────  │  │
│  │   • Feature Modules (Zustand) │  (Bridge)  │   • QueryEngine         │  │
│  │   • Custom SQL Highlighter  │ <────────── │   • ConnectionManager   │  │
│  │   • TanStack Virtual Grid   │             │   • ObjectBrowserService│  │
│  │   • React Flow ERD Canvas   │             │   • KeychainService     │  │
│  └───────────────┬──────────────┘             └────────────┬────────────┘  │
│                  │                                          │               │
│                  │ calls via Client interface               │ implements    │
│                  ▼                                          ▼               │
│  ┌───────────────────────────────┐             ┌─────────────────────────┐  │
│  │     packages/contracts        │             │    packages/dialects    │  │
│  │     • Typed Zod Schemas       │             │    • DialectPort        │  │
│  │     • Client Interface        │             │    • MySQL Adapter      │  │
│  │     • ClientError Standard    │             │    • Postgres Adapter   │  │
│  └───────────────────────────────┘             │    • SQLite Adapter     │  │
│                                                └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hexagonal Architecture (Ports & Adapters)
Core application services do not interface directly with database-specific driver libraries (`mysql2`, `pg`, `node:sqlite`). Instead, all interaction flows through the **`DialectPort`** abstraction interface.

### Electron Process Model
- **Main Process (Node.js)**: Responsible for native OS Keychain management (`safeStorage`), application state persistence (SQLite), driver connection pooling, streaming I/O untuk transfer data (import/export/backup), dan audit logging.
- **Renderer Process (React SPA)**: Responsible exclusively for UI layout, state presentation, virtualized grid rendering, dan canvas graphics. Does **not** import Node.js core modules or driver libraries.
- **Preload Script**: Uses Electron `contextBridge` to expose a strict, whitelisted set of typed IPC methods to the renderer.

> [!NOTE]
> Transfer data besar (import/export/backup) berjalan via streaming di **main process** (Node `streams`), bukan worker threads. Offloading ke worker threads dijadwalkan v1.1.

### Web-Ready Design & Client Abstraction
To ensure future web deployment capabilities (v2.x roadmap) without refactoring UI code, feature modules in the renderer **never** invoke `window.canvabase` directly. Instead, UI components consume the abstract **`Client`** interface:

```ts
// packages/contracts/src/client.ts
export interface Client {
  connections: ConnectionApi;
  browser: BrowserApi;
  query: QueryApi;
  designer: DesignerApi;
  erd: ErdApi;
  transfer: TransferApi;
  settings: SettingsApi;
  events: EventBusApi;
}
```
- **Desktop Runtime**: Injects `ipcClient` (mapping calls to IPC channels).
- **Web Runtime (Roadmap)**: Injects `httpClient` (mapping calls to HTTP REST / WebSocket endpoints).

---

## 2. Monorepo Layout

CanvaBase is structured as an **npm workspaces** monorepo:

```
canvabase/
├── package.json               # Workspaces root configuration
├── packages/
│   ├── dialects/              # Database Ports & Adapters (mysql2, pg, node:sqlite)
│   ├── contracts/             # Versioned Zod contract schemas & Client interface
│   ├── desktop/               # Electron App (Main process & Renderer React UI)
│   └── shared/                # Shared utilities, types, formatters, and sanitizers
├── scripts/                   # System tools (repo_scan.py, waypoint_check.py)
├── docs/                      # User & Developer documentation
├── tests/                     # Monorepo integration & contract test suites
└── .opencode/                 # SDLC Waypoint & Phase tracking state
```

### Dependency Rules:
1. `packages/contracts` and `packages/shared` have **zero** internal dependencies.
2. `packages/dialects` depends **only** on `packages/contracts` and `packages/shared`.
3. `packages/desktop` depends on `dialects`, `contracts`, and `shared`.
4. Circular dependencies between packages are strictly forbidden.

---

## 3. Environment Setup & Workflow

### Prerequisites
- **Node.js**: `v20.x`, `v22.x`, or `v24.x`
- **npm**: `v9.x` or `v10.x`
- **Python**: `v3.10+` (required for repo scanner and Waypoint check tools)

### Installation & Workspace Commands

```bash
# 1. Install all monorepo workspace dependencies
npm install

# 2. Build shared packages (contracts, shared, dialects)
npm run build:packages

# 3. Start Electron desktop application in live-reload dev mode
npm run dev

# 4. Run workspace linter & type-checker
npm run lint
npm run typecheck

# 5. Execute Vitest unit & contract test suites
npm run test
```

---

## 4. Extending Database Adapters (`packages/dialects`)

### The `DialectPort` Interface

Every database driver adapter must implement the **`DialectPort`** contract:

```ts
// packages/dialects/src/port.ts — DialectPort v1.0 (LOCKED, additive-only)
export interface DialectConnectionConfig {
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: 'disabled' | 'required' | 'verify';
}

export interface DialectPort {
  readonly name: string;
  readonly capabilities: DialectCapabilities;

  connect(config: DialectConnectionConfig, signal?: AbortSignal): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
    signal?: AbortSignal,
  ): Promise<QueryResult<T>>;
  stream<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<StreamedResult<T>>;

  listTables(): Promise<string[]>;
  listDatabases(): Promise<string[]>;
  listViews(): Promise<string[]>;
  listProcedures(): Promise<string[]>;
  listTriggers(): Promise<string[]>;
  listUsers(): Promise<string[]>;
  getTableSchema(table: string): Promise<TableColumn[]>;
  getTableDefinition(table: string): Promise<TableDefinition>;

  previewDdl(draft: TableDraft): string;
  quoteIdentifier(identifier: string): string;
  parameterPlaceholder(position: number): string;
}
```

### Capability Detection Model

To prevent engine-specific conditional statements (`if (engine === 'mysql')`) in UI code, each adapter declares explicit boolean capabilities:

```ts
export interface DialectCapabilities {
  ssl: boolean;
  sshTunnel: boolean;
  streaming: boolean;
  cancellation: boolean;
  editableGrid: boolean;
  tableSchema: boolean;
  ddl: boolean;
  userManagement: boolean;
  nativeJson: boolean;
  databases: boolean;
  views: boolean;
  procedures: boolean;
  triggers: boolean;
}
```

UI components query `adapter.capabilities` to conditionally render features.

### Step-by-Step: Adding a New Database Engine (e.g., MSSQL for v2.0)

1. **Create Adapter Folder**: Create `packages/dialects/src/mssql/`.
2. **Implement `DialectPort`**: Create `MssqlAdapter` implementing `DialectPort`.
3. **Declare Capabilities**: Specify capabilities in `MssqlAdapter.capabilities`.
4. **Register Adapter**: Register the new adapter in `DialectRegistry` (`packages/dialects/src/registry.ts`).
5. **Add Contract Tests**: Add `mssql.contract.test.ts` executing `dialectContractSuite(new MssqlAdapter(), config)`.

> [!IMPORTANT]
> `DialectPort` is **frozen (additive-only)**. Adding a new database engine requires **zero refactoring** of core QueryEngine or UI components.

---

## 5. IPC Contracts & Error Handling (`packages/contracts`)

### Contract Schema Structure
All IPC channel payloads are defined as Zod schemas in `packages/contracts`:

```ts
// packages/contracts/src/query.ts
export const QueryRequestSchema = z.object({
  connectionId: z.string().uuid(),
  sql: z.string().min(1).max(10_000_000),
  params: z.array(z.unknown()).optional(),
  signalId: z.string(),
  fetchSize: z.number().int().positive().default(500),
  maxRows: z.number().int().positive().default(1_000_000),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;
```

### CredentialMode Security Pattern
Raw passwords are **never** passed across IPC channels. All channel payloads requiring authentication utilize `CredentialMode`:

```ts
export type CredentialMode =
  | { type: 'NEW'; password: string }                    // Saved to keychain
  | { type: 'EXISTING'; connectionId: string }           // Retrieved from keychain by main
  | { type: 'TEMPORARY'; password: string; ttl: number };// Test connection (30s TTL in memory)
```

### ClientError Hierarchy & Envelope
All contract responses are wrapped in a standard `Result<T>` envelope:

```ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClientError };

export type ClientError =
  | { type: 'NETWORK'; retryable: true; originalError: unknown }
  | { type: 'TIMEOUT'; retryable: true; code: string }
  | { type: 'BUSINESS'; retryable: false; code: string; message: string }
  | { type: 'VALIDATION'; retryable: false; code: string; details: unknown };
```

---

## 6. Streaming, Backpressure & Memory Cleanup

### Async Iterator Streaming Spec

For large result sets, drivers implement `StreamedResult<T>`:

```ts
export interface StreamedResult<T> {
  metadata: { totalRows: number | null; columns: ColumnMetadata[] };
  chunks: AsyncIterableIterator<Chunk<T>>;
  pause(): void;
  resume(): void;
  cancel(reason?: string): Promise<void>;
}
```

### Backpressure (`pause` / `resume`)
When the renderer UI is slow to render virtualized rows, the `pause()` method signals the underlying database driver stream to stop reading buffer chunks. When the UI queue drains, `resume()` continues stream fetching.

### Resource Cancellation (`AbortController`)
Long-running queries pass an `AbortSignal`. When a user clicks **Stop**, the main process calls `abort()`, which triggers driver-level socket destruction (`mysql.destroy()`, `pg.end()`, or `sqlite.interrupt()`) and guarantees connection release in `finally` blocks.

---

## 7. Security Standards & Hardening

### OS Keychain & Fallback Encrypted Mode
1. **Primary**: Passwords encrypted via Electron `safeStorage` (OS Keychain).
2. **Fallback (`encrypted-file`)**: Jika `safeStorage.isEncryptionAvailable()` returns `false`, CanvaBase memakai **AES-256-GCM** (implementasi `KeychainCrypto.ts`): key 32-byte random tersimpan di `keychain.key` (mode 0o600, machine-bound hash hostname+user+platform+arch), format `cb1.<ivB64>.<tagB64>.<cipherB64>`. Aktif otomatis tanpa prompt.
3. **Plaintext Invariant**: Plaintext credential storage in production is **strictly prohibited**.

> **SQLite dual-driver (PRD-F-01.3)**: Electron 33 membundel Node 20.18 tanpa `node:sqlite` (tersedia mulai Node 22.5). Adapter SQLite memakai `createSqliteDriver()` (`packages/dialects/src/adapters/sqlite-driver.ts`) — feature-detect `node:sqlite` dulu, fallback `better-sqlite3` (optionalDependency). Tanpa fallback, koneksi SQLite di packaged app akan crash (`ERR_UNKNOWN_BUILTIN_MODULE`).

### SQL Injection Prevention Rules
- **100% Parameterization**: Queries with values must use `?` or `$1` parameter bindings.
- **Identifier Quoting**: Table and column names in generated DDL scripts must be quoted using dialect-specific escape rules (MySQL backticks `` `table` ``, Postgres/SQLite double quotes `"table"`).

### Import Validation & Sanitization Pipeline
CSV file imports undergo strict validation before SQL binding:
1. **Header Sanitization**: Column names from CSV headers are matched against `^[a-zA-Z_][a-zA-Z0-9_]*$` and checked against SQL reserved keywords.
2. **Type Coercion**: Values are coerced to target column types (`INT`, `VARCHAR`, `TIMESTAMP`) before parameter binding. Failing rows are captured without crashing the import job.

### Electron Security Configuration & CSP
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- **Content Security Policy**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`

### Log Sanitization
Application logging menerapkan path redaction rules untuk scrub key sensitif: `password`, `secret`, `token`, `privateKey`, `connectionString`. (Structured logger eksternal seperti `pino` tidak digunakan di v0.1.0-mvp.)

---

## 8. Testing & Quality Assurance

### Unit Testing
Vitest unit tests target business logic, formatters, and sanitizers:
```bash
npm run test
```

### Contract Test Suite (`dialectContractSuite`)
Every `DialectPort` driver adapter must pass the shared **`dialectContractSuite`**:

```ts
// tests/dialects/contract-suite.ts
export function dialectContractSuite(adapter: DialectPort, config: TestConfig) {
  describe(`${adapter.name} Contract Suite`, () => {
    it('should connect successfully', async () => { ... });
    it('should execute parameterized queries safely', async () => { ... });
    it('should stream large result sets', async () => { ... });
    it('should support cancellation via AbortController', async () => { ... });
    it('should honor backpressure (pause/resume)', async () => { ... });
  });
}
```

Contract tests execute against real database engines via Docker test containers in CI.

### Coverage Targets
Threshold coverage ditegakkan di `vitest.config.ts` (provider v8) terhadap `packages/dialects/src/**` dan `packages/shared/src/**`:

| Metric | Threshold |
| :--- | :---: |
| **Lines** | 60% |
| **Functions** | 60% |
| **Statements** | 60% |
| **Branches** | 50% |

Jalankan `npm run test:coverage` untuk laporan coverage.

---

## 9. Performance Budgets & Benchmarking

- **Memory Limit**: Idle memory consumption must remain **< 200 MB**. Virtualized grid memory (1M+ rows) must remain **< 400 MB**.
- **Bundle Budget**: Renderer bundle size enforced by `.size-limit.json` must remain **< 250 kB gzip**.
- **Grid Benchmarks** (CI): 1M rows heap < 400MB, filter 1M rows < 5s, sort 200k rows < 5s.

### Perf Scripts & CI

- **`scripts/measure-memory.mjs`**: mengukur memory budget idle & grid secara lokal.
- **`.github/workflows/performance.yml`**: CI gate yang menjalankan size-limit, memory budget, dan grid benchmark pada setiap push. (Workflow lint/typecheck/package belum dikonfigurasi — hanya `performance.yml` yang aktif saat ini.)

### Mengukur Performa Secara Lokal

```bash
node scripts/measure-memory.mjs
npx size-limit
```

---

## 10. SDLC Workflow & Waypoint Hard Gates

CanvaBase utilizes the **Waypoint SDLC system** for phase management and quality gates.

### Work Order (WO) Classification
Every task must be classified as a Work Order (`BUG`, `GAP`, `AUDIT`, `ENHANCEMENT`, `REFACTOR`, or `DOC`).

### Waypoint Hard Gate Verification
Before declaring any development phase complete, run the project verifier:

```bash
python scripts/waypoint_check.py --check --project canvabase
```

**Requirements for Phase Completion**:
1. WO JSON archived in `.opencode/archive/sprints/WO-YYYY-MM-DD-NNN.json`.
2. Handoff log entry appended to `.opencode/phase_state/canvabase/handoff.md`.
3. Phase JSON archived in `.opencode/archive/phases/phase-NN.json`.
4. `waypoint_check.py` returns **exit code 0**.

---

*Thank you for contributing to CanvaBase! For questions or architectural discussions, reach out to the **CanvaStack** core team.*
