# Emby Music Library BPM & Tempo Controller Plugin

A dedicated **Emby Server Plugin** and **Web Audio Component** designed specifically for your music library. It enables real-time playback speed and BPM adjustments **without altering the audio pitch** (pitch-preserved time-stretching), along with key transposition, tap-tempo beat detection, and BPM calculation.

---

## Features

- **Strict Pitch Preservation (Pitch Lock)**: Slow down (down to 50%) or speed up (up to 150%) music tracks while maintaining their original key and pitch using native browser WSOLA audio engines (`HTMLMediaElement.preservesPitch`).
- **Real-Time BPM Calculation**: Automatically reads embedded ID3/FLAC BPM tags from Emby library items and displays effective tempo in real time (e.g., *Original: 120 BPM → Playing at: 96 BPM at 80%*).
- **Key Transposition (Semitone Pitch Shift)**: Transpose musical keys up or down (±1 to ±6 semitones) independent of tempo.
- **Interactive Tap-Tempo**: Tap along with the beat of a song to calculate its BPM on the fly and store it for future playback.
- **Target BPM Calculator**: Input your desired practice BPM (e.g. 90 BPM) to automatically dial the exact tempo multiplier.
- **Speed Presets & Fine Tuning**: One-click preset pills (`50%`, `60%`, `70%`, `75%`, `80%`, `85%`, `90%`, `95%`, `100%`) plus `[-5%]`, `[-1%]`, `[Reset]`, `[+1%]`, `[+5%]` buttons.
- **Keyboard Shortcuts**:
  - `[` : Slow down by 5%
  - `]` : Speed up by 5%
  - `\` : Reset to normal speed (100% / 1.0x)
- **Seamless Emby UI Integration**: Integrates directly into Emby Web's bottom playback bar and full-screen music player.
- **Emby Admin Dashboard Settings**: Custom settings page inside **Server Dashboard > Plugins > BPM & Tempo Controller**.

---

## Project Structure

```
emby_plugin_bpm/
├── Emby.Plugin.BpmTempo/
│   ├── Emby.Plugin.BpmTempo.csproj       # .NET Standard 2.0 project file
│   ├── Plugin.cs                          # BasePlugin implementation with IHasWebPages & IHasThumbImage
│   ├── ServerEntryPoint.cs                # Server startup lifecycle & web client injector
│   ├── thumb.png                          # Plugin icon
│   ├── Configuration/
│   │   ├── PluginConfiguration.cs        # Config data model (presets, pitch lock, shortcuts)
│   │   ├── bpmsettings.html              # Emby dashboard configuration UI
│   │   └── bpmsettings.js                # Settings page controller
│   ├── Api/
│   │   └── BpmApiService.cs               # REST API endpoints (/Plugins/BpmTempo/...)
│   └── Web/
│       ├── bpm-player.js                  # Client audio engine & UI widget
│       └── bpm-player.css                 # Dark-mode glassmorphic styling
├── emby-bpm-tempo.user.js                 # Standalone Userscript for Tampermonkey / Violentmonkey
├── build.sh                               # Automated build and docker deployment script
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

---

### Option 2: Standalone Userscript (Zero-Server-Restart)

If you use Emby in a browser and want to use the controller immediately without touching or restarting the server:

1. Install a userscript manager browser extension like **Tampermonkey** or **Violentmonkey**.
2. Create a new script and paste the contents of `dist/emby-bpm-tempo.user.js` (or `emby-bpm-tempo.user.js`).
3. Save and open your Emby Web client. The BPM controller will automatically load on any music track.

---

## Configuration

In the Emby Web dashboard, navigate to **Settings > Plugins > BPM & Tempo Controller**:

* **Enable BPM & Tempo Controller**: Master switch for the playback controller.
* **Preserve Pitch (Pitch Lock)**: Keep enabled so slowing down tracks maintains original pitch without chipmunk or deep-voice distortion.
* **Enable Key Transposition**: Allows shifting pitch by semitones (±1 to ±6 st).
* **Show BPM Calculator & Tap-Tempo**: Enables effective BPM readouts and tap-tempo tool.
* **Enable Keyboard Shortcuts**: Toggle hotkeys (`[`, `]`, `\`).
* **Speed Presets**: Customize comma-separated speed values.
* **Auto-inject into Web Client**: Automatically injects script into Emby's `index.html` on server startup.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>[</kbd> | Decrease tempo by 5% (step) |
| <kbd>]</kbd> | Increase tempo by 5% (step) |
| <kbd>\</kbd> | Reset tempo to 100% (1.0x) and reset key |

---

## License

MIT License. Designed for Emby Media Server.
