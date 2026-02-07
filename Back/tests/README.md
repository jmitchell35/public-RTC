# Back tests

Integration tests for DB flows (servers, channels, messages, invites, friends, DMs).

## Notes

- Tests require `DATABASE_URL` pointing to a Postgres instance.
- Each test creates its own schema with `search_path` and runs migrations.

## Run

```bash
DATABASE_URL=postgres://... cargo test
```
