#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -------------------------------------------------------------
# Load environment configuration (.env)
# -------------------------------------------------------------
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
    set +a
fi

# -------------------------------------------------------------
# Diagnostic / Validation Functions
# -------------------------------------------------------------
check_plugins_dir() {
    local dir="$1"
    if [ -z "$dir" ]; then
        echo "✗ Error: EMBY_PLUGINS_DIR is not set."
        echo "  Please set EMBY_PLUGINS_DIR in your .env file (see .env.example) or pass path directly:"
        echo "    ./build.sh --copy /path/to/emby/config/plugins"
        return 1
    fi

    if [ ! -d "$dir" ]; then
        echo "✗ Error: Target plugins directory does not exist:"
        echo "  '$dir'"
        echo "  Please verify the EMBY_PLUGINS_DIR path in your .env file or check that your volume/drive is mounted."
        return 1
    fi

    if [ ! -w "$dir" ]; then
        echo "✗ Error: Target plugins directory is not writable:"
        echo "  '$dir'"
        echo "  Please check directory permissions (chmod / chown)."
        return 1
    fi

    echo "✓ Target plugins directory found: $dir"
    return 0
}

check_emby_running() {
    local running=false
    local details=""
    local remote_context_skipped=""

    # 1. Local Process Check (strictly processes on this local computer)
    if pgrep -i "emby" >/dev/null 2>&1 || pgrep -f "EmbyServer" >/dev/null 2>&1; then
        running=true
        details="Local Emby process is active"
    fi

    # 2. Local Port / Network Check (strictly 127.0.0.1 localhost on this computer)
    local port="${EMBY_PORT:-8096}"
    if [ "$running" = false ]; then
        if command -v curl >/dev/null 2>&1 && curl -s -m 1 "http://127.0.0.1:${port}/System/Info/Public" >/dev/null 2>&1; then
            running=true
            details="Emby server responding locally on 127.0.0.1:$port"
        elif command -v nc >/dev/null 2>&1 && nc -z -w 1 127.0.0.1 "$port" >/dev/null 2>&1; then
            running=true
            details="Port $port is listening on 127.0.0.1"
        fi
    fi

    # 3. Local Docker Check (MUST be local unix socket; strictly IGNORE remote SSH / TCP contexts)
    if [ "$running" = false ] && command -v docker >/dev/null 2>&1; then
        local active_endpoint
        active_endpoint=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || echo "")
        local active_context
        active_context=$(docker context show 2>/dev/null || echo "default")

        # Detect if current docker context points to a remote SSH or TCP host
        if [[ "$active_endpoint" == ssh://* ]] || [[ "$active_endpoint" == tcp://* && "$active_endpoint" != tcp://127.0.0.1* && "$active_endpoint" != tcp://localhost* ]]; then
            remote_context_skipped="$active_context ($active_endpoint)"
        fi

        # Find a genuine LOCAL docker socket on this computer
        local local_socket=""
        if [[ "$active_endpoint" == unix://* ]] && [ -S "${active_endpoint#unix://}" ]; then
            local_socket="${active_endpoint#unix://}"
        elif [ -S "/var/run/docker.sock" ]; then
            local_socket="/var/run/docker.sock"
        elif [ -S "$HOME/.docker/run/docker.sock" ]; then
            local_socket="$HOME/.docker/run/docker.sock"
        elif [ -S "$HOME/.orbstack/run/docker.sock" ]; then
            local_socket="$HOME/.orbstack/run/docker.sock"
        elif [ -S "$HOME/.colima/default/docker.sock" ]; then
            local_socket="$HOME/.colima/default/docker.sock"
        fi

        # Only query Docker if a local Unix socket actually exists on this host
        if [ -n "$local_socket" ]; then
            local c_name="${EMBY_CONTAINER_NAME:-emby}"
            local local_docker="docker -H unix://$local_socket"
            if command -v timeout >/dev/null 2>&1; then
                local_docker="timeout 2 docker -H unix://$local_socket"
            fi

            if $local_docker info >/dev/null 2>&1; then
                if [ "$($local_docker inspect -f '{{.State.Running}}' "$c_name" 2>/dev/null)" = "true" ]; then
                    running=true
                    details="Local Docker container '$c_name' is running"
                elif $local_docker ps --filter "status=running" --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -iq "emby"; then
                    local match
                    match=$($local_docker ps --filter "status=running" --format '{{.Names}}' 2>/dev/null | grep -i "emby" | head -n 1)
                    running=true
                    details="Local Docker container '${match:-emby}' is running"
                fi
            fi
        fi
    fi

    if [ "$running" = true ]; then
        echo "✓ Emby is running locally ($details)"
        return 0
    else
        if [ -n "$remote_context_skipped" ]; then
            echo "⚠ Emby is not running on this local computer (remote Docker context '$remote_context_skipped' ignored)"
        else
            echo "⚠ Emby is not running on this local computer"
        fi
        return 1
    fi
}

# -------------------------------------------------------------
# Parse Arguments
# -------------------------------------------------------------
COPY_PLUGIN=false
CUSTOM_TARGET=""
DEPLOY_DOCKER=false
DOCKER_CONTAINER=""
RESTART_REQUESTED=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --copy|--install|--deploy)
            COPY_PLUGIN=true
            if [[ -n "$2" && "$2" != --* ]]; then
                CUSTOM_TARGET="$2"
                shift
            fi
            shift
            ;;
        --check)
            CHECK_ONLY=true
            if [[ -n "$2" && "$2" != --* ]]; then
                CUSTOM_TARGET="$2"
                shift
            fi
            shift
            ;;
        --deploy-docker)
            DEPLOY_DOCKER=true
            if [[ -n "$2" && "$2" != --* ]]; then
                DOCKER_CONTAINER="$2"
                shift
            fi
            shift
            ;;
        --restart)
            RESTART_REQUESTED=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --copy, --install, --deploy [PATH]   Copy Emby.Plugin.BpmTempo.dll to target plugins directory"
            echo "                                       (Uses EMBY_PLUGINS_DIR from .env if [PATH] is omitted)"
            echo "  --check                              Check if plugins directory exists and Emby is running"
            echo "  --restart                            Restart the Docker container specified in EMBY_CONTAINER_NAME"
            echo "  --deploy-docker [CONTAINER]          Direct docker cp into container & restart (default: emby)"
            echo "  -h, --help                           Show this help message"
            echo ""
            echo "Environment variables (.env):"
            echo "  EMBY_PLUGINS_DIR=/path/to/emby/config/plugins"
            echo "  EMBY_CONTAINER_NAME=emby"
            echo "  EMBY_PORT=8096"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run ./build.sh --help for usage."
            exit 1
            ;;
    esac
done

# -------------------------------------------------------------
# Check Only mode (--check)
# -------------------------------------------------------------
if [ "$CHECK_ONLY" = true ]; then
    echo "====================================================="
    echo " Checking Emby Environment Configuration"
    echo "====================================================="
    TARGET_DIR="${CUSTOM_TARGET:-$EMBY_PLUGINS_DIR}"
    check_plugins_dir "$TARGET_DIR" || true
    check_emby_running || true
    echo ""
    exit 0
fi

# -------------------------------------------------------------
# Pre-flight validation when --copy is used
# -------------------------------------------------------------
if [ "$COPY_PLUGIN" = true ]; then
    TARGET_DIR="${CUSTOM_TARGET:-$EMBY_PLUGINS_DIR}"
    echo "====================================================="
    echo " Pre-flight Environment Checks"
    echo "====================================================="
    check_plugins_dir "$TARGET_DIR" || exit 1
    EMBY_STATUS=0
    check_emby_running || EMBY_STATUS=$?
    echo ""
fi

# -------------------------------------------------------------
# Build
# -------------------------------------------------------------
echo "====================================================="
echo " Building Emby BPM & Tempo Controller Plugin"
echo "====================================================="

dotnet build Emby.Plugin.BpmTempo/Emby.Plugin.BpmTempo.csproj -c Release

mkdir -p dist
cp Emby.Plugin.BpmTempo/bin/Release/netstandard2.0/Emby.Plugin.BpmTempo.dll dist/
cp emby-bpm-tempo.user.js dist/

echo ""
echo " Build Succeeded!"
echo " Output files:"
echo "   - Plugin Assembly: dist/Emby.Plugin.BpmTempo.dll"
echo "   - Standalone Userscript: dist/emby-bpm-tempo.user.js"
echo ""

# -------------------------------------------------------------
# Copy DLL to configured target directory (--copy / --install)
# -------------------------------------------------------------
if [ "$COPY_PLUGIN" = true ]; then
    echo "Deploying Emby.Plugin.BpmTempo.dll to '$TARGET_DIR'..."
    cp dist/Emby.Plugin.BpmTempo.dll "$TARGET_DIR/Emby.Plugin.BpmTempo.dll"
    echo " Successfully copied to: $TARGET_DIR/Emby.Plugin.BpmTempo.dll"

    # Container reload handling
    CONTAINER_TO_RESTART="${EMBY_CONTAINER_NAME:-}"
    if [ "$RESTART_REQUESTED" = true ] || [ -n "$CONTAINER_TO_RESTART" ]; then
        CONTAINER_TO_RESTART="${CONTAINER_TO_RESTART:-emby}"
        echo "Restarting Docker container '$CONTAINER_TO_RESTART'..."
        if docker restart "$CONTAINER_TO_RESTART" 2>/dev/null; then
            echo " Container '$CONTAINER_TO_RESTART' restarted successfully!"
        else
            echo " Warning: Could not restart Docker container '$CONTAINER_TO_RESTART'."
            echo "  Please restart your Emby container manually to load the updated plugin."
        fi
    elif [ $EMBY_STATUS -eq 0 ]; then
        echo " Note: Emby is running. Remember to restart Emby to load the updated plugin assembly."
    else
        echo " Note: Emby is currently stopped. The updated plugin will load when Emby starts."
    fi
    echo ""
fi

# -------------------------------------------------------------
# Direct Docker Deploy (--deploy-docker)
# -------------------------------------------------------------
if [ "$DEPLOY_DOCKER" = true ]; then
    C_NAME="${DOCKER_CONTAINER:-${EMBY_CONTAINER_NAME:-emby}}"
    echo "Deploying Emby.Plugin.BpmTempo.dll to Docker container '$C_NAME'..."
    docker cp dist/Emby.Plugin.BpmTempo.dll "$C_NAME":/config/plugins/
    
    echo "Deploying Web Client assets to '$C_NAME':/system/dashboard-ui/..."
    docker cp Emby.Plugin.BpmTempo/Web/bpm-player.js "$C_NAME":/system/dashboard-ui/
    docker cp Emby.Plugin.BpmTempo/Web/bpm-player.css "$C_NAME":/system/dashboard-ui/
    
    echo "Injecting into index.html..."
    docker exec -u 0 "$C_NAME" sh -c '
        if ! grep -q "bpm-player.js" /system/dashboard-ui/index.html; then
            sed -i "s|</body>|<link rel=\"stylesheet\" href=\"bpm-player.css\"><script src=\"bpm-player.js\" defer></script></body>|" /system/dashboard-ui/index.html
        fi
    '
    
    echo "Restarting container '$C_NAME'..."
    docker restart "$C_NAME"
    echo "Deployed and restarted successfully!"
    echo ""
fi
