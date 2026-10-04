#!/usr/bin/env bash
# Sets up the AI service on the VPS, inside its own folder: a .venv with the
# Python packages, Playwright's Chromium (Google Maps lookups) and, when run as
# root, the system packages these need. Run on every deploy; anything already
# installed is skipped.
set -euo pipefail
cd "$(dirname "$0")"

is_root() { [[ "$(id -u)" == 0 ]]; }

apt_install() {
    if ! is_root; then
        echo "ai-service: not root, so can't install $* – install it by hand" >&2
        return 1
    fi
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
}

# The code uses `str | None` hints, which need Python 3.10+
if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
    echo "ai-service: needs Python 3.10 or newer, found $(python3 --version)" >&2
    exit 1
fi

# Debian/Ubuntu ship venv's pip bootstrap (ensurepip) as a separate package
python3 -c "import ensurepip" 2>/dev/null || apt_install python3-venv

# Only /api/video/tiktok needs it (to trim clips), so carry on without it
command -v ffmpeg >/dev/null || apt_install ffmpeg \
    || echo "ai-service: no ffmpeg, /api/video/tiktok can't trim videos" >&2

[[ -x .venv/bin/python ]] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

# Downloads only when this Playwright version's Chromium isn't there yet
.venv/bin/playwright install chromium

# Chromium's system libraries (needs root, uses apt): once per Playwright version
marker=".chromium-deps-$(.venv/bin/python -c 'from importlib.metadata import version; print(version("playwright"))')"
if [[ ! -e "$marker" ]]; then
    if is_root; then
        .venv/bin/playwright install-deps chromium && touch "$marker"
    else
        echo "ai-service: not root, skipping Chromium's system libraries – Google Maps lookups may fail" >&2
    fi
fi

echo "ai-service: ready"
