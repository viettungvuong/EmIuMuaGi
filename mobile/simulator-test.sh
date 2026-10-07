#!/usr/bin/env bash
# Runs the app on an iOS simulator through Expo Go: boots a simulator if none
# is running, starts Metro on a free port and opens the app there.
#
# Usage:
#   ./simulator-test.sh                # the booted simulator, else the first iPhone
#   ./simulator-test.sh "iPhone 15"    # a specific simulator, by name
set -euo pipefail
cd "$(dirname "$0")"

UUID_RE='[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}'

if ! command -v xcrun >/dev/null; then
    echo "simulator-test: needs Xcode (xcrun not found)" >&2
    exit 1
fi

# 1. Pick the simulator
if [[ -n "${1:-}" ]]; then
    udid=$(xcrun simctl list devices available | grep -F "$1 (" | grep -oE "$UUID_RE" | head -n1 || true)
    [[ -n "$udid" ]] || { echo "simulator-test: no simulator called '$1'" >&2; exit 1; }
else
    udid=$(xcrun simctl list devices booted | grep -oE "$UUID_RE" | head -n1 || true)
    [[ -n "$udid" ]] || udid=$(xcrun simctl list devices available | grep "iPhone" | grep -oE "$UUID_RE" | head -n1 || true)
    [[ -n "$udid" ]] || { echo "simulator-test: no iPhone simulator installed (add one in Xcode)" >&2; exit 1; }
fi
# "    iPhone SE (3rd generation) (<udid>) (Booted)" -> "iPhone SE (3rd generation)"
name=$(xcrun simctl list devices | grep "$udid" | sed -E "s/ \($udid\).*//; s/^ +//")

# 2. Boot it and bring the Simulator window up
echo "simulator-test: using $name ($udid)"
xcrun simctl boot "$udid" 2>/dev/null || true # fine if it's already booted
# Xcode 27 renamed the Simulator app to "Device Hub"; use whichever is installed
for app in "Device Hub" "Simulator"; do
    if open -Ra "$app" 2>/dev/null; then
        open -a "$app" --args -CurrentDeviceUDID "$udid"
        break
    fi
done
xcrun simctl bootstatus "$udid" -b >/dev/null

# 3. The app talks to the gateway on this Mac; say so if it isn't up
if ! curl -s -o /dev/null --max-time 2 http://localhost:8000/; then
    echo "simulator-test: the backend isn't running on port 8000 – start it with: cd ../backend && bash start.sh" >&2
fi

# 4. Packages, on a fresh checkout
[[ -d node_modules ]] || npm install

# 5. Metro on the first free port from 8081 (something else may hold it, e.g. Docker)
port=8081
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
done

# --ios installs Expo Go on the booted simulator if needed and opens the app
echo "simulator-test: starting Metro on port $port"
exec npx expo start --ios --port "$port"
