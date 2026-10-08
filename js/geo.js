'use strict';

/*
 * El Quito real: sistema de coordenadas, relieve y carga de los datos.
 *
 * Todo se mide en metros. El origen es el centro de la Plaza Grande; el eje X
 * sigue la calle García Moreno hacia el norte (a la derecha de la pantalla) y
 * el eje Y baja hacia el oriente. Así la cuadrícula del Centro Histórico queda
 * derecha, el Pichincha arriba y los valles abajo.
 *
 * Los datos salen de OpenStreetMap y del relieve SRTM (ver tools/generar.py).
 */
(() => {
    const B = Q.BASE, [X0, Y0, X1, Y1] = B.mundo, T = B.tesela, NB = B.bloque;
    const G = (Q.geo = { X0, Y0, X1, Y1, T, NB, ANCHO: X1 - X0, ALTO: Y1 - Y0 });

    // ───────────────────────── Latitud y longitud ─────────────────────────
    const [LAT0, LON0] = B.origen, KLAT = 110574, KLON = 111320 * Math.cos(LAT0 * Math.PI / 180);
    const CS = Math.cos(B.giro), SN = Math.sin(B.giro);
    G.giro = B.giro;
    G.latlon = (x, y) => [LAT0 + (x * CS - y * SN) / KLAT, LON0 + (x * SN + y * CS) / KLON];
    G.xy = (lat, lon) => { const n = (lat - LAT0) * KLAT, e = (lon - LON0) * KLON; return [n * CS + e * SN, -n * SN + e * CS]; };
    /** 0°13′12″ S · 78°30′44″ O */
    G.gms = (lat, lon) => {
        const f = (v, pos, neg) => { const a = Math.abs(v), g = Math.floor(a), m = Math.floor((a - g) * 60), s = Math.round(((a - g) * 60 - m) * 60); return `${g}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″ ${v >= 0 ? pos : neg}`; };
        return f(lat, 'N', 'S') + ' · ' + f(lon, 'E', 'O');
    };

    // ───────────────────────── Lectura binaria ─────────────────────────
    const bytes = (s) => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
    class Lector {
        constructor(b) { this.b = b; this.i = 0; }
        u() { let v = 0, s = 0, c; do { c = this.b[this.i++]; v += (c & 127) * 2 ** s; s += 7; } while (c & 128); return v; }
        z() { const v = this.u(); return v % 2 ? -(v + 1) / 2 : v / 2; }
        /** Una línea: [x0, y0, x1, y1, …], multiplicada por `esc` y desplazada. */
        linea(esc = 1, ox = 0, oy = 0) {
            const n = this.u(), p = new Float32Array(n * 2);
            let x = 0, y = 0;
            for (let i = 0; i < n; i++) { x += this.z(); y += this.z(); p[i * 2] = x * esc + ox; p[i * 2 + 1] = y * esc + oy; }
            return p;
        }
    }
    G.Lector = Lector; G.bytes = bytes;

    // ───────────────────────── Relieve ─────────────────────────
    const D = B.dem, A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const idx = new Uint8Array(128); for (let i = 0; i < 64; i++) idx[A64.charCodeAt(i)] = i;
    const alt = new Float32Array(D.w * D.h);
    for (let i = 0; i < alt.length; i++) alt[i] = D.zmin + idx[D.datos.charCodeAt(i * 2)] * 64 + idx[D.datos.charCodeAt(i * 2 + 1)];
    D.datos = null;
    G.dem = { alt, w: D.w, h: D.h, x0: D.x0, y0: D.y0, celda: D.celda };

    /** Altitud en metros, interpolada. */
    G.altura = (x, y) => {
        const fx = Q.clamp((x - D.x0) / D.celda, 0, D.w - 1.001), fy = Q.clamp((y - D.y0) / D.celda, 0, D.h - 1.001);
        const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * D.w + ix;
        return (alt[i] * (1 - tx) + alt[i + 1] * tx) * (1 - ty) + (alt[i + D.w] * (1 - tx) + alt[i + D.w + 1] * tx) * ty;
    };
    /**
     * Rellena una rejilla de n×n con la altitud suavizada (Catmull-Rom), para
     * que las laderas no muestren las celdas de 50 m del relieve original.
     */
    G.alturas = (x0, y0, paso, n, out = new Float32Array(n * n)) => {
        const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
        const col = new Float32Array(4);
        for (let j = 0; j < n; j++) {
            const fy = Q.clamp((y0 + j * paso - D.y0) / D.celda, 1, D.h - 2.001), iy = fy | 0, ty = fy - iy;
            for (let i = 0; i < n; i++) {
                const fx = Q.clamp((x0 + i * paso - D.x0) / D.celda, 1, D.w - 2.001), ix = fx | 0, tx = fx - ix;
                for (let k = 0; k < 4; k++) { const r = (iy - 1 + k) * D.w + ix; col[k] = cr(alt[r - 1], alt[r], alt[r + 1], alt[r + 2], tx); }
                out[j * n + i] = cr(col[0], col[1], col[2], col[3], ty);
            }
        }
        return out;
    };

    /** Altitudes en una rejilla de w×h, por interpolación simple: para la vista de toda la región. */
    G.rejilla = (x0, y0, paso, w, h) => {
        const out = new Float32Array(w * h);
        for (let j = 0; j < h; j++) {
            const fy = Q.clamp((y0 + j * paso - D.y0) / D.celda, 0, D.h - 1.001), iy = fy | 0, ty = fy - iy;
            for (let i = 0; i < w; i++) {
                const fx = Q.clamp((x0 + i * paso - D.x0) / D.celda, 0, D.w - 1.001), ix = fx | 0, tx = fx - ix, q = iy * D.w + ix;
                out[j * w + i] = (alt[q] * (1 - tx) + alt[q + 1] * tx) * (1 - ty) + (alt[q + D.w] * (1 - tx) + alt[q + D.w + 1] * tx) * ty;
            }
        }
        return out;
    };

    // ───────────────────────── Datos generales ─────────────────────────
    const leerLista = (obj, conSub) => {
        const r = new Lector(bytes(obj.datos)), n = r.u(), out = [];
        for (let i = 0; i < n; i++) {
            const k = r.u(), nombre = obj.nombres[r.u() - 1] || '';
            if (!conSub) { out.push({ k: k & 63, unico: !!(k & 64), nombre, p: r.linea(2, X0, Y0) }); continue; }
            const m = r.u(), anillos = [];
            for (let j = 0; j < m; j++) anillos.push(r.linea(2, X0, Y0));
            out.push({ k, nombre, r: anillos });
        }
        obj.datos = null;
        return out;
    };
    G.vias = leerLista(B.vias, false);      // vías principales, ríos y quebradas
    G.areas = leerLista(B.areas, true);     // parques, bosques y lagunas grandes
    G.vias.forEach((v) => { let l = 0; for (let i = 2; i < v.p.length; i += 2) l += Math.hypot(v.p[i] - v.p[i - 2], v.p[i + 1] - v.p[i - 1]); v.largo = l; });

    {   // Densidad urbana en celdas de 32 m: 2 bits de calles y 2 de edificios.
        const d = B.dens, r = new Lector(bytes(d.datos)), out = new Uint8Array(d.w * d.h);
        for (let i = 0; i < out.length;) { const v = r.u(), val = v & 15, n = v >> 4; out.fill(val, i, i + n); i += n; }
        G.dens = { w: d.w, h: d.h, celda: d.celda, d: out };
        d.datos = null;
    }
    /** 0 a 1: cuánta ciudad hay en ese punto. */
    G.urbano = (x, y) => {
        const d = G.dens, ix = Math.floor((x - X0) / d.celda), iy = Math.floor((y - Y0) / d.celda);
        if (ix < 0 || iy < 0 || ix >= d.w || iy >= d.h) return 0;
        const v = d.d[iy * d.w + ix];
        return Math.max(v >> 2, v & 3) / 3;
    };

    // Dónde faltan casas por dibujar: hay calles y, en unos 160 m a la redonda, los
    // datos casi no traen edificios. Pasa en buena parte del sur y de la periferia.
    // Ahí el mapa rellena las manzanas con casas genéricas.
    {
        const d = G.dens, w = d.w, h = d.h, casas = new Float32Array((w + 1) * (h + 1)), calles = new Float32Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {      // sumas acumuladas, para promediar ventanas sin recorrerlas
            const v = d.d[y * w + x], i = (y + 1) * (w + 1) + x + 1;
            casas[i] = (v & 3) + casas[i - 1] + casas[i - w - 1] - casas[i - w - 2];
            calles[i] = ((v >> 2) ? 1 : 0) + calles[i - 1] + calles[i - w - 1] - calles[i - w - 2];
        }
        const R = 2, falta = new Uint8Array(w * h);
        for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
            const a = (y - R) * (w + 1) + x - R, b = a + 2 * R + 1, c = a + (2 * R + 1) * (w + 1), e = c + 2 * R + 1, n = (2 * R + 1) ** 2;
            if ((casas[e] - casas[b] - casas[c] + casas[a]) / n < 0.9 && (calles[e] - calles[b] - calles[c] + calles[a]) / n > 0.3) falta[y * w + x] = 1;
        }
        d.falta = falta;
    }
    /** ¿Toca rellenar con casas genéricas en este punto? */
    G.sinCasas = (x, y) => {
        const d = G.dens, ix = Math.floor((x - X0) / d.celda), iy = Math.floor((y - Y0) / d.celda);
        return ix >= 0 && iy >= 0 && ix < d.w && iy < d.h && d.falta[iy * d.w + ix] === 1;
    };

    /** ¿Hay en ese rectángulo alguna manzana por rellenar? Evita buscar píxel por píxel donde no hace falta. */
    G.hayVacios = (x0, y0, x1, y1) => {
        const d = G.dens;
        for (let iy = Math.max(0, Math.floor((y0 - Y0) / d.celda)); iy <= Math.min(d.h - 1, Math.floor((y1 - Y0) / d.celda)); iy++)
            for (let ix = Math.max(0, Math.floor((x0 - X0) / d.celda)); ix <= Math.min(d.w - 1, Math.floor((x1 - X0) / d.celda)); ix++) if (d.falta[iy * d.w + ix]) return true;
        return false;
    };

    // ───────────────────────── Bloques de detalle ─────────────────────────
    // Cada archivo b_X_Y.js trae 4×4 teselas de 512 m. Se piden cuando la
    // cámara se acerca: una etiqueta <script> funciona también desde el disco.
    const existe = new Set(B.bloques), pedido = new Set(), teselas = new Map();
    const VACIA = { v: [], e: [], a: [], vacia: true };
    Q.datos = {
        cargados: 0, alLlegar: null,
        llega(bx, by, datos, nombres) {
            const r = new Lector(bytes(datos)), n = r.u();
            for (let i = 0; i < n; i++) {
                const tx = bx * NB + r.u(), ty = by * NB + r.u(), t = { v: [], e: [], a: [] };
                for (let k = r.u(); k > 0; k--) { const c = r.u(); t.v.push({ k: c & 15, tunel: !!(c & 16), puente: !!(c & 32), nombre: nombres[r.u() - 1] || '', p: r.linea() }); }
                for (let k = r.u(); k > 0; k--) { const pisos = r.u(), tipo = r.u(), an = []; for (let m = r.u(); m > 0; m--) an.push(r.linea()); t.e.push({ pisos, tipo, r: an }); }
                for (let k = r.u(); k > 0; k--) { const c = r.u(), sub = r.u(), an = []; for (let m = r.u(); m > 0; m--) an.push(r.linea()); t.a.push({ k: c, sub, r: an }); }
                teselas.set(tx + '_' + ty, t);
            }
            for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) { const k = (bx * NB + i) + '_' + (by * NB + j); if (!teselas.has(k)) teselas.set(k, VACIA); }
            this.cargados++;
            if (this.alLlegar) this.alLlegar(bx, by);
        },
        /** La tesela, o null si su bloque todavía no ha llegado (y entonces lo pide). */
        tesela(tx, ty) {
            const t = teselas.get(tx + '_' + ty);
            if (t) return t;
            const bx = Math.floor(tx / NB), by = Math.floor(ty / NB), k = bx + '_' + by;
            if (!existe.has(k)) return VACIA;
            if (!pedido.has(k)) {
                pedido.add(k);
                const s = document.createElement('script');
                s.src = `js/datos/b_${k}.js`;
                s.onerror = () => { existe.delete(k); if (this.alLlegar) this.alLlegar(bx, by); };
                document.head.appendChild(s);
            }
            return null;
        },
        pendientes: () => pedido.size - Q.datos.cargados,
    };
})();
