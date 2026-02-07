# App routes

This folder contains the Next.js app router pages and API proxies.

## Pages

- `/` : landing
- `/login` : auth login
- `/register` : signup
- `/home` : friends + direct messages hub
- `/home/dm/[id]` : direct message thread
- `/profile` : profile settings shell (UI owned by frontend teammate)

## API routes

`/app/api/*` proxies backend endpoints and injects cookies/headers as needed.
See `app/api/README.md` for details.
