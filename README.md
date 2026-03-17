# RTC Chat Project

Full-stack Discord-like app with a Rust (Axum) backend and a Next.js frontend. Available as a web app and a cross-platform desktop app (Tauri).

## Layout

- `Back/` — Rust API + WebSocket server
- `Front/app/` — Next.js web frontend + Tauri desktop app

## Features

- Auth (signup/login/logout) with JWT and HttpOnly cookies
- Servers, channels, invites, roles, and membership management
- Channel chat via WebSocket with REST fallback
- Direct messages and friend requests
- Presence + typing indicators
- Message reactions, pinning, editing
- Kick and ban (temporary or permanent)
- GIF support via Tenor API
- Internationalization: French and English (i18n)
- Desktop app: Windows, macOS, Linux (Tauri 2)
- System notifications (desktop)

## Requirements

- [mise](https://mise.jdx.dev/) — manages Rust and Node.js toolchain versions automatically
- Docker — for local PostgreSQL (`Back/docker-compose.yml`)

Without mise, you need:
- Rust toolchain (edition 2024)
- Node.js 22+
- PostgreSQL

## Quick start (with mise)

```bash
# Backend
cd Back
mise install        # installs Rust
cp .env.example .env  # fill in DATABASE_URL etc.
mise run db         # start Postgres via Docker
mise run dev        # cargo run

# Frontend (separate terminal)
cd Front
mise install        # installs Node 22
mise run install    # npm install
mise run dev        # npm run dev
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:3001`.

## Quick start (without mise)

```bash
# Backend
cd Back
cp .env.example .env
docker compose up -d db
cargo run

# Frontend
cd Front/app
npm install
npm run dev
```

## Desktop app (Tauri)

```bash
cd Front
mise run desktop        # dev mode
mise run desktop-build  # production build
```

Or directly:
```bash
cd Front/app
npm run tauri:dev
npm run tauri:build
```

Supported platforms: Windows, macOS (universal), Linux.

## Configuration

**Backend** (`Back/.env`):

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Token signing secret | — |
| `JWT_EXP_SECONDS` | Token lifetime in seconds | `604800` |
| `BIND_ADDR` | Bind address | `0.0.0.0:3001` |

**Frontend** (`Front/app/.env.local`):

| Variable | Description | Default |
|---|---|---|
| `BACKEND_URL` | Backend base URL (server-side) | `http://localhost:3001` |
| `NEXT_PUBLIC_BACKEND_URL` | Backend base URL (client-side) | `http://localhost:3001` |
| `NEXT_PUBLIC_TENOR_API_KEY` | Tenor API key for GIF picker | — |

## CI/CD

GitHub Actions runs on every push and on pull requests to `main`:

- **Backend**: type-check (`cargo check`) + integration tests (`cargo test`) against a live PostgreSQL 16 instance
- **Frontend**: lint (`eslint`) + production build (`next build`)

On tag push (`v*`), the release workflow builds:
- The Rust backend binary
- Tauri desktop bundles for Windows, macOS (universal), and Linux

See `.github/workflows/` for details.

## Tests

Backend integration tests spin up isolated schemas per test run:

```bash
cd Back
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rtc cargo test -- --test-threads=1
# or with mise:
mise run test
```

Optional coverage (requires `cargo-llvm-cov`):

```bash
cargo llvm-cov --workspace --summary
```

Frontend has no unit test harness; use lint as a check:
```bash
cd Front/app && npm run lint
# or with mise:
cd Front && mise run lint
```

## Documentation

- `Back/README.md` — backend architecture, API reference, WebSocket protocol
- `Front/app/README.md` — frontend structure, routes, components
