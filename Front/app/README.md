# RTC Frontend (Next.js + Tauri)

Next.js 16 (app router) frontend for the RTC chat project. Also ships as a cross-platform desktop app via Tauri 2.

## Requirements

- Node.js 22+ (managed automatically by [mise](https://mise.jdx.dev/))
- A running backend (`Back/`)

## Quick start

### With mise (recommended)

Run from the `Front/` directory:

```bash
mise install        # installs Node 22
mise run install    # npm install
mise run dev        # starts Next.js dev server
```

Available tasks:

| Task | Description |
|---|---|
| `mise run install` | Install npm dependencies |
| `mise run dev` | Start Next.js dev server (`localhost:3000`) |
| `mise run build` | Production build |
| `mise run lint` | ESLint |
| `mise run desktop` | Tauri desktop app (dev mode) |
| `mise run desktop-build` | Tauri desktop app (release build) |

### Without mise

```bash
cd Front/app
npm install
npm run dev
```

## Environment

Create `Front/app/.env.local`:

```env
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_TENOR_API_KEY=your_tenor_key   # optional, enables GIF picker
```

The WebSocket URL is derived automatically from the HTTP base URL (`http://` → `ws://`, `https://` → `wss://`).

## Desktop app (Tauri 2)

The app is also available as a native desktop app (Windows, macOS, Linux).

### Prerequisites

Tauri requires a Rust toolchain plus platform-specific system dependencies.

**All platforms**
```bash
curl https://sh.rustup.rs -sSf | sh   # Rust stable toolchain
cargo install tauri-cli --version "^2"
```

**Linux (Debian/Ubuntu)**
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

**macOS**
```bash
xcode-select --install
```

**Windows**

Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload, then install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (bundled on Windows 11).

### Build and run

```bash
# Dev mode
cd Front/app
npm run tauri:dev

# Production build
npm run tauri:build
```

Or via mise from `Front/`:
```bash
mise run desktop          # dev mode
mise run desktop-build    # release build
```

macOS builds are universal binaries (x86_64 + aarch64). System notifications are supported via `@tauri-apps/plugin-notification`.

## Structure

```
app/
  app/
    (auth)/         login, register pages
    home/
      [id]/         server + channel view
      dm/           direct messages
      profile/      user profile & settings
    api/            Next.js API proxy routes (forward to backend)
  components/
    home/           chat, DMs, server bar, member panel, GIF picker, ...
    ui/             shared UI primitives
  lib/
    actions.ts      server actions (auth, profile)
    dm-actions.ts   DM server actions
    friend-actions.ts  friend server actions
    auth-fetch.ts   shared authenticated fetch helper
    backend.ts      raw backend fetch utility
    messages.ts     shared message utilities (mergeMessages)
    types.ts        shared TypeScript types
    ws-client.ts    WebSocket client
  public/
    locales/        i18n translation files (en/, fr/)
```

## Internationalization

The app supports **French** and **English** via `react-i18next`. Translation files are in `public/locales/{lang}/`.

Language is detected from the browser and can be switched at runtime.

## Key features

- **Real-time chat** via WebSocket with REST fallback (optimistic UI)
- **Direct messages** with typing indicators and presence
- **Message reactions** (emoji) and **pinning**
- **GIF picker** powered by Tenor API
- **Edit / delete** own messages
- **Kick & ban** (Admin/Owner actions)
- **Role management** (Member / Admin / Owner)
- **Invite codes** with optional expiry and use limits
- **Friend system** (add by friend code, accept/reject requests)
- **User profile** editing (username, email, password)
- **Status** (online / offline / dnd)

## Lint

```bash
npm run lint
# or
cd Front && mise run lint
```
