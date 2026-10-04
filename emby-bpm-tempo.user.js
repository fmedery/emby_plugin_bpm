// ==UserScript==
// @name         Emby Playback Speed & Tempo Controller (Pitch Preserved)
// @namespace    https://github.com/frederic/emby_plugin_bpm
// @version      2.0.0
// @description  Clean playback speed & BPM controller with native Emby UI and automatic pitch preservation.
// @author       Frederic
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    function isEmbyPage() {
        return !!(
            window.ApiClient ||
            window.Emby ||
            document.querySelector(".skinHeader") ||
            document.querySelector(".nowPlayingBar") ||
            document.querySelector('link[href*="emby"]') ||
            document.title.toLowerCase().includes("emby")
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

        const style = document.createElement("style");
        style.id = "embyBpmTempoStyles";
        style.textContent = "/* =============================================================\n   Emby BPM & Tempo Controller\n   100% Native Emby Look & Feel (Material Symbols & Emby Themes)\n   ============================================================= */\n\n/* Emby Now Playing Bar Speed Button */\n.emby-bpm-player-btn {\n    position: relative !important;\n    vertical-align: middle !important;\n    margin: 0 !important;\n    padding: 0.24em !important;\n    font-size: 200% !important;\n    line-height: 1 !important;\n    box-sizing: border-box !important;\n    cursor: pointer !important;\n    background: transparent !important;\n    border: none !important;\n    outline: none !important;\n    color: inherit !important;\n}\n\n.emby-bpm-player-btn:focus {\n    outline: none !important;\n}\n\n.emby-bpm-player-btn i.toggleButtonIcon {\n    font-size: inherit !important;\n    padding: 0.1em !important;\n    vertical-align: middle !important;\n    line-height: 1 !important;\n    border-radius: 0.3em !important;\n    transition: background 0.15s ease, color 0.15s ease !important;\n}\n\n/* When selected / active, match Shuffle button: black icon on translucent pill */\n.emby-bpm-player-btn.toggleButton-active i.toggleButtonIcon-active {\n    color: #000000 !important;\n}\n\n.emby-bpm-player-btn i.toggleButtonIcon:not(.toggleButtonIcon-active) {\n    color: inherit !important;\n    background: transparent !important;\n}\n\n/* Modal Dialog Panel matching Emby native dialogs */\n.emby-bpm-panel {\n    position: fixed;\n    bottom: 4.8em;\n    right: 1.5em;\n    width: 290px;\n    max-width: calc(100vw - 3em);\n    background-color: hsla(var(--card-background-hue, 0), var(--card-background-saturation, 0%), var(--card-background-lightness, 14%), 0.96) !important;\n    -webkit-backdrop-filter: blur(2.5em) saturate(1.8) !important;\n    backdrop-filter: blur(2.5em) saturate(1.8) !important;\n    border: 1px solid hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.12) !important;\n    border-radius: 1.1em !important;\n    box-shadow: 0 0.8em 3em rgba(0, 0, 0, 0.65) !important;\n    color: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), var(--theme-text-color-alpha, 0.95)) !important;\n    font-family: inherit !important;\n    z-index: 999999 !important;\n    padding: 1.1em 1.25em !important;\n    display: flex;\n    flex-direction: column;\n    gap: 0.85em;\n    box-sizing: border-box !important;\n    animation: embyDialogScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) normal both;\n}\n\n@keyframes embyDialogScaleUp {\n    from {\n        opacity: 0;\n        transform: translateY(1em) scale(0.96);\n    }\n    to {\n        opacity: 1;\n        transform: translateY(0) scale(1);\n    }\n}\n\n/* Header */\n.emby-bpm-header {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    border-bottom: 1px solid hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.08);\n    padding-bottom: 0.6em;\n}\n\n.emby-bpm-title {\n    display: flex;\n    align-items: center;\n    gap: 0.45em;\n    font-size: 1.02em;\n    font-weight: 600;\n    margin: 0;\n}\n\n.emby-bpm-title .md-icon {\n    font-size: 1.25em;\n    color: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n}\n\n.emby-bpm-close {\n    background: transparent;\n    border: none;\n    color: inherit;\n    opacity: 0.65;\n    cursor: pointer;\n    padding: 0.25em;\n    border-radius: 50%;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    transition: opacity 0.15s, background-color 0.15s;\n}\n\n.emby-bpm-close:hover {\n    opacity: 1;\n    background-color: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.12);\n}\n\n.emby-bpm-close .md-icon {\n    font-size: 1.2em;\n}\n\n/* Readout Card */\n.emby-bpm-readout {\n    display: flex;\n    align-items: baseline;\n    justify-content: space-between;\n    background-color: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.05);\n    border: 1px solid hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.08);\n    padding: 0.7em 0.9em;\n    border-radius: 0.75em;\n}\n\n.emby-bpm-tempo-val {\n    font-size: 1.9em;\n    font-weight: 800;\n    color: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n    line-height: 1;\n    font-variant-numeric: tabular-nums;\n}\n\n.emby-bpm-bpm-info {\n    font-size: 0.85em;\n    font-weight: 600;\n    opacity: 0.8;\n    text-align: right;\n    font-variant-numeric: tabular-nums;\n}\n\n/* Slider matching Emby native slider */\n.emby-bpm-slider-wrap {\n    display: flex;\n    flex-direction: column;\n    gap: 0.2em;\n}\n\n.emby-bpm-slider {\n    -webkit-appearance: none;\n    appearance: none;\n    width: 100%;\n    height: 0.45em;\n    border-radius: 0.3em;\n    background: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.22);\n    outline: none;\n    cursor: pointer;\n    margin: 0.4em 0 0.2em 0;\n}\n\n.emby-bpm-slider::-webkit-slider-thumb {\n    -webkit-appearance: none;\n    appearance: none;\n    width: 1.3em;\n    height: 1.3em;\n    border-radius: 50%;\n    background: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n    box-shadow: 0 0.1em 0.4em rgba(0, 0, 0, 0.45);\n    cursor: pointer;\n    transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);\n}\n\n.emby-bpm-slider::-webkit-slider-thumb:hover {\n    transform: scale(1.18);\n}\n\n.emby-bpm-slider::-moz-range-thumb {\n    width: 1.3em;\n    height: 1.3em;\n    border-radius: 50%;\n    background: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n    border: none;\n    box-shadow: 0 0.1em 0.4em rgba(0, 0, 0, 0.45);\n    cursor: pointer;\n}\n\n.emby-bpm-slider-labels {\n    display: flex;\n    justify-content: space-between;\n    font-size: 0.72em;\n    opacity: 0.5;\n    padding: 0 0.2em;\n}\n\n/* Quick Step Actions */\n.emby-bpm-quick-actions {\n    display: flex;\n    gap: 0.45em;\n    justify-content: space-between;\n}\n\n.emby-bpm-btn-sub {\n    flex: 1;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    gap: 0.2em;\n    background-color: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.08);\n    border: 1px solid hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.1);\n    color: inherit;\n    border-radius: 0.5em;\n    padding: 0.5em 0.3em;\n    font-size: 0.8em;\n    font-weight: 600;\n    cursor: pointer;\n    transition: all 0.15s ease;\n    font-family: inherit;\n    line-height: 1;\n}\n\n.emby-bpm-btn-sub:hover {\n    background-color: hsla(var(--theme-text-color-hue, 0), var(--theme-text-color-saturation, 0%), var(--theme-text-color-lightness, 100%), 0.18);\n}\n\n.emby-bpm-btn-sub.reset {\n    background-color: hsla(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%), 0.15);\n    border-color: hsla(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%), 0.35);\n    color: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n}\n\n.emby-bpm-btn-sub.reset:hover {\n    background-color: hsl(var(--theme-primary-color-hue, 116), var(--theme-primary-color-saturation, 42%), var(--theme-primary-color-lightness, 50%));\n    color: #ffffff;\n}\n\n.emby-bpm-btn-sub .md-icon {\n    font-size: 1.15em;\n}\n";
        document.head.appendChild(style);

        /**
 * Emby BPM & Tempo Controller
 * 100% Native Emby Look & Feel (Material Symbols & Emby Themes)
 */
(function () {
    'use strict';

    if (window._embyBpmTempoControllerLoaded) {
        return;
    }
    window._embyBpmTempoControllerLoaded = true;

    // State
    const state = {
        rate: 1.0,
        minRate: 0.50,
        maxRate: 1.50,
        trackBpm: null,
        currentTrackId: null,
        panelOpen: false
    };

    try {
        const savedRate = localStorage.getItem('emby_bpm_rate');
        if (savedRate) {
            state.rate = parseFloat(savedRate) || 1.0;
        }
    } catch (e) { }

    // -------------------------------------------------------------
    // Audio Player Hook (Pitch is natively preserved)
    // -------------------------------------------------------------
    function getActiveAudio() {
        const audios = document.querySelectorAll('audio, video');
        for (let i = 0; i < audios.length; i++) {
            const a = audios[i];
            if (!a.paused || a.currentTime > 0) {
                return a;
            }
        }
        return document.querySelector('audio') || document.querySelector('video');
    }

    function isPlayerActive() {
        const bar = document.querySelector('.nowPlayingBar');
        if (!bar) return false;
        if (bar.classList.contains('nowPlayingBar-hidden') || bar.classList.contains('hide')) {
            return false;
        }
        if (bar.offsetParent === null && window.getComputedStyle(bar).display === 'none') {
            return false;
        }

        if (window.playbackManager && typeof playbackManager.currentItem === 'function') {
            const item = playbackManager.currentItem();
            if (item) return true;
        }

        const audio = getActiveAudio();
        if (audio && (audio.currentTime > 0 || !audio.paused)) {
            return true;
        }

        return false;
    }

    function applyAudioSettings(audio) {
        if (!audio) return;

        // Native pitch lock (pitch remains unchanged when slowing down or speeding up)
        if ('preservesPitch' in audio) audio.preservesPitch = true;
        if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
        if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = true;

        if (audio.playbackRate !== state.rate) {
            audio.playbackRate = state.rate;
        }

        updateUI();
    }

    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        applyAudioSettings(this);
        return origPlay.apply(this, arguments);
    };

    setInterval(() => {
        const audio = getActiveAudio();
        if (audio && audio.playbackRate !== state.rate) {
            applyAudioSettings(audio);
        }
    }, 1000);

    // -------------------------------------------------------------
    // Track Metadata & BPM Fetching
    // -------------------------------------------------------------
    async function checkCurrentTrack() {
        if (!isPlayerActive()) {
            state.currentTrackId = null;
            state.trackBpm = null;
            return;
        }

        try {
            let itemId = null;
            if (window.playbackManager && typeof playbackManager.currentItem === 'function') {
                const item = playbackManager.currentItem();
                if (item && item.Id) itemId = item.Id;
            }

            if (!itemId && window.Emby && window.Emby.PlaybackManager) {
                const item = window.Emby.PlaybackManager.currentItem();
                if (item && item.Id) itemId = item.Id;
            }

            if (itemId && itemId !== state.currentTrackId) {
                state.currentTrackId = itemId;
                state.trackBpm = null;

                const cachedBpm = localStorage.getItem('emby_track_bpm_' + itemId);
                if (cachedBpm) {
                    state.trackBpm = parseFloat(cachedBpm);
                    updateUI();
                    return;
                }

                if (window.ApiClient) {
                    try {
                        const url = ApiClient.getUrl('/Plugins/BpmTempo/TrackBpm/' + itemId);
                        const res = await ApiClient.getJSON(url);
                        if (res && res.HasBpm && res.Bpm) {
                            state.trackBpm = res.Bpm;
                            localStorage.setItem('emby_track_bpm_' + itemId, res.Bpm);
                        }
                    } catch (e) { }

                    if (!state.trackBpm) {
                        try {
                            const userId = ApiClient.getCurrentUserId();
                            const item = await ApiClient.getItem(userId, itemId);
                            if (item && item.Tags) {
                                for (const tag of item.Tags) {
                                    const m = tag.match(/(\d+(?:\.\d+)?)\s*bpm/i);
                                    if (m) {
                                        state.trackBpm = parseFloat(m[1]);
                                        break;
                                    }
                                }
                            }
                        } catch (e) { }
                    }
                }
                updateUI();
            }
        } catch (e) { }
    }

    setInterval(checkCurrentTrack, 2000);

    // -------------------------------------------------------------
    // Tempo Controls Logic
    // -------------------------------------------------------------
    function setTempo(newRate) {
        newRate = Math.round(newRate * 100) / 100;
        if (newRate < state.minRate) newRate = state.minRate;
        if (newRate > state.maxRate) newRate = state.maxRate;

        state.rate = newRate;
        try {
            localStorage.setItem('emby_bpm_rate', newRate);
        } catch (e) { }

        const audio = getActiveAudio();
        if (audio) {
            audio.playbackRate = newRate;
            applyAudioSettings(audio);
        }
        updateUI();
    }

    function adjustTempo(delta) {
        setTempo(state.rate + delta);
    }

    function resetTempo() {
        setTempo(1.0);
    }

    // -------------------------------------------------------------
    // UI Creation & Updates
    // -------------------------------------------------------------
    function ensureUI() {
        const active = isPlayerActive();
        let btn = document.getElementById('embyBpmBtn');
        let panel = document.getElementById('embyBpmPanel');

        // Hide button and panel when playback is inactive
        if (!active) {
            if (btn) btn.style.display = 'none';
            if (state.panelOpen) togglePanel(false);
            return;
        }

        const barRight = document.querySelector('.nowPlayingBarRight') ||
                         document.querySelector('.nowPlayingBarCenter') ||
                         document.querySelector('.nowPlayingBar');

        if (!barRight) {
            if (btn) btn.style.display = 'none';
            return;
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'embyBpmBtn';
            btn.setAttribute('is', 'paper-icon-button-light');
            btn.className = 'nowPlayingBar-hidetv toggleButton mediaButton paper-icon-button-light emby-bpm-player-btn';
            btn.type = 'button';
            btn.style.padding = '.24em';
            btn.title = 'Playback Speed';
            btn.setAttribute('aria-label', 'Playback Speed');
            btn.innerHTML = `<i style="font-size:inherit;padding:.1em;" class="md-icon toggleButtonIcon" id="embyBpmIcon">speed</i>`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel();
            });
        }

        btn.style.display = '';

        if (btn.parentElement !== barRight) {
            const refElem = barRight.querySelector('.toggleShuffleButton') ||
                            barRight.querySelector('.toggleRepeatButton') ||
                            barRight.querySelector('.nowPlayingBarVolumeSliderContainer') ||
                            barRight.firstChild;
            if (refElem) {
                barRight.insertBefore(btn, refElem);
            } else {
                barRight.appendChild(btn);
            }
        }

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'embyBpmPanel';
            panel.className = 'emby-bpm-panel';
            panel.style.display = 'none';

            panel.innerHTML = `
                <div class="emby-bpm-header">
                    <h3 class="emby-bpm-title">
                        <i class="md-icon autortl">speed</i>
                        <span>Playback Speed</span>
                    </h3>
                    <button class="emby-bpm-close" id="embyBpmClose" type="button" title="Close" aria-label="Close">
                        <i class="md-icon">close</i>
                    </button>
                </div>

                <div class="emby-bpm-readout">
                    <div class="emby-bpm-tempo-val" id="embyBpmTempoDisplay">100%</div>
                    <div class="emby-bpm-bpm-info" id="embyBpmBpmInfo"></div>
                </div>

                <div class="emby-bpm-slider-wrap">
                    <input type="range" class="emby-bpm-slider" id="embyBpmSlider"
                           min="0.50" max="1.50" step="0.01" value="1.00" />
                    <div class="emby-bpm-slider-labels">
                        <span>0.5x</span>
                        <span>1.0x</span>
                        <span>1.5x</span>
                    </div>
                </div>

                <div class="emby-bpm-quick-actions">
                    <button class="emby-bpm-btn-sub" id="embyBpmMinus5" type="button"><i class="md-icon">remove</i> 5%</button>
                    <button class="emby-bpm-btn-sub reset" id="embyBpmReset" type="button"><i class="md-icon">restart_alt</i> Reset</button>
                    <button class="emby-bpm-btn-sub" id="embyBpmPlus5" type="button"><i class="md-icon">add</i> 5%</button>
                </div>
            `;

            document.body.appendChild(panel);

            // Bind Events
            document.getElementById('embyBpmClose').addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel(false);
            });
            
            const slider = document.getElementById('embyBpmSlider');
            slider.addEventListener('input', (e) => {
                setTempo(parseFloat(e.target.value));
            });

            document.getElementById('embyBpmMinus5').addEventListener('click', () => adjustTempo(-0.05));
            document.getElementById('embyBpmReset').addEventListener('click', resetTempo);
            document.getElementById('embyBpmPlus5').addEventListener('click', () => adjustTempo(0.05));
        }
    }

    function togglePanel(forceOpen) {
        const panel = document.getElementById('embyBpmPanel');
        if (!panel) return;

        if (typeof forceOpen === 'boolean') {
            state.panelOpen = forceOpen;
        } else {
            state.panelOpen = !state.panelOpen;
        }

        panel.style.display = state.panelOpen ? 'flex' : 'none';
        updateUI();

        if (!state.panelOpen) {
            const btn = document.getElementById('embyBpmBtn');
            if (btn) btn.blur();
        }
    }

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!state.panelOpen) return;
        const panel = document.getElementById('embyBpmPanel');
        const btn = document.getElementById('embyBpmBtn');
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
            togglePanel(false);
        }
    });

    function updateUI() {
        const isSelected = !!state.panelOpen;
        const percentStr = `${Math.round(state.rate * 100)}%`;

        const btn = document.getElementById('embyBpmBtn');
        const icon = document.getElementById('embyBpmIcon');

        if (btn) {
            btn.title = `Playback Speed (${percentStr})`;
            btn.classList.toggle('toggleButton-active', isSelected);
        }

        if (icon) {
            icon.classList.toggle('toggleButtonIcon-active', isSelected);
            if (isSelected) {
                icon.style.color = '#000000';
            } else {
                icon.style.color = '';
            }
        }

        const tempoDisplay = document.getElementById('embyBpmTempoDisplay');
        if (tempoDisplay) {
            tempoDisplay.textContent = percentStr;
        }

        const bpmInfo = document.getElementById('embyBpmBpmInfo');
        if (bpmInfo) {
            if (state.trackBpm) {
                const effectiveBpm = Math.round(state.trackBpm * state.rate * 10) / 10;
                bpmInfo.textContent = `${state.trackBpm} → ${effectiveBpm} BPM`;
            } else {
                bpmInfo.textContent = `${state.rate.toFixed(2)}x`;
            }
        }

        const slider = document.getElementById('embyBpmSlider');
        if (slider && Math.abs(parseFloat(slider.value) - state.rate) > 0.005) {
            slider.value = state.rate;
        }
    }

    // -------------------------------------------------------------
    // Keyboard Shortcuts Hook
    // -------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
            return;
        }

        if (e.key === '[') {
            adjustTempo(-0.05);
            e.preventDefault();
        } else if (e.key === ']') {
            adjustTempo(0.05);
            e.preventDefault();
        } else if (e.key === '\\') {
            resetTempo();
            e.preventDefault();
        }
    });

    setInterval(ensureUI, 800);
    ensureUI();

    console.log('[EmbyBPM] Clean Playback Speed Controller initialized.');
})();

    }
})();
