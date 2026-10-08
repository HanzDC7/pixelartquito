'use strict';

/*
 * Pinta el mapa a partir de los datos reales, en tres escalas:
 *
 *   detalle   2 m por píxel   cada edificio, cada calle, cada cancha
 *   ciudad    8 m por píxel   la trama de calles y manzanas
 *   región   32 m por píxel   todo el valle, con sus cerros
 *
 * Nada se dibuja a mano aquí: las formas vienen de OpenStreetMap y el relieve
 * del SRTM. Lo que sí se decide es el estilo: paleta corta, bordes con luz
 * arriba a la izquierda y sombra abajo a la derecha, y grano de un píxel.
 *
 * Cada tesela sale como datos (color, luces, altura y tipo de muro de cada
 * píxel). Con eso mismo se arma la vista inclinada: ver P.oblicua.
 */
(() => {
    const G = Q.geo, { clamp } = Q;
    const P = (Q.pinta = {});
    const pal = (l) => l.map(Q.hex);

    // Ruido entero: mismo valor para el mismo píxel del mundo, así las teselas empatan.
    const rnd = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    P.rnd = rnd;
    /** Ruido suave: el mismo azar, pero sin escalones entre una celda y la siguiente. */
    const suave = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy); return (rnd(ix, iy) * (1 - u) + rnd(ix + 1, iy) * u) * (1 - w) + (rnd(ix, iy + 1) * (1 - u) + rnd(ix + 1, iy + 1) * u) * w; };

    // ───────────────────────── Paleta ─────────────────────────
    const TEJA = pal(['#B5532F', '#A44A2A', '#C2633A', '#9A4A2C', '#BF5B36', '#AD5230', '#B85A38', '#A85032']);
    const LOSA = pal(['#C9CED8', '#B9BDC6', '#D8DCE2', '#A7B0BE', '#E2E5EA', '#BFC7CF', '#B3B0A8', '#CFCBC0', '#A9A69E', '#DAD6CC']);
    const PINTADO = pal(['#B86A4E', '#9C5A48', '#C4826A', '#8A6A5C', '#A8705A']);
    const LATA = pal(['#7FA6B8', '#6E9C8E', '#8FB3C4', '#9AA8B5', '#5E8FA8']);
    const NAVE = pal(['#D5DAE3', '#C3CAD6', '#E4E8EE', '#B5C6D6', '#DCE3EA']);
    const TORRE = pal(['#D8DCE2', '#C9CED8', '#E2E5EA', '#BCC8D4', '#CFD6DE']);
    const C = {
        acera: Q.hex('#B8B2A6'), aceraVieja: Q.hex('#A49D90'), patio: pal(['#58534D', '#615C55', '#514C47']),
        suelo: pal(['#8B877F', '#938F86', '#84807A']), adoquin: pal(['#625E58', '#6C6862', '#5A5651']),
        via: pal(['#33363E', '#33363E', '#383B43', '#3A3D45', '#3F424A', '#464951', '#50535B']),
        peatonal: pal(['#CFC8B8', '#C2BBAA', '#D9D3C4']), sendero: Q.hex('#C9BD9E'), grada: pal(['#BDB5A4', '#8F887A']),
        tierra: pal(['#A6916C', '#9A8662']), rio: pal(['#4F8FB8', '#5FA2C8', '#447FA6']), quebrada: Q.hex('#3A6E6A'),
        linea: Q.hex('#E2C63A'), blanca: Q.hex('#E8E4DA'),
    };
    const AREA = {
        1: pal(['#5E9A55', '#6FAE62', '#528C4B']),      // parque
        3: pal(['#B9BDC6', '#C9CED8', '#A9AEB8']),      // graderías
        4: pal(['#9DB08A', '#A6B992', '#93A680']),      // centro deportivo
        5: pal(['#6AA35C', '#77B068', '#5E9652']),      // pasto
        6: pal(['#2F6F3E', '#37794A', '#286236']),      // bosque
        7: pal(['#6F8F4E', '#7B9A58', '#638346']),      // matorral
        9: pal(['#8FA88A', '#9AB294', '#859E80']),      // cementerio
        10: pal(['#D6CFC0', '#C2BBAA', '#D9D3C4']),     // plaza
        11: pal(['#5FA8D6', '#7FC0E6', '#5299C8']),     // agua
        12: pal(['#8A8590', '#9A95A0', '#7C7782']),     // roca
        13: pal(['#8E8A84', '#96928C', '#86827C']),     // industria
        14: pal(['#9A958C', '#A29D94', '#928D84']),     // comercio
        15: pal(['#8C9A7A', '#95A383', '#839171']),     // cuartel
        16: pal(['#93AB82', '#9DB58C', '#89A178']),     // universidad
        17: pal(['#A8A49C', '#B0ACA4', '#A09C94']),     // hospital
        18: pal(['#B8A88A', '#C0B092', '#B0A082']),     // mercado
        19: pal(['#6A6D76', '#72757E', '#62656E']),     // terminal
        20: pal(['#5A5D66', '#62656E', '#52555E']),     // pista
    };
    const CULTIVO = pal(['#8DAE5A', '#A8B860', '#C9B86A', '#7FA052', '#9A8A5A', '#6E9A4E', '#B5C06A']);
    const CANCHA = { 0: ['#7FAE6A', '#8ABA74'], 1: ['#3F9A4A', '#4BAA55'], 2: ['#C2633A', '#C96D45'], 3: ['#3B7A57', '#44855F'], 4: ['#D9C9A0', '#E0D1AA'], 5: ['#8E5A3C', '#996545'], 6: ['#5FB8E6', '#74C4EC'], 7: ['#9A9CA4', '#A4A6AE'], 8: ['#C9B88A', '#D2C294'] };
    Object.keys(CANCHA).forEach((k) => { CANCHA[k] = pal(CANCHA[k]); });
    const TERRENO = {
        roca: pal(['#77727C', '#8A8590', '#9C97A2']), arenal: pal(['#8C8478', '#9A9184', '#A89F92']),
        paramo: pal(['#7F8444', '#8E9150', '#9A9C5A']), bosque: pal(['#2F5E34', '#386B39', '#427840']),
        campo: pal(['#4E8A48', '#5B9A52', '#69A85C', '#7FAE5A', '#93B462', '#6E9A4E', '#A9B866']),
        seco: pal(['#A99B70', '#B8A97C', '#C6B789', '#9E9468', '#B3A070']),
    };
    const SOMBRA = [20, 24, 46];
    // Muros, para la vista inclinada: 1-6 cal y colores del centro, 7-13 barrio,
    // 14-18 torres de vidrio, 19 piedra, 20 lata, 21 follaje, 22 aluminio, 23 bronce. Y el vidrio de cada uno.
    const MURO = pal(['#000000', '#F4F1E8', '#F6E7B8', '#EBD9C4', '#DCE6EA', '#F2D6C2', '#E9E3D0',
        '#D9D4C6', '#E8D2B0', '#C9D3DA', '#E6C9B0', '#BFC9B8', '#A89888', '#9A9288',
        '#5B7FA6', '#3F6A78', '#6B7385', '#2F4F6F', '#8A8F9C', '#8E8A86', '#B5BEC8', '#2A5E36', '#D5DCE6', '#C8A24A']);
    const VIDRIO = pal(['#000000', '#3A3040', '#3A3040', '#3A3040', '#3A3040', '#3A3040', '#3A3040',
        '#2B3A55', '#2B3A55', '#2B3A55', '#2B3A55', '#2B3A55', '#3A3A40', '#3A3A40',
        '#9DD1E8', '#8FD3C8', '#B9C6DA', '#7FB3E0', '#D0DCEA', '#3A3A40', '#5A6070', '#1E4A2A', '#9AA5B5', '#8E6F2B']);

    /**
     * El Centro Histórico: aquí los techos son de teja y las calles de adoquín.
     * Es un contorno aproximado del área patrimonial, en metros.
     */
    const CENTRO = [[-1500, -620], [-900, -900], [-200, -960], [500, -860], [1050, -560], [1150, -100], [1000, 420], [300, 560], [-500, 520], [-1250, 380], [-1650, 60]];
    const CEX = Float64Array.from(CENTRO, (p) => p[0]), CEY = Float64Array.from(CENTRO, (p) => p[1]), CEN = CENTRO.length;
    const enCentro = (x, y) => { let d = false; for (let i = 0, j = CEN - 1; i < CEN; j = i++) { const yi = CEY[i], yj = CEY[j]; if ((yi > y) !== (yj > y) && x < (CEX[j] - CEX[i]) * (y - yi) / (yj - yi) + CEX[i]) d = !d; } return d; };
    P.enCentro = enCentro;
    /** Para no preguntar píxel por píxel: 1 si el rectángulo cae entero en el centro, 0 si entero fuera, -1 si lo cruza el borde. */
    const centroEn = (x0, y0, x1, y1) => {
        if (x1 < -1700 || x0 > 1200 || y1 < -1000 || y0 > 600) return 0;
        let dentro = 0, n = 0;
        for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) { n++; if (enCentro(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * j / 8)) dentro++; }
        return dentro === n ? 1 : dentro === 0 ? 0 : -1;
    };

    // ───────────────────────── Terreno natural ─────────────────────────
    /**
     * Color del suelo sin ciudad: de abajo hacia arriba, campo en retazos,
     * bosque andino, páramo y roca; hacia la Mitad del Mundo, matorral seco.
     */
    const terreno = (z, x, y, n, out) => {
        const e = z + (n - 0.5) * 70 + Math.sin(x * 0.0041) * 45 + Math.sin(y * 0.0057 + 2) * 35;
        const k = n > 0.66 ? 2 : n > 0.33 ? 1 : 0;
        let c;
        if (e > 4330) c = (rnd(x >> 6, y >> 6) > 0.5 ? TERRENO.roca : TERRENO.arenal)[k];
        else if (e > 3680) c = TERRENO.paramo[k];
        else {
            const seco = clamp((2700 - z) / 220) * clamp((x - 7500) / 5000);
            if (seco > 0.15 + n * 0.5) c = TERRENO.seco[rnd(x >> 3, y >> 3) > 0.93 ? 3 : k];
            else {
                // Manchas de bosque que se van cerrando con la altura.
                const manta = suave(x / 40, y / 40) * 0.5 + suave(x / 150 + 9, y / 150 + 4) * 0.5 + (n - 0.5) * 0.08, alto = clamp((e - 2950) / 500);
                if (manta < alto * 0.75 + 0.2) c = TERRENO.bosque[k];
                else {
                    const px = Math.floor(x / 56 + Math.sin(y * 0.021) * 0.4), py = Math.floor(y / 44 + Math.sin(x * 0.017) * 0.4);
                    c = TERRENO.campo[Math.floor(rnd(px, py) * 7)];
                    if (n > 0.9) c = TERRENO.campo[0];
                }
            }
        }
        out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    };

    /** Luz del relieve: la ladera que mira arriba a la izquierda queda clara. */
    const luzDe = (dzdx, dzdy, n) => {
        const v = (-dzdx * 0.62 - dzdy * 0.62 + 0.48) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1) / 0.48;
        return clamp(Math.round((0.52 + v * 0.48 + (n - 0.5) * 0.05) * 14) / 14, 0.55, 1.28);
    };

    // ───────────────────────── Trazado en rejilla ─────────────────────────
    let M = 0, MH = 0, cls = null, bid = null;     // M es el ancho de la rejilla y MH su alto
    let EX = new Float32Array(4096), EA = new Float32Array(4096), EB = new Float32Array(4096), ES = new Float32Array(4096);
    const XS = new Float32Array(512);

    /** Rellena un polígono con huecos (regla par-impar). */
    const poli = (anillos, esc, offx, offy, val, id = 0) => {
        let n = 0, ymin = 1e9, ymax = -1e9;
        for (const p of anillos) {
            const m = p.length;
            if (n + m / 2 > EX.length) { const g = (a) => { const b = new Float32Array((n + m) * 2); b.set(a); return b; }; EX = g(EX); EA = g(EA); EB = g(EB); ES = g(ES); }
            for (let i = 0; i < m; i += 2) {
                const j = (i + 2) % m;
                let x1 = p[i] * esc + offx, y1 = p[i + 1] * esc + offy, x2 = p[j] * esc + offx, y2 = p[j + 1] * esc + offy;
                if (y1 === y2) continue;
                if (y1 > y2) { let t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t; }
                EX[n] = x1; EA[n] = y1; EB[n] = y2; ES[n] = (x2 - x1) / (y2 - y1); n++;
                if (y1 < ymin) ymin = y1; if (y2 > ymax) ymax = y2;
            }
        }
        const ya = Math.max(0, Math.ceil(ymin - 0.5)), yb = Math.min(MH - 1, Math.floor(ymax - 0.5));
        let cuenta = 0;
        for (let y = ya; y <= yb; y++) {
            const yc = y + 0.5; let k = 0;
            for (let e = 0; e < n && k < 510; e++) if (yc >= EA[e] && yc < EB[e]) XS[k++] = EX[e] + (yc - EA[e]) * ES[e];
            for (let i = 1; i < k; i++) { const v = XS[i]; let j = i - 1; while (j >= 0 && XS[j] > v) { XS[j + 1] = XS[j]; j--; } XS[j + 1] = v; }
            for (let i = 0; i + 1 < k; i += 2) {
                const xa = Math.max(0, Math.ceil(XS[i] - 0.5)), xb = Math.min(M - 1, Math.floor(XS[i + 1] - 0.5));
                for (let x = xa, g = y * M + xa; x <= xb; x++, g++) { cls[g] = val; if (id) bid[g] = id; cuenta++; }
            }
        }
        return cuenta;
    };

    /** Línea gruesa: todo píxel a menos de medio ancho del eje. */
    const trazo = (p, esc, offx, offy, ancho, val) => {
        const r = ancho <= 1 ? 0.71 : ancho / 2, r2 = r * r;
        for (let i = 0; i + 3 < p.length; i += 2) {
            const x1 = p[i] * esc + offx, y1 = p[i + 1] * esc + offy, x2 = p[i + 2] * esc + offx, y2 = p[i + 3] * esc + offy;
            const xa = Math.max(0, Math.floor(Math.min(x1, x2) - r)), xb = Math.min(M - 1, Math.ceil(Math.max(x1, x2) + r));
            const ya = Math.max(0, Math.floor(Math.min(y1, y2) - r)), yb = Math.min(MH - 1, Math.ceil(Math.max(y1, y2) + r));
            const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1e-9;
            for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
                const px = x + 0.5 - x1, py = y + 0.5 - y1;
                let t = (px * dx + py * dy) / L; t = t < 0 ? 0 : t > 1 ? 1 : t;
                const ex = px - t * dx, ey = py - t * dy;
                if (ex * ex + ey * ey <= r2) cls[y * M + x] = val;
            }
        }
    };

    /** Un lienzo a partir de los colores de una tesela. */
    P.lienzo = (rgba, w, h = w) => { const c = Q.canvas(w, h); c.g.putImageData(new ImageData(rgba, w, h), 0, 0); return c.cv; };

    // ───────────────────────── Detalle: 2 m por píxel ─────────────────────────
    const N = 256, PAD = 48, MD = N + PAD * 2;
    const clsD = new Uint8Array(MD * MD), bidD = new Uint16Array(MD * MD), somD = new Uint8Array(MD * MD);
    const ACERA = 30, VIA = 32, EDIF = 64;
    const ANCHO = [7, 7, 6, 5, 4, 3, 2, 3, 1, 2, 2, 4, 5, 2];        // píxeles, por clase de vía
    const ORDEN = [13, 12, 10, 8, 9, 6, 7, 5, 11, 4, 3, 2, 1, 0];     // de abajo hacia arriba
    const ARBOLES = { 1: 0.34, 6: 0.92, 16: 0.12, 9: 0.1, 5: 0.04, 7: 0.3, 15: 0.1, 17: 0.06 };
    const tmp = [0, 0, 0];
    const LW = 8, LH = 7;     // un lote genérico: 16 × 14 m
    const HITOS = (Q.HITOS || []).map((h) => {
        const b = h.r ? [h.r[0], h.r[1], h.r[0], h.r[1]] : h.c ? h.c : [h.d[0] - h.d[2], h.d[1] - h.d[2], h.d[0] + h.d[2], h.d[1] + h.d[2]];
        return Object.assign({}, h, { col: h.techo ? Q.hex(h.techo) : null, x0: b[0], y0: b[1], x1: b[2], y1: b[3] });
    });

    /**
     * Pinta la tesela (tx, ty). Devuelve null mientras sus datos no llegan.
     * Entrega el color y las luces de cada píxel, su altura sobre el suelo y el
     * tipo de muro (para la vista inclinada), y los puntos donde hay gente,
     * balizas y nombres de calles.
     */
    P.detalle = (tx, ty) => {
        const T = Q.datos.tesela(tx, ty);
        if (!T) return null;
        const ox = G.X0 + tx * G.T, oy = G.Y0 + ty * G.T;   // esquina de la tesela, en metros
        M = MH = MD; cls = clsD; bid = bidD; cls.fill(0); bid.fill(0); somD.fill(0);
        const esc = 0.5, off = PAD, wx0 = tx * N, wy0 = ty * N;
        const zona = centroEn(ox - PAD * 2, oy - PAD * 2, ox + G.T + PAD * 2, oy + G.T + PAD * 2), viejoEn = zona === -1 ? enCentro : zona === 1 ? () => true : () => false;

        T.a.forEach((a) => poli(a.r, esc, off, off, a.k === 2 ? 100 + a.sub : a.k));
        const urbano = G.urbano(ox + 256, oy + 256) > 0 || T.e.length > 3;
        ORDEN.forEach((k) => { if (k <= 5 || k === 7 || k === 11) T.v.forEach((v) => { if (v.k === k && !v.tunel && urbano) trazo(v.p, esc, off, off, ANCHO[k] + 2, ACERA); }); });
        ORDEN.forEach((k) => T.v.forEach((v) => { if (v.k === k && !v.tunel) trazo(v.p, esc, off, off, ANCHO[k], VIA + k); }));

        // Edificios: cada uno con su color de techo, su altura, su muro y su sombra.
        const techo = [null], alto = [0], muro = [0], retazos = [false], punta = [];
        const nuevo = (c, pisos, m, parches) => { techo.push(c); alto.push(pisos); muro.push(m); retazos.push(parches); return techo.length - 1; };
        T.e.forEach((e) => {
            const p = e.r[0], cx = ox + p[0], cy = oy + p[1], s = rnd(Math.round(cx * 3.1), Math.round(cy * 2.7)), s2 = rnd(Math.round(cy * 1.9), Math.round(cx * 4.3));
            const viejo = viejoEn(cx, cy);
            const pisos = Math.min(60, e.pisos || (viejo ? 2 : 1 + Math.floor(s2 * 2.6)));
            let c, m = 7 + Math.floor(s * 7), parches = false;
            if (e.tipo === 1) { const teja = viejo || s > 0.5; c = teja ? TEJA[Math.floor(s2 * 8)] : LOSA[Math.floor(s2 * 10)]; m = viejo ? (s > 0.5 ? 19 : 1) : 1 + Math.floor(s * 6); parches = viejo; }
            else if (e.tipo === 4 || e.tipo === 5 || e.tipo === 8) { c = (s > 0.6 ? LATA : NAVE)[Math.floor(s2 * 5)]; m = 20; }
            else if (pisos >= 7) { c = TORRE[Math.floor(s * 5)]; m = 14 + Math.floor(s2 * 5); }
            else if (viejo && pisos <= 4) { const teja = s > 0.07; c = teja ? TEJA[Math.floor(s2 * 8)] : LOSA[Math.floor(s2 * 10)]; m = 1 + Math.floor(s * 6); parches = teja; }
            else if (e.tipo === 3) c = NAVE[Math.floor(s * 5)];
            else c = s < 0.6 ? LOSA[Math.floor(s2 * 10)] : s < 0.76 ? TEJA[Math.floor(s2 * 8)] : s < 0.9 ? PINTADO[Math.floor(s2 * 5)] : LATA[Math.floor(s2 * 5)];
            poli(e.r, esc, off, off, EDIF, nuevo(c, pisos, m, parches));
        });

        // Donde el mapa tiene calles pero todavía no casas, la manzana se llena con lotes genéricos.
        if (urbano && zona !== 1 && G.hayVacios(ox - PAD * 2, oy - PAD * 2, ox + G.T + PAD * 2, oy + G.T + PAD * 2)) {
            const lotes = new Map();
            for (let y = 1; y < M - 1; y++) for (let x = 1, g = y * M + 1; x < M - 1; x++, g++) {
                if (cls[g] !== 0) continue;
                const wx = wx0 + x - PAD, wy = wy0 + y - PAD, mx = G.X0 + wx * 2, my = G.Y0 + wy * 2;
                if (!G.sinCasas(mx, my) || viejoEn(mx, my)) continue;
                const v = Math.floor(wy / LH), d = Math.floor(rnd(v, 7) * LW), u = Math.floor((wx + d) / LW), s = rnd(u * 3 + 1, v * 5 + 2);
                if (s < 0.14) continue;                                    // lote baldío
                const lx = ((wx + d) % LW + LW) % LW, ly = (wy % LH + LH) % LH;
                if (lx >= LW - 1 || ly >= LH - 2 || (s > 0.86 && lx >= LW / 2)) continue;   // el retiro y el patio de atrás
                const clave = u * 4099 + v;
                let id = lotes.get(clave);
                if (!id) { const s2 = rnd(u * 7 + 3, v * 3 + 5); id = nuevo(s2 < 0.62 ? LOSA[Math.floor(s * 10)] : s2 < 0.8 ? TEJA[Math.floor(s * 8)] : s2 < 0.93 ? PINTADO[Math.floor(s * 5)] : LATA[Math.floor(s * 5)], 1 + Math.floor(s2 * 2.7), 7 + Math.floor(s * 7), false); lotes.set(clave, id); }
                cls[g] = EDIF; bid[g] = id;
            }
        }

        // Hitos: lo que se reconoce de lejos lleva su altura y sus materiales de verdad.
        HITOS.forEach((h) => {
            if (h.x1 < ox - 96 || h.x0 > ox + G.T + 96 || h.y1 < oy - 96 || h.y0 > oy + G.T + 96) return;
            if (h.r) {
                const gx = Math.round((h.r[0] - ox) / 2) + PAD, gy = Math.round((h.r[1] - oy) / 2) + PAD, id = gx >= 0 && gy >= 0 && gx < M && gy < M ? bid[gy * M + gx] : 0;
                if (id) { if (h.col) techo[id] = h.col; alto[id] = h.alto / 3.2; muro[id] = h.muro; retazos[id] = !!h.teja; }
                return;
            }
            const id = nuevo(h.col, h.alto / 3.2, h.muro, false);
            if (h.punta) punta[id] = [((h.x0 + h.x1) / 2 - ox) / 2, ((h.y0 + h.y1) / 2 - oy) / 2, (h.x1 - h.x0) / 4, h.punta];     // centro y medio ancho en píxeles, y metros de aguja
            if (h.c) poli([Float32Array.from([h.c[0] - ox, h.c[1] - oy, h.c[2] - ox, h.c[1] - oy, h.c[2] - ox, h.c[3] - oy, h.c[0] - ox, h.c[3] - oy])], esc, off, off, EDIF, id);
            else { const cx = (h.d[0] - ox) / 2 + PAD, cy = (h.d[1] - oy) / 2 + PAD, r = h.d[2] / 2; for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(M - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(M - 1, Math.ceil(cx + r)); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r + 0.3) { cls[y * M + x] = EDIF; bid[y * M + x] = id; } }
        });

        // La sombra cae abajo a la derecha, un píxel por piso.
        for (let y = 0; y < M; y++) for (let x = 0, g = y * M; x < M; x++, g++) {
            const b = bid[g]; if (!b) continue;
            const largo = Math.min(42, Math.max(1, Math.round(alto[b] * 0.95)));
            for (let k = 1; k <= largo && x + k < M && y + k < M; k++) { const q = g + k * (M + 1), v = largo - k + 1; if (somD[q] < v) somD[q] = v; }
        }

        // Relieve y densidad urbana, muestreados cada 8 píxeles e interpolados.
        const PASO = 8, NG = N / PASO + 3, hs = G.alturas(ox - PASO * 2, oy - PASO * 2, PASO * 2, NG), ub = new Float32Array(NG * NG);
        for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) ub[j * NG + i] = G.urbano(ox + (i - 1) * PASO * 2, oy + (j - 1) * PASO * 2);

        const rgba = new Uint8ClampedArray(N * N * 4), luz = new Uint8ClampedArray(N * N * 4), alto8 = new Uint8Array(N * N), mur8 = new Uint8Array(N * N);
        const gente = [];
        for (let y = 0; y < N; y++) {
            const gy = y / PASO + 1, jy = gy | 0, fy = gy - jy;
            for (let x = 0; x < N; x++) {
                const g = (y + PAD) * M + x + PAD, c = cls[g], wx = wx0 + x, wy = wy0 + y, n = rnd(wx, wy), k3 = n > 0.66 ? 2 : n > 0.33 ? 1 : 0;
                const gx = x / PASO + 1, ix = gx | 0, fx = gx - ix, q = jy * NG + ix;
                const mx = ox + x * 2, my = oy + y * 2, o = y * N + x;
                let r, gg, b, plano = false;
                if (c === EDIF) {
                    const id = bid[g];
                    let t = techo[id], junta = false;
                    if (retazos[id]) {
                        // Un solo polígono suele abarcar varias casas: se lo reparte en techos de distinto tono.
                        const v = Math.floor(wy / 8), d = Math.floor(rnd(v, 3) * 9), u = Math.floor((wx + d) / 9);
                        t = TEJA[Math.floor(rnd(u * 5 + 1, v * 3 + 2) * 8)];
                        junta = (wy % 8 + 8) % 8 === 0 || ((wx + d) % 9 + 9) % 9 === 0;
                    }
                    const claro = bid[g - M] !== id || bid[g - 1] !== id, oscuro = bid[g + M] !== id || bid[g + 1] !== id;
                    const f = oscuro ? 0.74 : claro ? 1.16 : junta ? 0.86 : n > 0.93 ? 0.93 : 1;
                    r = t[0] * f; gg = t[1] * f; b = t[2] * f;
                    if (alto[id] >= 7 && claro && !oscuro) { r = 127; gg = 179; b = 224; }           // el vidrio asoma en dos bordes
                    plano = true; alto8[o] = Math.min(255, Math.round(alto[id] * 3.2 + (retazos[id] ? 1.6 : 0))); mur8[o] = muro[id];
                    if (punta[id]) { const q = punta[id], d = Math.max(Math.abs(x + 0.5 - q[0]), Math.abs(y + 0.5 - q[1])) / q[2]; alto8[o] -= Math.round(q[3] * Math.min(1, d)); }
                } else if (c >= VIA && c < EDIF) {
                    const k = c - VIA, viejo = viejoEn(mx, my);
                    let col;
                    if (k === 7) col = C.peatonal[k3];
                    else if (k === 8) col = C.sendero;
                    else if (k === 9) col = C.grada[(wx + wy) & 1];
                    else if (k === 10) col = C.tierra[k3 & 1];
                    else if (k === 12) col = C.rio[k3];
                    else if (k === 13) col = C.quebrada;
                    else col = viejo && k >= 4 && k !== 11 ? C.adoquin[k3] : C.via[k === 11 ? 3 : k];
                    r = col[0]; gg = col[1]; b = col[2]; plano = k !== 8 && k !== 10 && k < 12;
                } else if (c === ACERA) { const col = viejoEn(mx, my) ? C.aceraVieja : C.acera; r = col[0]; gg = col[1]; b = col[2]; plano = true; }
                else if (c >= 100) {
                    const col = CANCHA[c - 100] || CANCHA[0], raya = c === 101 ? ((wx >> 2) & 1) : 0;
                    const borde = cls[g - 1] !== c || cls[g + 1] !== c || cls[g - M] !== c || cls[g + M] !== c;
                    const cc = borde ? C.blanca : col[raya];
                    r = cc[0]; gg = cc[1]; b = cc[2]; plano = true;
                } else if (c === 8) { const px = Math.floor(mx / 38 + Math.sin(my * 0.03) * 0.3), py = Math.floor(my / 30); const col = CULTIVO[Math.floor(rnd(px, py) * 7)]; r = col[0]; gg = col[1]; b = col[2]; if ((wy + px) % 3 === 0) { r *= 0.93; gg *= 0.93; b *= 0.93; } }
                else if (c > 0) {
                    const col = (AREA[c] || AREA[5])[c === 11 ? (((wx + wy * 3) % 11 < 3 && n > 0.4) ? 1 : 0) : (n > 0.8 ? 1 : n < 0.16 ? 2 : 0)];
                    r = col[0]; gg = col[1]; b = col[2]; plano = c === 10 || c === 11 || c >= 13;
                    if (c === 3) { alto8[o] = 11; mur8[o] = 20; if ((wx + wy) % 3 === 0) { r *= 0.9; gg *= 0.9; b *= 0.9; } }      // las graderías de un estadio
                    if (c === 10 && n > 0.985) gente.push(mx, my);
                    if (c === 1 && n > 0.9965) gente.push(mx, my);
                } else {
                    const u = (ub[q] * (1 - fx) + ub[q + 1] * fx) * (1 - fy) + (ub[q + NG] * (1 - fx) + ub[q + NG + 1] * fx) * fy;
                    if (u + (n - 0.5) * 0.25 > 0.2) {
                        const viejo = viejoEn(mx, my), verde = rnd(wx >> 2, wy >> 2);
                        const col = viejo ? C.patio[k3] : verde > 0.86 ? AREA[5][k3] : C.suelo[k3];
                        r = col[0]; gg = col[1]; b = col[2]; plano = true;
                        if (viejo && n > 0.975) { r = 79; gg = 138; b = 72; }                       // una mata en el patio
                    } else {
                        const z = (hs[q] * (1 - fx) + hs[q + 1] * fx) * (1 - fy) + (hs[q + NG] * (1 - fx) + hs[q + NG + 1] * fx) * fy;
                        terreno(z, wx, wy, n, tmp); r = tmp[0]; gg = tmp[1]; b = tmp[2];
                    }
                }
                // Luz del relieve; lo construido la recibe atenuada para que la ciudad no se manche.
                const dzx = ((hs[q + 1] - hs[q]) * (1 - fy) + (hs[q + NG + 1] - hs[q + NG]) * fy) / (PASO * 2);
                const dzy = ((hs[q + NG] - hs[q]) * (1 - fx) + (hs[q + NG + 1] - hs[q + 1]) * fx) / (PASO * 2);
                let l = luzDe(dzx, dzy, n); if (plano) l = 1 + (l - 1) * 0.3;
                r *= l; gg *= l; b *= l;
                const s = somD[g];
                if (s && (c !== EDIF || s > Math.max(1, Math.round(alto[bid[g]] * 0.95)))) { r = r * 0.62 + SOMBRA[0] * 0.38; gg = gg * 0.62 + SOMBRA[1] * 0.38; b = b * 0.62 + SOMBRA[2] * 0.38; }
                const o4 = o * 4; rgba[o4] = r; rgba[o4 + 1] = gg; rgba[o4 + 2] = b; rgba[o4 + 3] = 255;
            }
        }

        // Árboles: una copa cada tantos metros donde hay parque o bosque.
        const sello = (x, y, rad, c1, c2, h) => {
            for (let dy = -rad; dy <= rad + 1; dy++) for (let dx = -rad; dx <= rad + 1; dx++) {
                const px = x + dx, py = y + dy; if (px < 0 || py < 0 || px >= N || py >= N) continue;
                const d2 = dx * dx + dy * dy, o = (py * N + px) * 4, r2 = rad * rad + 0.6;
                if (d2 <= r2) { const cc = dx + dy < -rad * 0.5 ? c2 : c1; rgba[o] = cc[0]; rgba[o + 1] = cc[1]; rgba[o + 2] = cc[2]; if (!alto8[o >> 2]) { alto8[o >> 2] = h; mur8[o >> 2] = 21; } }
                else if ((dx - 1) * (dx - 1) + (dy - 1) * (dy - 1) <= r2) { rgba[o] = rgba[o] * 0.66; rgba[o + 1] = rgba[o + 1] * 0.66; rgba[o + 2] = rgba[o + 2] * 0.7; }
            }
        };
        const VERDE = pal(['#2F6F3E', '#4E9A55', '#286236', '#43884B', '#35783F', '#5BA55E']), ARUPO = pal(['#D46A9C', '#F0A3C6']);
        const R5 = 5, i0 = Math.floor((wx0 - 4) / R5), i1 = Math.floor((wx0 + N + 4) / R5), j0 = Math.floor((wy0 - 4) / R5), j1 = Math.floor((wy0 + N + 4) / R5);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const x = i * R5 + Math.floor(rnd(i, j * 3) * R5) - wx0, y = j * R5 + Math.floor(rnd(i * 3, j) * R5) - wy0;
            const gx = x + PAD, gy = y + PAD; if (gx < 0 || gy < 0 || gx >= M || gy >= M) continue;
            const c = cls[gy * M + gx], d = ARBOLES[c]; if (!d) continue;
            const s = rnd(i * 7 + 1, j * 5 + 2); if (s > d) continue;
            const t = rnd(i + 99, j + 77);
            if (c === 1 && t > 0.96) sello(x, y, 2, ARUPO[0], ARUPO[1], 5);
            else sello(x, y, c === 7 ? 1 : t > 0.6 ? 2 : c === 6 ? 2 : 1 + (t > 0.3 ? 1 : 0), VERDE[c === 6 ? 2 * Math.floor(t * 2) : 0], VERDE[c === 6 ? 3 + Math.floor(t * 2) : 1], c === 7 ? 3 : 5 + Math.floor(t * 6));
        }

        // Línea central en las avenidas, faroles y nombres.
        const faroles = [], nombres = [], vistos = new Map();
        const punto = (x, y, col) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= N || y >= N) return; const o = (y * N + x) * 4; rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; };
        T.v.forEach((v) => {
            if (v.tunel) return;
            const p = v.p, calle = v.k <= 5 || v.k === 7 || v.k === 11;
            let rec = 0, largo = 0;
            for (let i = 0; i + 3 < p.length; i += 2) {
                const ax = p[i] / 2, ay = p[i + 1] / 2, bx = p[i + 2] / 2, by = p[i + 3] / 2, d = Math.hypot(bx - ax, by - ay); if (!d) continue;
                const ux = (bx - ax) / d, uy = (by - ay) / d;
                for (let s = 0; s < d; s += 1) {
                    const x = ax + ux * s, y = ay + uy * s, a = Math.floor(rec + s);
                    if (v.k <= 3 && a % 8 < 4 && cls[((y | 0) + PAD) * M + (x | 0) + PAD] === VIA + v.k) punto(x, y, v.k <= 1 ? C.linea : C.blanca);
                    if (calle && urbano && a % 15 === 7) { const lado = (Math.floor(a / 15) & 1 ? 1 : -1) * (ANCHO[v.k] / 2 + 1), fx = Math.round(x - uy * lado), fy = Math.round(y + ux * lado); if (fx >= 0 && fy >= 0 && fx < N && fy < N) faroles.push(fx, fy); }
                }
                rec += d; largo += d;
            }
            // Los códigos de nomenclatura (Oe6F, S37E…) se dejan fuera: solo ensucian.
            if (v.nombre && v.k !== 8 && v.k !== 9 && v.k < 12 && !/^[A-Za-z]{1,2}\d+[A-Za-z]?$/.test(v.nombre.replace(/^(Calle|Pasaje) /, ''))) {
                const m = (p.length >> 2) << 1, x = p[m], y = p[m + 1];
                if (x >= 0 && y >= 0 && x < G.T && y < G.T) {
                    const prev = vistos.get(v.nombre);
                    if (!prev || prev.largo < largo) vistos.set(v.nombre, { t: v.nombre, x: ox + x, y: oy + y, vert: Math.abs(p[p.length - 1] - p[1]) > Math.abs(p[p.length - 2] - p[0]), k: v.k, largo });
                }
            }
        });
        vistos.forEach((v) => nombres.push(v));

        // Luces: faroles, ventanas, y balizas rojas en lo más alto.
        const brillo = (x, y, r, g2, b, a) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const o = (y * N + x) * 4; if (luz[o + 3] < a) { luz[o] = r; luz[o + 1] = g2; luz[o + 2] = b; luz[o + 3] = a; } };
        for (let i = 0; i < faroles.length; i += 2) {
            const x = faroles[i], y = faroles[i + 1];
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) brillo(x + dx, y + dy, 255, 217, 138, Math.abs(dx) + Math.abs(dy) <= 1 ? 130 : Math.abs(dx) + Math.abs(dy) <= 3 ? 56 : 0);
            brillo(x, y, 255, 243, 200, 255);
        }
        const balizas = [];
        for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
            const g = (y + PAD) * M + x + PAD, id = bid[g]; if (!id) { if (cls[g] === 10 && rnd(wx0 + x, wy0 + y) > 0.6) brillo(x, y, 255, 232, 180, 46); continue; }
            if (bid[g - 1] !== id || bid[g + 1] !== id || bid[g - M] !== id || bid[g + M] !== id) continue;
            const n = rnd(wx0 + x + 31, wy0 + y + 17), h = alto[id];
            if (n > (h >= 7 ? 0.82 : 0.955)) brillo(x, y, n > 0.99 ? 190 : 255, n > 0.99 ? 224 : 205, n > 0.99 ? 255 : 130, 190);
            if (h >= 12 && bid[g - M - 1] !== id && bid[g - M - M] !== id) balizas.push(ox + x * 2, oy + y * 2, h * 3.2);
        }
        return { px: rgba, lz: luz, alto: alto8, mur: mur8, gente, nombres, balizas };
    };

    // ───────────────────────── Ciudad: 8 m por píxel ─────────────────────────
    const PC = 8, MC = N + PC * 2;
    const clsC = new Uint8Array(MC * MC), bidC = new Uint16Array(MC * MC);
    const ANCHO_C = [2, 2, 2, 1.5, 1, 1, 0, 1, 0, 0, 0, 1, 2, 1];

    /** El bloque (bx, by), de 2 km de lado. Necesita sus 16 teselas cargadas. */
    P.ciudad = (bx, by) => {
        const NB = G.NB, ts = [];
        for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) { const t = Q.datos.tesela(bx * NB + i, by * NB + j); if (!t) return null; ts.push([t, i, j]); }
        const ox = G.X0 + bx * NB * G.T, oy = G.Y0 + by * NB * G.T;
        M = MH = MC; cls = clsC; bid = bidC; cls.fill(0); bid.fill(0);
        const esc = 1 / 8;
        const zona = centroEn(ox, oy, ox + 2048, oy + 2048), viejoEn = zona === -1 ? enCentro : zona === 1 ? () => true : () => false, vacios = G.hayVacios(ox, oy, ox + 2048, oy + 2048);
        const cada = (fn) => ts.forEach(([t, i, j]) => fn(t, PC + i * G.T / 8, PC + j * G.T / 8));
        cada((t, dx, dy) => t.a.forEach((a) => poli(a.r, esc, dx, dy, a.k === 2 ? 100 + a.sub : a.k)));
        const altoC = [0];
        cada((t, dx, dy) => t.e.forEach((e) => {
            altoC.push(e.pisos);
            const id = Math.min(65535, altoC.length - 1);
            // Una casa mide uno o dos píxeles a esta escala: si el relleno no acierta ninguno, se marca su esquina.
            if (!poli(e.r, esc, dx, dy, EDIF, id)) { const p = e.r[0], x = Math.floor(p[0] * esc + dx), y = Math.floor(p[1] * esc + dy); if (x >= 0 && y >= 0 && x < M && y < M) { cls[y * M + x] = EDIF; bid[y * M + x] = id; } }
        }));
        ORDEN.forEach((k) => { if (ANCHO_C[k]) cada((t, dx, dy) => t.v.forEach((v) => { if (v.k === k && !v.tunel) trazo(v.p, esc, dx, dy, ANCHO_C[k], VIA + k); })); });

        const PASO = 8, NG = N / PASO + 3, hs = G.alturas(ox - PASO * 8, oy - PASO * 8, PASO * 8, NG);
        const rgba = new Uint8ClampedArray(N * N * 4), luz = new Uint8ClampedArray(N * N * 4), alto8 = new Uint8Array(N * N), mur8 = new Uint8Array(N * N), wx0 = bx * N, wy0 = by * N;
        const agujas = new Map();     // los hitos altos caben en un píxel: se anotan para pintarlos encima
        HITOS.forEach((h) => { if (h.r || h.alto < 25) return; const x = Math.floor(((h.x0 + h.x1) / 2 - ox) / 8), y = Math.floor(((h.y0 + h.y1) / 2 - oy) / 8); if (x >= 0 && y >= 0 && x < N && y < N) agujas.set(y * N + x, h); });
        for (let y = 0; y < N; y++) {
            const gy = y / PASO + 1, jy = gy | 0, fy = gy - jy;
            for (let x = 0; x < N; x++) {
                const g = (y + PC) * M + x + PC, wx = wx0 + x, wy = wy0 + y, n = rnd(wx + 7, wy + 3), k3 = n > 0.66 ? 2 : n > 0.33 ? 1 : 0;
                const gx = x / PASO + 1, ix = gx | 0, fx = gx - ix, q = jy * NG + ix, mx = ox + x * 8, my = oy + y * 8, o = y * N + x;
                let c = cls[g], r, gg, b, plano = true, h = 0;
                // Manzanas sin casas dibujadas: el mismo relleno genérico que en el detalle, a ojo.
                if (c === 0 && vacios && n > 0.3 && G.sinCasas(mx, my) && !viejoEn(mx, my)) { c = EDIF; h = 1 + (n > 0.7 ? 1 : 0); } else if (c === EDIF) h = altoC[bid[g]] || (viejoEn(mx, my) ? 2 : 1 + (n > 0.6 ? 1 : 0));
                if (c === EDIF) {
                    const viejo = viejoEn(mx, my), s = rnd(wx, wy);
                    const col = h >= 7 ? TORRE[k3] : viejo ? TEJA[Math.floor(n * 8)] : n < 0.62 ? LOSA[Math.floor(s * 10)] : n < 0.8 ? TEJA[Math.floor(s * 8)] : n < 0.92 ? PINTADO[k3] : LATA[k3];
                    const f = cls[g + M] !== EDIF || cls[g + 1] !== EDIF ? 0.8 : 1;
                    r = col[0] * f; gg = col[1] * f; b = col[2] * f;
                    alto8[o] = Math.min(255, Math.round(h * 3.2)); mur8[o] = h >= 7 ? 14 + Math.floor(s * 5) : viejo ? 1 + Math.floor(s * 6) : 7 + Math.floor(s * 7);
                    if (n > (h >= 7 ? 0.5 : 0.86)) { luz[o * 4] = 255; luz[o * 4 + 1] = n > 0.97 ? 236 : 205; luz[o * 4 + 2] = n > 0.97 ? 255 : 130; luz[o * 4 + 3] = 200; }
                } else if (c >= VIA && c < EDIF) {
                    const k = c - VIA, col = k === 7 ? C.peatonal[0] : k === 12 ? C.rio[k3] : k === 13 ? C.quebrada : k <= 3 ? C.via[1] : viejoEn(mx, my) ? C.adoquin[1] : C.via[6];
                    r = col[0]; gg = col[1]; b = col[2]; plano = k < 12;
                    if (k <= 4 && n > 0.72) { luz[o * 4] = 255; luz[o * 4 + 1] = 217; luz[o * 4 + 2] = 138; luz[o * 4 + 3] = 220; }
                } else if (c >= 100) { const col = (CANCHA[c - 100] || CANCHA[0])[0]; r = col[0]; gg = col[1]; b = col[2]; }
                else if (c === 8) { const col = CULTIVO[Math.floor(rnd(Math.floor(mx / 38), Math.floor(my / 30)) * 7)]; r = col[0]; gg = col[1]; b = col[2]; plano = false; }
                else if (c > 0) { const col = (AREA[c] || AREA[5])[n > 0.75 ? 1 : n < 0.2 ? 2 : 0]; r = col[0]; gg = col[1]; b = col[2]; plano = c === 10 || c >= 13; if (c === 6 && n > 0.5) { r = 40; gg = 98; b = 54; } if (c === 6) { alto8[o] = 9; mur8[o] = 21; } }
                else if (G.urbano(mx, my) + (n - 0.5) * 0.3 > 0.2) { const col = viejoEn(mx, my) ? C.patio[k3] : C.suelo[k3]; r = col[0]; gg = col[1]; b = col[2]; }
                else {
                    const z = (hs[q] * (1 - fx) + hs[q + 1] * fx) * (1 - fy) + (hs[q + NG] * (1 - fx) + hs[q + NG + 1] * fx) * fy;
                    terreno(z, wx * 4, wy * 4, n, tmp); r = tmp[0]; gg = tmp[1]; b = tmp[2]; plano = false;
                }
                const dzx = ((hs[q + 1] - hs[q]) * (1 - fy) + (hs[q + NG + 1] - hs[q + NG]) * fy) / (PASO * 8);
                const dzy = ((hs[q + NG] - hs[q]) * (1 - fx) + (hs[q + NG + 1] - hs[q + 1]) * fx) / (PASO * 8);
                let l = luzDe(dzx, dzy, n); if (plano) l = 1 + (l - 1) * 0.45;
                rgba[o * 4] = r * l; rgba[o * 4 + 1] = gg * l; rgba[o * 4 + 2] = b * l; rgba[o * 4 + 3] = 255;
            }
        }
        agujas.forEach((h, o) => { rgba[o * 4] = h.col[0]; rgba[o * 4 + 1] = h.col[1]; rgba[o * 4 + 2] = h.col[2]; alto8[o] = Math.min(255, h.alto); mur8[o] = h.muro; });
        return { px: rgba, lz: luz, alto: alto8, mur: mur8 };
    };

    // ───────────────────────── Región: 32 m por píxel ─────────────────────────
    /** Todo el mundo de una vez. También sirve de minimapa y de relleno mientras cargan los datos. */
    P.region = () => {
        const E = 32, w = Math.round(G.ANCHO / E), h = Math.round(G.ALTO / E), d = G.dens;
        const rgba = new Uint8ClampedArray(w * h * 4), luz = new Uint8ClampedArray(w * h * 4);
        const lado = w, NG = w + 2, hs = G.rejilla(G.X0 - E, G.Y0 - E, E, w + 2, h + 2);
        M = w; MH = h; cls = new Uint8Array(w * h); bid = new Uint16Array(1);
        G.areas.forEach((a) => poli(a.r, 1 / E, -G.X0 / E, -G.Y0 / E, a.k));
        const ANCHO_R = { 0: 2, 1: 2, 2: 1, 3: 1, 12: 1 };
        [12, 3, 2, 1, 0].forEach((k) => G.vias.forEach((v) => { if (v.k === k && v.largo >= 150) trazo(v.p, 1 / E, -G.X0 / E, -G.Y0 / E, ANCHO_R[k], VIA + k); }));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const n = rnd(x + 11, y + 5), k3 = n > 0.66 ? 2 : n > 0.33 ? 1 : 0, c = cls[y * lado + x], mx = G.X0 + x * E, my = G.Y0 + y * E;
            const q = (y + 1) * NG + x + 1, z = hs[q], v = d.d[y * d.w + x] || 0, calles = (v >> 2) / 3, casas = Math.max((v & 3) / 3, calles > 0.3 ? 0.5 : 0);
            let r, gg, b, plano = true;
            const o = (y * w + x) * 4;
            if (c >= VIA) { const k = c - VIA, col = k === 12 ? C.rio[0] : k <= 1 ? C.via[0] : C.via[5]; r = col[0]; gg = col[1]; b = col[2]; if (k < 12 && (calles > 0 || n > 0.6)) { luz[o] = 255; luz[o + 1] = 217; luz[o + 2] = 138; luz[o + 3] = 230; } }
            else if (c === 11) { const col = AREA[11][k3 & 1]; r = col[0]; gg = col[1]; b = col[2]; }
            else if (casas > 0 && c !== 1 && c !== 6 && n < 0.25 + casas * 0.75) {
                const viejo = enCentro(mx, my), col = viejo ? TEJA[Math.floor(n * 31) % 8] : n * 7 % 1 < 0.64 ? LOSA[Math.floor(n * 53) % 10] : n * 7 % 1 < 0.84 ? TEJA[Math.floor(n * 31) % 8] : PINTADO[k3];
                r = col[0]; gg = col[1]; b = col[2];
                if (n * 13 % 1 > 0.55) { luz[o] = 255; luz[o + 1] = 205; luz[o + 2] = 130; luz[o + 3] = 170 + casas * 80; }
            } else if (c > 0 && c !== 8) { const col = (AREA[c] || AREA[5])[n > 0.75 ? 1 : n < 0.2 ? 2 : 0]; r = col[0]; gg = col[1]; b = col[2]; plano = c === 10; if (c === 6 && n > 0.45) { r = 40; gg = 98; b = 54; } }
            else if (calles > 0 && n < 0.3 + calles * 0.6) { const col = calles > 0.5 ? C.suelo[k3] : C.tierra[k3 & 1]; r = col[0]; gg = col[1]; b = col[2]; }
            else if (c === 8) { const col = CULTIVO[Math.floor(rnd(x >> 1, y >> 1) * 7)]; r = col[0]; gg = col[1]; b = col[2]; plano = false; }
            else { terreno(z, x * 16, y * 16, n, tmp); r = tmp[0]; gg = tmp[1]; b = tmp[2]; plano = false; }
            let l = luzDe((hs[q + 1] - hs[q - 1]) / (2 * E), (hs[q + NG] - hs[q - NG]) / (2 * E), n); if (plano) l = 1 + (l - 1) * 0.55;
            rgba[o] = r * l; rgba[o + 1] = gg * l; rgba[o + 2] = b * l; rgba[o + 3] = 255;
        }
        // En teselas de 256, como las demás escalas, para la vista inclinada.
        const nulo = new Uint8Array(N * N), teselas = new Map();
        for (let ty = 0; ty * N < h; ty++) for (let tx = 0; tx * N < w; tx++) {
            const px = new Uint8ClampedArray(N * N * 4), lz = new Uint8ClampedArray(N * N * 4);
            for (let y = 0; y < N && ty * N + y < h; y++) { const a = ((ty * N + y) * w + tx * N) * 4, len = Math.min(N, w - tx * N) * 4; px.set(rgba.subarray(a, a + len), y * N * 4); lz.set(luz.subarray(a, a + len), y * N * 4); }
            teselas.set(tx + '_' + ty, { px, lz, alto: nulo, mur: nulo });
        }
        return { cv: P.lienzo(rgba, w, h), luz: P.lienzo(luz, w, h), w, h, escala: E, teselas };
    };

    // ───────────────────────── Vista inclinada ─────────────────────────
    // El mismo mapa, mirado en ángulo desde el suroriente: el suelo se encoge a
    // lo alto y todo lo que tiene altura (cerros, edificios, árboles) se levanta.
    // Es una proyección paralela, así que las medidas siguen valiendo en toda la
    // pantalla: a lo ancho, un píxel mide lo mismo que en el mapa.
    const CY = 0.5, CZ = 0.87, ZREF = 2800;      // la cámara mira desde 30° sobre el horizonte
    P.INCL = { CY, CZ, ZREF, S0: Math.floor((G.Y0 * CY - (4900 - ZREF) * CZ) / 8192) * 8192, S1: G.Y1 * CY - (1600 - ZREF) * CZ };
    /** Qué tan abajo en la pantalla (en metros) cae un punto del mundo. */
    P.caer = (y, z) => y * CY - (z - ZREF) * CZ;
    /** Lo contrario: qué punto del suelo se ve en esa columna y a esa altura de pantalla. */
    P.subir = (x, s) => {
        let y = Math.min(G.Y1, (s + (4850 - ZREF) * CZ) / CY), paso = 24;
        const tope = (s + (1500 - ZREF) * CZ) / CY - 100;
        while (y > tope && P.caer(y, G.altura(x, y)) > s) y -= paso;        // de cerca hacia lejos, hasta tocar el suelo
        for (let i = 0; i < 5; i++) { paso /= 2; y += P.caer(y, G.altura(x, y)) > s ? -paso : paso; }
        return y;
    };

    /**
     * Arma la tesela inclinada (i, j) a `m` metros por píxel. `fuente(tx, ty)`
     * entrega la tesela del mapa plano a esa misma escala: undefined si todavía
     * no está lista, false si ahí no hay nada. Cada columna se recorre de cerca
     * hacia lejos, y solo se pinta lo que asoma por encima de lo ya pintado.
     */
    P.oblicua = (m, i, j, fuente) => {
        const lado = N * m, x0 = G.X0 + i * lado, s0 = P.INCL.S0 + j * lado, s1 = s0 + lado;
        // Entre qué alturas está el terreno que puede caer en esta tesela.
        let zlo = 1500, zhi = 4850;
        for (let vuelta = 0; vuelta < 3; vuelta++) {
            const ya = (s0 + (zlo - ZREF) * CZ) / CY, yb = (s1 + (zhi - ZREF) * CZ) / CY; let lo = 1e9, hi = -1e9;
            for (let y = ya; y <= yb + 1; y += Math.max(40, (yb - ya) / 24)) for (let x = x0; x <= x0 + lado; x += lado / 6) { const z = G.altura(x, y); if (z < lo) lo = z; if (z > hi) hi = z; }
            zlo = lo - 40; zhi = hi + 40;
        }
        const kA = Math.floor(((s0 + (zlo - ZREF) * CZ) / CY - G.Y0) / m) - 2, kB = Math.ceil(((s1 + (zhi + 210 - ZREF) * CZ) / CY - G.Y0) / m) + 2;
        const fuentes = [], ty0 = Math.floor(kA / N);
        for (let ty = ty0; ty <= Math.floor(kB / N); ty++) { const f = fuente(i, ty); if (f === undefined) return null; fuentes.push(f || null); }

        const rgba = new Uint8ClampedArray(N * N * 4), luz = new Uint8ClampedArray(N * N * 4), piso = new Uint8Array(N * N);
        const kz = CZ / m, PASOZ = 4;
        for (let c = 0; c < N; c++) {
            const x = x0 + (c + 0.5) * m, sem0 = Math.round(x / m);
            let ybuf = N, za = 0, zb = G.altura(x, G.Y0 + (kB + 0.5) * m), kzb = kB;
            for (let k = kB; k >= kA && ybuf > 0; k--) {
                // La altitud se toma cada cuatro pasos y se interpola: el relieve es suave.
                if (k === kzb) { za = zb; kzb = k - PASOZ; zb = G.altura(x, G.Y0 + (kzb + 0.5) * m); }
                const z = zb + (za - zb) * (k - kzb) / PASOZ, y = G.Y0 + (k + 0.5) * m;
                const f = fuentes[Math.floor(k / N) - ty0];
                const idx = f ? (((k % N) + N) % N) * N + c : 0, h = f ? f.alto[idx] : 0;
                const base = (y * CY - (z - ZREF) * CZ - s0) / m, r0 = Math.max(0, Math.round(base - h * kz));
                if (r0 >= ybuf) continue;
                const o4 = idx * 4;
                let r = 96, g = 120, b = 88;
                if (f) { r = f.px[o4]; g = f.px[o4 + 1]; b = f.px[o4 + 2]; }
                if (h > 0 && ybuf - r0 >= 2 && f.mur[idx] === 21) {
                    // Follaje: no tiene muro; la copa se oscurece hacia abajo.
                    for (let row = r0; row < ybuf; row++) { const o = (row * N + c) * 4, t = row === r0 ? 1 : 0.84; rgba[o] = r * t; rgba[o + 1] = g * t; rgba[o + 2] = b * t; rgba[o + 3] = 255; }
                } else if (h > 0 && ybuf - r0 >= 2) {
                    // Lo que asoma es un muro: el de este edificio, que mira hacia nosotros.
                    const mu = f.mur[idx] || 7, col = MURO[mu], vid = VIDRIO[mu], torre = mu >= 14 && mu <= 18, sem = sem0 + mu, simple = mu >= 19 || m > 2;
                    for (let row = r0 + 1; row < ybuf; row++) {
                        const sube = Math.round(base) - row, o = (row * N + c) * 4;       // píxeles sobre el suelo
                        let wr = col[0], wg = col[1], wb = col[2];
                        if (torre) {
                            if (sube % 2 === 1) { wr = vid[0]; wg = vid[1]; wb = vid[2]; if (rnd(sem * 5 + k, sube) > 0.45) { luz[o] = 255; luz[o + 1] = 226; luz[o + 2] = 160; luz[o + 3] = 215; } }
                            if (sem % 3 === 0) { wr *= 0.86; wg *= 0.86; wb *= 0.86; }
                        } else if (!simple && sube >= 1 && sube % 2 === 1 && row > r0 + 1 && sem % 2 === 0) { wr = vid[0]; wg = vid[1]; wb = vid[2]; if (rnd(sem * 3 + k, sube) > 0.6) { luz[o] = 255; luz[o + 1] = 205; luz[o + 2] = 130; luz[o + 3] = 215; } }
                        else if (mu === 19 && m <= 2 && sube >= 2 && row > r0 + 2 && sem % 4 === 0) { wr = vid[0]; wg = vid[1]; wb = vid[2]; }      // vanos altos y angostos, de iglesia
                        else if (row === r0 + 1) { wr *= 0.8; wg *= 0.8; wb *= 0.8; }                    // la sombra del alero
                        rgba[o] = wr * 0.94; rgba[o + 1] = wg * 0.94; rgba[o + 2] = wb * 0.94; rgba[o + 3] = 255;
                    }
                    const o = (r0 * N + c) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
                } else {
                    for (let row = r0; row < ybuf; row++) { const o = (row * N + c) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255; if (!h) piso[row * N + c] = 1; }
                    if (f && f.lz[o4 + 3]) { const o = (r0 * N + c) * 4; luz[o] = f.lz[o4]; luz[o + 1] = f.lz[o4 + 1]; luz[o + 2] = f.lz[o4 + 2]; luz[o + 3] = f.lz[o4 + 3]; }
                }
                ybuf = r0;
            }
        }
        return { cv: P.lienzo(rgba, N), luz: P.lienzo(luz, N), piso };
    };
})();
