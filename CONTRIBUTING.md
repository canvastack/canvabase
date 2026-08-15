# Contributing — CanvaBase

Terima kasih sudah tertarik berkontribusi ke CanvaBase! Repo ini adalah **Community Edition (CE)**, dilisensikan **Apache-2.0**.

## Model Repo (Baca dulu!)

CanvaBase memakai model **open-core dual-repo** (keputusan 2026-08-15, lihat `docs/licensing.md`):

- **`canvabase` (repo ini, PUBLIC)** — Community Edition (CE), Apache-2.0. Semua fitur lokal: koneksi, query editor, grid, ERD, import/export, app-state SQLite, notes.
- **`canvabase-pro` (PRIVATE)** — Enterprise Edition (EE), proprietary. Backend self-hosted, identity/auth, cloud sync, RoleManager, ServerMonitor, fitur Pro.
- **Garis pembatas:** *semua yang lokal = CE; semua yang berjaringan/berakun = EE.*

**Penting:** jangan kirim PR yang memindahkan kode EE ke repo ini (feature-gating, licensing bypass, atau hook ke backend Pro). Itu akan ditolak.

## Workflow

1. **Fork + branch** dari `master` (default branch): `git checkout -b fix/deskripsi-singkat`
2. Ikuti **Conventional Commits**: `fix:`, `feat:`, `refactor:`, `docs:`, `test:`, `chore:`
3. Pastikan lulus sebelum submit:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```
4. Tulis/update **test** untuk perubahan (target coverage ≥80% di `packages/dialects`).
5. Buka PR ke `master` — deskripsikan perubahan, link issue jika ada.

## Branching & Rilis

- **`master`** = development line. Semua fitur baru & bugfix masuk ke sini.
- **Tag `vX.Y.Z`** = rilis. Cek kode versi lama via `git checkout vX.Y.Z` (tag, bukan branch).
- **Branch `N.x`** = maintenance line, lahir HANYA saat rilis (pola Laravel-style, keputusan 2026-08-15). Backport/security fix untuk versi yang sudah rilis dikerjakan di branch `N.x`, lalu cherry-pick ke `master`.
- Detail: `AGENTS.md` section "Version Branch Lifecycle" + `docs/licensing.md`.

## Contributor License Agreement (CLA)

Dengan berkontribusi (PR, patch, docs, test) ke repo ini, kamu menyetujui **CanvaStack CLA**:

1. Kamu memiliki kontribusi tersebut (atau berhak menyumbangkannya).
2. Kamu memberikan lisensi abadi, bebas-royalti, non-eksklusif kepada CanvaStack untuk menggunakan, memodifikasi, mendistribusikan, dan menggabungkan kontribusimu dalam produk CE maupun EE (termasuk versi proprietary), serta menggunakannya dalam format lain.
3. Kontribusi tetap dilisensikan Apache-2.0 kepada publik sesuai syarat LICENSE repo ini.

> Mengapa CLA diperlukan? Model open-core memungkinkan CanvaStack mengintegrasikan kontribusi CE ke dalam produk Enterprise tanpa kontaminasi lisensi. Apache-2.0 sendiri sudah mengizinkan ini secara hukum, CLA mempertegas fleksibilitas jangka panjang.

## Kode & Standar

- **TypeScript strict** — tanpa `any` liar (`strict: true`)
- **Hexagonal architecture** — modul fitur, cross-feature hanya via contract
- **`DialectPort` additive-only** — interface yang sudah di-lock tidak boleh diubah
- **Selalu parameterized SQL** — tidak pernah interpolasi nilai (SQL injection)
- **Kredensial** — tidak pernah plaintext di log/kode/DB (OS keychain + `keychain_ref`)
- **Log sanitization** — scrub kredensial & data sensitif dari semua log

## Security

Temukan kerentanan? **JANGAN buat issue publik.** Baca `SECURITY.md` dan ikuti jalur responsible disclosure (email security@canvastack.dev atau contact private di GitHub).

## Lisensi

Dengan berkontribusi, kamu setuju kontribusimu tunduk pada Apache-2.0 (lihat `LICENSE`).
