# Licensing & Repo Strategy — CanvaBase

> Keputusan 2026-08-15 (T3 — strategi enterprise). Dokumen ini rujukan utama boundary Community vs Enterprise.

## Model: Open-core Dual-Repo

CanvaBase menggunakan **open-core** dengan pemisahan fisik repo. Ini menghindari dua masalah sekaligus: repo private membunuh komunitas (CE tidak bisa diakses end-user), repo public mengekspos fitur Pro secara gratis.

```
GitHub canvastack/
├─ canvabase           (PUBLIC)  → Community Edition (CE) — Apache-2.0
├─ canvabase-pro       (PRIVATE) → Enterprise Edition (EE) — Proprietary EULA
└─ (opsional) canvabase-meta     (PRIVATE) → planning/roadmap internal
```

### Prinsip Boundary

> **Semua yang lokal = CE. Semua yang berjaringan/berakun = EE.**

| Lokasi | CE (public, Apache-2.0) | EE (private, proprietary) |
|---|---|---|
| Connection Manager, Object Browser, Query Editor, Result Grid | ✅ | — |
| Table Designer, ERD, Import/Export | ✅ | — |
| App-state SQLite (lokal) | ✅ | — |
| User Notes (lokal) | ✅ | — |
| RoleManager, ServerMonitor, HistoryLog | — | ✅ (fitur enterprise post-G3) |
| Identity & Auth (register/login/OAuth/forgot) | — | ✅ |
| Cloud Sync (E2EE, scheduler, recovery) | — | ✅ |
| Self-hosted Backend (Fastify + PostgreSQL) | — | ✅ |
| Explain Plan, Backup native, Excel/XML, Report, Scheduler, Kolaborasi | — | ✅ |

## Alur Dependensi & Distribusi

1. Repo public di-release sebagai **npm package** `@canvabase/core` + GitHub Releases (installer CE).
2. Repo private `canvabase-pro` mengonsumsi `@canvabase/core` sebagai dependency — EE hanya berisi delta (backend + sync + auth + UI Pro).
3. EE didistribusikan ke pelanggan via **private npm registry** + **private GitHub Releases** — bukan source.
4. **Renovate/Dependabot** di repo private otomatis bump versi `@canvabase/core` saat CE rilis → maintenance tidak dobel.
5. Backend self-hosted masuk EE — operator enterprise pakai Docker Compose Pro.

## Lisensi

| Artifact | Lisensi | Alasan |
|---|---|---|
| CE (semua package) | **Apache-2.0** | Permissive + patent grant, enterprise-friendly, anti-kontaminasi (bisa dipakai bebas di Pro), komunitas luas |
| EE (source + artifact) | **Proprietary (EULA)** | Melindungi revenue & keunggulan kompetitif |

> Dipilih **bukan** MIT (tanpa patent grant) dan **bukan** GPL-3.0 (copyleft mengunci fitur Pro).

## CLA (Contributor License Agreement)

Detail lengkap di `CONTRIBUTING.md`. Ringkas: kontribusi CE tetap Apache-2.0 untuk publik, dan CanvaStack diberi hak menggunakan kontribusi di produk EE. Ini mempertegas fleksibilitas relicensing tanpa menghambat kontributor.

## Hal Krusial

1. **Jangan pernah taruh secret/API key di repo public** — OAuth client secret, signing cert, backend keys semuanya di EE.
2. **Trademark** — nama "CanvaBase" + logo tetap trademark CanvaStack walau kode Apache-2.0 (pola VS Code/Grafana). Mencegah orang lain jual produk pakai nama kita.
3. **`packages/contracts` sudah versioned** — kunci kompatibilitas CE↔EE; wajib additive-only (aturan G1).
4. **G4 audit scope** — repo private tidak mengganggu CI public; masing-masing punya pipeline sendiri.
5. **Forker rebadge CE** — risiko umum open-core; trademark melindungi nama, EE tetap punya nilai (backend, support, SLA).

## Status Implementasi

| Item | Status |
|---|---|
| Boundary CE/EE ditetapkan | ✅ 2026-08-15 |
| LICENSE Apache-2.0 (CE) | ✅ 2026-08-15 |
| CONTRIBUTING.md (CLA) | ✅ 2026-08-15 |
| SECURITY.md | ✅ 2026-08-15 |
| package.json license → Apache-2.0 | ✅ 2026-08-15 |
| Split repo `canvabase-pro` + `@canvabase/core` publish | ⏳ v1.1 (Phase 3 roadmap) |
| Trademark filing | ⏳ (legal) |
