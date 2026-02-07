# RTC Frontend (Next.js)

Next.js app router UI for the RTC chat project.

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Environment

- `BACKEND_URL` or `NEXT_PUBLIC_BACKEND_URL`
  - Example: `http://localhost:3001`

The app also derives the WebSocket URL from the HTTP base.

## Structure

- `app/` : routes (login, register, home, DMs, profile, API proxies)
- `components/` : UI building blocks
- `lib/` : data fetching, server actions, websocket client
- `styles/` : global CSS

## Lint

```bash
npm run lint
```
