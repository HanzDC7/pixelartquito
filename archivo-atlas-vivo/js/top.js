'use strict';

/*
 * Quito visto desde arriba, como un mapa vivo.
 *
 * El norte queda a la derecha (igual que en la vista lateral): el Pichincha
 * arriba, al occidente; los valles abajo, al oriente. La ciudad no está a
 * escala —Quito mide unos 40 km de largo y 5 de ancho—, pero los lugares
 * guardan su orden y su posición relativa.
 *
 * Cuadro fijo para retocar: arriba.html#shot&x=300&y=90&h=21&w=rain&f=1&t=6&names=1
 */
(() => {
    const { R, hash, pick, disc, line, clamp, lerp, W, H } = Q;
    const S = Q.state, $ = (sel) => document.querySelector(sel);
    const MW = 1400, MH = 460, CITY_N = 1290, MITAD_X = 1314;
    const MAXX = MW - W, MAXY = MH - H;
    Object.assign(S, { cam: 250, camY: 70, names: false, metro: true, camVY: 0 });

    const base = Q.canvas(MW, MH), g = base.g, glow = Q.canvas(MW, MH), lg = glow.g;
    const wbA = new Float32Array(MW), ebA = new Float32Array(MW);
    for (let x = 0; x < MW; x++) {
        wbA[x] = 92 + Math.sin(x * 0.013) * 8 + Math.sin(x * 0.05 + 1) * 4;     // borde occidental: donde empieza el cerro
        ebA[x] = 388 + Math.sin(x * 0.011 + 2) * 14 + Math.sin(x * 0.04) * 5;   // borde oriental: donde la ciudad cae al valle
    }
    const wb = (x) => wbA[clamp(Math.round(x), 0, MW - 1)], eb = (x) => ebA[clamp(Math.round(x), 0, MW - 1)];

    const SH = 'rgba(8,10,24,.32)';
    const shade = (x, y, w, h, k = 1) => { g.fillStyle = SH; g.fillRect(Math.round(x) + k, Math.round(y) + k, w, h); };
    /** Sombra de algo alto: se alarga hacia abajo a la derecha sin repintar píxeles. */
    const tall = (x, y, w, h, len) => { g.fillStyle = SH; for (let k = 1; k <= len; k++) { g.fillRect(x + k, y + h + k - 1, w, 1); g.fillRect(x + w + k - 1, y + k, 1, h - 1); } };
    const ellipse = (ctx, cx, cy, rx, ry, color) => { for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); R(ctx, cx - hw, cy + dy, hw * 2 + 1, 1, color); } };
    const treeTop = (x, y, r = 2, pink = false) => {
        ellipse(g, Math.round(x + 2), Math.round(y + 3), r + 1, r, '#395540');
        disc(g, x, y, r, pink ? '#AD6287' : '#315E42');
        disc(g, x - 1, y - 1, Math.max(1, r - 1), pink ? '#DC96B1' : '#648F57');
        R(g, x - 1, y - 2, 1, 1, pink ? '#F5C9CE' : '#9EAF70');
        R(g, x + 1, y + 1, 1, 1, pink ? '#C07D9A' : '#477547');
    };

    const lamps = [], floods = [], marks = [], people = [], reserved = [];
    const reserve = (x, y, w, h, m = 3) => reserved.push([x - m, y - m, w + m * 2, h + m * 2]);
    const isReserved = (x, y) => reserved.some((r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]);
    const rectMark = (id, x, y, w, h) => marks.push({ id, x, y, w, h, cx: x + w / 2, cy: y + h / 2, test: (px, py) => px >= x && px <= x + w && py >= y && py <= y + h });
    const circleMark = (id, cx, cy, r) => marks.push({ id, x: cx - r, y: cy - r, w: r * 2, h: r * 2, cx, cy, test: (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r });
    /** Gente que pasea dentro de un rectángulo. */
    const crowd = (n, x, y, w, h) => { for (let i = 0; i < n; i++) people.push({ box: [x, y, w, h], x: x + Math.random() * w, y: y + Math.random() * h, a: Math.random() * 7, c: pick(['#D62828', '#1F4FA3', '#F2C200', '#F4F1E8', '#8B5CF6', '#FF8A3D', '#2A2A2E', '#2FA36B'], Math.random() * 99) }); };

    // ───────────────────────── Terreno ─────────────────────────
    const terrain = () => {
        const img = g.createImageData(MW, MH), d = img.data, P = (list) => list.map(Q.hex);
        const forest = P(['#2F5E34', '#386B39', '#427840']), paramo = P(['#7F8444', '#8E9150', '#9A9C5A']), rock = P(['#6F6B78', '#85818C', '#9B97A3']);
        const east = P(['#447C40', '#4E8A48', '#5B9A52']), dry = P(['#B5A678', '#C2B284', '#CDBD90']);
        const cobble = P(['#77736C', '#7E7A73', '#716D66']), asphalt = P(['#43464E', '#474A52', '#4C4F58']), south = P(['#57554F', '#5C5A54', '#52504B']);

        for (let y = 0; y < MH; y++) {
            for (let x = 0; x < MW; x++) {
                const n = Q.noise(x * 0.13, y * 0.14) * 0.8 + hash(x * 12.9898 + y * 78.233) * 0.2, k = n > 0.58 ? 2 : n > 0.42 ? 1 : 0, w = wbA[x], e = ebA[x];
                let c;
                if (x >= MITAD_X) {
                    c = dry[k]; if (hash(x * 3.1 + y * 9.7) > 0.985) c = [122, 138, 84];   // matorral seco
                } else if (x >= CITY_N) {
                    c = [20, 24, 40];
                } else if (y < w) {
                    // Cuanto más arriba en el mapa, más alto en el cerro: bosque, páramo y roca.
                    const alt = (w - y) / w + 0.3 * Math.exp(-(((x - 520) / 110) ** 2)) + 0.24 * Math.exp(-(((x - 770) / 90) ** 2)) - 0.12 + (n - 0.5) * 0.14 + Math.sin(x * 0.06 + y * 0.09) * 0.04;
                    c = (alt > 0.8 ? rock : alt > 0.5 ? paramo : forest)[k];
                    const ravine = Math.abs(Math.sin(x * 0.045 + Math.sin(y * 0.07) * 1.3));
                    if (ravine < 0.07 && alt < 0.82) c = c.map((v) => v * 0.7);            // quebradas
                    else if (ravine > 0.55 && ravine < 0.75) c = c.map((v) => Math.min(255, v * 1.07));
                } else if (y > e) {
                    c = east[k];
                    const river = e + 36 + Math.sin(x * 0.025) * 12;
                    if (x < 560 && Math.abs(y - river) < 2) c = [94, 127, 143];             // río Machángara
                    else if (x < 560 && Math.abs(y - river) < 5) c = [52, 96, 54];
                    else if (hash(x * 0.37 + y * 1.9) > 0.93) c = [47, 111, 62];
                } else {
                    c = (x < 240 ? south : x < 545 ? cobble : asphalt)[k];
                }
                const i = (y * MW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
            }
        }
        g.putImageData(img, 0, 0);
    };

    // ───────────────────────── Manzanas ─────────────────────────
    const TILE = ['#B5532F', '#A44A2A', '#C2633A', '#9A4A2C', '#BF5B36', '#AD5230'];
    const FLAT = ['#C9CED8', '#B9BDC6', '#D8DCE2', '#A7B0BE', '#E2E5EA', '#BFC7CF'];
    const patios = [];

    const tiled = (x, y, w, h, seed) => {
        const c = pick(TILE, seed);
        shade(x, y, w, h); R(g, x, y, w, h, c);
        R(g, x, y, w, 1, Q.mix(c, '#FFFFFF', 0.25)); R(g, x, y, 1, h, Q.mix(c, '#FFFFFF', 0.18));
        R(g, x + w - 1, y, 1, h, Q.mix(c, '#000000', 0.25)); R(g, x, y + h - 1, w, 1, Q.mix(c, '#000000', 0.25));
        // Hiladas de teja con cumbrera, limatesas y variación del barro.
        for (let yy = 2; yy < h - 1; yy += 2) {
            for (let xx = 1; xx < w - 1; xx += 2) R(g, x + xx, y + yy, 1, 1, Q.mix(c, hash(seed + xx + yy * 5) > 0.5 ? '#E2A775' : '#693F32', 0.3));
        }
        line(g, x + 1, y + 1, x + Math.floor(w / 2), y + Math.floor(h / 2), '#DA9162');
        if (w >= 8 && h >= 8 && hash(seed + 11) > 0.28) {   // el patio interior de la casa colonial
            R(g, x + 3, y + 3, w - 6, h - 6, '#B0A38C'); R(g, x + 3, y + 3, w - 6, 1, '#534D44');
            R(g, x + 3, y + 3, 1, h - 6, '#756953');
            if (hash(seed + 2) > 0.45) R(g, x + Math.floor(w / 2), y + Math.floor(h / 2), 1, 1, '#4F8A48');
            patios.push([x + 3, y + 3, w - 6, h - 6, seed]);
        } else {
            R(g, x + 1, y + Math.floor(h / 2), w - 2, 1, '#DB9666');
            if (w > 6) { shade(x + w - 4, y + 2, 2, 2); R(g, x + w - 4, y + 2, 2, 2, '#D3BB97'); }
        }
    };
    const flat = (x, y, w, h, seed, height = 0) => {
        const c = pick(FLAT, seed);
        if (height) tall(x, y, w, h, height); else shade(x, y, w, h);
        if (height) {
            const depth = Math.max(2, Math.round(height * 0.65));
            // Dos fachadas bajo la azotea: volumen en perspectiva oblicua.
            for (let d = depth; d > 0; d--) {
                R(g, x + d, y + h + d - 1, w, 1, '#637D89');
                R(g, x + w + d - 1, y + d, 1, h, '#415C6B');
            }
            for (let d = 2; d < depth; d += 2) {
                for (let dx = 2; dx < w - 1; dx += 3) R(g, x + dx + d, y + h + d - 1, 1, 1, '#AEC7CB');
                for (let dy = 2; dy < h - 1; dy += 3) R(g, x + w + d - 1, y + dy + d, 1, 1, '#819FAC');
            }
        }
        R(g, x, y, w, h, Q.mix(c, '#000000', 0.25)); R(g, x + 1, y + 1, w - 2, h - 2, height ? Q.mix(c, '#FFFFFF', 0.25) : c);
        if (height) { R(g, x, y, w, 1, '#7FB3E0'); R(g, x, y, 1, h, '#9DD1E8'); }                    // el vidrio de la fachada asoma en dos bordes
        if (w > 7 && h > 7) { R(g, x + 3, y + 3, 2, 2, '#8A8F9C'); if (hash(seed + 4) > 0.5) R(g, x + w - 5, y + h - 4, 3, 2, '#9AA0AC'); }
        if (w > 9 && h > 9) {
            // Tanque de agua, paneles y conductos sobre las terrazas.
            R(g, x + w - 4, y + 3, 2, 3, '#657475'); R(g, x + w - 4, y + 3, 2, 1, '#9EA9A2');
            if (hash(seed + 8) > 0.45) {
                R(g, x + 2, y + h - 5, 5, 3, '#405E70'); R(g, x + 2, y + h - 5, 5, 1, '#83A4AD');
                R(g, x + 4, y + h - 4, 1, 2, '#ACBBC0');
            }
            R(g, x + 3, y + 6, w - 6, 1, '#A3A9A5');
        }
        if (height > 6) { disc(g, x + Math.floor(w / 2), y + Math.floor(h / 2), 3, '#6E717C'); R(g, x + Math.floor(w / 2) - 1, y + Math.floor(h / 2), 3, 1, '#F2C200'); beacons.push([x + 1, y + 1]); }
        if (hash(seed + 6) > 0.55) patios.push([x + 2, y + 2, 2, 2, seed + 9]);
    };
    const beacons = [];

    const blocks = () => {
        let x = 4;
        while (x < CITY_N - 12) {
            const zone = x < 240 ? 0 : x < 545 ? 1 : 2;
            const bw = [24, 19, 30][zone], bh = [20, 19, 26][zone], st = [3, 3, 4][zone];
            let y = Math.ceil(Math.max(wb(x), wb(x + bw)) + 9);
            const end = Math.min(eb(x), eb(x + bw)) - 5;
            while (y + bh < end) {
                const seed = x * 7.13 + y * 13.7;
                if (!isReserved(x + bw / 2, y + bh / 2)) {
                    if (zone === 2 && hash(seed + 5) > 0.74) {
                        R(g, x, y, bw, bh, '#8E929C');
                        flat(x + 5, y + 4, bw - 10, bh - 8, seed, 4 + Math.floor(hash(seed + 8) * 7));
                    } else {
                        const nx = 2, ny = 2, lw = Math.floor((bw - 1) / nx), lh = Math.floor((bh - 1) / ny);
                        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
                            const s2 = seed + i * 3.3 + j * 5.7, lx = x + i * (lw + 1), ly = y + j * (lh + 1);
                            const inset = hash(s2 + 17) > 0.66 ? 2 : 0;
                            if (inset) { R(g, lx, ly, lw, lh, '#8B897A'); R(g, lx + lw - 1, ly + 2, 1, lh - 4, '#56784C'); }
                            if (zone === 1 || (zone === 0 && hash(s2) > 0.4)) tiled(lx, ly, lw - inset, lh, s2);
                            else flat(lx, ly, lw - inset, lh, s2);
                        }
                    }
                }
                lamps.push([x - 2, y - 2]);
                y += bh + st;
            }
            x += bw + st;
        }
    };

    // ───────────────────────── Calles principales ─────────────────────────
    const AV = [
        { name: 'AV. 10 DE AGOSTO', y: 212, x0: 0, x1: CITY_N, w: 7, kinds: ['trole', 'car', 'taxi', 'car', 'bus', 'trole', 'taxi', 'car'] },
        { name: 'AV. AMAZONAS', y: 252, x0: 703, x1: 1062, w: 5, kinds: ['car', 'taxi', 'car'] },
        { name: 'AV. 6 DE DICIEMBRE', y: 330, x0: 548, x1: CITY_N, w: 7, kinds: ['eco', 'car', 'taxi', 'bus', 'car', 'eco'] },
    ];
    const CROSS = [{ name: '24 DE MAYO', x: 266 }, { name: 'AV. PATRIA', x: 700 }, { name: 'AV. COLON', x: 792 }, { name: 'NACIONES UNIDAS', x: 978 }];

    const roads = () => {
        for (let x = 0; x < CITY_N; x++) { R(g, x, wbA[x] + 2, 1, 5, '#33363E'); R(g, x, wbA[x] + 1, 1, 1, '#7C7870'); if (x % 9 < 4) R(g, x, wbA[x] + 4, 1, 1, '#C9C9B0'); }   // Av. Mariscal Sucre, la Occidental
        CROSS.forEach((c) => {
            c.y0 = Math.round(wb(c.x)) + 7; c.y1 = Math.round(eb(c.x)) - 3;
            R(g, c.x - 3, c.y0, 6, c.y1 - c.y0, '#33363E'); R(g, c.x - 4, c.y0, 1, c.y1 - c.y0, '#8A857A'); R(g, c.x + 3, c.y0, 1, c.y1 - c.y0, '#8A857A');
            for (let y = c.y0; y < c.y1; y += 8) R(g, c.x, y, 1, 4, '#C9C9B0');
        });
        AV.forEach((a) => {
            const h = Math.floor(a.w / 2), len = a.x1 - a.x0;
            R(g, a.x0, a.y - h, len, a.w, '#33363E'); R(g, a.x0, a.y - h - 1, len, 1, '#8A857A'); R(g, a.x0, a.y + h + 1, len, 1, '#8A857A');
            for (let x = a.x0; x < a.x1; x += 8) R(g, x, a.y, 4, 1, a.w > 5 ? '#F2C200' : '#C9C9B0');
            for (let x = a.x0 + 6; x < a.x1; x += 15) { lamps.push([x, a.y - h - 2], [x + 7, a.y + h + 2]); if (x > 545 && hash(x) > 0.35) treeTop(x + 3, a.y - h - 3, 1); }
        });
        CROSS.forEach((c) => { for (let y = c.y0 + 5; y < c.y1; y += 16) lamps.push([c.x - 5, y], [c.x + 4, y + 8]); });
        CROSS.forEach((c) => AV.forEach((a) => {
            if (c.x <= a.x0 || c.x >= a.x1) return;
            const edge = Math.ceil(a.w / 2);
            for (let k = -2; k <= 2; k += 2) {
                R(g, c.x + k, a.y - edge - 4, 1, 3, '#DDD6BF'); R(g, c.x + k, a.y + edge + 2, 1, 3, '#DDD6BF');
                R(g, c.x - 7, a.y + k, 3, 1, '#DDD6BF'); R(g, c.x + 4, a.y + k, 3, 1, '#DDD6BF');
            }
            R(g, c.x - 5, a.y - edge - 1, 1, 2, '#2D4B41'); R(g, c.x + 4, a.y + edge, 1, 2, '#AC6650');
        }));
        AV.forEach((a) => {
            for (let x = a.x0 + 45; x < a.x1 - 20; x += 118) {
                const y = a.y - Math.ceil(a.w / 2) - 4;
                shade(x, y, 9, 3); R(g, x, y, 9, 3, '#73959A'); R(g, x, y, 9, 1, '#CAD5CA');
                R(g, x + 1, y + 2, 7, 1, '#485D61');
                R(g, x + 13, a.y + 1, 2, 1, '#252E32');
            }
        });
    };

    // ───────────────────────── Lugares ─────────────────────────
    const hill = (cx, cy, r, c1, c2) => {
        for (let rr = r; rr > 0; rr -= 1) disc(g, Math.round(cx - (r - rr) * 0.14), Math.round(cy - (r - rr) * 0.14), rr, Q.mix(c1, c2, 1 - rr / r));
        for (let rr = r - 6; rr > 8; rr -= 9) for (let a = 0; a < 6.28; a += 0.5 / rr) if (hash(a * rr) > 0.35) R(g, cx - (r - rr) * 0.14 + Math.cos(a) * rr, cy - (r - rr) * 0.14 + Math.sin(a) * rr, 1, 1, Q.mix(c1, '#000000', 0.18));   // curvas de nivel
    };

    const panecillo = () => {
        const cx = 190, cy = 262, r = 44;
        reserve(cx - r, cy - r, r * 2, r * 2, 0);
        hill(cx, cy, r, '#3F7A40', '#6FA862');
        for (let i = 0; i < 80; i++) { const a = hash(i) * 6.28, d = 29 + hash(i + 0.4) * 13, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; shade(x, y, 3, 3); R(g, x, y, 3, 3, pick(TILE, i)); R(g, x, y, 3, 1, '#D07A4E'); }
        for (let a = 0; a < 6.28; a += 0.03) R(g, cx - 3 + Math.cos(a) * 19, cy - 3 + Math.sin(a) * 19, 1, 1, '#9A958E');        // la vía que sube en anillo
        line(g, cx - 3 - 19, cy - 3, cx - r + 2, cy + 8, '#9A958E');
        disc(g, cx - 5, cy - 5, 8, '#C9C3B6');
        tall(cx - 7, cy - 7, 5, 5, 13);
        R(g, cx - 7, cy - 7, 5, 5, '#D9D4C7'); R(g, cx - 6, cy - 6, 3, 3, '#C9D2DE'); R(g, cx - 9, cy - 5, 9, 1, '#E8ECF2'); R(g, cx - 5, cy - 8, 1, 1, '#FFE9A8');   // la Virgen: las alas se ven desde arriba
        circleMark('panecillo', cx - 5, cy - 5, 15); floods.push([cx - 13, cy - 13, 18, 18]);
    };

    const sanFrancisco = () => {
        reserve(292, 104, 60, 90);
        R(g, 296, 150, 54, 42, '#CFC8B8');
        for (let i = 0; i < 160; i++) R(g, 296 + hash(i) * 54, 150 + hash(i + 0.5) * 42, 2, 1, hash(i + 0.2) > 0.5 ? '#C2BBAA' : '#D9D3C4');
        // Convento: cuatro claustros con su jardín.
        shade(292, 104, 60, 46, 2); R(g, 292, 104, 60, 46, '#B5532F');
        [[296, 108], [316, 108], [336, 108], [296, 128]].forEach(([x, y]) => { R(g, x, y, 13, 13, '#9A4A2C'); R(g, x + 2, y + 2, 9, 9, '#5E8A52'); R(g, x + 6, y + 6, 1, 1, '#BFE3F0'); });
        for (let x = 292; x < 352; x += 4) R(g, x, 104, 1, 46, '#A44A2A');
        R(g, 314, 128, 34, 20, '#C2633A'); R(g, 314, 137, 34, 1, '#D98458');                       // la nave de la iglesia
        R(g, 292, 149, 60, 2, '#A9A39A'); for (let a = 0; a < 3.14; a += 0.08) R(g, 331 + Math.cos(a) * 8, 151 + Math.sin(a) * 4, 1, 1, '#8E877A');   // atrio y escalinata redonda
        [[318, 143], [338, 143]].forEach(([x, y]) => { tall(x, y, 6, 6, 9); R(g, x, y, 6, 6, '#F4F1E8'); R(g, x + 1, y + 1, 4, 4, '#D9D4C6'); R(g, x + 2, y + 2, 2, 2, '#3A3A40'); });
        [[306, 176, '#E0314F'], [338, 182, '#F2C200'], [320, 168, '#3B82F6']].forEach(([x, y, c]) => { shade(x - 2, y - 2, 5, 5); disc(g, x, y, 2, c); R(g, x, y, 1, 1, '#FFFFFF'); });   // parasoles de vendedores
        rectMark('sanfrancisco', 292, 104, 60, 90); crowd(9, 298, 156, 50, 34); floods.push([296, 140, 54, 52]);
    };

    const centro = () => {
        reserve(360, 128, 104, 78);
        // La Compañía: piedra gris y cúpulas verdes.
        shade(362, 160, 24, 22, 2); R(g, 362, 160, 24, 22, '#8E8A86'); R(g, 362, 160, 24, 1, '#A9A59F'); R(g, 362, 170, 24, 1, '#77736F');
        [[374, 171, 5], [381, 165, 2], [367, 165, 2]].forEach(([x, y, r]) => { disc(g, x, y, r, '#3E8E5A'); R(g, x, y, 1, 1, '#E3C24A'); if (r > 3) for (let a = 0; a < 6.28; a += 0.8) R(g, x + Math.cos(a) * 3, y + Math.sin(a) * 3, 1, 1, '#E3C24A'); });
        rectMark('compania', 362, 160, 24, 22);

        // Plaza Grande: jardines en cruz y el monumento al centro.
        const px = 404, py = 150, s = 40, cx = px + 20, cy = py + 20;
        R(g, px, py, s, s, '#D6CFC0');
        [[px + 3, py + 3], [px + 22, py + 3], [px + 3, py + 22], [px + 22, py + 22]].forEach(([x, y]) => { R(g, x, y, 15, 15, '#5E9A55'); R(g, x + 1, y + 1, 13, 13, '#6FAE62'); });
        line(g, px + 3, py + 3, px + s - 4, py + s - 4, '#D6CFC0'); line(g, px + s - 4, py + 3, px + 3, py + s - 4, '#D6CFC0');
        disc(g, cx, cy, 6, '#D6CFC0'); disc(g, cx, cy, 3, '#B9B2A3');
        tall(cx - 1, cy - 1, 3, 3, 10); R(g, cx - 1, cy - 1, 3, 3, '#F4F1E8'); R(g, cx, cy, 1, 1, '#7A5B2E');
        [[px + 5, py + 5], [px + 34, py + 5], [px + 5, py + 34], [px + 34, py + 34], [px + 10, py + 29], [px + 29, py + 10]].forEach(([x, y], i) => treeTop(x, y, 2, i === 4));
        [[px + 11, cy], [px + 29, cy]].forEach(([x, y]) => { disc(g, x, y, 2, '#C9C3B6'); R(g, x, y, 1, 1, '#7FB3E0'); });
        rectMark('plaza', px, py, s, s); crowd(12, px + 2, py + 2, s - 4, s - 4); floods.push([px, py, s, s]);

        // Carondelet, al occidente de la plaza.
        shade(402, 130, 44, 18, 2); R(g, 402, 130, 44, 18, '#B5532F'); R(g, 402, 130, 44, 1, '#D07A4E');
        [[407, 134], [431, 134]].forEach(([x, y]) => { R(g, x, y, 10, 8, '#58534D'); R(g, x + 4, y + 3, 2, 2, '#4F8A48'); });
        R(g, 402, 146, 44, 2, '#F4F1E8'); for (let x = 403; x < 446; x += 3) R(g, x, 147, 1, 1, '#B9B2A3');   // la columnata
        rectMark('carondelet', 402, 130, 44, 18);

        // Catedral, al sur (izquierda) de la plaza.
        shade(386, 150, 16, 40, 2); R(g, 386, 150, 16, 40, '#C2633A'); R(g, 393, 150, 1, 40, '#D98458');
        disc(g, 394, 160, 3, '#4E9A6A'); disc(g, 394, 176, 2, '#4E9A6A');
        tall(388, 183, 6, 6, 8); R(g, 388, 183, 6, 6, '#F4F1E8'); disc(g, 390, 185, 2, '#4E9A6A');
        rectMark('catedral', 386, 150, 16, 40);

        shade(446, 150, 14, 40); R(g, 446, 150, 14, 40, '#A44A2A'); R(g, 450, 156, 6, 10, '#58534D'); R(g, 450, 174, 6, 10, '#58534D');   // Palacio Arzobispal
        flat(404, 192, 40, 12, 3.3);                                                                                                // Municipio
        floods.push([362, 158, 100, 50]);
    };

    const basilica = () => {
        reserve(484, 108, 60, 38);
        R(g, 484, 108, 60, 38, '#A9A39A');
        const slate = '#4A5560', ridge = '#6B7885';
        tall(492, 121, 46, 11, 8); tall(516, 113, 9, 27, 8);
        R(g, 492, 121, 46, 11, slate); R(g, 492, 126, 46, 1, ridge);        // nave
        R(g, 516, 113, 9, 27, slate); R(g, 520, 113, 1, 27, ridge);         // crucero: la planta es una cruz
        disc(g, 538, 126, 5, slate); disc(g, 538, 126, 2, ridge);            // ábside
        for (let x = 494; x < 536; x += 5) { R(g, x, 120, 1, 1, '#C9CED8'); R(g, x, 132, 1, 1, '#C9CED8'); }   // contrafuertes
        [[486, 118], [486, 128]].forEach(([x, y]) => { tall(x, y, 7, 7, 17); R(g, x, y, 7, 7, '#8C8F99'); R(g, x + 1, y + 1, 5, 5, '#3F4A52'); R(g, x + 3, y + 3, 1, 1, '#C9CED8'); });   // torres de 115 m: sombra larga
        tall(540, 123, 5, 5, 13); R(g, 540, 123, 5, 5, '#8C8F99'); R(g, 541, 124, 3, 3, '#3F4A52');
        rectMark('basilica', 484, 108, 60, 38); floods.push([484, 108, 60, 38]);
    };

    const park = (x, y, w, h, trees, seed) => {
        reserve(x, y, w, h);
        R(g, x - 1, y - 1, w + 2, h + 2, '#B8B2A6'); R(g, x, y, w, h, '#5E9A55');
        for (let i = 0; i < w * h / 26; i++) R(g, x + hash(seed + i) * w, y + hash(seed + i + 0.5) * h, 2, 1, hash(seed + i + 0.2) > 0.5 ? '#6FAE62' : '#528C4B');
        for (let i = 0; i < trees; i++) treeTop(x + 3 + hash(seed + i * 1.7) * (w - 6), y + 3 + hash(seed + i * 2.9) * (h - 6), 2 + (i % 3 === 0 ? 1 : 0), i % 6 === 2);
        // Sendero perimetral y bancas, con jardines junto a las entradas.
        R(g, x + 3, y + 4, w - 6, 2, '#C0B99A'); R(g, x + 3, y + h - 6, w - 6, 2, '#C0B99A');
        R(g, x + 3, y + 4, 2, h - 8, '#C0B99A'); R(g, x + w - 5, y + 4, 2, h - 8, '#C0B99A');
        for (let dx = 11; dx < w - 9; dx += 19) {
            shade(x + dx, y + 8, 4, 1); R(g, x + dx, y + 8, 4, 1, '#8B6B46');
            R(g, x + dx, y + h - 9, 4, 1, '#8B6B46');
            R(g, x + dx, y + h - 12, 4, 2, '#3D7544');
            R(g, x + dx + 1, y + h - 12, 1, 1, '#DFA38D'); R(g, x + dx + 3, y + h - 11, 1, 1, '#E5CC8E');
        }
    };

    const parques = () => {
        // La Alameda: laguna y observatorio.
        park(552, 262, 52, 56, 26, 11);
        ellipse(g, 590, 302, 8, 5, '#5FA8D6'); R(g, 587, 300, 4, 1, '#9DD1E8'); shade(566, 276, 7, 7); disc(g, 569, 279, 3, '#F4F1E8'); disc(g, 569, 279, 1, '#B9BDC6');
        crowd(6, 556, 266, 44, 48);

        // El Ejido, con sus senderos en diagonal.
        park(626, 220, 68, 102, 60, 23);
        line(g, 626, 220, 694, 322, '#D6CFC0'); line(g, 694, 220, 626, 322, '#D6CFC0'); line(g, 660, 220, 660, 322, '#D6CFC0');
        R(g, 688, 266, 5, 9, '#D9D4C6'); R(g, 689, 269, 3, 3, '#3A3A40');                                    // el arco de la Circasiana
        R(g, 640, 300, 16, 4, '#4E8A48'); [641, 644, 647, 650, 653].forEach((fx, i) => R(g, fx, 301, 2, 2, pick(['#E0314F', '#FF8A3D', '#F06292', '#F2C200'], i)));
        Q.garden = { x: 648, y: 300 };
        crowd(14, 630, 224, 60, 94);

        // Casa de la Cultura: el edificio ovalado de espejos.
        reserve(712, 300, 30, 24); tall(714, 303, 26, 18, 4); ellipse(g, 727, 312, 13, 9, '#7FA6B8'); ellipse(g, 727, 312, 9, 6, '#B9BDC6'); ellipse(g, 727, 312, 5, 3, '#8A8F9C');

        // La Carolina.
        park(830, 262, 130, 60, 70, 37);
        ellipse(g, 866, 290, 16, 10, '#5FA8D6'); ellipse(g, 864, 288, 10, 5, '#7FC0E6');
        [[900, 270, '#C2633A'], [900, 284, '#2A6FD6'], [918, 270, '#4E9A55']].forEach(([x, y, c]) => { R(g, x, y, 14, 10, c); R(g, x, y, 14, 1, '#F4F1E8'); R(g, x, y + 9, 14, 1, '#F4F1E8'); R(g, x, y, 1, 10, '#F4F1E8'); R(g, x + 13, y, 1, 10, '#F4F1E8'); R(g, x + 7, y, 1, 10, '#F4F1E8'); });   // canchas
        R(g, 934, 298, 20, 16, '#BFE3F0'); for (let i = 0; i < 4; i++) R(g, 934 + i * 5, 298, 1, 16, '#7FA6B8'); R(g, 934, 306, 20, 1, '#7FA6B8');   // jardín botánico
        for (let a = 0; a < 6.28; a += 0.02) R(g, 895 + Math.cos(a) * 60, 292 + Math.sin(a) * 26, 1, 1, '#D6CFC0');                                  // la ciclovía
        rectMark('moderna', 830, 262, 130, 60); crowd(20, 834, 266, 122, 52);
        Q.lagoon = { x: 866, y: 290 };

        // Itchimbía, en el borde oriental.
        const cx = 500, cy = 420, r = 34;
        reserve(cx - r, cy - r, r * 2, r * 2, 0);
        hill(cx, cy, r, '#3F7A40', '#74AE66');
        tall(cx - 12, cy - 8, 16, 6, 3); R(g, cx - 12, cy - 8, 16, 6, '#BFE3F0'); R(g, cx - 7, cy - 13, 6, 16, '#BFE3F0'); disc(g, cx - 4, cy - 5, 3, '#E3F3F8');   // el Palacio de Cristal, en cruz
        R(g, cx - 12, cy - 5, 16, 1, '#7FA6B8'); R(g, cx - 4, cy - 13, 1, 16, '#7FA6B8');
        circleMark('itchimbia', cx - 4, cy - 5, 16); crowd(5, cx - 20, cy + 2, 30, 14);
    };

    const estadio = () => {
        const cx = 1015, cy = 359;
        reserve(cx - 28, cy - 22, 56, 44);
        ellipse(g, cx + 2, cy + 2, 27, 21, 'rgba(8,10,24,.35)'); ellipse(g, cx, cy, 27, 21, '#B9BDC6'); ellipse(g, cx, cy, 24, 18, '#9AA0AC');
        for (let a = 0; a < 6.28; a += 0.07) for (let k = 0; k < 3; k++) R(g, cx + Math.cos(a) * (18 + k * 2.4), cy + Math.sin(a) * (12.5 + k * 2.2), 1, 1, pick(['#F2C200', '#1F4FA3', '#D62828', '#F4F1E8', '#F2C200'], a * 9 + k));
        ellipse(g, cx, cy, 16, 11, '#8E5A3C');                                               // la pista atlética
        R(g, cx - 13, cy - 8, 26, 16, '#3F9A4A'); for (let i = 0; i < 6; i += 2) R(g, cx - 13 + i * 4 + 2, cy - 8, 4, 16, '#4BAA55');
        R(g, cx - 13, cy - 8, 26, 1, '#E8F3E8'); R(g, cx - 13, cy + 7, 26, 1, '#E8F3E8'); R(g, cx - 13, cy - 8, 1, 16, '#E8F3E8'); R(g, cx + 12, cy - 8, 1, 16, '#E8F3E8'); R(g, cx, cy - 8, 1, 16, '#E8F3E8');
        [[cx - 24, cy - 18], [cx + 22, cy - 18], [cx - 24, cy + 16], [cx + 22, cy + 16]].forEach(([x, y]) => { tall(x, y, 3, 3, 10); R(g, x, y, 3, 3, '#DADDE3'); lamps.push([x + 1, y + 1], [x, y], [x + 2, y + 2]); });
        Q.pitch = { x: cx - 12, y: cy - 7, w: 24, h: 14 };
        rectMark('estadio', cx - 28, cy - 22, 56, 44);
    };

    const bicentenario = () => {
        reserve(1070, 224, 202, 28);
        R(g, 1070, 224, 202, 28, '#5E9A55'); for (let i = 0; i < 150; i++) R(g, 1070 + hash(i + 70) * 202, 224 + hash(i + 71) * 28, 2, 1, '#6FAE62');
        R(g, 1078, 232, 186, 12, '#5A5D66'); R(g, 1078, 232, 186, 1, '#777B86'); R(g, 1078, 243, 186, 1, '#474A52');   // la vieja pista
        for (let x = 1094; x < 1250; x += 12) R(g, x, 238, 6, 1, '#E8E4DA');
        [1080, 1256].forEach((x) => { for (let i = 0; i < 4; i++) R(g, x, 234 + i * 2 + (i > 1 ? 1 : 0), 6, 1, '#E8E4DA'); });
        R(g, 1078, 228, 186, 1, '#2FA3A0');                                                                              // ciclovía
        for (let x = 1076; x < 1270; x += 11) treeTop(x, 248 + (x % 2), 1);
        flat(1100, 254, 30, 9, 5.5);                                                                                   // la antigua terminal
        rectMark('bicentenario', 1070, 224, 202, 28); crowd(16, 1080, 233, 180, 10);
    };

    const teleferico = () => {
        const x1 = 688, y1 = Math.round(wb(688)) - 3, x2 = 662, y2 = 16;
        Q.cable = { x1, y1, x2, y2 };
        line(g, x1, y1, x2, y2, '#D5DAE3');
        for (let i = 1; i < 5; i++) { const x = lerp(x1, x2, i / 5), y = lerp(y1, y2, i / 5); shade(x - 1, y - 1, 3, 3); R(g, x - 1, y - 1, 3, 3, '#8A8F9C'); }
        shade(x1 - 5, y1 - 2, 10, 7); R(g, x1 - 5, y1 - 2, 10, 7, '#E8E4DA'); R(g, x1 - 5, y1 - 2, 10, 2, '#B5532F');
        shade(x2 - 4, y2 - 3, 8, 6); R(g, x2 - 4, y2 - 3, 8, 6, '#E8E4DA'); R(g, x2 - 4, y2 - 3, 8, 2, '#B5532F');
        Q.antennas = [[674, 9], [680, 6], [686, 10]]; Q.antennas.forEach(([x, y]) => { tall(x, y, 1, 1, 5); R(g, x, y, 1, 1, '#C9CED8'); });
        for (let i = 0; i < 26; i += 2) R(g, x2 + 6 + i * 3, y2 - 4 - Math.sin(i * 0.3) * 4, 1, 1, '#C9B98F');   // el sendero al Rucu
        marks.push({ id: 'teleferico', x: x2 - 8, y: y2 - 8, w: x1 - x2 + 18, h: y1 - y2 + 14, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, test: (px, py) => { const u = clamp((py - y1) / (y2 - y1)); return Math.abs(px - lerp(x1, x2, u)) < 8 && py < y1 + 6 && py > y2 - 8; } });
    };

    const mitad = () => {
        const cx = 1352, cy = 230;
        R(g, CITY_N, 0, MITAD_X - CITY_N, MH, '#14182A');
        for (let y = 0; y < MH; y += 6) { line(g, CITY_N + 2, y, CITY_N + 6, y + 3, '#5E72A8'); line(g, CITY_N + 6, y + 3, CITY_N + 2, y + 6, '#5E72A8'); line(g, MITAD_X - 7, y, MITAD_X - 3, y + 3, '#5E72A8'); line(g, MITAD_X - 3, y + 3, MITAD_X - 7, y + 6, '#5E72A8'); }
        R(g, cx, 0, 1, MH, '#F2C200');                                                                    // la línea ecuatorial, de occidente a oriente
        R(g, MITAD_X, cy - 2, cx - MITAD_X - 14, 5, '#D8C9A3'); for (let x = MITAD_X + 3; x < cx - 16; x += 5) { R(g, x, cy - 4, 1, 1, '#8A8A8A'); R(g, x + 1, cy - 4, 2, 1, pick(['#F2C200', '#1F4FA3', '#D62828'], x)); }
        R(g, cx - 15, cy - 15, 31, 31, '#D8C9A3'); R(g, cx - 12, cy - 12, 25, 25, '#B9B2A3'); R(g, cx - 9, cy - 9, 19, 19, '#A9A294');
        R(g, cx, cy - 15, 1, 31, '#F2C200');
        tall(cx - 6, cy - 6, 13, 13, 15);
        R(g, cx - 6, cy - 6, 13, 13, '#8E877A'); R(g, cx - 4, cy - 4, 9, 9, '#A8A193'); disc(g, cx, cy, 3, '#C8A24A'); R(g, cx - 3, cy, 7, 1, '#8E6F2B'); R(g, cx - 1, cy - 2, 1, 1, '#F3E3A6');
        [[1326, 196], [1378, 204], [1372, 262], [1330, 270]].forEach(([x, y], i) => { shade(x, y, 9, 7); R(g, x, y, 9, 7, pick(TILE, i)); R(g, x, y, 9, 1, '#D07A4E'); });
        Q.text(g, 'LATITUD 0°', cx + 6, cy + 20, '#4A463E');
        rectMark('mitad', cx - 16, cy - 16, 33, 33); crowd(8, cx - 14, cy - 14, 28, 28); floods.push([cx - 15, cy - 15, 31, 31]);
    };

    // Metro: va bajo tierra, así que se dibuja como una línea punteada con sus estaciones.
    const METRO = [[0, 286], [120, 300], [322, 196], [400, 214], [578, 290], [660, 270], [728, 172], [806, 230], [892, 258], [990, 246], [1040, 240], [1074, 238]];
    const STATIONS = [[2, 'SAN FRANCISCO'], [4, 'LA ALAMEDA'], [5, 'EL EJIDO'], [6, 'U. CENTRAL'], [7, 'LA PRADERA'], [8, 'LA CAROLINA'], [9, 'INAQUITO'], [10, 'JIPIJAPA'], [11, 'EL LABRADOR']];
    const mLen = [0]; METRO.slice(1).forEach((p, i) => mLen.push(mLen[i] + Math.hypot(p[0] - METRO[i][0], p[1] - METRO[i][1])));
    const metroAt = (s) => { let i = 1; while (i < METRO.length - 1 && mLen[i] < s) i++; const t = clamp((s - mLen[i - 1]) / (mLen[i] - mLen[i - 1])); return [lerp(METRO[i - 1][0], METRO[i][0], t), lerp(METRO[i - 1][1], METRO[i][1], t)]; };
    STATIONS.forEach(([i]) => { const [x, y] = METRO[i]; marks.unshift({ id: 'metro', x: x - 5, y: y - 5, w: 10, h: 10, cx: x, cy: y, station: true, test: (px, py) => S.metro && Math.abs(px - x) < 6 && Math.abs(py - y) < 6 }); });

    const build = () => {
        terrain();
        panecillo(); sanFrancisco(); centro(); basilica(); parques(); estadio(); bicentenario();
        blocks(); roads(); teleferico(); mitad();
        marks.push({ id: 'pichincha', x: 380, y: 0, w: 520, h: 70, cx: 640, cy: 30, test: (px, py) => px < CITY_N && py < wb(px) - 2 });

        // Señal hacia el Cotopaxi, que queda fuera del mapa.
        R(g, 3, 438, 80, 13, '#0B1020'); R(g, 3, 438, 80, 1, '#5E72A8'); Q.text(g, 'COTOPAXI 50 KM', 15, 442, '#FFFFFF');
        [[5, 444, 1, 1], [6, 443, 1, 3], [7, 442, 1, 5], [8, 441, 4, 7]].forEach(([x, y, w, h]) => R(g, x, y, w, h, '#FFE500'));
        rectMark('cotopaxi', 3, 438, 80, 13);

        // Luces de la noche: faroles, patios encendidos y lugares iluminados.
        floods.forEach(([x, y, w, h]) => { lg.fillStyle = 'rgba(255,226,160,.2)'; lg.fillRect(x - 3, y - 3, w + 6, h + 6); lg.fillStyle = 'rgba(255,236,190,.22)'; lg.fillRect(x, y, w, h); });
        patios.forEach(([x, y, w, h, seed]) => { if (hash(seed + 1) < 0.4) { lg.fillStyle = hash(seed + 2) > 0.85 ? 'rgba(190,224,255,.7)' : 'rgba(255,205,130,.75)'; lg.fillRect(x, y, w, h); } });
        lamps.forEach(([x, y]) => { lg.fillStyle = 'rgba(255,217,138,.22)'; lg.fillRect(x - 2, y - 2, 5, 5); lg.fillStyle = 'rgba(255,225,160,.5)'; lg.fillRect(x - 1, y - 1, 3, 3); lg.fillStyle = '#FFF3C8'; lg.fillRect(x, y, 1, 1); });
        const p = Q.pitch; lg.fillStyle = 'rgba(220,255,220,.45)'; lg.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    };

    // ───────────────────────── Lo que se mueve ─────────────────────────
    const A = { cars: [], clouds: [], kites: [], rockets: [], sparks: [], ripples: [], flocks: [], rainF: 0, fogF: 0, bolt: 0, boltNext: 5, fiestaT: 0 };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const FW = [['#FFD23F', '#FF8A3D'], ['#FF5470', '#FFB3C1'], ['#7CC4FF', '#FFFFFF'], ['#3DDC84', '#D9FFE9'], ['#C792EA', '#FFFFFF'], ['#F2C200', '#1F4FA3', '#D62828']];

    const initActors = () => {
        AV.forEach((a, ai) => [1, -1].forEach((dir) => {
            const n = Math.round((a.x1 - a.x0) / 95);
            for (let i = 0; i < n; i++) A.cars.push({ a, dir, x: a.x0 + ((i + hash(ai * 9 + i + dir)) / n) * (a.x1 - a.x0), v: 26 + ai * 4, kind: pick(a.kinds, ai * 31 + i * 7 + dir), color: pick(['#D62828', '#F4F1E8', '#3A3A40', '#1F4FA3', '#8FA3B8'], i + ai) });
        }));
        CROSS.forEach((c, ci) => [1, -1].forEach((dir) => { for (let i = 0; i < 3; i++) A.cars.push({ c, dir, y: c.y0 + ((i + hash(ci + i * 3 + dir)) / 3) * (c.y1 - c.y0), v: 24, kind: i === 1 ? 'taxi' : 'car', color: pick(['#D62828', '#F4F1E8', '#3A3A40', '#8FA3B8'], i + ci * 2) }); }));
        for (let i = 0; i < 9; i++) A.cars.push({ occ: true, dir: i % 2 ? 1 : -1, x: i * 150 + hash(i) * 60, v: 34, kind: 'car', color: pick(['#F4F1E8', '#3A3A40', '#D62828'], i) });
        A.chivas = [0, 1].map((i) => ({ a: AV[i ? 2 : 0], dir: 1, x: 400 + i * 420, v: 16, kind: 'chiva' }));
        A.clouds = Array.from({ length: 8 }, (_, i) => ({ x: hash(i + 3) * MW, y: hash(i + 4) * MH, v: 5 + hash(i + 5) * 5, seed: i * 7.7 }));
        A.clouds.forEach((c) => {
            c.clear = Q.cloudSprite(c.seed); c.rain = Q.cloudSprite(c.seed, '#AAB8C2', '#637A8A'); c.night = Q.cloudSprite(c.seed, '#434C65', '#29384B');
            const shadow = Q.canvas(76,30); shadow.g.drawImage(c.clear,0,0); shadow.g.globalCompositeOperation='source-in'; R(shadow.g,0,0,76,30,'#172B32'); c.shadow=shadow.cv;
        });
        A.fog = Array.from({ length: 12 }, (_, i) => ({ x: hash(i + 13) * MW, y: hash(i + 14) * MH, v: 4 + hash(i + 15) * 5, r: 40 + hash(i + 16) * 50 }));
        A.flocks = [[424, 170], [322, 172]].map(([cx, cy], k) => ({ cx, cy, fly: 0, birds: Array.from({ length: 9 }, (_, i) => [rnd(-12, 12), rnd(-10, 10), i + k * 10]) }));
        A.boats = [0, 2.1, 4.2]; A.metro = { s: mLen[2], dir: 1, wait: 2, last: 2 };
        A.condor = 0; A.plane = { t: -1, wait: 6 }; A.bird = { x: 190, y: 110, vx: 0, vy: 0 };
        A.players = Array.from({ length: 12 }, (_, i) => ({ x: hash(i + 50), y: hash(i + 51), c: i < 6 ? '#F2C200' : '#F4F1E8' }));
        A.ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    };

    const scatter = (cx, cy) => A.flocks.forEach((f) => { if (Math.hypot(f.cx - cx, f.cy - cy) < 60 && f.fly <= 0) f.fly = 3.2; });

    const update = (dt) => {
        const t = S.time;
        A.rainF += clamp((S.weather === 'rain' ? 1 : 0) - A.rainF, -dt * 0.7, dt * 0.7);
        A.fogF += clamp((S.weather === 'fog' ? 1 : 0) - A.fogF, -dt * 0.5, dt * 0.5);

        [...A.cars, ...A.chivas].forEach((c) => {
            if (c.c) { c.y += c.v * c.dir * dt; if (c.y > c.c.y1) c.y = c.c.y0; if (c.y < c.c.y0) c.y = c.c.y1; return; }
            const x0 = c.a ? c.a.x0 : 0, x1 = c.a ? c.a.x1 : CITY_N;
            c.x += c.v * c.dir * dt; if (c.x > x1) c.x = x0; if (c.x < x0) c.x = x1;
        });
        people.forEach((p) => {
            if (Math.random() < dt * 0.5) p.a += rnd(-1.5, 1.5);
            p.x += Math.cos(p.a) * 5 * dt; p.y += Math.sin(p.a) * 5 * dt;
            const [bx, by, bw, bh] = p.box;
            if (p.x < bx || p.x > bx + bw || p.y < by || p.y > by + bh) { p.a += Math.PI; p.x = clamp(p.x, bx, bx + bw); p.y = clamp(p.y, by, by + bh); }
        });
        A.flocks.forEach((f) => { if (f.fly > 0) f.fly -= dt; });
        A.clouds.forEach((c) => { c.x += c.v * dt * (1 + A.rainF); c.y += c.v * 0.25 * dt; if (c.x > MW + 60) { c.x = -80; c.y = Math.random() * MH; } if (c.y > MH + 40) c.y = -40; });
        A.fog.forEach((f) => { f.x += f.v * dt; if (f.x > MW + f.r) f.x = -f.r; });

        const m = A.metro;
        if (m.wait > 0) m.wait -= dt;
        else {
            m.s += m.dir * 44 * dt;
            const st = STATIONS.find(([i]) => Math.abs(mLen[i] - m.s) < 1.3);
            if (st && st[0] !== m.last) { m.last = st[0]; m.wait = 2.2; }
            if (m.s >= mLen[METRO.length - 1]) { m.dir = -1; m.last = -1; } else if (m.s <= 0) { m.dir = 1; m.last = -1; }
        }

        const b = A.ball; if (Math.hypot(b.tx - b.x, b.ty - b.y) < 0.03) { b.tx = Math.random(); b.ty = Math.random(); }
        b.x += (b.tx - b.x) * dt * 1.4; b.y += (b.ty - b.y) * dt * 1.4;
        A.players.forEach((p, i) => { const pull = i % 6 < 3 ? 0.5 : 0.15; p.x += ((b.x - p.x) * pull + (hash(i + 50) - p.x) * 0.35) * dt; p.y += ((b.y - p.y) * pull + (hash(i + 51) - p.y) * 0.35) * dt; });

        if (S.fiestas) { A.fiestaT -= dt; if (A.fiestaT <= 0) { A.fiestaT = rnd(0.3, 0.8); firework(S.cam + rnd(20, W - 20), S.camY + rnd(20, H - 20)); } }
        A.rockets = A.rockets.filter((r) => {
            r.t += dt; if (r.t < 0.45) return true;
            const n = 40 + Math.floor(Math.random() * 20);
            for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, sp = i % 3 ? rnd(26, 40) : rnd(8, 20); A.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.8, 1.4), c: r.pal[i % r.pal.length] }); }
            Q.sfx.pop(); return false;
        });
        A.sparks = A.sparks.filter((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; return p.life > 0; });
        A.kites = A.kites.filter((k) => (k.t += dt) < 24);

        if (A.rainF > 0.02) {
            for (let i = 0; i < 9 * A.rainF; i++) A.ripples.push({ x: S.cam + Math.random() * W, y: S.camY + Math.random() * H, life: 0 });
            A.boltNext -= dt; if (A.boltNext <= 0 && S.weather === 'rain') { A.boltNext = rnd(5, 12); A.bolt = 0.35; Q.sfx.thunder(); }
        }
        A.ripples = A.ripples.filter((p) => (p.life += dt) < 0.45);
        if (A.bolt > 0) A.bolt -= dt;

        A.condor += dt * 0.25;
        const pl = A.plane; if (pl.wait > 0) { pl.wait -= dt; if (pl.wait <= 0) pl.t = 0; } else { pl.t += dt / 26; if (pl.t > 1) { pl.wait = rnd(25, 50); pl.t = -1; } }

        const bd = A.bird, called = S.mouse.inside && t - S.mouse.movedAt < 5;
        const tx = called ? S.mouse.x + S.cam + 7 : Q.garden.x + Math.sin(t * 1.3) * 6, ty = called ? S.mouse.y + S.camY - 5 : Q.garden.y - 4 + Math.sin(t * 2.1) * 3;
        bd.vx += ((tx - bd.x) * 22 - bd.vx * 7) * dt; bd.vy += ((ty - bd.y) * 22 - bd.vy * 7) * dt; bd.x += bd.vx * dt; bd.y += bd.vy * dt;
    };

    const firework = (x, y) => A.rockets.push({ x, y, t: 0, pal: FW[Math.floor(Math.random() * FW.length)] });
    const kite = (x, y) => { if (A.kites.length > 7) A.kites.shift(); A.kites.push({ x, y, t: 0, seed: Math.random() * 99, c: pick(['#D62828', '#F2C200', '#8B5CF6', '#FF8A3D', '#FFFFFF'], Math.random() * 99) }); };

    // ───────────────────────── Dibujo ─────────────────────────
    const view = $('#view'), v = view.getContext('2d'); v.imageSmoothingEnabled = false;
    const mini = Q.canvas(112, 37);
    const MINI = { x: W - 118, y: H - 43, w: 112, h: 37 };

    const carSprite = (c, heads) => {
        const vertical = !!c.c, d = c.dir;
        let x, y;
        if (vertical) { x = c.c.x - d * 2; y = c.y; } else if (c.occ) { x = c.x; y = wb(c.x) + 4 + d; } else { x = c.x; y = c.a.y + d * (c.a.w > 5 ? 2 : 1.5); }
        if (x < S.cam - 20 || x > S.cam + W + 20 || y < S.camY - 20 || y > S.camY + H + 20) return;
        const len = { car: 6, taxi: 6, bus: 10, trole: 15, eco: 13, chiva: 10 }[c.kind];
        const col = { taxi: '#F2C200', bus: '#2A6FD6', trole: '#2FA36B', eco: '#D62828', chiva: '#F2C200' }[c.kind] || c.color;
        const box = vertical ? [x - 1, y - len / 2, 3, len] : [x - len / 2, y - 1, len, 3];
        v.fillStyle = SH; v.fillRect(Math.round(box[0]) + 1, Math.round(box[1]) + 1, box[2], box[3]);
        R(v, box[0], box[1], box[2], box[3], col);
        if (vertical) { R(v, x, y - len / 2 + 1, 1, len - 2, Q.mix(col, '#FFFFFF', 0.35)); R(v, x - 1, d > 0 ? y + len / 2 - 2 : y - len / 2 + 1, 3, 1, '#22303F'); }
        else {
            R(v, x - len / 2 + 1, y, len - 2, 1, Q.mix(col, '#FFFFFF', 0.35)); R(v, d > 0 ? x + len / 2 - 2 : x - len / 2 + 1, y - 1, 1, 3, '#22303F');
            if (c.kind === 'trole' || c.kind === 'eco') R(v, x, y - 1, 1, 3, '#1F2A3A');
            if (c.kind === 'chiva') for (let i = 0; i < 4; i++) R(v, x - 4 + i * 2, y - 1, 1, 1, (Math.floor(S.time * 6) + i) % 2 ? '#D62828' : '#3DDC84');
            if (c.kind === 'trole') c.box = [box[0] - 2, box[1] - 3, len + 4, 9];
        }
        heads.push(vertical ? [x, y + d * (len / 2 + 1), 0, d] : [x + d * (len / 2 + 1), y, d, 0]);
    };

    const render = () => {
        const cam = Math.round(S.cam), camY = Math.round(S.camY), t = S.time, n = Q.night(S.hour), heads = [];
        v.drawImage(base.cv, -cam, -camY);
        v.save(); v.translate(-cam, -camY);

        // Agua, bandera y gente.
        const lag = Q.lagoon;
        for(let i=0;i<18;i++){const x=lag.x-12+hash(i)*24,y=lag.y-6+hash(i+31)*12;if(Math.sin(t*1.8+i)>0.5)R(v,x,y,2,1,'#99C8D3');}
        A.boats.forEach((ph, i) => { const a = t * 0.25 + ph, x = lag.x + Math.cos(a) * 10, y = lag.y + Math.sin(a) * 5; R(v, x - 1, y, 3, 2, ['#E0314F', '#F2C200', '#FFFFFF'][i]); R(v, x - 2 - Math.cos(a), y + 1, 1, 1, '#BFE3F0'); });
        [[415, 170], [433, 170]].forEach(([x, y], i) => R(v, x + (Math.floor(t * 5 + i) % 2 ? 1 : -1), y + (Math.floor(t * 3 + i) % 2 ? 1 : -1), 1, 1, '#E6F4FF'));
        const fw = Math.floor(t * 4) % 2; R(v, 424, 128 - fw, 4, 1, '#F2C200'); R(v, 424, 129 - fw, 4, 1, '#1F4FA3'); R(v, 424, 130 - fw, 4, 1, '#D62828'); R(v, 423, 127, 1, 5, '#8A8A8A');
        people.forEach((p) => { v.fillStyle = SH; v.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, 1, 1); R(v, p.x, p.y, 1, 1, A.rainF > 0.4 ? '#2A2A2E' : p.c); if (A.rainF > 0.4) R(v, p.x - 1, p.y - 1, 3, 1, p.c); });
        const pt = Q.pitch; A.players.forEach((p) => R(v, pt.x + p.x * pt.w, pt.y + p.y * pt.h, 1, 1, p.c)); R(v, pt.x + A.ball.x * pt.w, pt.y + A.ball.y * pt.h, 1, 1, '#FFFFFF');
        A.flocks.forEach((f) => f.birds.forEach(([dx, dy, s]) => {
            if (f.fly > 0) { const k = Math.sin(clamp(f.fly / 3.2) * Math.PI), a = s + f.fly * 2, x = f.cx + dx + Math.cos(a) * 26 * k, y = f.cy + dy + Math.sin(a) * 18 * k; v.fillStyle = SH; v.fillRect(Math.round(x + 4 * k), Math.round(y + 5 * k), 2, 1); R(v, x - 1, y, 3, 1, '#D5DAE3'); R(v, x, y - (Math.floor(t * 12 + s) % 2), 1, 1, '#FFFFFF'); }
            else R(v, f.cx + dx, f.cy + dy, 1, 1, '#8A8F9C');
        }));

        // Metro: línea, estaciones y tren.
        if (S.metro) {
            v.globalAlpha = 0.75;
            for (let s = 0; s < mLen[METRO.length - 1]; s += 4) { const [x, y] = metroAt(s); if (Math.floor(s / 4) % 2 === 0) R(v, x, y, 2, 2, '#E8ECF2'); }
            v.globalAlpha = 1;
            STATIONS.forEach(([i]) => { const [x, y] = METRO[i]; R(v, x - 3, y - 3, 7, 7, '#FFFFFF'); R(v, x - 2, y - 2, 5, 5, '#D62828'); R(v, x - 1, y - 1, 1, 3, '#FFFFFF'); R(v, x + 1, y - 1, 1, 3, '#FFFFFF'); R(v, x, y, 1, 1, '#FFFFFF'); });
            for (let k = 0; k < 3; k++) { const [x, y] = metroAt(clamp(A.metro.s - A.metro.dir * k * 6, 0, mLen[METRO.length - 1])); R(v, x - 2, y - 2, 5, 5, '#1F4FA3'); R(v, x - 1, y - 1, 3, 3, '#FFE9A8'); }
        }

        [...A.cars, ...(S.fiestas ? A.chivas : [])].forEach((c) => carSprite(c, heads));

        // Teleférico: cabinas con su sombra sobre el cerro.
        const cb = Q.cable; for (let i = 0; i < 4; i++) { const u0 = (t * 0.035 + i / 4) % 1, u = i % 2 ? u0 : 1 - u0, x = lerp(cb.x1, cb.x2, u) + (i % 2 ? 1 : -1), y = lerp(cb.y1, cb.y2, u); v.fillStyle = SH; v.fillRect(Math.round(x) + 2, Math.round(y) + 3, 3, 3); R(v, x - 1, y - 1, 3, 3, '#F4F1E8'); R(v, x - 1, y, 3, 1, '#D62828'); }

        A.kites.forEach((k) => {
            const x = k.x + Math.sin(k.t * 1.2 + k.seed) * 7, y = k.y + Math.cos(k.t * 0.9 + k.seed) * 5;
            v.globalAlpha = clamp((24 - k.t) / 3);
            v.fillStyle = SH; v.fillRect(Math.round(x) + 7, Math.round(y) + 9, 3, 3);
            line(v, x, y, k.x + 4, k.y + 16, '#E8E4DA'); R(v, x - 2, y, 5, 1, k.c); R(v, x, y - 2, 1, 5, k.c); R(v, x - 1, y - 1, 3, 3, k.c); R(v, x, y, 1, 1, '#FFFFFF');
            v.globalAlpha = 1;
        });

        // Sombras de lo que vuela: cuanto más alto, más lejos cae la sombra.
        const ca = A.condor, cx = 600 + Math.cos(ca) * 110, cy = 46 + Math.sin(ca) * 26, flap = Math.sin(t * 2.4) > 0.3;
        v.fillStyle = SH; v.fillRect(Math.round(cx) + 4, Math.round(cy) + 9, 7, 1);
        const pl = A.plane, px = lerp(-40, MW + 40, pl.t), py = lerp(400, 60, pl.t);
        if (pl.t >= 0) { v.fillStyle = 'rgba(8,10,24,.25)'; v.fillRect(Math.round(px) + 12, Math.round(py) + 26, 12, 3); v.fillRect(Math.round(px) + 16, Math.round(py) + 22, 3, 11); }
        v.globalAlpha = 0.19 + A.rainF * 0.1;
        A.clouds.forEach((c) => v.drawImage(c.shadow,Math.round(c.x)+18,Math.round(c.y)+24));
        v.globalAlpha = 1;
        v.restore();

        // La hora y el clima tiñen el mapa entero.
        const tint = (color, a) => { if (a > 0.01) { v.globalAlpha = a; R(v, 0, 0, W, H, color); v.globalAlpha = 1; } };
        tint('#FF7A2E', Q.dusk(S.hour) * 0.2 * (1 - A.rainF)); tint('#3C4558', A.rainF * 0.3); tint('#070B22', n * 0.7);

        v.save(); v.translate(-cam, -camY);
        if (n > 0.02) {
            v.globalAlpha = n; v.drawImage(glow.cv, 0, 0);
            heads.forEach(([x, y, dx, dy]) => { v.globalAlpha = n * 0.35; for (let i = 1; i < 6; i++) R(v, x + dx * i - (dy ? 1 : 0), y + dy * i - (dx ? 1 : 0), dy ? 3 : 1, dx ? 3 : 1, '#FFF3B0'); v.globalAlpha = n; R(v, x, y, 1, 1, '#FFFFFF'); });
            if (Math.floor(t * 1.5) % 2) { beacons.forEach(([x, y]) => R(v, x, y, 1, 1, '#FF3B3B')); Q.antennas.forEach(([x, y]) => R(v, x, y, 1, 1, '#FF3B3B')); }
            v.globalAlpha = 1;
        }

        // Nubes, cóndor y avión, por encima de todo.
        A.clouds.forEach((c) => {
            const x = Math.round(c.x), y = Math.round(c.y);
            if (x + 76 < cam || x > cam + W || y + 30 < camY || y > camY + H) return;
            v.globalAlpha = 0.6; v.drawImage(c.clear, x, y);
            if (A.rainF > 0.01) { v.globalAlpha = A.rainF * 0.75; v.drawImage(c.rain, x, y); }
            if (n > 0.01) { v.globalAlpha = n * 0.9; v.drawImage(c.night, x, y); }
        });
        v.globalAlpha = 1;
        R(v, cx, cy - 1, 1, 3, '#16161A'); R(v, cx, cy - 1, 1, 1, '#FFFFFF'); R(v, cx - 4, cy - (flap ? 1 : 0), 4, 1, '#16161A'); R(v, cx + 1, cy - (flap ? 1 : 0), 4, 1, '#16161A'); R(v, cx - 5, cy - (flap ? 2 : -1), 1, 1, '#16161A'); R(v, cx + 5, cy - (flap ? 2 : -1), 1, 1, '#16161A');
        if (pl.t >= 0) { R(v, px, py, 12, 3, '#E8ECF2'); R(v, px + 4, py - 4, 3, 11, '#D5DAE3'); R(v, px, py - 1, 2, 5, '#C9CED8'); R(v, px + 11, py + 1, 1, 1, '#9DD1E8'); if (n > 0.3 && Math.floor(t * 3) % 2) { R(v, px + 5, py - 4, 1, 1, '#FF3B3B'); R(v, px + 5, py + 6, 1, 1, '#3DDC84'); } }

        if (A.fogF > 0.02) { A.fog.forEach((f, i) => { v.globalAlpha = A.fogF * (0.16 + (i % 3) * 0.06); ellipse(v, Math.round(f.x), Math.round(f.y), Math.round(f.r), Math.round(f.r * 0.45), '#E6ECF4'); }); v.globalAlpha = 1; }
        A.ripples.forEach((p) => { const r = 1 + Math.floor(p.life * 7); v.globalAlpha = (1 - p.life / 0.45) * 0.7 * A.rainF; R(v, p.x - r, p.y, 1, 1, '#DCE8F7'); R(v, p.x + r, p.y, 1, 1, '#DCE8F7'); R(v, p.x, p.y - r, 1, 1, '#DCE8F7'); R(v, p.x, p.y + r, 1, 1, '#DCE8F7'); });
        v.globalAlpha = 1;

        A.rockets.forEach((r) => { const k = r.t / 0.45; v.globalAlpha = 0.9; R(v, r.x - 1, r.y - 1, 3, 3, '#FFE9A8'); v.globalAlpha = 0.4; R(v, r.x - 4 + k * 3, r.y - 4 + k * 3, 9 - k * 6, 9 - k * 6, '#FFF3B0'); });
        A.sparks.forEach((p) => { const s = p.life > 0.45 ? 2 : 1; v.globalAlpha = clamp(p.life * 1.6); R(v, p.x, p.y, s, s, p.c); });
        v.globalAlpha = 1;

        // Colibrí, visto desde arriba: las alas baten a los lados.
        const b = A.bird, bx = Math.round(b.x), by = Math.round(b.y), wing = Math.floor(t * 30) % 2;
        v.fillStyle = SH; v.fillRect(bx + 3, by + 5, 3, 2);
        R(v, bx - 1, by, 3, 2, '#1FA37A'); R(v, bx + 2, by, 1, 1, '#7C4DFF'); R(v, bx + 3, by, 2, 1, '#2A2A2E'); R(v, bx - 2, by + 1, 1, 1, '#0F6E55');
        v.globalAlpha = 0.75; R(v, bx, wing ? by - 2 : by - 1, 2, wing ? 2 : 1, '#D9FFF2'); R(v, bx, wing ? by + 2 : by + 2, 2, wing ? 2 : 1, '#D9FFF2'); v.globalAlpha = 1;
        v.restore();

        if (A.bolt > 0) { v.globalAlpha = (A.bolt / 0.35) * 0.5; R(v, 0, 0, W, H, '#EAF2FF'); v.globalAlpha = 1; }

        // Nombres: de las avenidas, de las estaciones y de los lugares.
        if (S.names) {
            AV.forEach((a) => { for (let x = a.x0 + 60; x < a.x1 - 60; x += 260) Q.text(v, a.name, x - cam, a.y - 9 - camY, '#FFFFFF'); });
            for (let x = 80; x < CITY_N; x += 320) Q.text(v, 'AV. MARISCAL SUCRE', x - cam, wb(x) - 5 - camY, '#FFFFFF');
            const seen = (x, y) => x - cam > 12 && x - cam < W - 12 && y - camY > 4 && y - camY < H - 8;
            if (S.metro) STATIONS.forEach(([i, name]) => { if (seen(METRO[i][0], METRO[i][1] + 6)) Q.label(v, name, METRO[i][0] - cam, METRO[i][1] + 6 - camY, '#FFFFFF', '#1E4FA3'); });
            marks.filter((m) => !m.station && m.id !== 'cotopaxi').forEach((m) => { const y = m.id === 'pichincha' ? 30 : Math.max(m.y - 9, camY + 6); if (seen(m.cx, y)) Q.label(v, plain(m.id), m.cx - cam, y - camY, '#FFE500'); });
            if (S.cam < 100 && S.camY > 150) Q.label(v, 'RIO MACHANGARA', 150 - cam, 440 - camY, '#BFE3F0');
        }
        if (S.fiestas) Q.label(v, 'QUE VIVA QUITO!', W / 2, 24 + Math.round(Math.sin(t * 3) * 2), pick(['#FFE500', '#FFFFFF', '#FF8A3D'], Math.floor(t * 3)), '#1F4FA3');

        const m = S.hover;
        if (m) {
            const [hx, hy, hw, hh] = m.car ? m.box : [m.x, m.y, m.w, m.h], x = Math.round(hx) - cam, y = Math.round(hy) - camY, c = '#FFE500';
            [[x, y, 1, 1], [x + hw - 1, y, -1, 1], [x, y + hh - 1, 1, -1], [x + hw - 1, y + hh - 1, -1, -1]].forEach(([px2, py2, dx, dy]) => { R(v, dx > 0 ? px2 : px2 - 3, py2, 4, 1, c); R(v, px2, dy > 0 ? py2 : py2 - 3, 1, 4, c); });
            const name = m.station ? 'METRO ' + STATIONS.find(([i]) => METRO[i][0] === m.cx)[1] : plain(m.id);
            if (!S.names || m.station || m.car) Q.label(v, name, x + hw / 2, y > 14 ? y - 10 : y + hh + 4, '#FFE500');
        }

        // Minimapa y rosa de los vientos (el norte apunta a la derecha).
        v.globalAlpha = 0.92; R(v, MINI.x - 2, MINI.y - 2, MINI.w + 4, MINI.h + 4, '#0B1020'); v.globalAlpha = 1;
        v.drawImage(mini.cv, MINI.x, MINI.y);
        if (n > 0.02) { v.globalAlpha = n * 0.55; R(v, MINI.x, MINI.y, MINI.w, MINI.h, '#070B22'); v.globalAlpha = 1; }
        const vx = MINI.x + S.cam / MW * MINI.w, vy = MINI.y + S.camY / MH * MINI.h, vw = Math.round(W / MW * MINI.w), vh = Math.round(H / MH * MINI.h);
        R(v, vx, vy, vw, 1, '#FF8A3D'); R(v, vx, vy + vh - 1, vw, 1, '#FF8A3D'); R(v, vx, vy, 1, vh, '#FF8A3D'); R(v, vx + vw - 1, vy, 1, vh, '#FF8A3D');
        v.globalAlpha = 0.85; R(v, 4, H - 17, 27, 13, '#0B1020'); v.globalAlpha = 1;
        Q.text(v, 'N', 7, H - 13, '#FFFFFF'); R(v, 15, H - 11, 9, 1, '#FFE500'); R(v, 24, H - 12, 1, 3, '#FFE500'); R(v, 25, H - 11, 1, 1, '#FFE500'); R(v, 22, H - 13, 2, 1, '#FFE500'); R(v, 22, H - 9, 2, 1, '#FFE500');
        Q.experience?.draw(v);
    };

    const plain = (id) => Q.INFO[id][0].toUpperCase().normalize('NFD').replace(/[^A-Z0-9 .·-]/g, '').replace('IGLESIA Y CONVENTO DE ', '').replace('IGLESIA DE ', '').replace(' Y LA VIRGEN DE QUITO', '').replace(' Y EL QUITO MODERNO', '');

    // ───────────────────────── Entrada ─────────────────────────
    const keys = {}, drag = { on: false };
    const TOUR = ['panecillo', 'sanfrancisco', 'plaza', 'basilica', 'teleferico', 'moderna', 'estadio', 'bicentenario', 'mitad'];
    let tourI = 0, tourWait = 0;
    const centerOn = (m) => { S.camTarget = [clamp(m.cx - W / 2, 0, MAXX), clamp(m.cy - H / 2, 0, MAXY)]; };

    const step = (dt) => {
        S.time += dt;
        if (S.playing) S.hour = (S.hour + dt * 0.08) % 24;
        const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
        if (kx || ky) { S.camV = kx * 170; S.camVY = ky * 170; S.camTarget = null; if (S.tour) { S.tour = false; syncButtons(); } }
        if (S.tour && !drag.on) {
            if (!S.camTarget) { tourWait -= dt; if (tourWait <= 0) { centerOn(marks.find((m) => m.id === TOUR[tourI % TOUR.length] && !m.station)); tourI++; tourWait = 3; } }
        }
        if (S.camTarget) {
            const [tx, ty] = S.camTarget, k = Math.min(1, dt * (S.tour ? 1.1 : 4));
            S.cam += (tx - S.cam) * k; S.camY += (ty - S.camY) * k;
            if (Math.abs(tx - S.cam) + Math.abs(ty - S.camY) < 1) S.camTarget = null;
        } else if (!drag.on) { S.cam += S.camV * dt; S.camY += S.camVY * dt; const f = Math.pow(0.02, dt); S.camV *= f; S.camVY *= f; }
        S.cam = clamp(S.cam, 0, MAXX); S.camY = clamp(S.camY, 0, MAXY);
        update(dt);
    };

    const toCanvas = (e) => { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    const inMini = (x, y) => x >= MINI.x - 2 && y >= MINI.y - 2;
    const pickAt = (x, y) => {
        if (inMini(x, y)) return null;
        const wx = x + S.cam, wy = y + S.camY;
        const car = A.cars.find((c) => c.kind === 'trole' && c.box && wx >= c.box[0] && wx <= c.box[0] + c.box[2] && wy >= c.box[1] && wy <= c.box[1] + c.box[3]);
        if (car) return { id: 'trole', car: true, box: car.box };
        return marks.find((m) => m.test(wx, wy)) || null;
    };

    const card = $('#card');
    const showCard = (id) => {
        Q.experience?.visit(id);
        const [title, sub, text] = Q.INFO[id];
        card.querySelector('h2').textContent = title; card.querySelector('.sub').textContent = sub; card.querySelector('.text').textContent = text;
        card.hidden = false;
        document.querySelectorAll('#places button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    };
    const click = (x, y) => {
        if (inMini(x, y)) { S.camTarget = [clamp((x - MINI.x) / MINI.w * MW - W / 2, 0, MAXX), clamp((y - MINI.y) / MINI.h * MH - H / 2, 0, MAXY)]; S.tour = false; syncButtons(); return; }
        const m = pickAt(x, y), wx = x + S.cam, wy = y + S.camY;
        if (m && m.id !== 'pichincha') {
            showCard(m.id);
            if (['sanfrancisco', 'compania', 'catedral', 'basilica'].includes(m.id)) Q.sfx.bell();
            if (m.id === 'plaza' || m.id === 'sanfrancisco') scatter(wx, wy);
            if (m.id === 'trole') Q.sfx.horn();
            return;
        }
        // Sobre el cerro o en cualquier punto libre: cometa de día, fuegos de noche.
        if (Q.night(S.hour) > 0.5 || S.fiestas) firework(wx, wy); else if (m) showCard('pichincha'); else kite(wx, wy);
        if (m && Q.night(S.hour) <= 0.5 && !S.fiestas) kite(wx, wy);
    };

    view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); Object.assign(drag, { on: true, x: e.clientX, y: e.clientY, cam: S.cam, camY: S.camY, moved: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() }); S.camV = S.camVY = 0; S.camTarget = null; });
    view.addEventListener('pointermove', (e) => {
        const [x, y] = toCanvas(e);
        Object.assign(S.mouse, { x, y, inside: true, movedAt: S.time });
        if (drag.on) {
            const sc = view.getBoundingClientRect().width / W, now = performance.now();
            drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y));
            S.cam = clamp(drag.cam - (e.clientX - drag.x) / sc, 0, MAXX); S.camY = clamp(drag.camY - (e.clientY - drag.y) / sc, 0, MAXY);
            if (now > drag.lt) { S.camV = -((e.clientX - drag.lx) / sc) / ((now - drag.lt) / 1000); S.camVY = -((e.clientY - drag.ly) / sc) / ((now - drag.lt) / 1000); }
            drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
            if (drag.moved > 5 && S.tour) { S.tour = false; syncButtons(); }
        }
        const dragging = drag.on && drag.moved > 5;
        S.hover = dragging ? null : pickAt(x, y);
        if (S.hover && S.hover.id === 'pichincha') S.hover = null;
        view.style.cursor = dragging ? 'grabbing' : S.hover || inMini(x, y) ? 'pointer' : 'grab';
    });
    view.addEventListener('pointerup', (e) => { if (!drag.on) return; drag.on = false; if (drag.moved <= 5) { S.camV = S.camVY = 0; click(...toCanvas(e)); } else if (performance.now() - drag.lt > 80) S.camV = S.camVY = 0; });
    view.addEventListener('pointercancel', () => { drag.on = false; });
    view.addEventListener('pointerleave', () => { S.mouse.inside = false; S.hover = null; });
    view.addEventListener('wheel', (e) => { e.preventDefault(); S.cam = clamp(S.cam + e.deltaX * 0.4 + (e.shiftKey ? e.deltaY * 0.4 : 0), 0, MAXX); if (!e.shiftKey) S.camY = clamp(S.camY + e.deltaY * 0.4, 0, MAXY); S.camTarget = null; }, { passive: false });
    addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement || Q.experience?.busy()) return;
        keys[e.key] = true; if (e.key.startsWith('Arrow')) e.preventDefault();
        const k = e.key.toLowerCase();
        if (k === 'n') setHour(Q.night(S.hour) > 0.5 ? 11 : 21);
        else if (k === 'r') setWeather({ clear: 'rain', rain: 'fog', fog: 'clear' }[S.weather]);
        else if (k === 'f') toggle('fiestas'); else if (k === 'm') toggle('metro'); else if (k === 't') toggle('names');
        else if (k === ' ') { e.preventDefault(); toggle('playing'); } else if (k === 'escape') card.hidden = true;
    });
    addEventListener('keyup', (e) => { keys[e.key] = false; });

    // ───────────────────────── Controles ─────────────────────────
    const hourInput = $('#hour'), clock = $('#clock');
    const setHour = (h) => { S.hour = ((h % 24) + 24) % 24; hourInput.value = S.hour; };
    const setWeather = (w) => { S.weather = w; document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === w)); Q.sfx.rain(w === 'rain'); };
    const BTN = { play: 'playing', fiestas: 'fiestas', tour: 'tour', sound: 'sound', names: 'names', metro: 'metro' };
    const syncButtons = () => { Object.entries(BTN).forEach(([id, key]) => { $('#' + id).classList.toggle('on', S[key]); $('#' + id).setAttribute('aria-pressed', S[key]); }); $('#play').textContent = S.playing ? 'Pausar el tiempo' : 'Seguir el tiempo'; };
    const toggle = (key) => { S[key] = !S[key]; if (key === 'sound') Q.sfx.enable(S.sound); if (key === 'tour') { S.camTarget = null; tourWait = 0; } syncButtons(); };
    Object.entries(BTN).forEach(([id, key]) => $('#' + id).addEventListener('click', () => toggle(key)));
    hourInput.addEventListener('input', () => { S.hour = parseFloat(hourInput.value) % 24; });
    document.querySelectorAll('[data-weather]').forEach((b) => b.addEventListener('click', () => setWeather(b.dataset.weather)));
    card.querySelector('button').addEventListener('click', () => { card.hidden = true; });

    const NAV = { panecillo: 'El Panecillo', sanfrancisco: 'San Francisco', compania: 'La Compañía', plaza: 'Plaza Grande', carondelet: 'Carondelet', basilica: 'Basílica', itchimbia: 'Itchimbía', teleferico: 'TelefériQo', moderna: 'La Carolina', estadio: 'Estadio', bicentenario: 'Bicentenario', mitad: 'Mitad del Mundo' };
    const PERIODS = [[5, 'madrugada'], [6.5, 'amanecer'], [12, 'mañana'], [17.7, 'tarde'], [19.2, 'atardecer'], [24, 'noche']];
    const syncClock = () => {
        const h = Math.floor(S.hour), mm = Math.floor((S.hour % 1) * 60);
        clock.querySelector('strong').textContent = String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        clock.querySelector('span').textContent = PERIODS.find(([until]) => S.hour < until)[1];
        if (document.activeElement !== hourInput) hourInput.value = S.hour;
    };

    // ───────────────────────── Arranque ─────────────────────────
    build(); initActors();
    mini.g.imageSmoothingEnabled = true; mini.g.drawImage(base.cv, 0, 0, MINI.w, MINI.h);
    Object.entries(NAV).forEach(([id, label]) => {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.id = id; b.textContent = label;
        b.addEventListener('click', () => { centerOn(marks.find((m) => m.id === id && !m.station)); S.tour = false; syncButtons(); showCard(id); });
        $('#places').appendChild(b);
    });
    Q.top = { marks, A, pickAt, render, step };
    Q.api = {
        mode: 'top', render, marks: () => marks.filter((m) => !m.station),
        overview: { canvas: base.cv, width: MW, height: MH,
            jump(x,y) { S.camTarget = [clamp(x-W/2,0,MAXX),clamp(y-H/2,0,MAXY)]; S.tour=false; S.camV=S.camVY=0; syncButtons(); } },
        project: (m) => [m.cx - Math.round(S.cam), m.cy - Math.round(S.camY)],
        focus(id, instant = false) {
            const m = marks.find((m) => m.id === id && !m.station);
            if (!m) return;
            centerOn(m); S.tour = false; S.camV = S.camVY = 0;
            if (instant) { [S.cam, S.camY] = S.camTarget; S.camTarget = null; }
            card.hidden = true; syncButtons();
        },
        atmosphere(hour, weather = 'clear') { setHour(hour); setWeather(weather); S.playing = false; syncButtons(); syncClock(); },
        sync() { syncButtons(); syncClock(); setWeather(S.weather); },
    };
    syncButtons();

    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has('shot')) {
        if (params.has('x')) S.cam = clamp(+params.get('x'), 0, MAXX);
        if (params.has('y')) S.camY = clamp(+params.get('y'), 0, MAXY);
        if (params.has('h')) S.hour = +params.get('h');
        if (params.has('w')) S.weather = params.get('w');
        S.fiestas = params.get('f') === '1'; S.names = params.get('names') === '1'; S.playing = false;
        if (params.has('mx')) Object.assign(S.mouse, { x: +params.get('mx'), y: +params.get('my'), inside: true, movedAt: 1e9 });
        for (let i = 0; i < (+params.get('t') || 3) * 30; i++) step(1 / 30);
        if (params.has('mx')) S.hover = pickAt(S.mouse.x, S.mouse.y);
        if (params.has('card')) showCard(params.get('card'));
        document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === S.weather));
        syncButtons(); syncClock(); render();
        return;
    }

    let last = performance.now(), clockT = 0;
    const frame = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); render(); if ((clockT += dt) > 0.2) { clockT = 0; syncClock(); } requestAnimationFrame(frame); };
    syncClock(); requestAnimationFrame(frame);
})();
