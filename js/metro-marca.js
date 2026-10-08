'use strict';

/*
 * Jefe de línea: la portada y los festejos.
 *
 * Lo que le da cara al juego, sin tocar sus reglas:
 *   - La portada: un cuadro animado en pixel art (el cielo de Quito de noche,
 *     el Pichincha, la silueta de la ciudad, el tren pasando por el túnel) con
 *     el nombre del juego. Se pone sola encima del menú principal.
 *   - Los festejos: las estrellas del informe se encienden de una en una, el
 *     saldo del día sube contando, y con tres estrellas, un récord o el rango
 *     final cae confeti. Una partida perdida se anuncia sin fiesta.
 *
 * No hay que llamarlo: mira lo que js/juego.js pone en #jfin y lo viste. Solo
 * depende de estas marcas, que juego.js mantiene:
 *   #jfin .caja             cada ventana del juego
 *   h2.grande               el nombre del juego (menú principal) o el rango (final)
 *   p.estrellas             «★★☆» en el informe de un día, «★ 15» en el final
 *   .cuentas .total         la fila del saldo del día
 *   .record, .logro         un récord y un logro recién ganado
 *   .caja.perdida           la partida perdida
 * Con movimiento reducido, o en las capturas de prueba (#shot), todo aparece
 * quieto y terminado.
 */
(() => {
    const { R, hash, clamp } = Q;
    const fin = document.querySelector('#jfin'), stage = document.querySelector('#stage');
    if (!fin || !stage) return;
    const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash.includes('shot');
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    const NOMBRE = 'Jefe de línea';

    // ───────────────────────── Estilos ─────────────────────────
    const estilo = el('style');
    estilo.textContent = `
        /* La línea con sus quince estaciones, arriba de cada ventana del juego. */
        #jfin .caja::before { content: ""; display: block; height: 7px; margin: -4px 0 10px;
            background: radial-gradient(circle, var(--gold) 0 2.5px, transparent 3px) 0 0 / calc(100% / 15) 7px repeat-x, linear-gradient(var(--line), var(--line)) 0 3px / 100% 1px no-repeat; }
        #jfin .caja.portada::before, #jfin .caja.perdida::before { display: none; }
        #jfin .caja.entra { animation: jm-entra .2s ease-out both; }
        @keyframes jm-entra { from { opacity: 0; transform: translateY(10px); } }

        /* La portada. */
        #jfin .caja.portada { padding-top: 0; overflow-x: hidden; }
        #jfin .jm-cartel { display: block; margin: 0 -18px 12px; width: calc(100% + 36px); background: #0B1020; border-bottom: 2px solid var(--gold); line-height: 0; text-align: center; }
        #jfin .jm-cartel canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
        #jfin .caja.portada h2.grande { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
        @media (max-width: 900px) { #jfin .jm-cartel { margin: 0 -12px 10px; width: calc(100% + 24px); } }

        /* Las estrellas, de una en una. */
        #jfin .estrellas.jm span { display: inline-block; }
        #jfin .estrellas.jm .vacia { opacity: .35; }
        #jfin .estrellas.jm.anima .llena { animation: jm-estrella .42s cubic-bezier(.2, 1.6, .4, 1) both; }
        #jfin .estrellas.jm.anima .vacia { animation: jm-vacia .3s ease-out both; }
        @keyframes jm-estrella { from { opacity: 0; transform: scale(3) rotate(-25deg); } 60% { opacity: 1; } to { transform: none; } }
        @keyframes jm-vacia { from { opacity: 0; } to { opacity: .35; } }
        #jfin .caja.redondo .estrellas { text-shadow: 0 0 12px rgba(255, 229, 0, .7); }

        /* Récords, logros y el rango final. */
        #jfin .record, #jfin .jm-record { position: relative; border-left-color: #3DDC84 !important; background: rgba(61, 220, 132, .12) !important; }
        #jfin .jm-sello { display: inline-block; margin: 0 8px 0 0; padding: 1px 7px; background: var(--gold); color: #1A0E04; font: 700 11px/1.5 ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; border-radius: 2px; }
        #jfin .jm-sello.anima { animation: jm-sello .5s cubic-bezier(.2, 1.6, .4, 1) .9s both; }
        @keyframes jm-sello { from { opacity: 0; transform: scale(2.4) rotate(-8deg); } }
        #jfin .logro.jm-anima { animation: jm-logro .5s ease-out both; }
        @keyframes jm-logro { from { opacity: 0; transform: translateX(-14px); } }
        #jfin .caja.rango h2.grande { text-shadow: 0 0 14px rgba(255, 229, 0, .65); }
        #jfin .caja.rango.entra h2.grande { animation: jm-rango .7s cubic-bezier(.2, 1.4, .4, 1) .15s both; }
        @keyframes jm-rango { from { opacity: 0; letter-spacing: .5em; } }

        /* La partida perdida: sin fiesta. */
        #jfin .caja.perdida { border-color: #E0314F; background: rgba(24, 8, 14, .94); }
        #jfin .caja.perdida h2 { color: #FF6B7D; }
        #jfin .caja.perdida.entra { animation: jm-perdida .9s ease-out both; }
        @keyframes jm-perdida { from { opacity: 0; filter: grayscale(1) brightness(.4); } }

        #jm-confeti { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 11; pointer-events: none; image-rendering: pixelated; image-rendering: crisp-edges; }
        @media (prefers-reduced-motion: reduce) { #jfin .caja, #jfin .caja * { animation: none !important; } }
    `;
    document.head.append(estilo);

    // ───────────────────────── El cartel de la portada ─────────────────────────
    const AMARILLO = '#FFE500', NOCHE = '#0B1020';
    /** Un texto con la fuente de píxeles del mapa, agrandada `k` veces. */
    const letras = (g, str, x, y, k, color) => {
        g.fillStyle = color;
        for (const ch of str) {
            const bits = Q.FONT[ch], w = Q.glyphW(ch);
            for (let b = 0; bits && b < bits.length; b++) if (bits[b] === '1') g.fillRect(x + (b % w) * k, y + Math.floor(b / w) * k, k, k);
            x += (w + 1) * k;
        }
    };
    const FUEGOS = [['#FFD23F', '#FF8A3D'], ['#FF5470', '#FFB3C1'], ['#7CC4FF', '#FFFFFF'], ['#3DDC84', '#D9FFE9'], ['#F2C200', '#1F4FA3', '#D62828']];
    /**
     * Pinta el cartel en `g`, de `W` × `H` píxeles, en el segundo `t`. De arriba abajo: el cielo, el
     * Pichincha, la ciudad (El Panecillo a la izquierda, la Basílica, las cúpulas del centro y las
     * torres del norte a la derecha), la calle y, debajo, el túnel con el tren.
     */
    const cartel = (g, W, H, t) => {
        const calle = H - 30, tunel = calle + 7, riel = H - 5;
        for (let y = 0; y < calle; y++) R(g, 0, y, W, 1, Q.mix('#070B22', '#243066', y / calle));
        for (let i = 0; i < 46; i++) { const x = Math.floor(hash(i * 3.1) * W), y = Math.floor(hash(i * 7.7) * (calle - 26)); if (Math.sin(t * (1 + hash(i)) + i) > -0.6) R(g, x, y, 1, 1, i % 5 ? '#C8D4F0' : '#FFFFFF'); }
        // El Pichincha, detrás: dos cumbres y sus faldas.
        for (let x = 0; x < W; x++) { const u = x / W, alto = Math.round(15 + 13 * Math.exp(-((u - 0.34) ** 2) / 0.012) + 10 * Math.exp(-((u - 0.52) ** 2) / 0.02) + 4 * Math.sin(u * 9) + 2 * Math.sin(u * 23)); R(g, x, calle - 9 - alto, 1, alto + 9, '#161E44'); R(g, x, calle - 9 - alto, 1, 1, '#2B3975'); }
        // Fuegos artificiales sobre el cerro: cada uno sube, revienta y se apaga, y vuelve a salir en otro sitio.
        for (let k = 0; k < 3; k++) {
            const ciclo = 3.4 + k * 0.9, fase = (t + k * 1.3) % ciclo, vez = Math.floor((t + k * 1.3) / ciclo), cx = Math.round((0.14 + 0.72 * hash(vez * 5.3 + k)) * W), cy = Math.round(7 + hash(vez * 2.9 + k) * 16), pal = FUEGOS[(vez + k) % FUEGOS.length];
            if (fase < 0.5) R(g, cx, Math.round(calle - 14 - (calle - 14 - cy) * (fase / 0.5)), 1, 2, '#FFE9A8');
            else if (fase < 1.7) { const e = (fase - 0.5) / 1.2, r = 3 + e * 15; g.globalAlpha = clamp(1.25 - e * 1.25); for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, rr = r * (i % 2 ? 1 : 0.6); R(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8 + e * e * 5, 1, 1, pal[i % pal.length]); } g.globalAlpha = 1; }
        }
        // La ciudad, a contraluz. Cada edificio sale de una cuenta: siempre los mismos.
        const C = '#0A0F24', luz = (x, y) => { if (hash(x * 1.7 + y * 3.3) > 0.55) R(g, x, y, 1, 1, hash(x + y * 9) > 0.3 ? '#FFE9A8' : '#FFB86B'); };
        for (let x = 0, i = 0; x < W; i++) { const w = 4 + Math.floor(hash(i * 2.3) * 6), norte = x / W > 0.66, h = (norte ? 9 : 4) + Math.floor(hash(i * 5.1) * (norte ? 15 : 6)); R(g, x, calle - h, w, h, C); for (let yy = calle - h + 2; yy < calle - 1; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) luz(xx, yy); if (norte && h > 17 && Math.floor(t * 1.5) % 2) R(g, x + (w >> 1), calle - h - 1, 1, 1, '#FF3B3B'); x += w + 1; }
        // El Panecillo, con la Virgen arriba.
        const px = Math.round(W * 0.13);
        for (let dx = -17; dx <= 17; dx++) { const h = Math.round(13 * Math.cos(dx / 17 * 1.5708)); R(g, px + dx, calle - h, 1, h, '#0C1230'); }
        R(g, px, calle - 20, 1, 7, '#DCE3EE'); R(g, px - 1, calle - 18, 3, 1, '#AEB8C6'); R(g, px - 2, calle - 19, 1, 1, '#AEB8C6'); R(g, px + 2, calle - 19, 1, 1, '#AEB8C6'); R(g, px, calle - 21, 1, 1, '#FFE9A8');
        // La Basílica: dos torres de aguja y la del crucero.
        const bx = Math.round(W * 0.4);
        R(g, bx - 9, calle - 9, 22, 9, C);
        for (const [dx, alto] of [[-8, 26], [-3, 26], [10, 17]]) { R(g, bx + dx, calle - alto + 6, 3, alto - 6, C); R(g, bx + dx + 1, calle - alto, 1, 6, C); R(g, bx + dx + 1, calle - alto + 9, 1, 2, '#FFE9A8'); }
        // Las cúpulas del centro.
        for (const [u, r] of [[0.52, 5], [0.58, 4]]) { const cx = Math.round(W * u); R(g, cx - r - 1, calle - 6, r * 2 + 3, 6, C); for (let dy = 0; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); R(g, cx - hw, calle - 6 - dy, hw * 2 + 1, 1, '#122A2A'); } R(g, cx, calle - 8 - r, 1, 2, '#3E8E5A'); }
        // La calle y lo que hay debajo.
        R(g, 0, calle, W, 1, '#2C3A66'); R(g, 0, calle + 1, W, H - calle - 1, '#090C18');
        R(g, 0, tunel, W, riel - tunel + 2, '#04060C');
        for (let x = 6; x < W; x += 18) { R(g, x, tunel, 2, 1, '#8FA3D9'); g.globalAlpha = 0.18; R(g, x - 2, tunel + 1, 6, 5, '#8FA3D9'); g.globalAlpha = 1; }
        R(g, 0, riel, W, 1, '#5E72A8'); for (let x = 2; x < W; x += 5) R(g, x, riel + 1, 2, 1, '#27304F');
        // El tren: seis vagones blancos con la franja roja y azul. Pasa, se pierde y vuelve.
        const vag = 20, largo = vag * 6 + 5, vuelta = (W + largo * 2) / 46, tx = Math.round(((t % vuelta) / vuelta) * (W + largo * 2) - largo);
        for (let d = 0; d < 18; d++) { g.globalAlpha = 0.34 * (1 - d / 18); const alto = 2 + (d >> 2); R(g, tx + largo + d, riel - 8 - (alto >> 1), 1, alto, '#FFF3B0'); } g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
            const x = tx + i * (vag + 1), y = riel - 13;
            R(g, x, y, vag, 12, '#E9ECF2'); R(g, x, y, vag, 1, '#FFFFFF'); R(g, x, y + 8, vag, 1, '#D62828'); R(g, x, y + 9, vag, 1, '#1F4FA3'); R(g, x, y + 11, vag, 1, '#8A8F9C');
            for (let v = 2; v < vag - 3; v += 5) R(g, x + v, y + 2, 3, 4, '#FFE9A8');
            R(g, x + 3, riel - 1, 3, 1, '#17171B'); R(g, x + vag - 6, riel - 1, 3, 1, '#17171B');
        }
        R(g, tx + largo - 1, riel - 9, 1, 2, '#FFF3B0');
        // El nombre.
        const k = W >= 150 ? 3 : 2, ancho = (Q.textW('JEFE DE LINEA') + 1) * k, x0 = Math.round((W - ancho) / 2), y0 = 9;
        letras(g, 'JEFE DE LINEA', x0 + k, y0 + k, k, NOCHE); letras(g, 'JEFE DE LINEA', x0, y0, k, AMARILLO);
        // La tilde de LÍNEA, que la fuente no tiene.
        const xi = x0 + (Q.textW('JEFE DE L') + 1) * k; R(g, xi + k, y0 - k - 1, k, k, AMARILLO); R(g, xi + 2 * k, y0 - 2 * k - 1, k, k, AMARILLO);
        const sub = 'METRO DE QUITO · LINEA 1', ws = Q.textW(sub);
        if (ws + 8 < W) { R(g, Math.round((W - ws) / 2) - 3, y0 + 5 * k + 5, ws + 6, 9, 'rgba(11,16,32,.7)'); Q.text(g, sub, Math.round((W - ws) / 2), y0 + 5 * k + 7, '#C8D4F0'); }
    };
    /** El cartel como elemento: se ajusta al ancho que tenga, en píxeles enteros, y se anima mientras esté en la página. */
    const ponerCartel = (caja) => {
        const marco = el('div', 'jm-cartel'), cv = el('canvas'), g = cv.getContext('2d'), H = 86;
        cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Jefe de línea: un tren del Metro pasa bajo la ciudad de Quito en una noche de fiestas');
        marco.append(cv); caja.prepend(marco);
        let W = 0, k = 1;
        // En una pantalla baja (un teléfono acostado) el cartel no pasa de un tercio del alto: se achica de a medios pasos.
        const medir = () => { const ancho = marco.clientWidth || 320; k = Math.max(1, Math.min(Math.floor(ancho / 168), Math.floor(innerHeight * 0.36 / H * 2) / 2)); W = Math.ceil(ancho / k); cv.width = W; cv.height = H; cv.style.width = Math.round(W * k) + 'px'; cv.style.height = Math.round(H * k) + 'px'; g.imageSmoothingEnabled = false; };
        medir();
        const obs = new ResizeObserver(() => { medir(); if (quieto()) cartel(g, W, H, 7.3); }); obs.observe(marco);
        if (quieto()) { cartel(g, W, H, 7.3); return; }
        let antes = 0;
        const cuadro = (ahora) => {
            if (!cv.isConnected) { obs.disconnect(); return; }
            if (ahora - antes > 45 && !document.hidden) { antes = ahora; cartel(g, W, H, ahora / 1000); }
            requestAnimationFrame(cuadro);
        };
        requestAnimationFrame(cuadro);
    };

    // ───────────────────────── Confeti ─────────────────────────
    const COLORES = ['#FFE500', '#D62828', '#1F4FA3', '#FFFFFF', '#3DDC84', '#FF8A3D'];
    let confetiVivo = null;
    /** Papel picado en píxeles gordos: cae desde arriba unos segundos y se va. */
    const confeti = (cuantos = 110) => {
        if (quieto() || confetiVivo) return;
        const cv = el('canvas'); cv.id = 'jm-confeti'; stage.append(cv); confetiVivo = cv;
        const E = 3, W = Math.ceil(stage.clientWidth / E), H = Math.ceil(stage.clientHeight / E), g = cv.getContext('2d');
        cv.width = W; cv.height = H;
        const p = Array.from({ length: cuantos }, (_, i) => ({ x: Math.random() * W, y: -Math.random() * H * 0.6 - 4, vx: (Math.random() - 0.5) * 26, vy: 30 + Math.random() * 50, w: 1 + (i % 3 === 0 ? 1 : 0), h: 1 + (i % 2), c: COLORES[i % COLORES.length], f: Math.random() * 6 }));
        const t0 = performance.now(); let antes = t0;
        const cuadro = (ahora) => {
            const dt = Math.min(0.05, (ahora - antes) / 1000), t = (ahora - t0) / 1000; antes = ahora;
            g.clearRect(0, 0, W, H);
            let quedan = 0;
            for (const q of p) {
                q.x += (q.vx + Math.sin(t * 5 + q.f) * 14) * dt; q.y += q.vy * dt; q.vy += 22 * dt;
                if (q.y < H + 3) quedan++;
                g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), Math.floor(t * 9 + q.f) % 2 ? q.w : q.h, Math.floor(t * 9 + q.f) % 2 ? q.h : q.w);
            }
            if (quedan && t < 6 && cv.isConnected) requestAnimationFrame(cuadro); else { cv.remove(); confetiVivo = null; }
        };
        requestAnimationFrame(cuadro);
    };

    // ───────────────────────── Vestir cada ventana ─────────────────────────
    const son = (cual, ...a) => { try { if (Q.musica && Q.musica[cual]) Q.musica[cual](...a); } catch (e) { /* el sonido nunca detiene nada */ } };
    /** Un número que sube contando hasta su valor, conservando su formato («−$1.234»). */
    const contar = (nodo, ms = 900) => {
        const txt = nodo.textContent, digitos = txt.replace(/[^0-9]/g, ''), valor = +digitos;
        if (!digitos || valor < 10 || digitos.length > 9) return;
        const antes = txt.slice(0, txt.search(/[0-9]/)), despues = txt.slice(txt.search(/[0-9][^0-9]*$/) + 1), t0 = performance.now();
        if (antes + valor.toLocaleString('de-DE') + despues !== txt) return;      // solo si se sabe rearmar tal cual
        const cuadro = (ahora) => {
            const e = clamp((ahora - t0) / ms), suave = 1 - (1 - e) ** 3;
            if (!nodo.isConnected) return;
            nodo.textContent = e < 1 ? antes + Math.round(valor * suave).toLocaleString('de-DE') + despues : txt;
            if (e < 1) requestAnimationFrame(cuadro);
        };
        requestAnimationFrame(cuadro);
    };
    const vistas = new WeakSet();
    let ultima = '';
    const vestir = () => {
        const caja = fin.querySelector('.caja');
        if (!caja || vistas.has(caja)) return;
        vistas.add(caja);
        const anima = !quieto(), grande = caja.querySelector('h2.grande'), titulo = caja.querySelector('h2'), cual = titulo ? titulo.textContent : '';
        // Una ventana que se vuelve a pintar igual (al comprar en la tienda, por ejemplo) no vuelve a entrar.
        if (anima && cual !== ultima) caja.classList.add('entra');
        ultima = cual;
        if (grande && grande.textContent.trim().toLowerCase() === NOMBRE.toLowerCase()) { caja.classList.add('portada'); ponerCartel(caja); return; }

        const perdida = caja.classList.contains('perdida'), estrellas = caja.querySelector('p.estrellas');
        let fiesta = false, espera = 250;
        if (perdida) { if (anima) setTimeout(() => son('lamento'), 300); }
        if (estrellas && /^[★☆]{3}$/.test(estrellas.textContent)) {
            // El informe de un día: tres estrellas, llenas o vacías.
            const txt = estrellas.textContent, n = txt.split('★').length - 1;
            estrellas.textContent = ''; estrellas.classList.add('jm'); estrellas.setAttribute('aria-label', `${n} de 3 estrellas`); if (anima) estrellas.classList.add('anima');
            [...txt].forEach((c, i) => {
                const s = el('span', c === '★' ? 'llena' : 'vacia', c); s.setAttribute('aria-hidden', 'true'); s.style.animationDelay = `${0.3 + i * 0.4}s`; estrellas.append(s);
                if (anima && c === '★') setTimeout(() => { if (s.isConnected) son('estrella', i); }, 300 + i * 400 + 150);
            });
            espera = 300 + 3 * 400 + 250;
            if (n === 3 && !perdida) { caja.classList.add('redondo'); fiesta = true; }
            if (n === 0 && anima && !perdida) setTimeout(() => { if (caja.isConnected) son('lamento'); }, 500);
            const saldo = caja.querySelector('.cuentas .total td:last-child'); if (saldo && anima) contar(saldo);
        } else if (grande && !perdida) {
            // El final de la semana: el rango.
            caja.classList.add('rango'); fiesta = true; espera = 500;
        }
        // Un récord: lo marca juego.js con la clase «record»; si no, se reconoce por la frase.
        const record = caja.querySelector('.record') || [...caja.querySelectorAll('.consejo')].find((p) => /es tu récord|nuevo récord/i.test(p.textContent));
        if (record && !perdida) { record.classList.add('jm-record'); const sello = el('span', 'jm-sello' + (anima ? ' anima' : ''), '¡Récord!'); record.prepend(sello); fiesta = true; }
        caja.querySelectorAll('.logro').forEach((l, i) => { if (anima) { l.classList.add('jm-anima'); l.style.animationDelay = `${espera / 1000 + i * 0.25}s`; setTimeout(() => { if (l.isConnected) son('estrella', 2); }, espera + i * 250); } fiesta = fiesta || !perdida; });
        if (fiesta && anima) setTimeout(() => { if (caja.isConnected) { confeti(); son('fanfarria'); } }, espera);
    };
    new MutationObserver(vestir).observe(fin, { childList: true });
    vestir();

    Q.marca = { cartel, confeti, vestir };
})();
