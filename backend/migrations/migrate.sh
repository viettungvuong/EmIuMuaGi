#!/usr/bin/env bash
# Applies the <YYYYMMDD>_<name>.sql files in this folder that haven't run yet,
# oldest first, and records each in the schema_migrations table so it never
# runs twice. Each file runs in one transaction together with its record, so a
# failing migration leaves the database untouched and stops the run.
#
# Usage: migrate.sh [migrations dir] [env file holding DATABASE_URL]
#   DATABASE_URL set in the environment wins over the env file; with neither,
#   the local item database below is used.
set -euo pipefail

# User and password come from PGUSER/PGPASSWORD or ~/.pgpass, as usual for psql
DEFAULT_DATABASE_URL="postgres://localhost:5432/emiumuagi_item"

dir="${1:-$(dirname "$0")}"
env_file="${2:-}"

if [[ -z "${DATABASE_URL:-}" && -f "$env_file" ]]; then
    # The value after DATABASE_URL=, without surrounding quotes
    DATABASE_URL="$(sed -nE "s/^(export )?DATABASE_URL=[\"']?([^\"']*)[\"']?[[:space:]]*$/\2/p" "$env_file" | head -n1)"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
    DATABASE_URL="$DEFAULT_DATABASE_URL"
    echo "migrate: no DATABASE_URL set or in '${env_file}', using $DATABASE_URL" >&2
fi

# GORM-style DSNs often carry TimeZone=Asia/…, which the Go driver passes to the
# server but psql rejects as an "invalid connection option". psql takes the
# time zone from PGTZ instead, so move it there.
if [[ "$DATABASE_URL" =~ (^|[[:space:]?&])[Tt]ime[Zz]one=([^[:space:]&]+) ]]; then
    tz="${BASH_REMATCH[2]//\'/}"            # key=value form may quote it
    PGTZ="$(printf '%b' "${tz//%/\\x}")"    # URL form may encode / as %2F
    export PGTZ
    # Cut the match out, keeping the separator before it. Not ${var/pat/rep}:
    # since bash 5.2 an "&" in rep stands for the match, and the separator can be "&"
    before="${DATABASE_URL%%"${BASH_REMATCH[0]}"*}"
    after="${DATABASE_URL#*"${BASH_REMATCH[0]}"}"
    DATABASE_URL="${before}${BASH_REMATCH[1]}${after}"
    # Tidy what removing it from a URL's query string can leave behind
    DATABASE_URL="$(sed -E 's/\?&/?/; s/&&/\&/; s/[?&[:space:]]+$//' <<<"$DATABASE_URL")"
fi
if ! command -v psql >/dev/null; then
    echo "migrate: psql is not installed (apt install postgresql-client)" >&2
    exit 1
fi

run_psql() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt "$@"; }

# Warning level hides the "already exists, skipping" notice on every run after the first
run_psql -c "SET client_min_messages = warning; CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)"

shopt -s nullglob
applied=0
# The date prefix makes the glob's alphabetical order chronological
for file in "$dir"/[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql; do
    name="$(basename "$file")"
    # The name is written into SQL below, so only allow safe characters
    if [[ ! "$name" =~ ^[0-9]{8}_[A-Za-z0-9_-]+\.sql$ ]]; then
        echo "migrate: bad file name '$name', expected <YYYYMMDD>_<name>.sql using letters, digits, _ or -" >&2
        exit 1
    fi
    if [[ -n "$(run_psql -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'")" ]]; then
        continue
    fi

    echo "migrate: applying $name"
    run_psql --single-transaction -f "$file" \
        -c "INSERT INTO schema_migrations (filename) VALUES ('$name')"
    applied=$((applied + 1))
done

echo "migrate: $applied new migration(s) applied"
