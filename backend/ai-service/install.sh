#!/usr/bin/env bash
# Sets up the AI service on the VPS, inside its own folder: a .venv with the
# Python packages, Playwright's Chromium (Google Maps lookups) and, when run as
# root, the system packages these need. Run on every deploy; anything already
# installed is skipped.
set -euo pipefail
cd "$(dirname "$0")"

# Never wait for an answer: nobody is there to give one during a deploy
export DEBIAN_FRONTEND=noninteractive

# Progress with elapsed time, so a slow deploy's log shows which step was slow
step() { echo "ai-service [${SECONDS}s]: $*"; }

is_root() { [[ "$(id -u)" == 0 ]]; }

# Finish an install a timed-out deploy cut short; apt won't run until that's done
fix_apt() { dpkg --configure -a; }

apt_install() {
    if ! is_root; then
        echo "ai-service: not root, so can't install $* – install it by hand" >&2
        return 1
    fi
    step "installing $* (apt)"
    fix_apt
    apt-get update -qq
    apt-get install -y -qq "$@"
}

# The code uses `str | None` hints, which need Python 3.10+
if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
    echo "ai-service: needs Python 3.10 or newer, found $(python3 --version)" >&2
    exit 1
fi

# Debian/Ubuntu ship venv's pip bootstrap (ensurepip) as a separate package
python3 -c "import ensurepip" 2>/dev/null || apt_install python3-venv

[[ -x .venv/bin/python ]] || { step "creating .venv"; python3 -m venv .venv; }
step "installing Python packages"
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt

# Downloads only when this Playwright version's Chromium isn't there yet
step "checking Chromium (~280 MB download the first time)"
.venv/bin/playwright install chromium

# Chromium's system libraries (needs root, uses apt): once per Playwright version
marker=".chromium-deps-$(.venv/bin/python -c 'from importlib.metadata import version; print(version("playwright"))')"
if [[ ! -e "$marker" ]]; then
    if is_root; then
        step "installing Chromium's system libraries (apt)"
        fix_apt
        .venv/bin/playwright install-deps chromium && touch "$marker"
    else
        echo "ai-service: not root, skipping Chromium's system libraries – Google Maps lookups may fail" >&2
    fi
fi

step "ready"
