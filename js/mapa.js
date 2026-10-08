'use strict';

/*
 * Quito, el mapa real a escala, a pantalla completa.
 *
 * Cada píxel mide lo mismo en toda la pantalla: 1, 2, 8 o 32 metros según el
 * acercamiento. Las calles, los edificios, los parques y las quebradas son los
 * de verdad (OpenStreetMap), y el relieve es el del SRTM. El norte no queda
 * arriba: el mapa está girado para que la cuadrícula del Centro Histórico
 * quede derecha, con el Pichincha arriba y el norte hacia la derecha.
 *
 * Dos maneras de mirarlo: desde arriba, como un plano, o inclinado, con los
 * cerros y los edificios levantados según su altura real.
 *
 * Cuadro fijo para retocar: index.html#shot&x=0&y=0&z=1&v=1&h=21&w=rain&f=1&t=6&names=1
 *   x, y: metros desde la Plaza Grande · z: nivel (0 a 3) · v=1: vista inclinada
 *   en: nombre de un lugar · card: abre una ficha · k: píxeles de pantalla por píxel del dibujo
 *   tam=1536x950: tamaño fijo de la ventana, para que la captura no dependa del navegador
 */
(() => {
    const { R, hash, pick, disc, line, clamp, lerp } = Q;
    const G = Q.geo, P = Q.pinta, I = P.INCL, S = Q.state, $ = (sel) => document.querySelector(sel);
    const NIVELES = [1, 2, 8, 32];                 // metros por píxel
    const NOMBRE_NIVEL = ['calle', 'barrio', 'ciudad', 'región'];
    const params = new URLSearchParams(location.hash.slice(1));
    // La cámara: x en metros; c es la coordenada vertical, que en el plano es «y» y en la vista inclinada es la altura de pantalla.
    Object.assign(S, { x: 0, c: 0, nivel: 1, vx: 0, vc: 0, destino: null, names: false, metro: true, inclinada: false });

    const view = $('#view'), v = view.getContext('2d');
    let W = Q.W, H = Q.H, pie = 0;
    let entrada = null;
    /** El lienzo llena la ventana con píxeles enteros: nítido en cualquier pantalla. */
    const ajustar = () => {
        const fija = (params.get('tam') || '').split('x'), dpr = window.devicePixelRatio || 1;     // «tam=1536x950» fija el tamaño, para las capturas
        const pw = Math.max(320, (+fija[0] || innerWidth) * dpr), ph = Math.max(200, (+fija[1] || innerHeight) * dpr);
        // En un teléfono, cada píxel del dibujo ocupa al menos 1,6 de pantalla: si no, los rótulos no se leen.
        const chica = Math.min(pw, ph) / dpr < 500 ? Math.ceil(1.6 * dpr) : 1;
        const k = +params.get('k') || Math.max(chica, Math.round(Math.max(pw, ph * 1.5) / 660));
        W = Q.W = Math.ceil(pw / k); H = Q.H = Math.ceil(ph / k);
        view.width = W; view.height = H; view.style.width = W * k / dpr + 'px'; view.style.height = H * k / dpr + 'px';
        v.imageSmoothingEnabled = false;
        const barra = $('#places');
        const juego = Q.mapa && Q.mapa.extra;
        pie = document.body.classList.contains('limpio') || !barra ? 2 : juego ? juego.alto + 2 : Math.ceil((barra.offsetHeight + 10) * dpr / k) + 2;   // lo que tapa la barra de abajo
    };
    let fijo = null;      // en el modo de cuadro fijo, repinta hasta que no falte nada
    addEventListener('resize', () => { ajustar(); limitar(); if (fijo) fijo(); });

    const region = P.region();
    const SITIOS = Q.SITIOS || [];
    const sitio = (id) => SITIOS.find((s) => s.id === id);
    const SH = 'rgba(8,10,24,.32)';
    const rnd = (a, b) => a + Math.random() * (b - a);

    /** Del mundo a la coordenada vertical de la cámara, y de vuelta. */
    const aC = (x, y, h = 0) => (S.inclinada ? P.caer(y, G.altura(x, y) + h) : y);
    const deC = (x, c) => (S.inclinada ? P.subir(x, c) : c);

    // ───────────────────────── Teselas pintadas ─────────────────────────
    const TIPOS = ['det', 'ciu', 'odet', 'ociu', 'oreg'], LIMITE = { det: 96, ciu: 40, odet: 96, ociu: 44, oreg: 60 };
    const cache = {}; TIPOS.forEach((t) => { cache[t] = new Map(); });
    let cola = [], cuadro = 0, faltan = 0;
    const NTX = G.ANCHO / G.T, NTY = G.ALTO / G.T, NBX = G.ANCHO / 2048, NBY = G.ALTO / 2048;
    // Las teselas del plano son la materia prima de las inclinadas.
    const fuente = {
        det: (tx, ty) => { if (tx < 0 || ty < 0 || tx >= NTX || ty >= NTY) return false; const k = tx + '_' + ty; let c = cache.det.get(k); if (!c) { c = P.detalle(tx, ty); if (!c) return undefined; cache.det.set(k, c); } c.uso = cuadro; return c; },
        ciu: (bx, by) => { if (bx < 0 || by < 0 || bx >= NBX || by >= NBY) return false; const k = bx + '_' + by; let c = cache.ciu.get(k); if (!c) { c = P.ciudad(bx, by); if (!c) return undefined; cache.ciu.set(k, c); } c.uso = cuadro; return c; },
        reg: (tx, ty) => region.teselas.get(tx + '_' + ty) || false,
    };
    const armar = { det: P.detalle, ciu: P.ciudad, odet: (i, j) => P.oblicua(2, i, j, fuente.det), ociu: (i, j) => P.oblicua(8, i, j, fuente.ciu), oreg: (i, j) => P.oblicua(32, i, j, fuente.reg) };
    const pedir = (tipo, a, b, d) => {
        const c = cache[tipo].get(a + '_' + b);
        if (c) { c.uso = cuadro; return c; }
        cola.push([d, tipo, a, b]); faltan++;
        return null;
    };
    /** Pinta lo que falta, lo más cercano primero, sin pasarse del tiempo dado. */
    const construir = (ms) => {
        const t0 = performance.now();
        cola.sort((p, q) => p[0] - q[0]);
        for (const [, tipo, a, b] of cola) {
            if (performance.now() - t0 > ms) break;
            const k = a + '_' + b;
            if (cache[tipo].has(k)) continue;
            const c = armar[tipo](a, b);
            if (c) { c.uso = cuadro; cache[tipo].set(k, c); }
        }
        cola = [];
        for (const tipo of TIPOS) {
            const m = cache[tipo];
            if (m.size > LIMITE[tipo]) [...m.entries()].sort((p, q) => p[1].uso - q[1].uso).slice(0, m.size - LIMITE[tipo] + 8).forEach(([k]) => m.delete(k));
        }
    };
    /** Los lienzos de una tesela del plano se crean solo cuando toca dibujarla. */
    const lienzos = (c) => { if (!c.cv) { c.cv = P.lienzo(c.px, 256); c.luz = P.lienzo(c.lz, 256); } return c; };

    // ───────────────────────── Vías, metro y teleférico ─────────────────────────
    const CELDA = 1024, indice = new Map();
    G.vias.forEach((via, i) => {
        if (via.k > 4 && via.k !== 11) return;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let j = 0; j < via.p.length; j += 2) { x0 = Math.min(x0, via.p[j]); x1 = Math.max(x1, via.p[j]); y0 = Math.min(y0, via.p[j + 1]); y1 = Math.max(y1, via.p[j + 1]); }
        via.caja = [x0, y0, x1, y1];
        for (let cx = Math.floor(x0 / CELDA); cx <= Math.floor(x1 / CELDA); cx++) for (let cy = Math.floor(y0 / CELDA); cy <= Math.floor(y1 / CELDA); cy++) { const k = cx + '_' + cy; if (!indice.has(k)) indice.set(k, []); indice.get(k).push(i); }
    });
    const visto = new Int32Array(G.vias.length);
    let ronda = 0;
    const viasEn = (x0, y0, x1, y1, fn) => {
        ronda++;
        for (let cx = Math.floor(x0 / CELDA); cx <= Math.floor(x1 / CELDA); cx++) for (let cy = Math.floor(y0 / CELDA); cy <= Math.floor(y1 / CELDA); cy++) {
            const l = indice.get(cx + '_' + cy); if (!l) continue;
            for (const i of l) { if (visto[i] === ronda) continue; visto[i] = ronda; const c = G.vias[i].caja; if (c[2] >= x0 && c[0] <= x1 && c[3] >= y0 && c[1] <= y1) fn(G.vias[i], i); }
        }
    };
    /** Recorrido de una línea: largo acumulado y punto a una distancia dada. */
    const camino = (p) => { const a = new Float32Array(p.length / 2); for (let i = 1; i < a.length; i++) a[i] = a[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]); return a; };
    const pt = [0, 0, 0, 0];
    const enCamino = (p, a, s) => {
        let lo = 1, hi = a.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < s) lo = m + 1; else hi = m; }
        const d = a[lo] - a[lo - 1] || 1, t = clamp((s - a[lo - 1]) / d), i = lo * 2;
        pt[0] = lerp(p[i - 2], p[i], t); pt[1] = lerp(p[i - 1], p[i + 1], t); pt[2] = (p[i] - p[i - 2]) / d; pt[3] = (p[i + 1] - p[i - 1]) / d;
        return pt;
    };

    // El metro: se unen los tramos de vía en una sola línea, de sur a norte.
    const metro = (() => {
        // Los datos traen las dos vías, una por sentido, casi encimadas. Se sigue una sola: desde el
        // extremo sur, se va pegando el tramo que continúa y que más avanza hacia el norte.
        const tramos = Q.BASE.metro.map((t) => t.map(([x, y]) => [x, y])).filter((t) => t.length >= 2);
        const cerca = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 14;
        let mejor = [];
        if (tramos.length) {
            let ini = 0, minX = 1e9;
            tramos.forEach((t, i) => { const x = Math.min(t[0][0], t[t.length - 1][0]); if (x < minX - 1 || (Math.abs(x - minX) <= 1 && t.length > tramos[ini].length)) { minX = x; ini = i; } });
            const usados = new Set([ini]); mejor = tramos[ini].slice();
            if (mejor[0][0] > mejor[mejor.length - 1][0]) mejor.reverse();
            for (;;) {
                const fin = mejor[mejor.length - 1]; let sig = -1, alReves = false, avance = 20;
                tramos.forEach((t, i) => {
                    if (usados.has(i)) return;
                    const a0 = t[0], a1 = t[t.length - 1];
                    if (cerca(a0, fin) && a1[0] - fin[0] > avance) { avance = a1[0] - fin[0]; sig = i; alReves = false; }
                    else if (cerca(a1, fin) && a0[0] - fin[0] > avance) { avance = a0[0] - fin[0]; sig = i; alReves = true; }
                });
                if (sig < 0) break;
                usados.add(sig);
                const t = alReves ? tramos[sig].slice().reverse() : tramos[sig];
                mejor = mejor.concat(t.slice(1));
            }
        }
        if (mejor.length < 2) return null;
        const p = new Float32Array(mejor.length * 2); mejor.forEach((c, i) => { p[i * 2] = c[0]; p[i * 2 + 1] = c[1]; });
        const a = camino(p), largo = a[a.length - 1];
        // Cada estación, en el punto de la línea que le queda más cerca.
        const est = Q.BASE.estaciones.map(([nombre, x, y]) => {
            let ms = 0, md = 1e9;
            for (let s = 0; s <= largo; s += 20) { const q = enCamino(p, a, s), d = Math.hypot(q[0] - x, q[1] - y); if (d < md) { md = d; ms = s; } }
            const q = enCamino(p, a, ms);
            return { nombre, s: ms, x: q[0], y: q[1], lejos: md, est: true, id: 'metro' };
        }).filter((e) => e.lejos < 400).sort((e1, e2) => e1.s - e2.s)
            // Una misma estación puede venir dos veces en los datos (El Labrador y Labrador): se queda la de nombre más completo.
            .filter((e, i, l) => !l.some((o, j) => j !== i && Math.abs(o.s - e.s) < 450 && (o.nombre.length > e.nombre.length || (o.nombre.length === e.nombre.length && j < i))));
        return { p, a, largo, est };
    })();
    const cable = (() => {
        const c = Q.BASE.cables.filter(([, pts]) => pts.length >= 2).sort((a, b) => b[1].length - a[1].length).find(([n]) => /telef/i.test(n)) || Q.BASE.cables[0];
        if (!c) return null;
        const p = new Float32Array(c[1].length * 2); c[1].forEach((q, i) => { p[i * 2] = q[0]; p[i * 2 + 1] = q[1]; });
        const a = camino(p);
        return { p, a, largo: a[a.length - 1] };
    })();

    // ───────────────────────── Lo que se mueve ─────────────────────────
    const A = { rockets: [], sparks: [], kites: [], ripples: [], rainF: 0, fogF: 0, bolt: 0, boltNext: 5, fiestaT: 0, condor: 0 };
    const FW = [['#FFD23F', '#FF8A3D'], ['#FF5470', '#FFB3C1'], ['#7CC4FF', '#FFFFFF'], ['#3DDC84', '#D9FFE9'], ['#C792EA', '#FFFFFF'], ['#F2C200', '#1F4FA3', '#D62828']];
    A.clouds = Array.from({ length: 9 }, (_, i) => ({ x: hash(i + 3) * 1100, y: hash(i + 4) * 700, v: 5 + hash(i + 5) * 5, seed: i * 7.7 }));
    A.fog = Array.from({ length: 12 }, (_, i) => ({ x: hash(i + 13) * 1100, y: hash(i + 14) * 600, v: 4 + hash(i + 15) * 5, r: 60 + hash(i + 16) * 70 }));
    A.metro = { s: metro ? metro.largo * 0.45 : 0, dir: 1, wait: 2, last: -1 };
    A.plane = { t: -1, wait: 6 }; A.bird = { x: 300, y: 180, vx: 0, vy: 0 };
    A.flocks = ['plaza', 'sanfrancisco', 'santodomingo'].map(sitio).filter(Boolean).map((s, k) => ({ cx: s.x, cy: s.id === 'sanfrancisco' ? s.y + 50 : s.y, fly: 0, birds: Array.from({ length: 9 }, (_, i) => [rnd(-22, 22), rnd(-18, 18), i + k * 10]) }));
    const scatter = (x, y) => A.flocks.forEach((f) => { if (Math.hypot(f.cx - x, f.cy - y) < 110 && f.fly <= 0) f.fly = 3.2; });
    const firework = (x, y) => A.rockets.push({ x, y, t: 0, pal: FW[Math.floor(Math.random() * FW.length)] });
    const kite = (x, y) => { if (A.kites.length > 7) A.kites.shift(); A.kites.push({ x, y, t: 0, seed: Math.random() * 99, c: pick(['#D62828', '#F2C200', '#8B5CF6', '#FF8A3D', '#FFFFFF'], Math.random() * 99) }); };

    const update = (dt) => {
        const t = S.time, m = NIVELES[S.nivel];
        A.rainF += clamp((S.weather === 'rain' ? 1 : 0) - A.rainF, -dt * 0.7, dt * 0.7);
        A.fogF += clamp((S.weather === 'fog' ? 1 : 0) - A.fogF, -dt * 0.5, dt * 0.5);
        A.flocks.forEach((f) => { if (f.fly > 0) f.fly -= dt; });

        if (metro) {
            const tr = A.metro;
            if (tr.wait > 0) tr.wait -= dt;
            else {
                tr.s += tr.dir * 55 * dt;          // en el mapa va más rápido que en la vida real, para que se lo vea pasar
                const i = metro.est.findIndex((e) => Math.abs(e.s - tr.s) < 2);
                if (i >= 0 && i !== tr.last) { tr.last = i; tr.wait = 2.2; }
                if (tr.s >= metro.largo) { tr.s = metro.largo; tr.dir = -1; tr.last = -1; } else if (tr.s <= 0) { tr.s = 0; tr.dir = 1; tr.last = -1; }
            }
        }

        if (S.fiestas) { A.fiestaT -= dt; if (A.fiestaT <= 0) { A.fiestaT = rnd(0.3, 0.8); const x = S.x + rnd(-W / 2 + 20, W / 2 - 20) * m; firework(x, deC(x, S.c + rnd(-H / 2 + 20, H / 2 - 20) * m)); } }
        A.rockets = A.rockets.filter((r) => {
            r.t += dt; if (r.t < 0.45) return true;
            const n = 40 + Math.floor(Math.random() * 20);
            for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, sp = i % 3 ? rnd(26, 40) : rnd(8, 20); A.sparks.push({ x: r.x, y: r.y, ox: 0, oy: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.8, 1.4), c: r.pal[i % r.pal.length] }); }
            Q.sfx.pop(); return false;
        });
        A.sparks = A.sparks.filter((p) => { p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; return p.life > 0; });
        A.kites = A.kites.filter((k) => (k.t += dt) < 24);

        if (A.rainF > 0.02) {
            for (let i = 0; i < 14 * A.rainF; i++) A.ripples.push({ x: Math.random() * W, y: Math.random() * H, life: 0 });
            A.boltNext -= dt; if (A.boltNext <= 0 && S.weather === 'rain') { A.boltNext = rnd(5, 12); A.bolt = 0.35; Q.sfx.thunder(); }
        }
        A.ripples = A.ripples.filter((p) => (p.life += dt) < 0.45);
        if (A.bolt > 0) A.bolt -= dt;

        A.condor += dt * 0.25;
        const pl = A.plane; if (pl.wait > 0) { pl.wait -= dt; if (pl.wait <= 0) pl.t = 0; } else { pl.t += dt / 22; if (pl.t > 1) { pl.wait = rnd(25, 50); pl.t = -1; } }

        // El colibrí sigue al cursor; si nadie lo llama, vuelve a sus flores en El Ejido.
        const bd = A.bird, called = S.mouse.inside && t - S.mouse.movedAt < 5, jardin = sitio('ejido') || { x: 0, y: 0 };
        const tx = called ? S.mouse.x + 7 : clamp((jardin.x - S.x) / m + W / 2, -30, W + 30) + Math.sin(t * 1.3) * 6;
        const ty = called ? S.mouse.y - 5 : clamp((aC(jardin.x, jardin.y) - S.c) / m + H / 2, -30, H + 30) - 4 + Math.sin(t * 2.1) * 3;
        bd.vx += ((tx - bd.x) * 22 - bd.vx * 7) * dt; bd.vy += ((ty - bd.y) * 22 - bd.vy * 7) * dt; bd.x += bd.vx * dt; bd.y += bd.vy * dt;
    };

    // ───────────────────────── Dibujo ─────────────────────────
    const MINI = { w: Math.round(region.w / 13), h: Math.round(region.h / 13), x: 0, y: 0 };
    const mini = Q.canvas(MINI.w, MINI.h);
    mini.g.imageSmoothingEnabled = true; mini.g.drawImage(region.cv, 0, 0, MINI.w, MINI.h);

    const COCHES = ['#D62828', '#F4F1E8', '#3A3A40', '#1F4FA3', '#8FA3B8', '#C9CED8', '#7A7F8A'];
    const SEPARA = { 0: 55, 1: 55, 2: 50, 3: 70, 4: 120, 11: 300 };   // metros entre un vehículo y el siguiente
    const GENTE = ['#D62828', '#1F4FA3', '#F2C200', '#F4F1E8', '#8B5CF6', '#FF8A3D', '#2A2A2E', '#2FA36B'];
    const faros = [];

    /** Texto con borde oscuro, para que se lea sobre cualquier fondo. */
    const rotulo = (str, x, y, color = '#FFFFFF', vertical = false) => {
        const f = vertical ? Q.textV : Q.text;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f(v, str, x + dx, y + dy, '#0B1020'));
        f(v, str, x, y, color);
    };

    const render = () => {
        cuadro++; faltan = 0;
        if (Q.mapa.extra && Q.mapa.extra.dentro(v, W, H)) return;      // el juego muestra una estación por dentro
        const m = NIVELES[S.nivel], inc = S.inclinada, t = S.time, n = Q.night(S.hour), limpio = !!entrada || document.body.classList.contains('limpio');
        const camX = Math.round(S.x / m - W / 2), camY = Math.round(S.c / m - H / 2);
        const X = (x) => Math.round(x / m) - camX;
        const Y = inc ? (x, y, h = 0) => Math.round(P.caer(y, G.altura(x, y) + h) / m) - camY : (x, y) => Math.round(y / m) - camY;
        // Lo que se ve, en metros. En la vista inclinada el borde de arriba y el de abajo dependen del relieve.
        const wx0 = camX * m, wx1 = wx0 + W * m, c0 = camY * m, c1 = c0 + H * m;
        let wy0 = c0, wy1 = c1;
        if (inc) { wy0 = 1e9; wy1 = -1e9; for (let k = 0; k <= 4; k++) { const x = wx0 + (wx1 - wx0) * k / 4; wy0 = Math.min(wy0, P.subir(x, c0)); wy1 = Math.max(wy1, P.subir(x, c1)); } wy0 -= 200; wy1 += 200; }
        const detalle = m <= 2, visibles = [];
        const E = region.escala;

        // 1. El mapa. Debajo va siempre la región, por si alguna tesela aún no llega.
        v.fillStyle = '#10141F'; v.fillRect(0, 0, W, H);
        if (!inc) {
            v.drawImage(region.cv, (wx0 - G.X0) / E, (wy0 - G.Y0) / E, W * m / E, H * m / E, 0, 0, W, H);
            if (m <= 8) {
                const lado = 2048 / m;
                for (let by = Math.floor((wy0 - G.Y0) / 2048); by <= Math.floor((wy1 - G.Y0) / 2048); by++) for (let bx = Math.floor((wx0 - G.X0) / 2048); bx <= Math.floor((wx1 - G.X0) / 2048); bx++) {
                    if (bx < 0 || by < 0 || bx >= NBX || by >= NBY) continue;
                    const c = m === 8 ? pedir('ciu', bx, by, Math.hypot(G.X0 + bx * 2048 + 1024 - S.x, G.Y0 + by * 2048 + 1024 - S.c)) : cache.ciu.get(bx + '_' + by);
                    if (c) { lienzos(c); const dx = X(G.X0 + bx * 2048), dy = Math.round((G.Y0 + by * 2048) / m) - camY; v.drawImage(c.cv, dx, dy, lado, lado); if (m === 8) visibles.push([c, dx, dy, lado]); }
                }
            }
            if (detalle) {
                const lado = G.T / m;
                for (let ty = Math.floor((wy0 - G.Y0) / G.T); ty <= Math.floor((wy1 - G.Y0) / G.T); ty++) for (let tx = Math.floor((wx0 - G.X0) / G.T); tx <= Math.floor((wx1 - G.X0) / G.T); tx++) {
                    if (tx < 0 || ty < 0 || tx >= NTX || ty >= NTY) continue;
                    const c = pedir('det', tx, ty, Math.hypot(G.X0 + tx * G.T + 256 - S.x, G.Y0 + ty * G.T + 256 - S.c));
                    if (c) { lienzos(c); const dx = X(G.X0 + tx * G.T), dy = Math.round((G.Y0 + ty * G.T) / m) - camY; v.drawImage(c.cv, dx, dy, lado, lado); visibles.push([c, dx, dy, lado]); }
                }
            }
        } else {
            // Inclinada: tres capas, de lo más grueso a lo más fino. La de la región se arma al instante.
            const capa = (tipo, mt, pide, luces) => {
                const tam = 256 * mt, lado = tam / m;
                for (let j = Math.floor((c0 - I.S0) / tam); j <= Math.floor((c1 - I.S0) / tam); j++) for (let i = Math.floor((wx0 - G.X0) / tam); i <= Math.floor((wx1 - G.X0) / tam); i++) {
                    if (i < 0 || j < 0 || G.X0 + i * tam >= G.X1) continue;
                    const c = pide ? pedir(tipo, i, j, Math.hypot(G.X0 + (i + 0.5) * tam - S.x, I.S0 + (j + 0.5) * tam - S.c) - (mt === 32 ? 1e6 : 0)) : cache[tipo].get(i + '_' + j);
                    if (!c) continue;
                    c.uso = cuadro;
                    const dx = X(G.X0 + i * tam), dy = Math.round((I.S0 + j * tam) / m) - camY;
                    v.drawImage(c.cv, dx, dy, lado, lado); if (luces) visibles.push([c, dx, dy, lado]);
                }
            };
            capa('oreg', 32, true, m === 32);
            if (m <= 8) capa('ociu', 8, m === 8, m === 8);
            if (detalle) capa('odet', 2, true, true);
        }
        /** En la vista inclinada, ¿ese píxel es suelo? Si es un muro o un techo, lo que va por la calle queda tapado. */
        const enPiso = (sx, sy) => {
            if (!inc || !detalle) return true;
            const ax = Math.floor(((sx + camX) * m - G.X0) / 2), ay = Math.floor(((sy + camY) * m - I.S0) / 2), c = cache.odet.get((ax >> 8) + '_' + (ay >> 8));
            return !c || c.piso[(ay & 255) * 256 + (ax & 255)] === 1;
        };
        // Las teselas del plano que caen en pantalla: de ahí salen la gente, los nombres y las balizas.
        const planas = [];
        if (detalle) for (let ty = Math.floor((wy0 - G.Y0) / G.T); ty <= Math.floor((wy1 - G.Y0) / G.T); ty++) for (let tx = Math.floor((wx0 - G.X0) / G.T); tx <= Math.floor((wx1 - G.X0) / G.T); tx++) { const c = cache.det.get(tx + '_' + ty); if (c) planas.push(c); }

        // 2. La vida de la ciudad.
        const px = Math.max(1, Math.round(2 / m));   // tamaño de un «punto» según el acercamiento
        if (detalle) {
            planas.forEach((c) => {
                const g = c.gente;
                for (let i = 0; i < g.length; i += 2) {
                    const s = g[i] * 0.37 + g[i + 1] * 0.11, wx = g[i] + Math.sin(t * 0.31 + s) * 5 + Math.sin(t * 0.13 + s * 2) * 4, wy = g[i + 1] + Math.cos(t * 0.27 + s) * 5, x = X(wx), y = Y(wx, wy);
                    if (x < -2 || y < -2 || x > W || y > H || !enPiso(x, y)) continue;
                    const col = pick(GENTE, s);
                    v.fillStyle = SH; v.fillRect(x + 1, y + 1, px, px);
                    R(v, x, y, px, px, A.rainF > 0.4 ? '#2A2A2E' : col); if (inc) R(v, x, y - px, px, px, '#D9A77A'); if (A.rainF > 0.4) R(v, x - 1, y - 1 - (inc ? px : 0), px + 2, 1, col);
                }
            });
            A.flocks.forEach((f) => f.birds.forEach(([dx, dy, s]) => {
                if (f.fly > 0) { const k = Math.sin(clamp(f.fly / 3.2) * Math.PI), a = s + f.fly * 2, wx = f.cx + dx + Math.cos(a) * 52 * k, wy = f.cy + dy + Math.sin(a) * 36 * k, x = X(wx), y = Y(wx, wy, 18 * k); v.fillStyle = SH; v.fillRect(x + Math.round(4 * k), y + Math.round(5 * k), 2, 1); R(v, x - 1, y, 3, 1, '#D5DAE3'); R(v, x, y - (Math.floor(t * 12 + s) % 2), 1, 1, '#FFFFFF'); }
                else R(v, X(f.cx + dx), Y(f.cx + dx, f.cy + dy), 1, 1, '#8A8F9C');
            }));
        }

        // Metro: va bajo tierra, así que es una línea punteada con sus estaciones.
        if (S.metro && metro) {
            const paso = Math.max(8, m * 4), g2 = m < 8 ? 2 : 1;
            v.globalAlpha = 0.8;
            for (let s = 0, i = 0; s < metro.largo; s += paso, i++) { if (i % 2) continue; const q = enCamino(metro.p, metro.a, s), x = X(q[0]); if (x < -3 || x > W + 3) continue; const y = Y(q[0], q[1]); if (y > -3 && y < H + 3) R(v, x - (g2 >> 1), y - (g2 >> 1), g2, g2, '#E8ECF2'); }
            v.globalAlpha = 1;
            metro.est.forEach((e) => {
                const x = X(e.x), y = Y(e.x, e.y); if (x < -6 || y < -6 || x > W + 6 || y > H + 6) return;
                if (m >= 32) { R(v, x - 1, y - 1, 3, 3, '#FFFFFF'); R(v, x, y, 1, 1, '#D62828'); return; }
                R(v, x - 3, y - 3, 7, 7, '#FFFFFF'); R(v, x - 2, y - 2, 5, 5, '#D62828'); R(v, x - 1, y - 1, 1, 3, '#FFFFFF'); R(v, x + 1, y - 1, 1, 3, '#FFFFFF'); R(v, x, y, 1, 1, '#FFFFFF');
            });
            // El tren real mide unos 109 m: seis vagones. En el juego, los trenes los pone la simulación.
            const vag = m <= 2 ? 6 : 3;
            if (Q.mapa.extra) Q.mapa.extra.mundo(v, X, Y, m, metro, enCamino);
            else for (let k = 0; k < vag; k++) { const q = enCamino(metro.p, metro.a, clamp(A.metro.s - A.metro.dir * k * (m <= 2 ? 18 : 40), 0, metro.largo)), x = X(q[0]), y = Y(q[0], q[1]), r = m === 1 ? 4 : 2; R(v, x - r, y - r, r * 2 + 1, r * 2 + 1, '#1F4FA3'); R(v, x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, '#FFE9A8'); }
        }

        // Tráfico en las avenidas: cada vehículo sale de una cuenta, no de una lista; así la ciudad entera tiene tránsito sin guardarlo.
        faros.length = 0;
        if (m <= 8) viasEn(wx0 - 40, wy0 - 40, wx1 + 40, wy1 + 40, (via, vi) => {
            if (via.largo < 60) return;
            const a = via.acum || (via.acum = camino(via.p)), sep = SEPARA[via.k] * (m === 8 ? 2.5 : 1), cuenta = Math.max(1, Math.floor(via.largo / sep));
            for (let d = via.unico ? 1 : -1; d <= 1; d += 2) for (let i = 0; i < cuenta; i++) {
                const h1 = hash(vi * 7.13 + i * 3.7 + d), vel = via.k === 11 ? 9 : 9 + hash(vi + i * 1.3) * 7;
                let s = ((h1 + i) / cuenta * via.largo + t * vel) % via.largo; if (d < 0) s = via.largo - s;
                const q = enCamino(via.p, a, s), ux = q[2] * d, uy = q[3] * d, lado = via.unico ? 0 : 2.4, wx = q[0] - uy * lado, wy = q[1] + ux * lado;
                const x = X(wx); if (x < -8 || x > W + 8) continue;
                const y = Y(wx, wy); if (y < -8 || y > H + 8 || !enPiso(x, y)) continue;
                if (m === 8) { R(v, x, y, 1, 1, h1 > 0.75 ? '#F2C200' : '#D5DAE3'); if (n > 0.3) faros.push(x, y, 0, 0); continue; }
                const tipo = via.k === 11 ? (hash(vi) > 0.5 ? 'trole' : 'eco') : h1 > 0.8 ? 'bus' : h1 > 0.58 ? 'taxi' : 'car';
                const len = { car: 3, taxi: 3, bus: 5, trole: 8, eco: 8 }[tipo] * px, an = px + 1;
                const col = { taxi: '#F2C200', bus: '#2A6FD6', trole: '#2FA36B', eco: '#D62828' }[tipo] || pick(COCHES, vi + i * 5 + d);
                const hor = Math.abs(ux) >= Math.abs(uy) * (inc ? I.CY : 1), bw = hor ? len : an, bh = hor ? an : Math.max(an, Math.round(len * (inc ? 0.7 : 1))), bx = x - (bw >> 1), by = y - (bh >> 1);
                v.fillStyle = SH; v.fillRect(bx + 1, by + 1, bw, bh);
                R(v, bx, by, bw, bh, col);
                if (hor) R(v, ux > 0 ? bx + bw - 1 : bx, by, 1, bh, '#22303F'); else R(v, bx, uy > 0 ? by + bh - 1 : by, bw, 1, '#22303F');
                if (tipo === 'trole' || tipo === 'eco') R(v, bx + (hor ? bw >> 1 : 0), by + (hor ? 0 : bh >> 1), hor ? 1 : bw, hor ? bh : 1, '#1F2A3A');
                if (n > 0.02) faros.push(hor ? (ux > 0 ? bx + bw : bx - 1) : x, hor ? y : (uy > 0 ? by + bh : by - 1), hor ? Math.sign(ux) : 0, hor ? 0 : Math.sign(uy));
            }
        });

        // Teleférico: el cable y sus cabinas, con su sombra sobre el cerro.
        if (cable && m <= 8) {
            const alto = inc ? 14 : 0;
            for (let i = 2; i < cable.p.length; i += 2) line(v, X(cable.p[i - 2]), Y(cable.p[i - 2], cable.p[i - 1], alto), X(cable.p[i]), Y(cable.p[i], cable.p[i + 1], alto), '#D5DAE3');
            const nc = m === 8 ? 6 : 10;
            for (let i = 0; i < nc; i++) {
                const u0 = (t * 0.02 + i / nc) % 1, u = i % 2 ? u0 : 1 - u0, q = enCamino(cable.p, cable.a, u * cable.largo), qx = q[0], qy = q[1], x = X(qx) + (i % 2 ? 1 : -1), r = m === 8 ? 0 : 1, ys = Y(qx, qy);
                v.fillStyle = SH; if (inc) v.fillRect(x - r, ys, r * 2 + 1, r + 1); else v.fillRect(x + 2, ys + 3, r * 2 + 1, r * 2 + 1);
                const y = Y(qx, qy, alto ? alto - 3 : 0); R(v, x - r, y - r, r * 2 + 1, r * 2 + 1, '#F4F1E8'); if (r) R(v, x - r, y, r * 2 + 1, 1, '#D62828');
            }
        }

        // La Virgen de El Panecillo, con sus alas: en la vista inclinada va como figura, sobre su base.
        if (inc && detalle && Q.VIRGEN) {
            const V = Q.VIRGEN, e = m === 1 ? 2 : 1, x = X(V.x), y = Y(V.x, V.y, V.base);
            if (x > -20 && x < W + 20 && y > -10 && y < H + 40) V.forma.forEach((fila, j) => { for (let i = 0; i < fila.length; i++) if (fila[i] !== '.') R(v, x + (i - 6) * e - (e >> 1), y - (V.forma.length - j) * e, e, e, V.color[fila[i]]); });
        }

        A.kites.forEach((k) => {
            const x = X(k.x) + Math.sin(k.t * 1.2 + k.seed) * 7, y0 = Y(k.x, k.y), y = y0 - (inc ? 22 : 0) + Math.cos(k.t * 0.9 + k.seed) * 5;
            v.globalAlpha = clamp((24 - k.t) / 3);
            v.fillStyle = SH; v.fillRect(Math.round(x) + (inc ? 0 : 7), (inc ? y0 : Math.round(y) + 9), 3, inc ? 2 : 3);
            line(v, x, y, X(k.x) + 4, y0 + (inc ? 0 : 16), '#E8E4DA'); R(v, x - 2, y, 5, 1, k.c); R(v, x, y - 2, 1, 5, k.c); R(v, x - 1, y - 1, 3, 3, k.c); R(v, x, y, 1, 1, '#FFFFFF');
            v.globalAlpha = 1;
        });

        // Sombras de lo que vuela: cuanto más alto, más lejos cae la sombra.
        const nubeX = (c) => ((c.x + t * c.v * (1 + A.rainF) - camX * 0.9) % (W + 260) + (W + 260)) % (W + 260) - 130, nubeY = (c) => ((c.y + t * c.v * 0.25 - camY * 0.9) % (H + 160) + (H + 160)) % (H + 160) - 80;
        A.clouds.forEach((c) => { const cx = nubeX(c), cy = nubeY(c); v.fillStyle = `rgba(8,10,24,${0.13 + A.rainF * 0.1})`; for (let i = 0; i < 5; i++) v.fillRect(Math.round(cx + i * 13 + hash(c.seed + i) * 9) + 20, Math.round(cy + hash(c.seed + i + 3) * 12) + 26, 24 + Math.round(hash(c.seed + i + 6) * 18), 11); });
        const cumbre = sitio('rucu') || { x: 2000, y: -8000 }, ca = A.condor, cwx = cumbre.x + Math.cos(ca) * 900 + 1500, cwy = cumbre.y + Math.sin(ca) * 500 + 2500, cx = X(cwx), cy = Y(cwx, cwy, inc ? 120 : 0), flap = Math.sin(t * 2.4) > 0.3;
        v.fillStyle = SH; v.fillRect(cx + 4, inc ? Y(cwx, cwy) : cy + 9, 7, 1);
        const pl = A.plane, ppx = lerp(-60, W + 60, pl.t), ppy = lerp(H * 0.85, H * 0.1, pl.t);
        if (pl.t >= 0) { v.fillStyle = 'rgba(8,10,24,.25)'; v.fillRect(Math.round(ppx) + 14, Math.round(ppy) + 30, 12, 3); v.fillRect(Math.round(ppx) + 18, Math.round(ppy) + 26, 3, 11); }

        // 3. La hora y el clima tiñen el mapa entero.
        const tint = (color, a) => { if (a > 0.01) { v.globalAlpha = a; R(v, 0, 0, W, H, color); v.globalAlpha = 1; } };
        tint('#FF7A2E', Q.dusk(S.hour) * 0.2 * (1 - A.rainF)); tint('#3C4558', A.rainF * 0.3); tint('#070B22', n * 0.72);

        // 4. Luces de la noche.
        if (n > 0.02) {
            v.globalAlpha = n;
            if (!inc && m === 32) v.drawImage(region.luz, (wx0 - G.X0) / E, (wy0 - G.Y0) / E, W * m / E, H * m / E, 0, 0, W, H);
            else {
                if (!inc && detalle) { v.globalAlpha = n * 0.5; v.drawImage(region.luz, (wx0 - G.X0) / E, (wy0 - G.Y0) / E, W * m / E, H * m / E, 0, 0, W, H); v.globalAlpha = n; }
                visibles.forEach(([c, x, y, lado]) => v.drawImage(c.luz, x, y, lado, lado));
            }
            for (let i = 0; i < faros.length; i += 4) {
                const x = faros[i], y = faros[i + 1], dx = faros[i + 2], dy = faros[i + 3];
                if (dx || dy) { v.globalAlpha = n * 0.35; for (let k = 1; k < 6; k++) R(v, x + dx * k - (dy ? 1 : 0), y + dy * k - (dx ? 1 : 0), dy ? 3 : 1, dx ? 3 : 1, '#FFF3B0'); v.globalAlpha = n; }
                R(v, x, y, 1, 1, '#FFFFFF');
            }
            if (Math.floor(t * 1.5) % 2 && detalle) planas.forEach((c) => { for (let i = 0; i < c.balizas.length; i += 3) R(v, X(c.balizas[i]), Y(c.balizas[i], c.balizas[i + 1], c.balizas[i + 2]), px, px, '#FF3B3B'); });
            v.globalAlpha = 1;
        }

        // 5. Nubes, cóndor y avión, por encima de todo.
        const cloudCol = Q.mix(Q.mix('#FFFFFF', '#8F9AAD', A.rainF), '#1D2440', n * 0.8);
        v.globalAlpha = 0.42 + A.rainF * 0.3;
        A.clouds.forEach((c) => { const x = nubeX(c), y = nubeY(c); for (let i = 0; i < 5; i++) R(v, x + i * 13 + hash(c.seed + i) * 9, y + hash(c.seed + i + 3) * 12, 24 + Math.round(hash(c.seed + i + 6) * 18), 11, cloudCol); });
        v.globalAlpha = 1;
        R(v, cx, cy - 1, 1, 3, '#16161A'); R(v, cx, cy - 1, 1, 1, '#FFFFFF'); R(v, cx - 4, cy - (flap ? 1 : 0), 4, 1, '#16161A'); R(v, cx + 1, cy - (flap ? 1 : 0), 4, 1, '#16161A'); R(v, cx - 5, cy - (flap ? 2 : -1), 1, 1, '#16161A'); R(v, cx + 5, cy - (flap ? 2 : -1), 1, 1, '#16161A');
        if (pl.t >= 0) { R(v, ppx, ppy, 12, 3, '#E8ECF2'); R(v, ppx + 4, ppy - 4, 3, 11, '#D5DAE3'); R(v, ppx, ppy - 1, 2, 5, '#C9CED8'); R(v, ppx + 11, ppy + 1, 1, 1, '#9DD1E8'); if (n > 0.3 && Math.floor(t * 3) % 2) { R(v, ppx + 5, ppy - 4, 1, 1, '#FF3B3B'); R(v, ppx + 5, ppy + 6, 1, 1, '#3DDC84'); } }

        if (A.fogF > 0.02) { A.fog.forEach((f, i) => { v.globalAlpha = A.fogF * (0.16 + (i % 3) * 0.06); const fx = ((f.x + t * f.v - camX * 0.5) % (W + 300) + (W + 300)) % (W + 300) - 150, fy = ((f.y - camY * 0.5) % (H + 120) + (H + 120)) % (H + 120) - 60, ry = Math.round(f.r * 0.45); for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(f.r * Math.sqrt(1 - (dy * dy) / (ry * ry))); R(v, fx - hw, fy + dy, hw * 2 + 1, 1, '#E6ECF4'); } }); v.globalAlpha = 1; }
        A.ripples.forEach((p) => { const r = 1 + Math.floor(p.life * 7); v.globalAlpha = (1 - p.life / 0.45) * 0.7 * A.rainF; R(v, p.x - r, p.y, 1, 1, '#DCE8F7'); R(v, p.x + r, p.y, 1, 1, '#DCE8F7'); R(v, p.x, p.y - r, 1, 1, '#DCE8F7'); R(v, p.x, p.y + r, 1, 1, '#DCE8F7'); });
        v.globalAlpha = 1;

        A.rockets.forEach((r) => { const k = r.t / 0.45, x = X(r.x), y = Y(r.x, r.y, inc ? 60 * k : 0); v.globalAlpha = 0.9; R(v, x - 1, y - 1, 3, 3, '#FFE9A8'); v.globalAlpha = 0.4; R(v, x - 4 + k * 3, y - 4 + k * 3, 9 - k * 6, 9 - k * 6, '#FFF3B0'); });
        A.sparks.forEach((p) => { const s = p.life > 0.45 ? 2 : 1; v.globalAlpha = clamp(p.life * 1.6); R(v, X(p.x) + p.ox, Y(p.x, p.y, inc ? 60 : 0) + p.oy, s, s, p.c); });
        v.globalAlpha = 1;

        // Colibrí, visto desde arriba: las alas baten a los lados.
        const b = A.bird, bx = Math.round(b.x), by = Math.round(b.y), wing = Math.floor(t * 30) % 2;
        v.fillStyle = SH; v.fillRect(bx + 3, by + 5, 3, 2);
        R(v, bx - 1, by, 3, 2, '#1FA37A'); R(v, bx + 2, by, 1, 1, '#7C4DFF'); R(v, bx + 3, by, 2, 1, '#2A2A2E'); R(v, bx - 2, by + 1, 1, 1, '#0F6E55');
        v.globalAlpha = 0.75; R(v, bx, wing ? by - 2 : by - 1, 2, wing ? 2 : 1, '#D9FFF2'); R(v, bx, by + 2, 2, wing ? 2 : 1, '#D9FFF2'); v.globalAlpha = 1;

        if (A.bolt > 0) { v.globalAlpha = (A.bolt / 0.35) * 0.5; R(v, 0, 0, W, H, '#EAF2FF'); v.globalAlpha = 1; }

        // 6. Nombres.
        MINI.x = W - MINI.w - 5; MINI.y = H - MINI.h - 3 - pie;
        const puestos = [];
        // Un rótulo solo se pone si no pisa a otro, ni al minimapa, ni a los paneles de las esquinas.
        const libre = (x, y, w, h) => { if (x < 2 || y < 2 || x + w > W - 2 || y + h > H - pie) return false; if (!limpio && ((x + w > MINI.x - 4 && y + h > MINI.y - 4) || (x < 130 && y < 34) || (x + w > W - 240 && y < 24) || (x < 74 && y + h > H - pie - 56))) return false; for (const p of puestos) if (x < p[0] + p[2] + 3 && x + w + 3 > p[0] && y < p[1] + p[3] + 2 && y + h + 2 > p[1]) return false; puestos.push([x, y, w, h]); return true; };
        const placa = (str, cx, y, color, fondo) => { const w = Q.textW(str), x = Math.round(cx - w / 2); if (!libre(x - 2, y - 2, w + 4, 9)) return false; R(v, x - 2, y - 2, w + 4, 9, fondo); Q.text(v, str, x, y, color); return true; };
        const radio = (s) => Math.max(7, Math.round((s.r || 30) / m * (inc ? 0.75 : 1)));
        const hov = S.hover;
        if (hov && !hov.est) { const x = X(hov.x), y = Y(hov.x, hov.y), r = radio(hov); placa(Q.plano(hov.n), x, y - r - 11 > 12 ? y - r - 11 : y + r + 5, '#FFE500', '#0B1020'); }
        if (hov && hov.est) placa('METRO ' + Q.plano(hov.nombre), X(hov.x), Y(hov.x, hov.y) - 14, '#FFFFFF', '#1E4FA3');
        if (S.names) {
            SITIOS.forEach((s) => { if (s === hov || (s.nivel || 0) < S.nivel) return; const x = X(s.x); if (x < 10 || x > W - 10) return; const y = Y(s.x, s.y); if (y > 10 && y < H - 6) placa(Q.plano(s.n), x, y - Math.min(22, radio(s)) - 10, '#FFE500', '#0B1020'); });
            if (S.metro && metro && m <= 8) metro.est.forEach((e) => { const x = X(e.x); if (x < 10 || x > W - 10) return; const y = Y(e.x, e.y); if (y > 10 && y < H - 6 && e !== hov) placa(Q.plano(e.nombre), x, y + 7, '#FFFFFF', '#1E4FA3'); });
            if (m >= 8) Q.BASE.cerros.forEach(([nombre, x, y, ele]) => { if (x < G.X0 || x > G.X1 || y < G.Y0 || y > G.Y1) return; const sx = X(x); if (sx < 8 || sx > W - 8) return; const sy = Y(x, y); if (sy < 12 || sy > H - 8 || (m === 32 && ele < 3300)) return; const str = Q.plano(nombre) + (ele ? ' ' + ele + ' M' : ''), w = Q.textW(str); if (libre(sx - w / 2 - 1, sy - 9, w + 2, 7)) { rotulo(str, Math.round(sx - w / 2), sy - 9, '#F4F1E8'); R(v, sx - 1, sy, 3, 1, '#F4F1E8'); R(v, sx, sy - 1, 1, 1, '#F4F1E8'); } });
            const rango = m === 32 ? 1 : m === 8 ? 2 : 3;
            Q.BASE.barrios.forEach(([nombre, x, y, r]) => { if (r > rango) return; const sx = X(x); if (sx < 8 || sx > W - 8) return; const sy = Y(x, y); if (sy < 8 || sy > H - 8) return; const str = Q.plano(nombre), w = Q.textW(str); if (w < 150 && libre(sx - w / 2 - 1, sy - 3, w + 2, 7)) rotulo(str, Math.round(sx - w / 2), sy - 3, r <= 1 ? '#FFFFFF' : '#C8D4F0'); });
            if (m === 8) viasEn(wx0, wy0, wx1, wy1, (via) => { if (!via.nombre || via.largo < 700 || via.k > 3) return; const a = via.acum || (via.acum = camino(via.p)), q = enCamino(via.p, a, via.largo / 2), str = Q.plano(via.nombre), w = Q.textW(str), vert = Math.abs(q[3]) * (inc ? I.CY : 1) > Math.abs(q[2]), sx = X(q[0]), sy = Y(q[0], q[1]); if (vert ? libre(sx - 3, sy - w / 2, 7, w) : libre(sx - w / 2, sy - 3, w, 7)) rotulo(str, vert ? sx - 2 : Math.round(sx - w / 2), vert ? Math.round(sy + w / 2) : sy - 2, '#FFFFFF', vert); });
            if (detalle) {
                const lista = []; planas.forEach((c) => c.nombres.forEach((e) => lista.push(e)));
                lista.sort((p, q) => (p.k - q.k) || (q.largo - p.largo));
                const usados = new Map();
                for (const e of lista) {
                    const str = Q.plano(e.t.replace(/^(Calle|Avenida|Av\.|Pasaje|Psje\.?) /i, (s0) => (/^av/i.test(s0) ? 'AV. ' : ''))), w = Q.textW(str), sx = X(e.x), sy = Y(e.x, e.y);
                    const prev = usados.get(e.t); if (prev && prev.some((q) => Math.hypot(q[0] - sx, q[1] - sy) < 190)) continue;
                    if (w > 170 || !(e.vert ? libre(sx - 3, sy - w / 2, 7, w) : libre(sx - w / 2, sy - 3, w, 7))) continue;
                    rotulo(str, e.vert ? sx - 2 : Math.round(sx - w / 2), e.vert ? Math.round(sy + w / 2) : sy - 2, e.k <= 3 ? '#FFFFFF' : '#DDE4F2', e.vert);
                    if (!prev) usados.set(e.t, [[sx, sy]]); else prev.push([sx, sy]);
                }
            }
            // Los nevados que no caben en el mapa: una marca en el borde, con su distancia.
            if (m >= 8) (Q.LEJANOS || []).forEach((f) => {
                const cy0 = deC(S.x, S.c), dx = f.x - S.x, dy = (f.y - cy0) * (inc ? I.CY : 1), d = Math.hypot(f.x - S.x, f.y - cy0), k = Math.min((W / 2 - 14) / Math.abs(dx || 1), (H / 2 - 18 - pie / 2) / Math.abs(dy || 1));
                const str = `${Q.plano(f.n)} ${f.ele} M · ${Math.round(d / 1000)} KM`, w = Q.textW(str), ex = W / 2 + dx * k, ey = (H - pie) / 2 + dy * k, x = Math.round(clamp(ex - w / 2, 4, W - w - 4)), y = Math.round(clamp(ey - 3, 14, H - pie - 10));
                if (!libre(x - 2, y - 2, w + 4, 9)) return;
                R(v, x - 2, y - 2, w + 4, 9, '#0B1020'); Q.text(v, str, x, y, '#BFE3F0'); R(v, Math.round(ex) - 1, Math.round(ey) - 1, 3, 3, '#BFE3F0');
            });
        }
        if (S.fiestas) Q.label(v, 'QUE VIVA QUITO!', W / 2, 30 + Math.round(Math.sin(t * 3) * 2), pick(['#FFE500', '#FFFFFF', '#FF8A3D'], Math.floor(t * 3)), '#1F4FA3');

        // Lugar bajo el cursor: cuatro esquinas.
        if (hov && !hov.est) {
            const r = radio(hov), x = X(hov.x) - r, y = Y(hov.x, hov.y) - r, d = r * 2 + 1, c = '#FFE500';
            [[x, y, 1, 1], [x + d - 1, y, -1, 1], [x, y + d - 1, 1, -1], [x + d - 1, y + d - 1, -1, -1]].forEach(([qx, qy, dx, dy]) => { R(v, dx > 0 ? qx : qx - 3, qy, 4, 1, c); R(v, qx, dy > 0 ? qy : qy - 3, 1, 4, c); });
        }
        if (entrada) {
            const e = metro.est[entrada.i], x = X(e.x), y = Y(e.x, e.y);
            [[-6, -6, 1, 1], [6, -6, -1, 1], [-6, 6, 1, -1], [6, 6, -1, -1]].forEach(([dx, dy, sx, sy]) => {
                line(v, x + dx, y + dy, x + dx + sx * 3, y + dy, '#FFE500');
                line(v, x + dx, y + dy, x + dx, y + dy + sy * 3, '#FFE500');
            });
        }
        if (limpio) return;
        if (Q.mapa.extra) Q.mapa.extra.dibujar(v, W, H);

        // 7. Minimapa, escala y rosa de los vientos.
        v.globalAlpha = 0.92; R(v, MINI.x - 2, MINI.y - 2, MINI.w + 4, MINI.h + 4, '#0B1020'); v.globalAlpha = 1;
        v.drawImage(mini.cv, MINI.x, MINI.y);
        if (n > 0.02) { v.globalAlpha = n * 0.55; R(v, MINI.x, MINI.y, MINI.w, MINI.h, '#070B22'); v.globalAlpha = 1; }
        const vw = Math.max(3, Math.round(W * m / G.ANCHO * MINI.w)), vh = Math.max(3, Math.round((wy1 - wy0 - (inc ? 400 : 0)) / G.ALTO * MINI.h));
        const vx = Math.round(MINI.x + (wx0 - G.X0) / G.ANCHO * MINI.w), vy = Math.round(MINI.y + (wy0 + (inc ? 200 : 0) - G.Y0) / G.ALTO * MINI.h);
        v.save(); v.beginPath(); v.rect(MINI.x, MINI.y, MINI.w, MINI.h); v.clip();
        R(v, vx, vy, vw, 1, '#FF8A3D'); R(v, vx, vy + vh - 1, vw, 1, '#FF8A3D'); R(v, vx, vy, 1, vh, '#FF8A3D'); R(v, vx + vw - 1, vy, 1, vh, '#FF8A3D');
        v.restore();

        const tramo = { 1: 50, 2: 100, 8: 500, 32: 2000 }[m], largo = tramo / m, ex = 6, ey = H - 9 - pie, texto = tramo >= 1000 ? tramo / 1000 + ' KM' : tramo + ' M';
        v.globalAlpha = 0.85; R(v, ex - 3, ey - 11, Math.max(largo, Q.textW(texto)) + 7, 19, '#0B1020'); v.globalAlpha = 1;
        Q.text(v, texto, ex, ey - 8, '#FFFFFF'); R(v, ex, ey + 2, largo, 1, '#FFE500'); R(v, ex, ey, 1, 5, '#FFE500'); R(v, ex + largo - 1, ey, 1, 5, '#FFE500');
        // El norte verdadero: como el mapa está girado, apunta hacia arriba a la derecha.
        const nx = Math.cos(G.giro), ny = -Math.sin(G.giro) * (inc ? I.CY : 1), nl = Math.hypot(nx, ny), rx = 20, ry = ey - 28;
        v.globalAlpha = 0.85; disc(v, rx, ry, 13, '#0B1020'); v.globalAlpha = 1;
        line(v, rx - nx / nl * 8, ry - ny / nl * 8, rx + nx / nl * 8, ry + ny / nl * 8, '#8FA3D9'); line(v, rx, ry, rx + nx / nl * 9, ry + ny / nl * 9, '#FFE500');
        R(v, Math.round(rx + nx / nl * 9) - 1, Math.round(ry + ny / nl * 9) - 1, 3, 3, '#FFE500'); Q.text(v, 'N', Math.round(rx + nx / nl * 2 + 4), Math.round(ry + ny / nl * 2 + 3), '#FFFFFF');
    };

    // ───────────────────────── Cámara ─────────────────────────
    const keys = {}, drag = { on: false };
    function limitar() {
        const m = NIVELES[S.nivel], x0 = G.X0 + W / 2 * m, x1 = G.X1 - W / 2 * m;
        const a = S.inclinada ? P.caer(G.Y0, 3600) : G.Y0, b = S.inclinada ? P.caer(G.Y1, 2300) : G.Y1, c0 = a + H / 2 * m, c1 = b - (H / 2 - pie) * m;
        S.x = x0 > x1 ? (G.X0 + G.X1) / 2 : clamp(S.x, x0, x1); S.c = c0 > c1 ? (a + b) / 2 : clamp(S.c, c0, c1);
    }
    /** Cambia de nivel dejando quieto el punto del mapa que está bajo (sx, sy). */
    const zoom = (delta, sx = W / 2, sy = H / 2) => {
        const nuevo = clamp(S.nivel + delta, 0, NIVELES.length - 1); if (nuevo === S.nivel) return;
        const m0 = NIVELES[S.nivel], m1 = NIVELES[nuevo], wx = S.x + (sx - W / 2) * m0, wc = S.c + (sy - H / 2) * m0;
        S.nivel = nuevo; S.x = wx - (sx - W / 2) * m1; S.c = wc - (sy - H / 2) * m1; S.destino = null; S.vx = S.vc = 0; limitar(); syncZoom();
    };
    const irA = (x, y, nivel = null) => { if (nivel !== null && nivel !== S.nivel) { S.nivel = nivel; syncZoom(); } S.destino = [x, aC(x, y)]; };
    const estacionCercana = () => metro.est.reduce((mejor, e, i) => Math.hypot(e.x - S.x, aC(e.x, e.y) - S.c) < Math.hypot(metro.est[mejor].x - S.x, aC(metro.est[mejor].x, metro.est[mejor].y) - S.c) ? i : mejor, 0);
    /** El mapa sigue dibujándose; la cámara viaja y amplía sus píxeles hacia la estación. */
    const acercarEstacion = (i, progreso) => new Promise((resolve) => {
        if (entrada) entrada.terminar();
        const e = metro.est[i], x0 = S.x, c0 = S.c, destino = aC(e.x, e.y), inicio = performance.now();
        Object.keys(keys).forEach((k) => delete keys[k]); drag.on = false;
        S.vx = S.vc = 0; S.destino = null; S.tour = false; S.playing = false; S.metro = true; S.hover = null;
        // Conserva la escala actual para que el primer fotograma no salte hacia atrás.
        const zoom = { i, frame: 0, terminar() {
            if (entrada !== zoom) return;
            cancelAnimationFrame(zoom.frame); progreso(1);
            S.x = e.x; S.c = destino; entrada = null;
            view.style.removeProperty('transform'); view.style.removeProperty('transform-origin');
            resolve();
        } };
        entrada = zoom;
        const animar = (ahora) => {
            const p = clamp((ahora - inicio) / 1800), viaje = clamp(p / 0.65), suave = viaje * viaje * (3 - 2 * viaje);
            S.x = lerp(x0, e.x, suave); S.c = lerp(c0, destino, suave);
            const z = clamp((p - 0.28) / 0.72), escala = 1 + 5 * z * z;
            view.style.transformOrigin = '50% 50%'; view.style.transform = `scale(${escala})`;
            progreso(p);
            if (p === 1) zoom.terminar(); else zoom.frame = requestAnimationFrame(animar);
        };
        zoom.frame = requestAnimationFrame(animar);
    });
    /** Pasa del plano a la vista inclinada, o al revés, sin perder de vista el mismo lugar. */
    const inclinar = (si) => { if (si === S.inclinada) return; const y = deC(S.x, S.c), d = S.destino && deC(S.destino[0], S.destino[1]); S.inclinada = si; S.c = aC(S.x, y); if (S.destino) S.destino[1] = aC(S.destino[0], d); limitar(); syncButtons(); };

    const TOUR = ['panecillo', 'sanfrancisco', 'plaza', 'basilica', 'alameda', 'ejido', 'carolina', 'estadio', 'bicentenario', 'teleferico', 'quitumbe', 'mitad'].filter(sitio);
    let tourI = 0, tourWait = 0;

    const step = (dt) => {
        S.time += dt;
        if (entrada) return;
        if (S.playing) S.hour = (S.hour + dt * 0.08) % 24;
        const m = NIVELES[S.nivel];
        const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        if (kx || ky) { S.vx = kx * 260 * m; S.vc = ky * 260 * m; S.destino = null; if (S.tour) { S.tour = false; syncButtons(); } }
        if (S.tour && !drag.on && !S.destino) { tourWait -= dt; if (tourWait <= 0 && TOUR.length) { const s = sitio(TOUR[tourI % TOUR.length]); irA(s.x, s.y); tourI++; tourWait = 4; } }
        if (S.destino) {
            const [tx, tc] = S.destino, k = Math.min(1, dt * (S.tour ? 1.2 : 4));
            S.x += (tx - S.x) * k; S.c += (tc - S.c) * k;
            if (Math.abs(tx - S.x) + Math.abs(tc - S.c) < m) S.destino = null;
        } else if (!drag.on) { S.x += S.vx * dt; S.c += S.vc * dt; const f = Math.pow(0.02, dt); S.vx *= f; S.vc *= f; }
        limitar();
        update(dt);
        Q.sfx.ambience(dt);
        if (Q.mapa && Q.mapa.extra) Q.mapa.extra.paso(dt);
    };

    // ───────────────────────── Entrada ─────────────────────────
    const toCanvas = (e) => { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    const inMini = (x, y) => !document.body.classList.contains('limpio') && x >= MINI.x - 2 && y >= MINI.y - 2 && y <= MINI.y + MINI.h + 2;
    const enTira = (y) => Q.mapa.extra && !document.body.classList.contains('limpio') && y >= H - Q.mapa.extra.alto;
    const aMundo = (sx, sy) => { const m = NIVELES[S.nivel], wx = S.x + (sx - W / 2) * m; return [wx, deC(wx, S.c + (sy - H / 2) * m)]; };
    const pickAt = (x, y) => {
        if (inMini(x, y)) return null;
        const m = NIVELES[S.nivel], [wx, wy] = aMundo(x, y);
        if (S.metro && metro && m <= 8) { const e = metro.est.find((q) => Math.abs(q.x - wx) < 5 * m && Math.abs(q.y - wy) < 6 * m); if (e) return e; }
        let mejor = null, md = 1e9;
        SITIOS.forEach((s) => { if ((s.nivel || 0) < S.nivel) return; const d = Math.hypot(s.x - wx, s.y - wy), r = Math.max(s.r || 30, 7 * m); if (d < r && d / r < md) { md = d / r; mejor = s; } });
        return mejor;
    };
    const click = (x, y) => {
        if (enTira(y)) { Q.mapa.extra.clic(x, y, null); return; }
        if (inMini(x, y)) { irA(G.X0 + (x - MINI.x) / MINI.w * G.ANCHO, G.Y0 + (y - MINI.y) / MINI.h * G.ALTO); S.tour = false; syncButtons(); return; }
        const s = pickAt(x, y), [wx, wy] = aMundo(x, y);
        if (Q.mapa.extra && Q.mapa.extra.clic(x, y, s)) return;
        if (s) {
            Q.ficha.abrir(s.id, s.est ? s.nombre : null);
            if (Q.INFO[s.id] && Q.INFO[s.id].campana) Q.sfx.bell();
            scatter(wx, wy);
            return;
        }
        if (Q.night(S.hour) > 0.5 || S.fiestas) firework(wx, wy); else kite(wx, wy);
    };

    view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); Object.assign(drag, { on: true, cx: e.clientX, cy: e.clientY, x: S.x, c: S.c, moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() }); S.vx = S.vc = 0; S.destino = null; });
    view.addEventListener('pointermove', (e) => {
        const [x, y] = toCanvas(e), m = NIVELES[S.nivel];
        Object.assign(S.mouse, { x, y, inside: true, movedAt: S.time });
        if (drag.on) {
            const sc = view.getBoundingClientRect().width / W / m, now = performance.now();
            drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.cx) + Math.abs(e.clientY - drag.cy));
            S.x = drag.x - (e.clientX - drag.cx) / sc; S.c = drag.c - (e.clientY - drag.cy) / sc; limitar();
            if (now > drag.lt) { S.vx = -((e.clientX - drag.lx) / sc) / ((now - drag.lt) / 1000); S.vc = -((e.clientY - drag.ly) / sc) / ((now - drag.lt) / 1000); }
            drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
            if (drag.moved > 5 && S.tour) { S.tour = false; syncButtons(); }
        }
        const dragging = drag.on && drag.moved > 5;
        S.hover = dragging || enTira(y) ? null : pickAt(x, y);
        view.style.cursor = dragging ? 'grabbing' : S.hover || inMini(x, y) || enTira(y) ? 'pointer' : 'grab';
        if (!dragging) syncPos(x, y);
    });
    view.addEventListener('pointerup', (e) => { if (!drag.on) return; drag.on = false; if (drag.moved <= 5) { S.vx = S.vc = 0; click(...toCanvas(e)); } else if (performance.now() - drag.lt > 80) S.vx = S.vc = 0; });
    view.addEventListener('pointercancel', () => { drag.on = false; });
    view.addEventListener('pointerleave', () => { S.mouse.inside = false; S.hover = null; });
    let rueda = 0, ruedaT = 0;
    view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = performance.now(); if (now - ruedaT > 400) rueda = 0;
        rueda += e.deltaY; ruedaT = now;
        if (Math.abs(rueda) > 60) { zoom(rueda > 0 ? 1 : -1, ...toCanvas(e)); rueda = 0; ruedaT = now + 250; }
    }, { passive: false });
    view.addEventListener('dblclick', (e) => zoom(-1, ...toCanvas(e)));
    addEventListener('keydown', (e) => {
        if (document.body.classList.contains('entrando')) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
        keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault();
        const k = e.key.toLowerCase();
        if (Q.mapa.extra && Q.mapa.extra.tecla(k, e)) return;
        if (k === 'n') setHour(Q.night(S.hour) > 0.5 ? 11 : 21);
        else if (k === 'r') setWeather({ clear: 'rain', rain: 'fog', fog: 'clear' }[S.weather]);
        else if (k === 'f') toggle('fiestas'); else if (k === 'm') toggle('metro'); else if (k === 't') toggle('names');
        else if (k === 'v') inclinar(!S.inclinada); else if (k === 'h') limpiar();
        else if (k === '+' || k === '=') zoom(-1); else if (k === '-' || k === '_') zoom(1);
        else if (k === ' ') { e.preventDefault(); toggle('playing'); } else if (k === 'escape') { Q.ficha.cerrar(); abrirMenu(false); }
    });
    addEventListener('keyup', (e) => { keys[e.key] = false; });

    // ───────────────────────── Controles ─────────────────────────
    const hourInput = $('#hour'), clock = $('#clock'), pos = $('#pos');
    const setHour = (h) => { S.hour = ((h % 24) + 24) % 24; hourInput.value = S.hour; };
    const setWeather = (w) => { S.weather = w; document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === w)); Q.sfx.rain(w === 'rain'); };
    const BTN = { play: 'playing', fiestas: 'fiestas', tour: 'tour', sound: 'sound', names: 'names', metro: 'metro' };
    function syncButtons() {
        Object.entries(BTN).forEach(([id, key]) => { $('#' + id).classList.toggle('on', !!S[key]); $('#' + id).setAttribute('aria-pressed', !!S[key]); });
        $('#sound').textContent = S.sound ? 'Sonido: activado' : 'Sonido: apagado';
        $('#play').textContent = S.playing ? 'Pausar el tiempo' : 'Seguir el tiempo';
        $('#vista').textContent = S.inclinada ? 'Ver desde arriba' : 'Ver inclinado'; $('#vista').classList.toggle('on', S.inclinada);
    }
    function syncZoom() { $('#nivel').textContent = `${NOMBRE_NIVEL[S.nivel]} · 1 px = ${NIVELES[S.nivel]} m`; $('#acercar').disabled = S.nivel === 0; $('#alejar').disabled = S.nivel === NIVELES.length - 1; }
    const toggle = (key) => { S[key] = !S[key]; if (key === 'sound') Q.sfx.enable(S.sound); if (key === 'tour') { S.destino = null; tourWait = 0; if (S.tour && S.nivel > 1) { S.nivel = 1; syncZoom(); } } syncButtons(); };
    const abrirMenu = (si) => { $('#controls').hidden = !si; $('#menu').classList.toggle('on', si); $('#menu').setAttribute('aria-expanded', si); };
    /** Quita todo lo que no es dibujo. Con la tecla H vuelve. */
    const limpiar = () => { document.body.classList.toggle('limpio'); abrirMenu(false); ajustar(); limitar(); };
    Object.entries(BTN).forEach(([id, key]) => $('#' + id).addEventListener('click', () => toggle(key)));
    $('#acercar').addEventListener('click', () => zoom(-1)); $('#alejar').addEventListener('click', () => zoom(1));
    $('#vista').addEventListener('click', () => inclinar(!S.inclinada));
    $('#menu').addEventListener('click', () => abrirMenu($('#controls').hidden));
    $('#limpio').addEventListener('click', limpiar);
    $('#volver').addEventListener('click', limpiar);
    hourInput.addEventListener('input', () => { S.hour = parseFloat(hourInput.value) % 24; });
    document.querySelectorAll('[data-weather]').forEach((b) => b.addEventListener('click', () => setWeather(b.dataset.weather)));

    /** Dónde está el cursor de verdad: coordenadas y altitud. */
    function syncPos(x, y) {
        const [wx, wy] = aMundo(x, y), [lat, lon] = G.latlon(wx, wy);
        pos.textContent = `${G.gms(lat, lon)} · ${Math.round(G.altura(wx, wy)).toLocaleString('es')} m`;
    }
    const PERIODS = [[5, 'madrugada'], [6.5, 'amanecer'], [12, 'mañana'], [17.7, 'tarde'], [19.2, 'atardecer'], [24, 'noche']];
    const syncClock = () => {
        const h = Math.floor(S.hour), mm = Math.floor((S.hour % 1) * 60);
        clock.querySelector('strong').textContent = String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        clock.querySelector('span').textContent = PERIODS.find(([until]) => S.hour < until)[1];
        if (document.activeElement !== hourInput) hourInput.value = S.hour;
    };

    // Buscador: lugares, estaciones, barrios y avenidas.
    const sinTilde = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const destinos = new Map();
    const anotar = (nombre, x, y, nivel, id) => { const k = sinTilde(nombre); if (k && !destinos.has(k)) destinos.set(k, { nombre, x, y, nivel, id }); };
    SITIOS.forEach((s) => { anotar(s.n, s.x, s.y, 1, s.id); if (Q.INFO[s.id]) anotar(Q.INFO[s.id].n, s.x, s.y, 1, s.id); });
    if (metro) metro.est.forEach((e) => anotar('Metro ' + e.nombre, e.x, e.y, 1));
    Q.BASE.barrios.forEach(([nombre, x, y, r]) => anotar(nombre, x, y, r <= 1 ? 2 : 1));
    {
        const largas = new Map();
        G.vias.forEach((via) => { if (via.nombre && via.k <= 4 && (!largas.has(via.nombre) || largas.get(via.nombre).largo < via.largo)) largas.set(via.nombre, via); });
        largas.forEach((via) => { if (via.largo < 300) return; const q = enCamino(via.p, via.acum || (via.acum = camino(via.p)), via.largo / 2); anotar(via.nombre, q[0], q[1], 1); });
        const lista = $('#sugerencias');
        [...destinos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).forEach((d) => { const o = document.createElement('option'); o.value = d.nombre; lista.append(o); });
    }
    const buscar = $('#buscar');
    const irABusqueda = () => {
        const k = sinTilde(buscar.value); if (!k) return;
        const d = destinos.get(k) || [...destinos.entries()].find(([n]) => n.startsWith(k))?.[1] || [...destinos.entries()].find(([n]) => n.includes(k))?.[1];
        if (!d) { buscar.classList.add('nada'); return; }
        buscar.classList.remove('nada'); irA(d.x, d.y, d.nivel); S.tour = false; syncButtons();
        if (d.id && Q.INFO[d.id]) Q.ficha.abrir(d.id);
        buscar.blur();
    };
    buscar.addEventListener('change', irABusqueda);
    buscar.addEventListener('keydown', (e) => { if (e.key === 'Enter') irABusqueda(); else buscar.classList.remove('nada'); });

    // Los lugares: un botón por cada uno, y la ficha que se abre al visitarlo.
    Q.ficha.alIr = (id) => { const s = sitio(id); if (!s) return; irA(s.x, s.y, Math.min(S.nivel, s.r > 400 ? 2 : 1)); S.tour = false; syncButtons(); };
    Q.ficha.lugares(SITIOS.filter((s) => Q.INFO[s.id]).map((s) => [s.id, s.n]));

    // ───────────────────────── Arranque ─────────────────────────
    ajustar();
    if (params.has('z')) S.nivel = clamp(+params.get('z'), 0, NIVELES.length - 1);
    if (params.get('v') === '1') S.inclinada = true;
    { let x = +params.get('x') || 0, y = +params.get('y') || 0; const s = sitio(params.get('en')); if (s) { x = s.x; y = s.y; } S.x = x; S.c = aC(x, y); }
    if (params.get('limpio') === '1') document.body.classList.add('limpio');
    ajustar(); limitar(); syncButtons(); syncZoom(); syncPos(W / 2, H / 2);
    Q.mapa = { render, step, cache, irA, inclinar, zoom, metro, cable, enCamino, sitio, ajustar, limitar, syncButtons, setWeather, estacionCercana, acercarEstacion, terminarEntrada: () => { if (entrada) entrada.terminar(); }, extra: null, repintar: () => { if (fijo) fijo(); } };
    if (params.has('shot')) {
        if (params.has('h')) S.hour = +params.get('h');
        if (params.has('w')) S.weather = params.get('w');
        S.fiestas = params.get('f') === '1'; S.names = params.get('names') === '1'; S.playing = false;
        if (params.get('menu') === '1') abrirMenu(true);
        if (params.has('mx')) Object.assign(S.mouse, { x: +params.get('mx'), y: +params.get('my'), inside: true, movedAt: 1e9 });
        for (let i = 0; i < (+params.get('t') || 3) * 30; i++) step(1 / 30);
        if (params.has('mx')) S.hover = pickAt(S.mouse.x, S.mouse.y);
        if (params.has('card')) Q.ficha.abrir(params.get('card'));
        document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === S.weather));
        syncButtons(); syncClock();
        // Se repite hasta que lleguen los datos y no quede nada por pintar.
        let turno = 0;
        fijo = () => { clearTimeout(turno); render(); construir(1e9); if (faltan || Q.datos.pendientes() > 0) turno = setTimeout(fijo, 40); else { render(); document.title = 'listo'; } };
        fijo();
        return;
    }

    let last = performance.now(), clockT = 0;
    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        // Pase lo que pase en un cuadro, el siguiente se pide igual: un error de dibujo no congela la página.
        try {
            step(dt); render(); construir(8);
            if ((clockT += dt) > 0.2) { clockT = 0; syncClock(); }
        } finally { requestAnimationFrame(frame); }
    };
    syncClock(); requestAnimationFrame(frame);
})();
