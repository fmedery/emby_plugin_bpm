/**
 * Emby BPM & Tempo Controller
 * High-fidelity pitch-preserved tempo reduction, BPM calculation, and key transposition.
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
        stepSize: 0.05,
        fineStepSize: 0.01,
        preservePitch: true,
        semitones: 0,
        presets: [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00],
        trackBpm: null,
        currentTrackId: null,
        panelOpen: false,
        tapTimes: []
    };

    // Load persisted rate
    try {
        const savedRate = localStorage.getItem('emby_bpm_rate');
        if (savedRate) {
            state.rate = parseFloat(savedRate) || 1.0;
        }
    } catch (e) { }

    let audioContext = null;
    let pitchNode = null;
    let mediaSourceNode = null;

    // -------------------------------------------------------------
    // Audio Player Hook
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

    function applyAudioSettings(audio) {
        if (!audio) return;

        // Strict pitch preservation
        if ('preservesPitch' in audio) {
            audio.preservesPitch = state.preservePitch;
        }
        if ('webkitPreservesPitch' in audio) {
            audio.webkitPreservesPitch = state.preservePitch;
        }
        if ('mozPreservesPitch' in audio) {
            audio.mozPreservesPitch = state.preservePitch;
        }

        // Apply rate
        if (audio.playbackRate !== state.rate) {
            audio.playbackRate = state.rate;
        }

        // Apply semitone pitch shift if Web Audio is enabled & semitones != 0
        applyPitchShift(audio);

        updateUI();
    }

    // -------------------------------------------------------------
    // Web Audio Pitch Shifter (Delay Modulation Phase Vocoder)
    // -------------------------------------------------------------
    function applyPitchShift(audio) {
        if (state.semitones === 0) {
            if (pitchNode) {
                pitchNode.setPitch(1.0);
            }
            return;
        }

        try {
            if (!audioContext) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                audioContext = new AudioCtx();
            }

            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            if (!mediaSourceNode && audio) {
                try {
                    mediaSourceNode = audioContext.createMediaElementSource(audio);
                    pitchNode = createPitchShiftNode(audioContext);
                    mediaSourceNode.connect(pitchNode.input);
                    pitchNode.output.connect(audioContext.destination);
                } catch (corsErr) {
                    // If CORS prevents AudioContext routing, fallback safely without error
                    console.warn('[EmbyBPM] Web Audio Pitch Shifter bypassed (CORS/Stream restriction):', corsErr);
                    return;
                }
            }

            if (pitchNode) {
                const pitchRatio = Math.pow(2, state.semitones / 12);
                pitchNode.setPitch(pitchRatio);
            }
        } catch (err) {
            console.warn('[EmbyBPM] Pitch shift error:', err);
        }
    }

    function createPitchShiftNode(ctx) {
        const bufferLen = 4096;
        const delay1 = ctx.createDelay(1.0);
        const delay2 = ctx.createDelay(1.0);
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const input = ctx.createGain();
        const output = ctx.createGain();

        input.connect(delay1);
        input.connect(delay2);
        delay1.connect(gain1);
        delay2.connect(gain2);
        gain1.connect(output);
        gain2.connect(output);

        let currentRatio = 1.0;
        let animationFrame = null;
        let phase = 0;
        const period = 0.05; // 50ms window

        function updateModulation() {
            if (state.semitones === 0) {
                gain1.gain.value = 1.0;
                gain2.gain.value = 0.0;
                delay1.delayTime.value = 0.0;
                delay2.delayTime.value = 0.0;
                animationFrame = requestAnimationFrame(updateModulation);
                return;
            }

            const now = ctx.currentTime;
            const delta = (1.0 - currentRatio);
            phase = (now % period) / period;

            // Two overlapping sawtooth delay lines
            const mod1 = (phase * period * delta + period) % period;
            const mod2 = ((phase + 0.5) % 1.0 * period * delta + period) % period;

            delay1.delayTime.setValueAtTime(Math.max(0.001, mod1), now);
            delay2.delayTime.setValueAtTime(Math.max(0.001, mod2), now);

            // Cross-fading triangular envelope
            const g1 = Math.sin(phase * Math.PI);
            gain1.gain.setValueAtTime(Math.max(0, g1), now);
            gain2.gain.setValueAtTime(Math.max(0, 1 - g1), now);

            animationFrame = requestAnimationFrame(updateModulation);
        }

        updateModulation();

        return {
            input,
            output,
            setPitch(ratio) {
                currentRatio = ratio;
            }
        };
    }

    // -------------------------------------------------------------
    // Hook HTMLMediaElement
    // -------------------------------------------------------------
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        applyAudioSettings(this);
        return origPlay.apply(this, arguments);
    };

    setInterval(() => {
        const audio = getActiveAudio();
        if (audio) {
            if (audio.preservesPitch !== state.preservePitch || audio.playbackRate !== state.rate) {
                applyAudioSettings(audio);
            }
        }
    }, 1000);

    // -------------------------------------------------------------
    // Track Metadata & BPM Fetching
    // -------------------------------------------------------------
    async function checkCurrentTrack() {
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

                // Check localStorage cached BPM first
                const cachedBpm = localStorage.getItem('emby_track_bpm_' + itemId);
                if (cachedBpm) {
                    state.trackBpm = parseFloat(cachedBpm);
                    updateUI();
                    return;
                }

                // Query server API endpoint
                if (window.ApiClient) {
                    try {
                        const url = ApiClient.getUrl('/Plugins/BpmTempo/TrackBpm/' + itemId);
                        const res = await ApiClient.getJSON(url);
                        if (res && res.HasBpm && res.Bpm) {
                            state.trackBpm = res.Bpm;
                            localStorage.setItem('emby_track_bpm_' + itemId, res.Bpm);
                        }
                    } catch (e) { }

                    // Also check Emby Item Tags
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
        state.semitones = 0;
        const audio = getActiveAudio();
        if (audio) applyAudioSettings(audio);
        updateUI();
    }

    function setSemitones(semitones) {
        state.semitones = Math.max(-6, Math.min(6, semitones));
        const audio = getActiveAudio();
        if (audio) applyAudioSettings(audio);
        updateUI();
    }

    // -------------------------------------------------------------
    // Tap Tempo Calculation
    // -------------------------------------------------------------
    function handleTapTempo() {
        const now = Date.now();
        if (state.tapTimes.length > 0 && (now - state.tapTimes[state.tapTimes.length - 1]) > 2500) {
            state.tapTimes = [];
        }

        state.tapTimes.push(now);
        if (state.tapTimes.length > 5) {
            state.tapTimes.shift();
        }

        if (state.tapTimes.length >= 2) {
            let intervals = [];
            for (let i = 1; i < state.tapTimes.length; i++) {
                intervals.push(state.tapTimes[i] - state.tapTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const calculatedBpm = Math.round(60000 / avgInterval);

            if (calculatedBpm >= 40 && calculatedBpm <= 240) {
                state.trackBpm = calculatedBpm;
                if (state.currentTrackId) {
                    try {
                        localStorage.setItem('emby_track_bpm_' + state.currentTrackId, calculatedBpm);
                    } catch (e) { }
                }
            }
        }
        updateUI();
    }

    // -------------------------------------------------------------
    // UI Creation & Updates
    // -------------------------------------------------------------
    function ensureUI() {
        let btn = document.getElementById('embyBpmBtn');
        const bar = document.querySelector('.nowPlayingBarRight') ||
                    document.querySelector('.nowPlayingBarCenter') ||
                    document.querySelector('.nowPlayingBar');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'embyBpmBtn';
            btn.className = 'emby-bpm-btn';
            btn.type = 'button';
            btn.title = 'BPM & Tempo Controller (Pitch Preserved)';
            btn.innerHTML = `<span style="font-size: 1rem;">🎵</span> <span id="embyBpmBtnLabel">${Math.round(state.rate * 100)}%</span>`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePanel();
            });
        }

        if (bar) {
            if (btn.parentElement !== bar) {
                btn.style.position = '';
                btn.style.bottom = '';
                btn.style.right = '';
                btn.style.zIndex = '';
                const vol = bar.querySelector('.nowPlayingBarVolumeSliderContainer') || bar.firstChild;
                if (vol) {
                    bar.insertBefore(btn, vol);
                } else {
                    bar.appendChild(btn);
                }
            }
        } else {
            if (!btn.parentElement) {
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

            // Bind Events
            document.getElementById('embyBpmClose').addEventListener('click', togglePanel);
            
            const slider = document.getElementById('embyBpmSlider');
            slider.addEventListener('input', (e) => {
                setTempo(parseFloat(e.target.value));
            });

            document.getElementById('embyBpmMinus5').addEventListener('click', () => adjustTempo(-0.05));
            document.getElementById('embyBpmMinus1').addEventListener('click', () => adjustTempo(-0.01));
            document.getElementById('embyBpmReset').addEventListener('click', resetTempo);
            document.getElementById('embyBpmPlus1').addEventListener('click', () => adjustTempo(0.01));
            document.getElementById('embyBpmPlus5').addEventListener('click', () => adjustTempo(0.05));

            document.getElementById('embyBpmSemiDown').addEventListener('click', () => setSemitones(state.semitones - 1));
            document.getElementById('embyBpmSemiUp').addEventListener('click', () => setSemitones(state.semitones + 1));

            document.getElementById('embyBpmTap').addEventListener('click', handleTapTempo);

            const targetInput = document.getElementById('embyBpmTargetInput');
            targetInput.addEventListener('change', (e) => {
                const targetBpm = parseFloat(e.target.value);
                if (targetBpm && state.trackBpm) {
                    setTempo(targetBpm / state.trackBpm);
                }
            });

            // Render Presets
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
        if (state.panelOpen) {
            updateUI();
        }
    }

    function updateUI() {
        const btnLabel = document.getElementById('embyBpmBtnLabel');
        if (btnLabel) {
            btnLabel.textContent = `${Math.round(state.rate * 100)}%`;
        }

        const tempoDisplay = document.getElementById('embyBpmTempoDisplay');
        if (tempoDisplay) {
            tempoDisplay.textContent = `${Math.round(state.rate * 100)}%`;
        }

        const multDisplay = document.getElementById('embyBpmMultiplierDisplay');
        if (multDisplay) {
            multDisplay.textContent = `${state.rate.toFixed(2)}x speed`;
        }

        const slider = document.getElementById('embyBpmSlider');
        if (slider && Math.abs(parseFloat(slider.value) - state.rate) > 0.005) {
            slider.value = state.rate;
        }

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
            if (state.semitones === 0) {
                semiDisplay.textContent = `Original Key`;
            } else if (state.semitones > 0) {
                semiDisplay.textContent = `+${state.semitones} st`;
            } else {
                semiDisplay.textContent = `${state.semitones} st`;
            }
        }

        // Highlight active preset
        const pills = document.querySelectorAll('.emby-bpm-preset-pill');
        pills.forEach(pill => {
            const val = parseFloat(pill.textContent) / 100;
            pill.classList.toggle('active', Math.abs(val - state.rate) < 0.005);
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
            adjustTempo(-state.stepSize);
            e.preventDefault();
        } else if (e.key === ']') {
            adjustTempo(state.stepSize);
            e.preventDefault();
        } else if (e.key === '\\') {
            resetTempo();
            e.preventDefault();
        }
    });

    // Initialize UI loop
    setInterval(ensureUI, 1000);
    ensureUI();

    console.log('[EmbyBPM] BPM & Tempo Controller initialized successfully.');
})();
