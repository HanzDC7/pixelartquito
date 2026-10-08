'use strict';

/*
 * Jefe de línea: la música y la voz.
 *
 * Seis temas cortos, originales, sintetizados con WebAudio: un pasillo para
 * los menús, un aire tranquilo para las horas valle (y su versión de noche),
 * un sanjuanito para las horas pico, un pasacalle para las fiestas y algo
 * lento para la lluvia. No hay archivos de sonido: cada tema es una lista de
 * notas.
 *
 * La música se elige sola según lo que pasa en el juego (lee Q.juego.sim y
 * Q.state) y cambia al terminar el compás. Suena solo si el Sonido está
 * activado; el botón «Música» de Opciones la apaga sin apagar los efectos.
 *
 * Usa su propio contexto de audio, aparte del de js/sonido.js, y sigue su
 * volumen (Q.sfx.volume).
 *
 * La voz son los anuncios del Metro, dichos con la voz en español que traiga
 * el navegador (speechSynthesis): la próxima estación cuando se mira un tren
 * por dentro, las estaciones que se cierran y se reabren, y el fin del
 * servicio. Si el navegador no tiene voz en español, no dice nada.
 */
(() => {
    const S = Q.state, CLAVE = 'quito-musica';
    let ac = null, salida = null, bus = null, efectos = null, eco = null, ruido = null;
    let activa = true, tema = null, pedido = null, fijo = null, k = 0, tSig = 0;
    try { activa = localStorage.getItem(CLAVE) !== '0'; } catch (e) { /* sin almacenamiento, encendida */ }

    // ───────────────────────── Notas y acordes ─────────────────────────
    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    /** «A4» → 440; «G#5» → 830,6. */
    const hz = (n) => { const sostenido = n[1] === '#', octava = +n[n.length - 1]; return 440 * 2 ** ((SEMI[n[0]] + (sostenido ? 1 : 0) - 9) / 12 + (octava - 4)); };
    const ACORDE = { Am: ['A', 'C', 'E'], C: ['C', 'E', 'G'], G: ['G', 'B', 'D'], F: ['F', 'A', 'C'], Dm: ['D', 'F', 'A'], E: ['E', 'G#', 'B'], Em: ['E', 'G', 'B'] };
    /** La nota `grado` (0 la tónica, 1 la tercera, 2 la quinta) de un acorde, a partir de una octava. */
    const deAcorde = (a, grado, octava) => { const n = ACORDE[a][grado]; return hz(n + (SEMI[n[0]] < SEMI[ACORDE[a][0][0]] ? octava + 1 : octava)); };

    /*
     * Un tema: `bpm` (negras por minuto), `paso` (lo que dura cada casilla, en
     * negras) y `compas` (casillas por compás). Cada compás tiene un acorde y
     * una línea de melodía: una nota por casilla, «.» es silencio y «-» alarga
     * la anterior. El bajo, el rasgueo y la percusión repiten un patrón:
     *   bajo      1 la tónica · 5 la quinta
     *   rasgueo   x un acorde corto, como de charango
     *   golpes    b el bombo · h las semillas
     */
    const TEMAS = {
        // Pasillo: tres por cuatro, en menor, para los menús.
        menu: {
            bpm: 92, paso: 0.5, compas: 6, voz: 'triangle', vol: 0.085, bajo: '1.5.5.', rasgueo: '..x.x.', golpes: '......',
            acordes: ['Am', 'Am', 'Dm', 'E', 'Am', 'F', 'E', 'Am'],
            melodia: ['E5 . A5 . C6 B5', 'A5 - - . E5 .', 'F5 . A5 . D6 C6', 'B5 - - . G#5 .', 'C6 . B5 . A5 E5', 'F5 - A5 . C6 .', 'B5 . A5 . G#5 B5', 'A5 - - - . .'],
        },
        // Las horas valle: liviano, con aire entre las notas.
        dia: {
            bpm: 96, paso: 0.25, compas: 16, voz: 'triangle', vol: 0.07, bajo: '1.......5.......', rasgueo: '....x.......x...', golpes: '........h.......',
            acordes: ['Am', 'C', 'G', 'Am', 'F', 'C', 'Em', 'Am'],
            melodia: [
                'A4 . . C5 . . E5 . D5 . . C5 . . A4 .', 'G4 . . C5 . . E5 . G5 . . E5 . . D5 .', 'D5 . . G4 . . B4 . D5 . . E5 . . D5 .', 'C5 . . A4 . . . . . . . . E4 . G4 .',
                'A4 . C5 . F5 . . E5 . . C5 . A4 . . .', 'G4 . C5 . E5 . . D5 . . C5 . G4 . . .', 'E5 . . D5 . . B4 . . . G4 . B4 . D5 .', 'C5 . . . A4 . . . . . . . . . . .',
            ],
        },
        // Las horas pico: un sanjuanito, que empuja.
        pico: {
            bpm: 118, paso: 0.25, compas: 16, voz: 'square', vol: 0.045, bajo: '1...5...1...5.5.', rasgueo: '..x...x...x...x.', golpes: 'b..hb.h.b..hb.hh',
            acordes: ['Am', 'C', 'G', 'Am', 'Am', 'C', 'Em', 'Am'],
            melodia: [
                'A5 . E5 A5 C6 . A5 . G5 . E5 G5 A5 . . .', 'C6 . G5 C6 E6 . C6 . D6 . C6 A5 G5 . . .', 'D6 . B5 D6 G5 . B5 . D6 . C6 B5 A5 . G5 .', 'E5 . G5 A5 C6 . A5 . A5 . . . . . E5 G5',
                'A5 . C6 A5 E6 . D6 . C6 . A5 C6 D6 . . .', 'E6 . C6 E6 G5 . C6 . E6 . D6 C6 G5 . . .', 'B5 . G5 B5 E5 . G5 . B5 . D6 B5 G5 . E5 .', 'A5 . . E5 A5 . . . A4 . . . . . . .',
            ],
        },
        // Las fiestas: un pasacalle, de banda de pueblo.
        fiesta: {
            bpm: 112, paso: 0.25, compas: 16, voz: 'square', vol: 0.05, bajo: '1...5...1...5...', rasgueo: '..x...x...x...x.', golpes: 'b...h...b...h.h.',
            acordes: ['Am', 'E', 'Am', 'C', 'C', 'G', 'E', 'Am'],
            melodia: [
                'E5 E5 A5 . C6 . B5 A5 G#5 . B5 . E5 . . .', 'E5 E5 G#5 . B5 . D6 C6 B5 . D6 . G#5 . . .', 'C6 C6 E6 . D6 . C6 B5 A5 . C6 . E6 . . .', 'D6 D6 C6 . G5 . C6 E6 G6 . . . E6 . . .',
                'G5 G5 C6 . E6 . D6 C6 E6 . G6 . E6 . C6 .', 'D6 D6 B5 . G5 . B5 D6 G6 . F6 . D6 . B5 .', 'E6 . D6 . B5 . G#5 . E5 . G#5 . B5 . D6 .', 'C6 . A5 . E5 . A5 . A5 - . . . . . .',
            ],
        },
        // La lluvia: pocas notas, con eco.
        lluvia: {
            bpm: 74, paso: 0.25, compas: 16, voz: 'sine', vol: 0.085, bajo: '1...............', rasgueo: '................', golpes: '................', eco: 0.55,
            acordes: ['Am', 'F', 'Dm', 'E'],
            melodia: ['E5 . . . . . C5 . . . . . A4 . . .', 'F4 . . . A4 . . . C5 . . . . . . .', 'D5 . . . . . F5 . . . E5 . D5 . . .', 'E5 . . . . . . . B4 . . . G#4 . . .'],
        },
    };
    // La noche: el tema de las horas valle, más lento y una octava más abajo.
    TEMAS.noche = Object.assign({}, TEMAS.dia, { bpm: 78, octava: -1, vol: 0.06, golpes: '................' });
    Object.values(TEMAS).forEach((T) => { T.notas = T.melodia.map((c) => c.split(' ')); T.largo = T.acordes.length * T.compas; });

    // ───────────────────────── Voces ─────────────────────────
    const tono = (f, t, dur, tipo, vol, a) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = tipo; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(a); o.start(t); o.stop(t + dur + 0.03);
        o.onended = () => { o.disconnect(); g.disconnect(); };
    };
    /** Un golpe de ruido: grave y corto es un bombo de cuero; agudo, unas semillas. */
    const golpe = (t, dur, vol, tipo, corte) => {
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = ruido; f.type = tipo; f.frequency.value = corte;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
        s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    };

    /** Toca la casilla `i` del tema, a la hora `t` del reloj de audio. */
    const casilla = (T, i, t) => {
        const c = Math.floor(i / T.compas), p = i % T.compas, dur = 60 / T.bpm * T.paso, acorde = T.acordes[c], oct = T.octava || 0;
        const n = T.notas[c][p];
        if (n && n !== '.' && n !== '-') {
            let largo = 1; while (p + largo < T.compas && T.notas[c][p + largo] === '-') largo++;
            const f = hz(n) * 2 ** oct;
            tono(f, t, dur * largo * 0.95 + 0.08, T.voz, T.vol, bus);
            if (T.eco) tono(f, t, dur * largo + 0.1, T.voz, T.vol * T.eco, eco);
        }
        const b = T.bajo[p];
        if (b === '1' || b === '5') tono(deAcorde(acorde, b === '1' ? 0 : 2, 2 + oct), t, dur * 2.6, 'triangle', 0.11, bus);
        if (T.rasgueo[p] === 'x') for (let j = 0; j < 3; j++) tono(deAcorde(acorde, j, 4 + oct), t + j * 0.014, 0.16, 'square', 0.014, bus);
        const g = T.golpes[p];
        if (g === 'b') { golpe(t, 0.16, 0.2, 'lowpass', 150); tono(88, t, 0.14, 'sine', 0.14, bus); } else if (g === 'h') golpe(t, 0.05, 0.035, 'highpass', 5200);
    };

    // ───────────────────────── El reloj ─────────────────────────
    const sonando = () => !!ac && ac.state === 'running' && S.sound && !document.hidden;
    const programar = () => {
        if (!sonando()) return;
        salida.gain.value = Q.sfx && Number.isFinite(Q.sfx.volume) ? Q.sfx.volume : 0.45;
        const quiere = activa ? pedido : null;
        // El cambio de tema espera al final del compás y deja un respiro.
        if (quiere !== tema && (!tema || k % TEMAS[tema].compas === 0)) { tema = quiere; k = 0; tSig = Math.max(tSig, ac.currentTime) + 0.25; }
        if (!tema) return;
        const T = TEMAS[tema];
        if (tSig < ac.currentTime - 0.3) tSig = ac.currentTime + 0.05;      // la pestaña estuvo dormida: se retoma desde ahora
        while (tSig < ac.currentTime + 0.2) { casilla(T, k, tSig); k = (k + 1) % T.largo; tSig += 60 / T.bpm * T.paso; if (quiere !== tema && k % T.compas === 0) break; }
    };
    /** Qué tema le toca al momento. Fuera del juego no hay música: el mapa tiene sus pájaros y sus grillos. */
    const elegir = () => {
        if (!document.body.classList.contains('jugando')) return null;
        const sim = Q.juego && Q.juego.sim;
        if (!sim) return 'menu';
        const h = sim.t / 60, laborable = sim.abre < 6.5 * 60;
        if (sim.lluvia) return 'lluvia';
        if (S.fiestas) return 'fiesta';
        if (h >= 21.5 || sim.t >= sim.cierra) return 'noche';
        if (laborable && ((h >= 6.4 && h < 10) || (h >= 16.9 && h < 20))) return 'pico';
        return 'dia';
    };
    const arrancar = () => {
        if (!S.sound || document.hidden) return;
        try {
            if (!ac) {
                const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
                ac = new Audio();
                salida = ac.createGain(); salida.connect(ac.destination);
                bus = ac.createGain(); bus.gain.value = 0.55; bus.connect(salida);
                efectos = ac.createGain(); efectos.gain.value = 0.9; efectos.connect(salida);
                // El eco: lo que entra vuelve a sonar un tercio de segundo después, cada vez más bajo.
                eco = ac.createDelay(1); eco.delayTime.value = 0.36; const vuelve = ac.createGain(); vuelve.gain.value = 0.35; eco.connect(vuelve).connect(eco); eco.connect(bus);
                ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            if (ac.state !== 'running') ac.resume();
        } catch (e) { ac = null; }
    };
    const callar = () => { if (ac && ac.state === 'running') ac.suspend(); tema = null; };

    setInterval(() => { pedido = fijo || elegir(); if (ac && (!S.sound || document.hidden)) callar(); programar(); }, 60);
    // El audio solo puede empezar dentro de un gesto del usuario: cualquier toque sirve, si el Sonido está activado.
    // (El botón de Sonido ya cambió Q.state.sound cuando el clic llega hasta aquí.)
    document.addEventListener('click', arrancar);
    document.addEventListener('visibilitychange', () => { if (document.hidden) callar(); else arrancar(); });

    // ───────────────────────── Lo que suena una sola vez ─────────────────────────
    const frase = (notas, paso, tipo, vol) => { if (!sonando()) return; notas.forEach((n, i) => { if (n !== '.') tono(hz(n), ac.currentTime + 0.02 + i * paso, paso * 2.4, tipo, vol, efectos); }); };
    Q.musica = {
        temas: Object.keys(TEMAS),
        get activa() { return activa; },
        get tema() { return tema; },
        poner(si) { activa = !!si; try { localStorage.setItem(CLAVE, activa ? '1' : '0'); } catch (e) { /* idem */ } if (activa) arrancar(); pintar(); },
        /** Una estrella que se enciende: la `i`-ésima de las tres suena más aguda. */
        estrella(i) { frase([['E5', 'A5'], ['A5', 'C6'], ['C6', 'E6']][Math.min(2, i)], 0.07, 'triangle', 0.16); },
        /** Para un día redondo, un récord o un logro. */
        fanfarria() { frase(['A4', 'C5', 'E5', 'A5', '.', 'E5', 'A5', 'C6', 'E6'], 0.085, 'square', 0.07); frase(['A3', '.', '.', '.', '.', 'E3', '.', '.', 'A3'], 0.085, 'triangle', 0.16); },
        /** Cuando las cosas salen mal: unas notas que bajan. */
        lamento() { frase(['E5', 'C5', 'A4', '.', 'E4'], 0.16, 'triangle', 0.12); },
        /** Para oír un tema desde la consola: Q.musica.probar('pico'); sin nombre, vuelve a elegir sola. */
        probar(t) { fijo = TEMAS[t] ? t : null; arrancar(); },
    };

    // ───────────────────────── La voz ─────────────────────────
    const CLAVE_VOZ = 'quito-voz', habla = window.speechSynthesis || null;
    let voz = true, dicho = -1e9;
    try { voz = localStorage.getItem(CLAVE_VOZ) !== '0'; } catch (e) { /* idem */ }
    const PREFERIDAS = ['es-EC', 'es-419', 'es-CO', 'es-PE', 'es-MX', 'es-US', 'es-ES'];
    const rango = (v) => { const i = PREFERIDAS.indexOf(v.lang.replace('_', '-')); return (i < 0 ? 50 : i) + (v.localService ? 0 : 0.5); };
    /** Dice una frase. Lo que no es urgente espera a que termine lo anterior y no se amontona. */
    const decir = (texto, urgente = false) => {
        if (!voz || !habla || !S.sound || document.hidden) return false;
        const ahora = performance.now();
        if (!urgente && (habla.speaking || ahora - dicho < 2500)) return false;
        try {
            const voces = habla.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es')).sort((a, b) => rango(a) - rango(b));
            if (!voces.length) return false;
            const u = new SpeechSynthesisUtterance(texto);
            u.voice = voces[0]; u.lang = voces[0].lang; u.rate = 1.03; u.volume = Math.min(1, (Q.sfx && Number.isFinite(Q.sfx.volume) ? Q.sfx.volume : 0.45) * 1.7);
            if (urgente) habla.cancel();
            habla.speak(u); dicho = ahora;
            return true;
        } catch (e) { return false; }
    };
    // Qué había la última vez que se miró, para notar lo que cambia.
    const antes = { sim: null, cerradas: [], tramo: '', cerro: false, tren: 0, estado: '' };
    const escuchar = () => {
        const sim = Q.juego && Q.juego.sim;
        if (!sim) { antes.sim = null; return; }
        const n = sim.est.length, cerradas = sim.est.map((e) => sim.cerrada(e.i)), tramo = sim.tramo.join('-'), nombre = (i) => sim.est[i].n;
        // Un día recién empezado (o retomado) no anuncia lo que ya estaba así.
        if (antes.sim !== sim) { Object.assign(antes, { sim, cerradas, tramo, cerro: sim.t >= sim.cierra, tren: 0, estado: '' }); return; }
        if (tramo !== antes.tramo) {
            if (sim.tramo[0] > 0 || sim.tramo[1] < n - 1) decir(`Atención. Los trenes circulan solo entre ${nombre(sim.tramo[0])} y ${nombre(sim.tramo[1])}. Las demás estaciones están cerradas.`, true);
            else decir('Atención. Se restablece el servicio en toda la línea.', true);
        } else {
            const nuevas = [], abiertas = [];
            cerradas.forEach((c, i) => { if (c && !antes.cerradas[i]) nuevas.push(i); else if (!c && antes.cerradas[i]) abiertas.push(i); });
            if (nuevas.length) decir(`Atención. La estación ${nombre(nuevas[0])} está cerrada. Los trenes no se detienen.`, true);
            else if (abiertas.length) decir(`La estación ${nombre(abiertas[0])} vuelve a abrir.`, true);
        }
        antes.cerradas = cerradas; antes.tramo = tramo;
        if (!antes.cerro && sim.t >= sim.cierra) { antes.cerro = true; decir('El Metro de Quito termina su operación por hoy. Gracias por viajar con nosotros.', true); }
        // Dentro de un tren: la próxima estación, al salir de cada parada.
        const titulo = document.body.classList.contains('dentro') && document.querySelector('#jest.untren h2'), num = titulo && titulo.textContent.match(/Tren (\d+)/);
        const t = num && sim.trenes.find((q) => q.id === +num[1]);
        if (!t) { antes.tren = 0; return; }
        if (antes.tren === t.id && t.estado !== antes.estado) {
            if (t.estado === 'viaje' && antes.estado === 'parada') decir(`Próxima estación: ${nombre(t.sig)}.`);
            else if (t.estado === 'averiado') decir('Estimados pasajeros: este tren se detendrá unos minutos. Disculpen las molestias.', true);
            else if (t.estado === 'vuelta') decir(`${nombre(sim.tramo[t.cab])}. Fin del recorrido.`);
        }
        antes.tren = t.id; antes.estado = t.estado;
    };
    setInterval(escuchar, 250);
    Object.defineProperty(Q.musica, 'voz', { get: () => voz });
    Object.assign(Q.musica, {
        ponerVoz(si) { voz = !!si; try { localStorage.setItem(CLAVE_VOZ, voz ? '1' : '0'); } catch (e) { /* idem */ } if (!voz && habla) habla.cancel(); else decir('Próxima estación: San Francisco.', true); pintar(); },
        decir,
    });

    // Los botones van en Opciones, en la fila del volumen, que es la que queda a la vista durante la partida.
    const volumen = document.querySelector('#volume'), fila = volumen && volumen.closest('.row');
    const boton = (id, alPulsar) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.style.flex = '1 1 40%'; b.addEventListener('click', alPulsar); if (fila) fila.append(b); return b; };
    const bMusica = boton('musica', () => Q.musica.poner(!activa)), bVoz = boton('voz', () => Q.musica.ponerVoz(!voz));
    function pintar() {
        bMusica.textContent = activa ? 'Música: activada' : 'Música: apagada'; bMusica.classList.toggle('on', activa); bMusica.setAttribute('aria-pressed', String(activa));
        bVoz.textContent = voz ? 'Voz: activada' : 'Voz: apagada'; bVoz.classList.toggle('on', voz); bVoz.setAttribute('aria-pressed', String(voz)); bVoz.hidden = !habla;
    }
    pintar();
})();
