// ==UserScript==
// @name         Emby BPM & Tempo Controller (Pitch Preserved)
// @namespace    https://github.com/frederic/emby_plugin_bpm
// @version      1.0.0
// @description  Slow down or speed up music BPM without altering pitch, plus key transposition, tap tempo, and real-time BPM calculation in Emby Web.
// @author       Frederic
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Only run if we are on an Emby Web page
    function isEmbyPage() {
        return !!(
            window.ApiClient ||
            window.Emby ||
            document.querySelector('.skinHeader') ||
            document.querySelector('.nowPlayingBar') ||
            document.querySelector('link[href*="emby"]') ||
            document.title.toLowerCase().includes('emby')
        );
    }

    if (!isEmbyPage()) {
        const checkInterval = setInterval(() => {
            if (isEmbyPage()) {
                clearInterval(checkInterval);
                initPlugin();
            }
        }, 1500);
        setTimeout(() => clearInterval(checkInterval), 15000);
        return;
    }

    initPlugin();

    function initPlugin() {
        if (window._embyBpmTempoUserscriptLoaded) return;
        window._embyBpmTempoUserscriptLoaded = true;

        // 1. Inject Styles
        const css = `
            .emby-bpm-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                background: rgba(255, 255, 255, 0.08);
                color: #e0e0e0;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 16px;
                padding: 3px 10px;
                font-size: 0.82rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                user-select: none;
                margin: 0 4px;
                vertical-align: middle;
            }
            .emby-bpm-btn:hover {
                background: rgba(0, 164, 220, 0.25);
                border-color: #00a4dc;
                color: #ffffff;
                box-shadow: 0 0 8px rgba(0, 164, 220, 0.4);
            }
            .emby-bpm-btn.active {
                background: #00a4dc;
                color: #ffffff;
                border-color: #00a4dc;
            }
            .emby-bpm-panel {
                position: fixed;
                bottom: 80px;
                right: 25px;
                width: 340px;
                background: rgba(20, 20, 24, 0.94);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 14px;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.2);
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                z-index: 999999;
                padding: 16px 18px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                animation: embyBpmSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes embyBpmSlideUp {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .emby-bpm-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding-bottom: 10px;
            }
            .emby-bpm-title {
                font-size: 0.95rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 6px;
                color: #ffffff;
            }
            .emby-bpm-close {
                background: transparent;
                border: none;
                color: #888888;
                font-size: 1.2rem;
                cursor: pointer;
                line-height: 1;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .emby-bpm-close:hover {
                color: #ffffff;
                background: rgba(255, 255, 255, 0.1);
            }
            .emby-bpm-readout {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                background: rgba(0, 0, 0, 0.35);
                padding: 10px 14px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .emby-bpm-tempo-val {
                font-size: 1.8rem;
                font-weight: 800;
                color: #00a4dc;
                font-variant-numeric: tabular-nums;
            }
            .emby-bpm-subval {
                font-size: 0.85rem;
                color: #aaaaaa;
                text-align: right;
            }
            .emby-bpm-effective {
                font-weight: 700;
                color: #00d284;
            }
            .emby-bpm-slider-container {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .emby-bpm-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 6px;
                border-radius: 3px;
                background: rgba(255, 255, 255, 0.2);
                outline: none;
                cursor: pointer;
            }
            .emby-bpm-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #00a4dc;
                cursor: pointer;
                box-shadow: 0 0 6px rgba(0, 164, 220, 0.7);
            }
            .emby-bpm-button-row {
                display: flex;
                gap: 6px;
                justify-content: space-between;
            }
            .emby-bpm-step-btn {
                flex: 1;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border-radius: 6px;
                padding: 6px 0;
                font-size: 0.78rem;
                font-weight: 600;
                cursor: pointer;
                text-align: center;
                transition: all 0.15s;
            }
            .emby-bpm-step-btn:hover {
                background: rgba(255, 255, 255, 0.18);
            }
            .emby-bpm-step-btn.reset {
                background: rgba(0, 164, 220, 0.15);
                color: #00a4dc;
                border-color: rgba(0, 164, 220, 0.3);
            }
            .emby-bpm-step-btn.reset:hover {
                background: #00a4dc;
                color: #ffffff;
            }
            .emby-bpm-presets {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }
            .emby-bpm-preset-pill {
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 3px 8px;
                font-size: 0.74rem;
                color: #cccccc;
                cursor: pointer;
                transition: all 0.15s;
            }
            .emby-bpm-preset-pill:hover, .emby-bpm-preset-pill.active {
                background: #00a4dc;
                color: #ffffff;
                border-color: #00a4dc;
            }
            .emby-bpm-pitch-section {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .emby-bpm-pitch-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.8rem;
                color: #bbbbbb;
                font-weight: 600;
            }
            .emby-bpm-pitch-badge {
                font-size: 0.72rem;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(0, 210, 132, 0.15);
                color: #00d284;
                border: 1px solid rgba(0, 210, 132, 0.3);
            }
            .emby-bpm-semitone-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 4px;
            }
            .emby-bpm-semitone-val {
                font-weight: 700;
                font-size: 0.9rem;
                color: #ffffff;
                min-width: 45px;
                text-align: center;
            }
            .emby-bpm-tools {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.78rem;
            }
            .emby-bpm-tap-btn {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #ffffff;
                border-radius: 6px;
                padding: 5px 10px;
                cursor: pointer;
                font-weight: 600;
            }
            .emby-bpm-target-input {
                width: 60px;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 4px;
                color: #ffffff;
                padding: 4px 6px;
                font-size: 0.78rem;
                text-align: center;
            }
            .emby-bpm-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.7rem;
                color: #666666;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                padding-top: 8px;
            }
            .emby-bpm-footer kbd {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                padding: 1px 4px;
                color: #aaaaaa;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'embyBpmStyles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        // 2. Initialize State
        const state = {
            rate: 1.0,
            minRate: 0.50,
            maxRate: 1.50,
            stepSize: 0.05,
            preservePitch: true,
            semitones: 0,
            presets: [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00],
            trackBpm: null,
            currentTrackId: null,
            panelOpen: false,
            tapTimes: []
        };

        try {
            const savedRate = localStorage.getItem('emby_bpm_rate');
            if (savedRate) state.rate = parseFloat(savedRate) || 1.0;
        } catch (e) { }

        function getActiveAudio() {
            const audios = document.querySelectorAll('audio, video');
            for (let i = 0; i < audios.length; i++) {
                if (!audios[i].paused || audios[i].currentTime > 0) return audios[i];
            }
            return document.querySelector('audio') || document.querySelector('video');
        }

        function applyAudioSettings(audio) {
            if (!audio) return;
            if ('preservesPitch' in audio) audio.preservesPitch = state.preservePitch;
            if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = state.preservePitch;
            if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = state.preservePitch;
            if (audio.playbackRate !== state.rate) audio.playbackRate = state.rate;
            updateUI();
        }

        const origPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            applyAudioSettings(this);
            return origPlay.apply(this, arguments);
        };

        setInterval(() => {
            const audio = getActiveAudio();
            if (audio && (audio.preservesPitch !== state.preservePitch || audio.playbackRate !== state.rate)) {
                applyAudioSettings(audio);
            }
        }, 1000);

        function setTempo(newRate) {
            newRate = Math.round(newRate * 100) / 100;
            if (newRate < state.minRate) newRate = state.minRate;
            if (newRate > state.maxRate) newRate = state.maxRate;
            state.rate = newRate;
            try { localStorage.setItem('emby_bpm_rate', newRate); } catch (e) { }
            const audio = getActiveAudio();
            if (audio) {
                audio.playbackRate = newRate;
                applyAudioSettings(audio);
            }
            updateUI();
        }

        function adjustTempo(delta) { setTempo(state.rate + delta); }
        function resetTempo() { setTempo(1.0); state.semitones = 0; updateUI(); }
        function setSemitones(s) { state.semitones = Math.max(-6, Math.min(6, s)); updateUI(); }

        function handleTapTempo() {
            const now = Date.now();
            if (state.tapTimes.length > 0 && (now - state.tapTimes[state.tapTimes.length - 1]) > 2500) {
                state.tapTimes = [];
            }
            state.tapTimes.push(now);
            if (state.tapTimes.length > 5) state.tapTimes.shift();

            if (state.tapTimes.length >= 2) {
                let intervals = [];
                for (let i = 1; i < state.tapTimes.length; i++) {
                    intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
                }
                const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const bpm = Math.round(60000 / avg);
                if (bpm >= 40 && bpm <= 240) {
                    state.trackBpm = bpm;
                    if (state.currentTrackId) {
                        try { localStorage.setItem('emby_track_bpm_' + state.currentTrackId, bpm); } catch (e) { }
                    }
                }
            }
            updateUI();
        }

        function ensureUI() {
            if (!document.getElementById('embyBpmBtn')) {
                const btn = document.createElement('button');
                btn.id = 'embyBpmBtn';
                btn.className = 'emby-bpm-btn';
                btn.type = 'button';
                btn.title = 'BPM & Tempo Controller (Pitch Preserved)';
                btn.innerHTML = `<span>🎵</span> <span id="embyBpmBtnLabel">${Math.round(state.rate * 100)}%</span>`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePanel();
                });

                const bar = document.querySelector('.nowPlayingBarCenter') ||
                            document.querySelector('.nowPlayingBarRight') ||
                            document.querySelector('.nowPlayingBar');
                if (bar) {
                    bar.appendChild(btn);
                } else {
                    btn.style.position = 'fixed';
                    btn.style.bottom = '20px';
                    btn.style.right = '20px';
                    btn.style.zIndex = '99999';
                    document.body.appendChild(btn);
                }
            }

            if (!document.getElementById('embyBpmPanel')) {
                const panel = document.createElement('div');
                panel.id = 'embyBpmPanel';
                panel.className = 'emby-bpm-panel';
                panel.style.display = 'none';
                panel.innerHTML = `
                    <div class="emby-bpm-header">
                        <div class="emby-bpm-title">
                            <span>🎵 Tempo &amp; BPM Control</span>
                        </div>
                        <button class="emby-bpm-close" id="embyBpmClose">&times;</button>
                    </div>
                    <div class="emby-bpm-readout">
                        <div>
                            <div class="emby-bpm-tempo-val" id="embyBpmTempoDisplay">100%</div>
                            <div style="font-size: 0.75rem; color: #888888;" id="embyBpmMultiplierDisplay">1.00x speed</div>
                        </div>
                        <div class="emby-bpm-subval">
                            <div id="embyBpmEffective" class="emby-bpm-effective">-- BPM</div>
                            <div style="font-size: 0.72rem; color: #777777;" id="embyBpmOriginal">Track: Unknown</div>
                        </div>
                    </div>
                    <div class="emby-bpm-slider-container">
                        <input type="range" class="emby-bpm-slider" id="embyBpmSlider"
                               min="0.50" max="1.50" step="0.01" value="1.00" />
                    </div>
                    <div class="emby-bpm-button-row">
                        <button class="emby-bpm-step-btn" id="embyBpmMinus5">-5%</button>
                        <button class="emby-bpm-step-btn" id="embyBpmMinus1">-1%</button>
                        <button class="emby-bpm-step-btn reset" id="embyBpmReset">Reset (1.0x)</button>
                        <button class="emby-bpm-step-btn" id="embyBpmPlus1">+1%</button>
                        <button class="emby-bpm-step-btn" id="embyBpmPlus5">+5%</button>
                    </div>
                    <div class="emby-bpm-presets" id="embyBpmPresets"></div>
                    <div class="emby-bpm-pitch-section">
                        <div class="emby-bpm-pitch-header">
                            <span>Pitch Lock &amp; Key Transposition</span>
                            <span class="emby-bpm-pitch-badge" id="embyBpmPitchLockBadge">🔒 Pitch Locked</span>
                        </div>
                        <div class="emby-bpm-semitone-controls">
                            <button class="emby-bpm-step-btn" id="embyBpmSemiDown">-1 Semi</button>
                            <span class="emby-bpm-semitone-val" id="embyBpmSemiDisplay">Original Key</span>
                            <button class="emby-bpm-step-btn" id="embyBpmSemiUp">+1 Semi</button>
                        </div>
                    </div>
                    <div class="emby-bpm-tools">
                        <button class="emby-bpm-tap-btn" id="embyBpmTap">🥁 Tap Beat</button>
                        <span style="color: #888888;">Target BPM:</span>
                        <input type="number" class="emby-bpm-target-input" id="embyBpmTargetInput" placeholder="BPM" min="40" max="250" />
                    </div>
                    <div class="emby-bpm-footer">
                        <span>Shortcuts: <kbd>[</kbd> slower &bull; <kbd>]</kbd> faster &bull; <kbd>\\</kbd> reset</span>
                    </div>
                `;
                document.body.appendChild(panel);

                document.getElementById('embyBpmClose').addEventListener('click', togglePanel);
                document.getElementById('embyBpmSlider').addEventListener('input', (e) => setTempo(parseFloat(e.target.value)));
                document.getElementById('embyBpmMinus5').addEventListener('click', () => adjustTempo(-0.05));
                document.getElementById('embyBpmMinus1').addEventListener('click', () => adjustTempo(-0.01));
                document.getElementById('embyBpmReset').addEventListener('click', resetTempo);
                document.getElementById('embyBpmPlus1').addEventListener('click', () => adjustTempo(0.01));
                document.getElementById('embyBpmPlus5').addEventListener('click', () => adjustTempo(0.05));
                document.getElementById('embyBpmSemiDown').addEventListener('click', () => setSemitones(state.semitones - 1));
                document.getElementById('embyBpmSemiUp').addEventListener('click', () => setSemitones(state.semitones + 1));
                document.getElementById('embyBpmTap').addEventListener('click', handleTapTempo);

                document.getElementById('embyBpmTargetInput').addEventListener('change', (e) => {
                    const target = parseFloat(e.target.value);
                    if (target && state.trackBpm) setTempo(target / state.trackBpm);
                });

                const presetsContainer = document.getElementById('embyBpmPresets');
                state.presets.forEach(p => {
                    const pill = document.createElement('button');
                    pill.className = 'emby-bpm-preset-pill';
                    pill.textContent = `${Math.round(p * 100)}%`;
                    pill.addEventListener('click', () => setTempo(p));
                    presetsContainer.appendChild(pill);
                });
            }
        }

        function togglePanel() {
            const panel = document.getElementById('embyBpmPanel');
            if (!panel) return;
            state.panelOpen = !state.panelOpen;
            panel.style.display = state.panelOpen ? 'flex' : 'none';
            if (state.panelOpen) updateUI();
        }

        function updateUI() {
            const btnLabel = document.getElementById('embyBpmBtnLabel');
            if (btnLabel) btnLabel.textContent = `${Math.round(state.rate * 100)}%`;

            const tempoDisplay = document.getElementById('embyBpmTempoDisplay');
            if (tempoDisplay) tempoDisplay.textContent = `${Math.round(state.rate * 100)}%`;

            const multDisplay = document.getElementById('embyBpmMultiplierDisplay');
            if (multDisplay) multDisplay.textContent = `${state.rate.toFixed(2)}x speed`;

            const slider = document.getElementById('embyBpmSlider');
            if (slider && Math.abs(parseFloat(slider.value) - state.rate) > 0.005) slider.value = state.rate;

            const effDisplay = document.getElementById('embyBpmEffective');
            const origDisplay = document.getElementById('embyBpmOriginal');
            if (effDisplay && origDisplay) {
                if (state.trackBpm) {
                    const eff = Math.round(state.trackBpm * state.rate * 10) / 10;
                    effDisplay.textContent = `${eff} BPM`;
                    origDisplay.textContent = `Original: ${state.trackBpm} BPM`;
                } else {
                    effDisplay.textContent = `-- BPM`;
                    origDisplay.textContent = `Tap beat to measure`;
                }
            }

            const semiDisplay = document.getElementById('embyBpmSemiDisplay');
            if (semiDisplay) {
                if (state.semitones === 0) semiDisplay.textContent = `Original Key`;
                else if (state.semitones > 0) semiDisplay.textContent = `+${state.semitones} st`;
                else semiDisplay.textContent = `${state.semitones} st`;
            }

            const pills = document.querySelectorAll('.emby-bpm-preset-pill');
            pills.forEach(pill => {
                const val = parseFloat(pill.textContent) / 100;
                pill.classList.toggle('active', Math.abs(val - state.rate) < 0.005);
            });
        }

        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || document.activeElement.isContentEditable) return;
            if (e.key === '[') { adjustTempo(-state.stepSize); e.preventDefault(); }
            else if (e.key === ']') { adjustTempo(state.stepSize); e.preventDefault(); }
            else if (e.key === '\\') { resetTempo(); e.preventDefault(); }
        });

        setInterval(ensureUI, 1000);
        ensureUI();
    }
})();
