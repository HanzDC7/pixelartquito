'use strict';

// Sonido opcional, generado con WebAudio (sin archivos). Apagado hasta que se pulsa «Sonido».
(() => {
    const S = Q.state;
    Q.sfx = (() => {
        let ac = null, rainGain = null;
        const tone = (freq, dur, type = 'sine', vol = 0.12, slide = 0) => {
            if (!ac) return;
            const o = ac.createOscillator(), v = ac.createGain();
            o.type = type; o.frequency.value = freq; if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, ac.currentTime + dur);
            v.gain.setValueAtTime(vol, ac.currentTime); v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
            o.connect(v).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
        };
        const noise = (dur, vol, freq) => {
            if (!ac) return null;
            const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const src = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
            src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; v.gain.value = vol;
            src.connect(f).connect(v).connect(ac.destination);
            return { src, v };
        };
        return {
            enable(on) {
                if (on && !ac) ac = new (window.AudioContext || window.webkitAudioContext)();
                if (ac) on ? ac.resume() : ac.suspend();
                this.rain(S.weather === 'rain');
            },
            bell() { tone(660, 1.6, 'sine', 0.14); tone(990, 1.2, 'sine', 0.06); tone(1320, 0.8, 'sine', 0.03); },
            horn() { tone(233, 0.35, 'square', 0.05); tone(294, 0.35, 'square', 0.04); },
            pop() { const n = noise(0.3, 0.12, 1800); if (n) { n.v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3); n.src.start(); } },
            thunder() { const n = noise(1.8, 0.3, 220); if (n) { n.v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.8); n.src.start(); } },
            rain(on) {
                if (rainGain) { rainGain.src.stop(); rainGain = null; }
                if (on && ac && S.sound) { rainGain = noise(2, 0.05, 2600); rainGain.src.loop = true; rainGain.src.start(); }
            },
        };
    })();
})();
