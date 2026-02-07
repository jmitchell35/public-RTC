# Back migrations

SQLx migrations for the Rust backend.

## Usage

Migrations run automatically at server start via `db::run_migrations`.

## Notes

- Keep migrations additive when possible.
- Use `sqlx` tooling if you want to create new migration files.
