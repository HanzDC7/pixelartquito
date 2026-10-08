'use strict';

// Sonidos originales sintetizados con WebAudio: no requieren descargas ni conexión.
// El contexto solo se crea al activar Sonido. Silenciar descarta las notas pendientes.
(() => {
    const S = Q.state, CLAVE = 'quito-volumen';
    let ac = null, master = null, rain = null, enabled = false, volume = 0.45, ambiente = 4;
    const voices = new Set(), last = new Map();
    try { const saved = localStorage.getItem(CLAVE); if (saved !== null && Number.isFinite(+saved)) volume = Math.max(0, Math.min(1, +saved)); } catch (_) { /* almacenamiento opcional */ }
    const ready = () => enabled && S.sound && ac && ac.state === 'running' && !document.hidden && volume > 0;
    const limit = (name, seconds) => {
        if (!ready()) return false;
        if (ac.currentTime - (last.get(name) ?? -Infinity) < seconds) return false;
        last.set(name, ac.currentTime); return true;
    };
    const track = (source, nodes) => {
        voices.add(source);
        source.onended = () => { voices.delete(source); source.disconnect(); nodes.forEach((n) => n.disconnect()); };
    };
    const stop = () => {
        for (const source of voices) { try { source.stop(); } catch (_) { /* ya terminó */ } }
        voices.clear(); rain = null; last.clear();
    };
    const tone = (freq, dur, type = 'sine', vol = 0.12, slide = 1, delay = 0) => {
        if (!ready()) return;
        const o = ac.createOscillator(), v = ac.createGain(), t = ac.currentTime + delay;
        o.type = type; o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
        v.gain.setValueAtTime(0.0001, t);
        v.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(v).connect(master); track(o, [v]); o.start(t); o.stop(t + dur);
    };
    const noise = (dur, vol, freq, loop = false) => {
        if (!ready()) return null;
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain(), t = ac.currentTime;
        src.buffer = buf; src.loop = loop; f.type = 'lowpass'; f.frequency.value = freq;
        v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(vol, t + 0.025);
        if (!loop) v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(v).connect(master); track(src, [f, v]); src.start();
        if (!loop) src.stop(t + dur);
        return src;
    };
    const notes = (freqs, step = 0.12, vol = 0.11, type = 'triangle') => freqs.forEach((f, i) => tone(f, step * 2.5, type, vol, 1, i * step));
    const syncRain = () => {
        const wanted = ready() && S.weather === 'rain';
        if (!wanted && rain) { rain.stop(); rain = null; }
        if (wanted && !rain) rain = noise(3, 0.075, 2600, true);
    };
    const sync = async () => {
        if (!ac) return;
        if (!enabled || document.hidden) { stop(); await ac.suspend(); return; }
        await ac.resume();
        // El usuario puede apagar el audio mientras resume() está pendiente.
        if (enabled && !document.hidden) syncRain();
        else { stop(); await ac.suspend(); }
    };
    Q.sfx = {
        async enable(on) {
            enabled = !!on; S.sound = enabled;
            try {
                if (enabled && !ac) {
                    const Audio = window.AudioContext || window.webkitAudioContext;
                    if (!Audio) throw new Error('WebAudio no disponible');
                    ac = new Audio(); master = ac.createGain(); master.gain.value = volume;
                    master.connect(ac.destination);
                }
                await sync();
                if (enabled) this.select();
            } catch (_) { enabled = false; S.sound = false; stop(); }
            if (Q.mapa) Q.mapa.syncButtons();
        },
        get volume() { return volume; },
        setVolume(value) {
            if (!Number.isFinite(+value)) return;
            volume = Math.max(0, Math.min(1, +value));
            if (master) master.gain.setTargetAtTime(volume, ac.currentTime, 0.025);
            if (!volume) stop();
            syncRain();
            try { localStorage.setItem(CLAVE, String(volume)); } catch (_) { /* opcional */ }
        },
        click() { if (limit('click', 0.07)) tone(520, 0.055, 'triangle', 0.07, 1.4); },
        select() { if (limit('select', 0.12)) notes([523, 784], 0.07, 0.09); },
        purchase() { if (limit('purchase', 0.15)) notes([659, 988, 1319], 0.09); },
        dispatch() {
            if (!limit('dispatch', 0.7)) return;
            notes([880, 660, 880], 0.15, 0.09, 'sine');
            noise(1.1, 0.07, 650); tone(95, 1.2, 'triangle', 0.07, 2);
        },
        notify(kind = 'info') {
            if (!limit('notice', 1.5)) return;
            if (kind === 'mal') notes([440, 330, 440], 0.13, 0.1);
            else notes(kind === 'bien' ? [659, 880] : [587, 740], 0.13, 0.09);
        },
        start() { notes([392, 523, 659, 784], 0.13); },
        result(stars) { notes(stars > 0 ? [523, 659, 784, 1047] : [392, 349, 262], 0.22, 0.13); },
        bell() { if (limit('bell', 0.5)) { tone(660, 1.6, 'sine', 0.14); tone(990, 1.2, 'sine', 0.06); tone(1320, 0.8, 'sine', 0.03); } },
        horn() { if (limit('horn', 1)) { tone(233, 0.35, 'square', 0.035); tone(294, 0.35, 'square', 0.025); } },
        pop() { if (limit('pop', 0.3)) noise(0.3, 0.12, 1800); },
        thunder() { if (limit('thunder', 3)) noise(1.8, 0.24, 220); },
        rain: syncRain,
        ambience(dt) {
            if (!ready() || !S.playing) return;
            ambiente -= dt;
            if (ambiente > 0) return;
            ambiente = 6 + Math.random() * 5;
            if (S.weather !== 'clear') return;
            if (S.hour >= 6 && S.hour < 18) {
                tone(1800, 0.16, 'sine', 0.035, 1.45);
                tone(2200, 0.2, 'sine', 0.025, 0.8, 0.2);
            } else {
                for (let i = 0; i < 3; i++) tone(3200, 0.07, 'sine', 0.012, 1, i * 0.13);
            }
        },
    };
    document.addEventListener('visibilitychange', () => { sync().catch(() => { stop(); }); });
    // Captura también los botones creados por el juego. No suena al pasar el ratón.
    document.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (button && !button.disabled && button.id !== 'sound') Q.sfx.click();
    }, true);
    const slider = document.querySelector('#volume'), output = document.querySelector('#volume-value');
    if (slider) {
        slider.value = Math.round(volume * 100);
        const label = () => { output.textContent = `${slider.value}%`; slider.setAttribute('aria-valuetext', `${slider.value} por ciento`); };
        label();
        slider.addEventListener('input', () => { Q.sfx.setVolume(+slider.value / 100); label(); });
        slider.addEventListener('change', () => Q.sfx.select());
    }
})();
