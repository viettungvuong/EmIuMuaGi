#!/usr/bin/env bash
# Runs the app through Expo Go on an iOS simulator, or with --android on an
# Android emulator: boots one if none is running, starts Metro on a free port
# and opens the app there.
#
# Usage:
#   ./simulator-test.sh                            # the booted simulator, else the first iPhone
#   ./simulator-test.sh "iPhone 15"                # a specific simulator, by name
#   ./simulator-test.sh --android                  # the running emulator, else the first AVD
#   ./simulator-test.sh --android "Pixel_8_API_35" # a specific AVD, by name (see: emulator -list-avds)
set -euo pipefail
cd "$(dirname "$0")"

platform=ios
device=""
for arg in "$@"; do
    case "$arg" in
        --android) platform=android ;;
        --ios) platform=ios ;;
        *) device="$arg" ;;
    esac
done

log() { echo "simulator-test: $*"; }
die() { echo "simulator-test: $*" >&2; exit 1; }

UUID_RE='[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}'

boot_ios() {
    command -v xcrun >/dev/null || die "needs Xcode (xcrun not found)"

    # Pick the simulator
    if [[ -n "$device" ]]; then
        udid=$(xcrun simctl list devices available | grep -F "$device (" | grep -oE "$UUID_RE" | head -n1 || true)
        [[ -n "$udid" ]] || die "no simulator called '$device'"
    else
        udid=$(xcrun simctl list devices booted | grep -oE "$UUID_RE" | head -n1 || true)
        [[ -n "$udid" ]] || udid=$(xcrun simctl list devices available | grep "iPhone" | grep -oE "$UUID_RE" | head -n1 || true)
        [[ -n "$udid" ]] || die "no iPhone simulator installed (add one in Xcode)"
    fi
    # "    iPhone SE (3rd generation) (<udid>) (Booted)" -> "iPhone SE (3rd generation)"
    name=$(xcrun simctl list devices | grep "$udid" | sed -E "s/ \($udid\).*//; s/^ +//")

    # Boot it and bring the Simulator window up
    log "using $name ($udid)"
    xcrun simctl boot "$udid" 2>/dev/null || true # fine if it's already booted
    # Xcode 27 renamed the Simulator app to "Device Hub"; use whichever is installed
    for app in "Device Hub" "Simulator"; do
        if open -Ra "$app" 2>/dev/null; then
            open -a "$app" --args -CurrentDeviceUDID "$udid"
            break
        fi
    done
    xcrun simctl bootstatus "$udid" -b >/dev/null
}

boot_android() {
    # The Android SDK: ANDROID_HOME, else where Android Studio puts it
    sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
    emulator="$sdk/emulator/emulator"
    adb="$sdk/platform-tools/adb"
    [[ -x "$emulator" && -x "$adb" ]] || die "no Android SDK at $sdk (install Android Studio, or set ANDROID_HOME)"

    # Pick the emulator: one already running, else the named AVD, else the first one
    serial=$("$adb" devices | awk '/^emulator-[0-9]+\tdevice$/ { print $1; exit }')
    if [[ -n "$serial" && -z "$device" ]]; then
        log "using the running emulator $serial"
    else
        avds=$("$emulator" -list-avds 2>/dev/null | grep -v '^INFO' || true)
        [[ -n "$avds" ]] || die "no Android emulator set up yet – create one in Android Studio (Device Manager → Create Virtual Device)"
        if [[ -n "$device" ]]; then
            grep -qxF "$device" <<<"$avds" || die "no emulator called '$device'. Yours: $(echo $avds)"
            avd="$device"
        else
            avd=$(head -n1 <<<"$avds")
        fi

        # Boot it in its own window, in the background, and wait until Android is up
        log "booting $avd"
        nohup "$emulator" -avd "$avd" -netdelay none -netspeed full >/dev/null 2>&1 &
        "$adb" wait-for-device
        until [[ "$("$adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
            sleep 2
        done
        serial=$("$adb" devices | awk '/^emulator-[0-9]+\tdevice$/ { print $1; exit }')
        log "$avd is up ($serial)"
    fi
    export ANDROID_SERIAL="$serial" # every adb call below, and Expo's, goes to this emulator
}

# 1. Boot the simulator / emulator
"boot_$platform"

# 2. The backend the app will use, as Expo resolves it: the shell first, then
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
log "the app will use the backend at $api_url"

# Inside the emulator, localhost is the emulator itself, not this Mac. adb reverse
# sends the emulator's localhost:<port> to this Mac's, so a localhost address in
# .env works there just like in the iOS simulator.
if [[ "$platform" == android && "$api_url" =~ ^https?://(localhost|127\.0\.0\.1)(:([0-9]+))? ]]; then
    api_port="${BASH_REMATCH[3]:-80}"
    "$adb" reverse "tcp:$api_port" "tcp:$api_port" >/dev/null
    log "the emulator's localhost:$api_port now reaches this Mac's port $api_port"
fi

# Any HTTP answer (a 401 included) means it's up
if [[ "$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "$api_url/api/me" || true)" == "000" ]]; then
    if [[ "$api_url" =~ ^https?://(localhost|127\.0\.0\.1) ]]; then
        echo "simulator-test: the backend isn't running at $api_url – start it with: cd ../backend && bash start.sh" >&2
    else
        echo "simulator-test: the backend at $api_url isn't answering" >&2
    fi
fi

# 3. Packages, on a fresh checkout
[[ -d node_modules ]] || npm install

# 4. Metro on the first free port from 8081 (something else may hold it, e.g. Docker)
port=8081
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
done

# Expo Go on Android keeps the code it last loaded while it stays open, so close
# it first: then it loads this Metro's build (with the backend address above) for sure
if [[ "$platform" == android ]]; then
    "$adb" shell am force-stop host.exp.exponent >/dev/null 2>&1 || true
fi

# --ios / --android installs Expo Go on the device if needed and opens the app.
# --clear rebuilds from scratch, so a changed backend address in .env is picked up
# (Metro would otherwise reuse files built with the old one).
log "starting Metro on port $port"
exec npx expo start "--$platform" --clear --port "$port"
