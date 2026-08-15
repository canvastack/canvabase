# Security Policy — CanvaBase

## Reporting a Vulnerability

Kerentanan keamanan **JANGAN dilaporkan lewat public issue** (bisa dilihat orang sebelum fix). Gunakan jalur private:

- **Email:** `security@canvastack.dev`
- **GitHub:** Security tab → "Report a vulnerability" (private advisory)

Sertakan sebanyak mungkin:
- Versi CanvaBase + OS
- Langkah reproduksi (minimal, jelas)
- Dampak yang diperkirakan (jenis data, attack surface)
- PoC jika ada (jangan sertakan data sensitif)

### SLA (draft)

| Severity | Respon awal | Target fix |
|----------|-------------|------------|
| Critical | 24 jam | 7 hari |
| High | 48 jam | 14 hari |
| Medium | 72 jam | 30 hari |
| Low | 1 minggu | 60 hari |

## Scope

### In-scope
- Aplikasi desktop CanvaBase (Electron main + renderer)
- `packages/dialects`, `packages/contracts`, `packages/shared`, `packages/desktop`
- Fitur Enterprise (backend, auth, sync) **saat sudah dirilis** di `canvabase-pro`
- Skema & alur keamanan: keychain, enkripsi, SQL parameterization, CSP

### Out-of-scope
- Database eksternal yang dikonsumsi user (bukan produk kami)
- Kerentanan di dependency pihak ketiga — laporkan ke upstream, tapi kabari kami juga
- Phishing/email engineering terhadap komunitas
- Banyak self-XSS tanpa dampak
- Kerentanan yang butuh akses fisik penuh ke device user

## Keamanan yang Kami Praktikkan

| Area | Mekanisme |
|------|-----------|
| Kredensial | OS keychain (`safeStorage`) + fallback AES-256-GCM machine-bound key (`KeychainCrypto.ts`) |
| Zero-knowledge | Password koneksi DB TIDAK pernah keluar device; cloud sync hanya app-state non-secret |
| SQL injection | Seluruh nilai parameterized; destructive DDL di-guard + audit |
| Electron hardening | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP |
| Enkripsi cloud (EE) | E2EE AES-256-GCM (passphrase-derived key + recovery key) |
| Password akun (EE) | Argon2id hash, rate limiting, session + refresh token |
| Log | Sanitized — tidak pernah memuat kredensial/token/query-data |

## Supported Versions

| Version | Support |
|---------|---------|
| v1.x (semver stable) | ✅ Security fixes |
| v0.x (pre-release/dev) | ⚠️ Best-effort |
| v1.0-mvp | Hanya critical |

## Disclosure

Kami mengikuti **coordinated disclosure**: 90 hari setelah patch dirilis sebelum publikasi detail penuh (kecuali sudah bocor atau eksploit aktif).
