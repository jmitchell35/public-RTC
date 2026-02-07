# API routes

Next.js route handlers that proxy the Rust backend.

## Notes

- These routes forward requests to `BACKEND_URL` or `NEXT_PUBLIC_BACKEND_URL`.
- Authentication uses the HttpOnly `auth_token` cookie.
- The proxy helper lives in `app/api/_utils.ts`.

## Sections

- `auth/` : login/logout/signup
- `me/` : current user
- `servers/`, `channels/`, `messages/` : server and chat operations
- `friends/`, `dm/` : direct messages and friend flows
- `invites/` : server invite join
