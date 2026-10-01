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
        presets: [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00],
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

                <div class="emby-bpm-presets" id="embyBpmPresets"></div>

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

            // Render Presets
            const presetsContainer = document.getElementById('embyBpmPresets');
            state.presets.forEach(p => {
                const chip = document.createElement('button');
                chip.className = 'emby-bpm-chip';
                chip.type = 'button';
                chip.textContent = `${Math.round(p * 100)}%`;
                chip.addEventListener('click', () => setTempo(p));
                presetsContainer.appendChild(chip);
            });
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
        const isSelected = (state.panelOpen || state.rate !== 1.0);
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

        const chips = document.querySelectorAll('.emby-bpm-chip');
        chips.forEach(chip => {
            const val = parseFloat(chip.textContent) / 100;
            chip.classList.toggle('active', Math.abs(val - state.rate) < 0.005);
        });
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
