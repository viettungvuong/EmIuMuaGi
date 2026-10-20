#!/usr/bin/env bash
# Runs the app on an Android emulator through Expo Go: boots an emulator if none
# is running, points the emulator's localhost at this Mac's backend, starts Metro
# on a free port and opens the app there. The Android twin of simulator-test.sh.
#
# Usage:
#   ./emulator-test.sh                # the running emulator, else the first AVD
#   ./emulator-test.sh "Pixel_8_API_35"  # a specific AVD, by name (see: emulator -list-avds)
set -euo pipefail
cd "$(dirname "$0")"

# 1. The Android SDK: ANDROID_HOME, else where Android Studio puts it
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
emulator="$sdk/emulator/emulator"
adb="$sdk/platform-tools/adb"
if [[ ! -x "$emulator" || ! -x "$adb" ]]; then
    echo "emulator-test: no Android SDK at $sdk (install Android Studio, or set ANDROID_HOME)" >&2
    exit 1
fi

# 2. Pick the emulator: one already running, else the named AVD, else the first one
serial=$("$adb" devices | awk '/^emulator-[0-9]+\tdevice$/ { print $1; exit }')
if [[ -n "$serial" && -z "${1:-}" ]]; then
    echo "emulator-test: using the running emulator $serial"
else
    avds=$("$emulator" -list-avds 2>/dev/null | grep -v '^INFO' || true)
    if [[ -z "$avds" ]]; then
        echo "emulator-test: no Android emulator set up yet – create one in Android Studio (Device Manager → Create Virtual Device)" >&2
        exit 1
    fi
    if [[ -n "${1:-}" ]]; then
        grep -qxF "$1" <<<"$avds" || { echo "emulator-test: no emulator called '$1'. Yours: $(echo $avds)" >&2; exit 1; }
        avd="$1"
    else
        avd=$(head -n1 <<<"$avds")
    fi

    # 3. Boot it in its own window, in the background, and wait until Android is up
    echo "emulator-test: booting $avd"
    nohup "$emulator" -avd "$avd" -netdelay none -netspeed full >/dev/null 2>&1 &
    "$adb" wait-for-device
    until [[ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
        sleep 2
    done
    serial=$("$adb" devices | awk '/^emulator-[0-9]+\tdevice$/ { print $1; exit }')
    echo "emulator-test: $avd is up ($serial)"
fi
export ANDROID_SERIAL="$serial" # every adb call below, and Expo's, goes to this emulator

# 4. The backend the app will use, as Expo resolves it: the shell first, then
#    .env.local, then .env; empty or unset means the gateway on this Mac
api_url=""
if [[ -n "${EXPO_PUBLIC_API_URL+set}" ]]; then
    api_url="$EXPO_PUBLIC_API_URL"
else
    for f in .env.local .env; do
        if [[ -f "$f" ]] && grep -qE '^EXPO_PUBLIC_API_URL=' "$f"; then
            api_url=$(sed -nE "s/^EXPO_PUBLIC_API_URL=[\"']?([^\"']*)[\"']?[[:space:]]*$/\1/p" "$f" | head -n1)
            break
        fi
    done
fi
api_url="${api_url:-http://localhost:8000}"
echo "emulator-test: the app will use the backend at $api_url"

# Inside the emulator, localhost is the emulator itself, not this Mac. adb reverse
# sends the emulator's localhost:<port> to this Mac's, so a localhost address in
# .env works here just like in the iOS simulator.
if [[ "$api_url" =~ ^https?://(localhost|127\.0\.0\.1)(:([0-9]+))? ]]; then
    api_port="${BASH_REMATCH[3]:-80}"
    "$adb" reverse "tcp:$api_port" "tcp:$api_port" >/dev/null
    echo "emulator-test: the emulator's localhost:$api_port now reaches this Mac's port $api_port"
fi

# Any HTTP answer (a 401 included) means it's up
if [[ "$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$api_url/api/me" || true)" == "000" ]]; then
    if [[ "$api_url" =~ ^https?://(localhost|127\.0\.0\.1) ]]; then
        echo "emulator-test: the backend isn't running at $api_url – start it with: cd ../backend && bash start.sh" >&2
    else
        echo "emulator-test: the backend at $api_url isn't answering" >&2
    fi
fi

# 5. Packages, on a fresh checkout
[[ -d node_modules ]] || npm install

# 6. Metro on the first free port from 8081 (something else may hold it, e.g. Docker)
port=8081
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
done

# Expo Go keeps the code it last loaded while it stays open, so close it first:
# then it loads this Metro's build (with the backend address above) for sure
"$adb" shell am force-stop host.exp.exponent >/dev/null 2>&1 || true

# --android installs Expo Go on the emulator if needed and opens the app.
# --clear rebuilds from scratch, so a changed backend address in .env is picked up.
echo "emulator-test: starting Metro on port $port"
exec npx expo start --android --clear --port "$port"
