# Emby Music Library BPM & Tempo Controller Plugin

A dedicated **Emby Server Plugin** and **Web Audio Component** designed specifically for your music library. It enables real-time playback speed and BPM adjustments **without altering the audio pitch** (pitch-preserved time-stretching), making it ideal for musicians, dancers, transcriptions, and tempo practice.

---

## Features

- **Strict Pitch Preservation (Pitch Lock)**: Slow down (down to 50%) or speed up (up to 150%) music tracks while maintaining their original key and pitch using native browser audio engines (`HTMLMediaElement.preservesPitch`).
- **Real-Time Dynamic BPM Readout**: Automatically reads embedded BPM tags from Emby music tracks and calculates the effective tempo dynamically as you adjust the speed (e.g., *Original: 120 BPM → Playing at: 96 BPM at 80%*).
- **Streamlined Speed Controls**: Clean speed slider (50% to 150% in 1% steps), quick step buttons (`[-5%]`, `[+5%]`), and instant `[Reset]` back to 100% (1.0x).
- **Keyboard Shortcuts**: Practice hands-free using keyboard hotkeys (`[` to slow down, `]` to speed up, `\` to reset).
- **Persistent Speed Memory**: Remembers your preferred playback speed across track changes in the same session.
- **Native Emby Look & Feel**: Matches Emby's Material Symbols and theme palette with a clean glassmorphic popup that activates in the bottom playback bar whenever audio is playing.
- **Zero-Config Web Injection**: Self-contained plugin assembly automatically injects its web components into the Emby Web dashboard on server startup.

---

## Prerequisites

Before building or deploying, ensure your system has the following installed:

- **[.NET SDK](https://dotnet.microsoft.com/download)**: .NET 6.0, 7.0, 8.0, 9.0, or 10.0 SDK (supports `.NET Standard 2.0` compilation).
  - Verify with: `dotnet --version`
  - macOS: `brew install dotnet-sdk`
  - Ubuntu / Debian: `sudo apt-get install -y dotnet-sdk-8.0`
  - Fedora: `sudo dnf install dotnet-sdk-8.0`
  - Arch Linux: `sudo pacman -S dotnet-sdk`
- **Bash Shell**: Linux, macOS, or WSL / Git Bash on Windows.
- **Git**: To clone the repository and push updates.
- *(Optional)* **Docker**: If you run Emby Server as a Docker container.
- *(Optional)* **curl** / **nc** / **pgrep**: Used by `build.sh` for pre-flight environment checks.

---

## Build Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/fmedery/emby_plugin_bpm.git
   cd emby_plugin_bpm
   ```

2. **Make the build script executable**:
   ```bash
   chmod +x build.sh
   ```

3. **Build the plugin**:
   ```bash
   ./build.sh
   ```
   *(Or build directly using the .NET CLI without `build.sh`: `dotnet build Emby.Plugin.BpmTempo/Emby.Plugin.BpmTempo.csproj -c Release`)*

4. **Build Outputs**:
   All artifacts are generated in the `dist/` directory:
   - `dist/Emby.Plugin.BpmTempo.dll` — Pre-compiled Emby Server plugin with embedded Web UI assets.
   - `dist/emby-bpm-tempo.user.js` — Standalone userscript for browser-only usage (no server install required).

---

## Project Structure

```
emby_plugin_bpm/
├── Emby.Plugin.BpmTempo/
│   ├── Emby.Plugin.BpmTempo.csproj       # .NET Standard 2.0 project file
│   ├── Plugin.cs                          # BasePlugin implementation with IHasThumbImage
│   ├── ServerEntryPoint.cs                # Server startup lifecycle & web client injector
│   ├── thumb.png                          # Plugin icon
│   ├── Api/
│   │   └── BpmApiService.cs               # REST API endpoints (/Plugins/BpmTempo/...)
│   └── Web/
│       ├── bpm-player.js                  # Client audio engine & UI widget
│       └── bpm-player.css                 # Dark-mode glassmorphic styling
├── emby-bpm-tempo.user.js                 # Standalone Userscript for Tampermonkey / Violentmonkey
├── build.sh                               # Automated build, check, and deployment script
├── .env.example                           # Template for deployment configuration
└── dist/
    ├── Emby.Plugin.BpmTempo.dll           # Compiled plugin assembly ready for Emby
    └── emby-bpm-tempo.user.js
```

---

## Installation & Deployment

### Option 1: Emby Server Plugin (Recommended)

1. **Configure deployment path (optional but recommended)**:
   Copy `.env.example` to `.env` and set your Emby plugins path (and optional container name for automatic reload):
   ```bash
   cp .env.example .env
   ```
   Example `.env`:
   ```bash
   EMBY_PLUGINS_DIR=/path/to/emby/config/plugins
   EMBY_CONTAINER_NAME=emby
   ```

2. **Build and deploy**:
   * **Auto-copy using `.env` target**:
     ```bash
     ./build.sh --copy
     ```
   * **Auto-copy specifying target path directly**:
     ```bash
     ./build.sh --copy /path/to/emby/config/plugins
     ```
   * **Direct container copy (`docker cp` + reload)**:
     ```bash
     ./build.sh --deploy-docker emby
     ```
   * **Check environment only** (without compiling):
     ```bash
     ./build.sh --check
     ```
   * **Standard build only** (output stored in `dist/`):
     ```bash
     ./build.sh
     ```

3. Open Emby Server in your browser. The BPM & Tempo controller will automatically appear in the bottom playback bar whenever music is playing!

#### `build.sh` CLI Reference

| Flag | Description |
| :--- | :--- |
| `(none)` | Build the plugin assembly and standalone userscript into `dist/`. |
| `--copy [PATH]` | Validate environment, compile, and copy `.dll` to target directory (uses `EMBY_PLUGINS_DIR` if omitted). |
| `--check [PATH]` | Run pre-flight checks only: verifies target directory existence/permissions and checks local Emby status. |
| `--restart` | Restart the Docker container configured in `EMBY_CONTAINER_NAME` after copying. |
| `--deploy-docker [NAME]` | Direct copy into a running container via `docker cp` and inject assets into `index.html`. |
| `-h, --help` | Display command help and usage instructions. |

#### Environment Configuration (`.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `EMBY_PLUGINS_DIR` | Host path mapped to Emby's `plugins/` directory. | `/path/to/emby/config/plugins` |
| `EMBY_CONTAINER_NAME` | Docker container name to reload upon deployment. | `emby` |
| `EMBY_PORT` | Local host port used for Emby liveness check. | `8096` |

---

### Option 2: Standalone Userscript (Zero-Server-Restart)

If you use Emby in a browser and want to use the controller immediately without touching or restarting the server:

1. Install a userscript manager browser extension like **Tampermonkey** or **Violentmonkey**.
2. Create a new script and paste the contents of `dist/emby-bpm-tempo.user.js` (or `emby-bpm-tempo.user.js`).
3. Save and open your Emby Web client. The BPM controller will automatically load on any music track.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>[</kbd> | Decrease tempo by 5% (step) |
| <kbd>]</kbd> | Increase tempo by 5% (step) |
| <kbd>\</kbd> | Reset tempo to 100% (1.0x) |

---

## License

MIT License. Designed for Emby Media Server.
