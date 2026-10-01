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
    echo "Restarting container '$CONTAINER_NAME'..."
    docker restart "$CONTAINER_NAME"
    echo "Deployed and restarted successfully!"
fi
