# RTC Chat Project

Full-stack Discord-like app with a Rust (Axum) backend and a Next.js frontend.

## Layout

- `Back/` : Rust API + WebSocket server
- `Front/app/` : Next.js app (frontend)

## Features (high level)

- Auth (signup/login/logout) with JWT and HttpOnly cookies
- Servers, channels, invites, roles, and membership management
- Channel chat via WebSocket + REST fallbacks
- Direct messages and friend requests
- Presence + typing indicators

## Requirements

- Rust toolchain (edition 2024)
- Node.js 18+ (for Next.js)
- PostgreSQL (Railway or local)

## Configuration

Backend (`Back/`):

- `DATABASE_URL` (Railway Postgres URL)
- `JWT_SECRET` (token secret)
- `JWT_EXP_SECONDS` (optional)
- `BIND_ADDR` (default `0.0.0.0:3001`)

Frontend (`Front/app/`):

- `BACKEND_URL` or `NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:3001`)

## Run locally

Backend:

```bash
cd Back
cargo run
```

Frontend:

```bash
cd Front/app
npm run dev
```

## Tests

Backend integration tests use `DATABASE_URL` and create a unique schema per test.

```bash
cd Back
DATABASE_URL=postgres://... cargo test
```

Optional coverage (if `cargo-llvm-cov` is installed):

```bash
cd Back
cargo llvm-cov --workspace --summary
```

Frontend does not have a unit test harness yet; use `npm run lint` for checks.

## Documentation

Each major folder has a README describing its role. Start here:

- `Back/README.md`
- `Front/README.md`
- `Front/app/README.md`
