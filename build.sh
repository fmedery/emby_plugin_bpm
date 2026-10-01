#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

if [ "$1" == "--deploy-docker" ]; then
    CONTAINER_NAME="${2:-emby}"
    echo "Deploying Emby.Plugin.BpmTempo.dll to Docker container '$CONTAINER_NAME'..."
    docker cp dist/Emby.Plugin.BpmTempo.dll "$CONTAINER_NAME":/config/plugins/
    
    echo "Deploying Web Client assets to '$CONTAINER_NAME':/system/dashboard-ui/..."
    docker cp Emby.Plugin.BpmTempo/Web/bpm-player.js "$CONTAINER_NAME":/system/dashboard-ui/
    docker cp Emby.Plugin.BpmTempo/Web/bpm-player.css "$CONTAINER_NAME":/system/dashboard-ui/
    
    echo "Injecting into index.html..."
    docker exec -u 0 "$CONTAINER_NAME" sh -c '
        if ! grep -q "bpm-player.js" /system/dashboard-ui/index.html; then
            sed -i "s|</body>|<link rel=\"stylesheet\" href=\"bpm-player.css\"><script src=\"bpm-player.js\" defer></script></body>|" /system/dashboard-ui/index.html
        fi
    '
    
    echo "Restarting container '$CONTAINER_NAME'..."
    docker restart "$CONTAINER_NAME"
    echo "Deployed and restarted successfully!"
fi
