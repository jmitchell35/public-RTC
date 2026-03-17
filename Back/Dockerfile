# Stage 1: Build
FROM rust:1-slim-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies by building a dummy binary first
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -f target/release/deps/rtc_backend*

# DATABASE_URL is required at build time for sqlx compile-time query checks
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copy source + migrations (embedded by sqlx::migrate! at compile time)
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim

WORKDIR /app

# ca-certificates needed for TLS connections to PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rtc_backend .

# Render injects PORT; map it to the app's BIND_ADDR
CMD ["/bin/sh", "-c", "BIND_ADDR=0.0.0.0:${PORT:-3001} exec ./rtc_backend"]
