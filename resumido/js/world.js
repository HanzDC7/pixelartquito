'use strict';

/*
 * El escenario fijo. Cada capa se dibuja una sola vez en su propio lienzo y
 * luego se desplaza a distinta velocidad (paralaje): los volcanes lejanos casi
 * no se mueven, la calle se mueve a la par de la cámara.
 *
 * Mirando hacia el oeste, como desde el Itchimbía: el sur queda a la izquierda,
 * el norte a la derecha y el Pichincha detrás de la ciudad.
 */
(() => {
    const { R, hash, pick, disc, line, W, H, GROUND: G } = Q;

    Q.layers = {};
    Q.marks = [];   // lugares con ficha, en orden de prioridad al hacer clic

    const mk = (name, f) => {
        const w = Math.ceil(W + Q.MAXCAM * f);
        const c = Q.canvas(w, H);
        return (Q.layers[name] = { name, f, w, cv: c.cv, g: c.g, lights: [] });
    };

    /**
     * Registra un lugar. Con `draw` se guarda una copia suelta del dibujo, que
     * sirve para dos cosas: responder al cursor por su silueta real (y no por
     * el rectángulo, que incluye cielo) y, si es `lit`, pintarla de noche sin
     * oscurecer, como si estuviera iluminada.
     */
    const mark = (L, id, x, y, w, h, draw = null, test = null, lit = true) => {
        const m = { id, layer: L, x, y, w, h, lit: null, test };   // test(x, y) en coordenadas de la capa
        if (draw) {
            const c = Q.canvas(w, h);
            c.g.translate(-x, -y);
            draw(c.g, { lights: [] });
            if (lit) m.lit = c.cv;
            m.test = (lx, ly) => {
                const d = c.g.getImageData(Math.round(lx - x) - 3, Math.round(ly - y) - 3, 7, 7).data;
                for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
                return false;
            };
        }
        Q.marks.push(m);
    };

    const C = {
        white: '#F4F1E8', whiteD: '#D9D4C6', stone: '#8C8F99', stoneD: '#6E717C', stoneL: '#A9ADB8',
        roof: '#B5532F', roofD: '#8E3F22', wood: '#6B4226', door: '#4A2C17', glass: '#2B3A55',
        slate: '#3F4A52', leaf: '#3E8E4E', leafD: '#2F6F3E', leafL: '#5BAA5E',
    };

    /** Ventana: se dibuja apagada y queda anotada para encenderse de noche. */
    const win = (g, L, x, y, w, h, color = C.glass) => {
        R(g, x, y, w, h, color);
        if (w > 2 && h > 3) {
            R(g, x, y, w, 1, '#202B39');
            R(g, x, y + h, w + 1, 1, '#B4AA95');
            R(g, x + w - 1, y + 1, 1, h - 1, '#526574');
        }
        L.lights.push([x, y, w, h, x * 7.3 + y * 3.1]);
    };

    // Se aplica antes de puertas y ventanas: juntas, estuco envejecido y zócalo.
    const surface = (g, x, y, w, h, color, stone = false) => {
        R(g, x, y, w, h, color);
        const dark = Q.mix(color, '#4D483F', stone ? 0.23 : 0.09);
        const light = Q.mix(color, '#FFF6DE', 0.22);
        for (let yy = 1; yy < h - 1; yy++) {
            for (let xx = 1; xx < w - 1; xx++) {
                const n = hash((x + xx) * 11.7 + (y + yy) * 3.3);
                if (stone && (yy % 5 === 0 || (xx + (Math.floor(yy / 5) % 2) * 4) % 9 === 0)) {
                    if (n > 0.25) R(g, x + xx, y + yy, 1, 1, dark);
                } else if (n > 0.94 || (yy > h - 5 && n > 0.65)) R(g, x + xx, y + yy, 1, 1, dark);
                else if (n < 0.035) R(g, x + xx, y + yy, 1, 1, light);
            }
        }
        R(g, x, y, 1, h, light);
        R(g, x + w - 2, y + 1, 2, h - 1, Q.mix(color, '#514B43', 0.2));
        R(g, x + 1, y + 1, w - 3, 1, dark);
    };

    // ───────────────────────── Volcanes lejanos ─────────────────────────
    const cone = (g, cx, top, base, slope, light, dark, snow, crater) => {
        for (let y = top; y <= base; y++) {
            const hw = Math.round((y - top) * slope) + crater;
            for (let x = cx - hw; x <= cx + hw; x++) {
                const snowLine = top + snow + Math.round(hash(x * 3.7) * 9 + Math.abs(x - cx) * 0.12);
                const lit = x < cx + (y - top) * 0.15;
                R(g, x, y, 1, 1, y < snowLine ? (lit ? '#FFFFFF' : '#CDD8EE') : (lit ? light : dark));
            }
        }
    };

    const buildFar = () => {
        const L = mk('far', 0.15), g = L.g;

        for (let x = 0; x < L.w; x++) {
            const y = 134 + Math.round(Math.sin(x * 0.035) * 6 + Math.sin(x * 0.11 + 2) * 3 + hash(x) * 1.5);
            R(g, x, y, 1, H - y, '#7C8FBF');
            R(g, x, y, 1, 1, '#93A5D0');
        }

        cone(g, 74, 92, 152, 1.05, '#7385B8', '#5E70A6', 22, 3);     // Cotopaxi
        R(g, 72, 92, 5, 1, '#B9C6E2');
        cone(g, 468, 98, 152, 1.7, '#7C8FBF', '#6779AE', 15, 6);     // Cayambe, al nororiente

        Q.fumarole = { x: 74, y: 90 };
        mark(L, 'cotopaxi', 14, 84, 122, 60, null, (x, y) => Math.abs(x - 74) <= (y - 92) * 1.05 + 4);
    };

    // ───────────────────────── Pichincha ─────────────────────────
    const buildPichincha = () => {
        const L = mk('pich', 0.3), g = L.g, w = L.w;

        const smooth = (x) => {
            const guagua = Math.exp(-(((x - 250) / 95) ** 2)) * 98;
            const rucu = Math.exp(-(((x - 430) / 80) ** 2)) * 84;
            const sur = Math.exp(-(((x - 80) / 120) ** 2)) * 44;
            const norte = Math.exp(-(((x - 630) / 110) ** 2)) * 50;
            return 152 - Math.max(guagua, rucu, sur, norte, 16) - (guagua + rucu) * 0.1;
        };
        const top = Q.pichTop = (x) => Math.round(smooth(x) - Math.sin(x * 0.09) * 3 - Math.sin(x * 0.23 + 1) * 2 - hash(x + 900) * 2);

        for (let x = 0; x < w; x++) {
            const t = top(x);
            for (let y = t; y < H; y++) {
                const noise = Q.noise(x * 0.12, y * 0.16) * 0.8 + hash(x * 13.1 + y * 7.7) * 0.2, d = noise > 0.5;
                // Le da el sol a la ladera que sube hacia la derecha. Se mira la
                // pendiente suavizada (con el perfil rugoso salían rayas) y el
                // borde de la sombra baja en diagonal, con algo de grano.
                const xs = x - (y - t) * 0.55 + (noise - 0.5) * 7;
                const lit = smooth(xs + 8) <= smooth(xs) + 0.4;
                // La altura "efectiva" ondula, para que el páramo y el bosque no corten en línea recta.
                const e = y + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.017 + 2) * 9 + (noise - 0.5) * 12;
                let c;
                if (e < 66) c = lit ? (d ? '#8A8590' : '#7B7682') : (d ? '#5F5B68' : '#55515E');          // roca
                else if (e < 102) c = lit ? (d ? '#93954F' : '#878946') : (d ? '#70733D' : '#666937');    // páramo
                else if (e < 138) c = lit ? (d ? '#4F8242' : '#467739') : (d ? '#3B6534' : '#345B2F');    // bosque
                else c = d ? '#345E36' : '#2C5230';
                const depth = y - t;
                if (depth > 2 && depth < 30 + hash(x * 0.21) * 40 && Math.sin((x + depth * 0.7) * 0.31) + hash(Math.floor((x + depth * 0.7) / 3)) * 0.6 > 1.28) c = Q.mix(c, '#1E2B22', 0.32);
                // Crestas y quebradas continuas; bruma atmosférica al pie de la montaña.
                const ridge = Math.sin(x * 0.067 + depth * 0.045 + Q.noise(x * 0.025, y * 0.023) * 4);
                c = Q.mix(c, ridge > 0 ? '#C1BE8C' : '#293D3E', Math.abs(ridge) * 0.17);
                c = Q.mix(c, '#A9C2CE', 0.12 + Q.clamp((y - 88) / 100) * 0.24);
                R(g, x, y, 1, 1, c);
            }
            R(g, x, t, 1, 1, smooth(x + 8) <= smooth(x) + 0.4 ? '#B5B0BA' : '#6A6673');
        }

        // Los barrios que trepan por las faldas.
        for (let i = 0; i < 620; i++) {
            const x = Math.floor(hash(i) * w), y = 139 + Math.floor(hash(i + 0.5) * 28);
            if (y < top(x) + 8) continue;
            R(g, x, y, 2, 2, pick(['#EFE9DC', '#D9CDB8', '#E6D2B0', '#C9D3DA'], i));
            R(g, x, y - 1, 2, 1, pick(['#B5532F', '#9A4A2C', '#7C8792'], i + 3));
            if (hash(i + 9) > 0.6) L.lights.push([x, y, 1, 1, i * 5.1]);
        }

        // Antenas de Cruz Loma y las dos estaciones del teleférico.
        const upX = 462, upY = top(462);
        [472, 478, 486].forEach((x, i) => {
            R(g, x, top(x) - 9 - i * 2, 1, 9 + i * 2, '#C9CED8');
            R(g, x, top(x) - 10 - i * 2, 1, 1, '#D62828');
        });
        R(g, upX - 4, upY - 4, 9, 4, '#E8E4DA'); R(g, upX - 5, upY - 5, 11, 1, '#B5532F');
        R(g, 542, 148, 13, 6, '#E8E4DA'); R(g, 541, 147, 15, 1, '#B5532F'); R(g, 546, 150, 4, 4, '#2B3A55');

        Q.cable = { x1: 548, y1: 147, x2: upX, y2: upY - 5 };
        Q.antennas = [472, 478, 486].map((x, i) => [x, top(x) - 10 - i * 2]);

        const c = Q.cable;
        mark(L, 'teleferico', 452, upY - 12, 106, 152 - upY + 14, null, (x, y) => {
            const u = Q.clamp((x - c.x1) / (c.x2 - c.x1));
            return Math.abs(y - (c.y1 + (c.y2 - c.y1) * u)) < 9;
        });
        mark(L, 'pichincha', 170, 36, 340, 84, null, (x, y) => y >= top(Math.round(x)) - 1);
    };

    // ───────────────────────── Lomas ─────────────────────────
    const virgen = (g, cx, by) => {
        R(g, cx - 7, by - 3, 14, 3, '#B9B2A3');
        R(g, cx - 5, by - 11, 10, 8, '#D9D4C7'); R(g, cx + 3, by - 11, 2, 8, '#B9B2A3');
        R(g, cx - 1, by - 7, 2, 4, '#5A4E44');
        R(g, cx - 4, by - 13, 8, 2, '#C9C3B6');
        disc(g, cx, by - 15, 3, '#AEB8C6');
        R(g, cx - 2, by - 27, 5, 10, '#D5DCE6'); R(g, cx + 2, by - 27, 1, 10, '#9AA5B5');
        R(g, cx - 3, by - 20, 7, 3, '#C3CCD8');
        R(g, cx - 1, by - 30, 3, 3, '#E3E8EF');
        // Las alas: lo que la distingue de casi cualquier otra Virgen.
        R(g, cx - 5, by - 28, 3, 2, '#C9D2DE'); R(g, cx - 7, by - 31, 3, 3, '#C9D2DE'); R(g, cx - 8, by - 34, 2, 3, '#B5BFCC');
        R(g, cx + 3, by - 28, 3, 2, '#C9D2DE'); R(g, cx + 5, by - 31, 3, 3, '#AEB8C6'); R(g, cx + 7, by - 34, 2, 3, '#9AA5B5');
        R(g, cx + 2, by - 25, 3, 1, '#C9D2DE');
        [[-2, -32], [0, -33], [2, -32]].forEach(([dx, dy]) => R(g, cx + dx, by + dy, 1, 1, '#FFE9A8'));
    };

    const buildHills = () => {
        const L = mk('hills', 0.55), g = L.g;

        const hill = (cx, top, rad, c1, c2, edge) => {
            const yAt = (x) => Math.round(top + (G - top) * (((x - cx) / rad) ** 2) + hash(x + 50) * 1.4);
            for (let x = cx - rad; x <= cx + rad; x++) {
                const y = yAt(x);
                for (let yy = y; yy < H; yy++) R(g, x, yy, 1, 1, Q.noise(x * 0.18, yy * 0.2) > 0.48 ? c1 : c2);
                R(g, x, y, 1, 1, edge);
            }
            return yAt;
        };

        // Lomas secas del norte, hacia la Mitad del Mundo.
        hill(900, 132, 150, '#9C9A63', '#8E8C58', '#B5B279');
        hill(700, 142, 110, '#7F9457', '#72874E', '#9AAE6C');
        hill(990, 140, 120, '#A8A26B', '#99935F', '#C2BC82');

        // Itchimbía, con su palacio de hierro y vidrio.
        hill(455, 134, 76, '#4F8A48', '#447B3F', '#6BA35F');
        R(g, 446, 127, 20, 7, '#BFE3F0'); R(g, 446, 127, 20, 1, '#7FA6B8');
        for (let i = 0; i <= 4; i++) R(g, 446 + i * 5, 127, 1, 7, '#7FA6B8');
        disc(g, 456, 127, 4, '#D5EEF6', true); R(g, 456, 121, 1, 2, '#7FA6B8');
        mark(L, 'itchimbia', 440, 118, 32, 18);

        // El Panecillo.
        const pan = hill(150, 106, 88, '#4A8346', '#40763E', '#69A05D');
        for (let i = 0; i < 190; i++) {
            const x = 66 + Math.floor(hash(i + 20) * 168), y = pan(x) + 16 + Math.floor(hash(i + 40) * 40);
            if (y > G - 2) continue;
            R(g, x, y, 3, 3, pick(['#F3EEE2', '#EADFC8', '#F6E7B8', '#E2D3C0'], i));
            R(g, x, y - 1, 3, 1, pick(['#B5532F', '#A44A2A', '#C2633A'], i + 1));
            if (hash(i + 77) > 0.55) L.lights.push([x + 1, y + 1, 1, 1, i * 3.3]);
        }
        const draw = (gg) => virgen(gg, 150, 107);
        draw(g);
        mark(L, 'panecillo', 138, 70, 25, 40, draw);
    };

    // ───────────────────────── La ciudad al fondo ─────────────────────────
    const buildCity = () => {
        const L = mk('city', 0.7), g = L.g;

        for (let row = 0; row < 6; row++) {
            const base = 133 + row * 7;
            let x = -Math.floor(hash(row) * 8);
            while (x < L.w) {
                const k = x * 31.7 + row * 977;
                const colonial = x < 540 + hash(row) * 50;
                const bw = 5 + Math.floor(hash(k) * 7);
                const bh = colonial ? 5 + Math.floor(hash(k + 1) * 5) : 6 + Math.floor(hash(k + 2) * (row < 3 ? 20 : 11));
                if (hash(k + 3) < (row < 2 ? 0.5 : 0.9)) {
                    if (colonial) {
                        R(g, x, base - bh, bw, bh, pick(['#F3EEE2', '#EADFC8', '#F6E7B8', '#E8D2C0', '#DCE6EA', '#F0D9C4'], k));
                        R(g, x - 1, base - bh - 2, bw + 2, 2, pick(['#B5532F', '#A44A2A', '#C2633A'], k + 5));
                        R(g, x - 1, base - bh, bw + 2, 1, '#7A3319');
                        if (bw > 5) win(g, L, x + 2, base - bh + 2, 1, 2, '#3A3040');
                    } else {
                        const body = pick(['#B9C2CF', '#9FB0C4', '#D8DCE2', '#8FA3B8', '#C7CFD6', '#A7B4BF'], k);
                        R(g, x, base - bh, bw, bh, body);
                        R(g, x, base - bh, bw, 1, Q.mix(body, '#FFFFFF', 0.4));
                        R(g, x + bw - 1, base - bh, 1, bh, Q.mix(body, '#000000', 0.2));
                        for (let yy = base - bh + 2; yy < base - 1; yy += 3) {
                            for (let xx = x + 1; xx < x + bw - 1; xx += 2) win(g, L, xx, yy, 1, 1, '#42556F');
                        }
                    }
                }
                x += bw + Math.floor(hash(k + 4) * 2);
            }
        }
    };

    // ───────────────────────── Piezas de la calle ─────────────────────────
    const tileRoof = (g, x, y, w) => {
        R(g, x, y - 2, w, 5, C.roof);
        for (let i = 0; i < w; i += 2) {
            R(g, x + i, y - 1, 1, 3, pick(['#9B492F', '#C0754C', '#D18B5A'], x + i));
            R(g, x + i, y + 1, 1, 1, C.roofD);
        }
        R(g, x, y - 2, w, 1, '#D49365');
        R(g, x, y + 2, w, 1, '#7A3319');
    };

    const house = (g, L, x, w, h, seed) => {
        const wall = pick(['#F4F1E8', '#F6E7B8', '#EBD9C4', '#DCE6EA', '#F2D6C2', '#E9E3D0'], seed);
        const top = G - h;
        surface(g, x, top, w, h, wall);
        R(g, x, G - 3, w, 3, '#8A857A');
        tileRoof(g, x - 1, top - 3, w + 2);
        R(g, x + 2, top + 2, 1, h - 5, '#B5AB97'); // bajante
        R(g, x + 2, top + 1, w - 4, 1, '#D1C5B0');
        if (w >= 30) {
            R(g, x + w - 8, top - 8, 3, 4, '#988877');
            R(g, x + w - 9, top - 9, 5, 1, '#D1C4AA');
        }

        const bays = Math.max(1, Math.floor(w / 11)), pad = Math.floor((w - bays * 11) / 2);
        for (let b = 0; b < bays; b++) {
            const bx = x + pad + b * 11;
            if (h >= 26) {
                win(g, L, bx + 3, top + 4, 5, 8);
                R(g, bx + 5, top + 4, 1, 8, C.wood);
                R(g, bx + 1, top + 12, 9, 1, C.wood); R(g, bx + 1, top + 10, 1, 2, C.wood); R(g, bx + 9, top + 10, 1, 2, C.wood);
                for (let rail = 2; rail < 9; rail += 2) R(g, bx + rail, top + 10, 1, 2, '#4D4A41');
                // Geranios en el balcón.
                [2, 4, 6, 8].forEach((dx, i) => { R(g, bx + dx, top + 10, 1, 1, pick(['#E0314F', '#F06292', '#E0314F', '#FF8A3D'], seed + b + i)); R(g, bx + dx, top + 11, 1, 1, C.leaf); });
            }
            if (b === Math.floor(bays / 2)) {
                R(g, bx + 3, G - 11, 5, 11, C.door); R(g, bx + 4, G - 12, 3, 1, C.door); R(g, bx + 6, G - 6, 1, 1, '#C8A24A');
            } else {
                win(g, L, bx + 3, G - 12, 5, 6); R(g, bx + 5, G - 12, 1, 6, C.wood);
            }
        }
        // Toldos de pequeños comercios, con cenefa y sombra sobre la puerta.
        if (w >= 30) {
            R(g, x + 4, G - 14, w - 8, 2, '#514B42');
            for (let i = 0; i < w - 8; i += 3) R(g, x + 4 + i, G - 15, Math.min(3, w - 8 - i), 2, i % 2 ? '#D5C6A8' : '#486F65');
            R(g, x + 5, G - 10, 3, 4, '#596F72');
        }
    };

    const tower = (g, L, x, w, h, style, seed) => {
        const [body, glass] = [['#5B7FA6', '#9DD1E8'], ['#3F6A78', '#8FD3C8'], ['#6B7385', '#B9C6DA'], ['#2F4F6F', '#7FB3E0'], ['#8A8F9C', '#D0DCEA']][style % 5];
        const top = G - h;
        R(g, x, top, w, h, body); R(g, x, top, 1, h, Q.mix(body, '#FFFFFF', 0.25)); R(g, x + w - 2, top, 2, h, Q.mix(body, '#000000', 0.25));
        for (let yy = top + 3; yy < G - 8; yy += 4) {
            for (let xx = x + 2; xx < x + w - 3; xx += 3) {
                const reflection = Q.noise(xx * 0.1, yy * 0.08 + seed);
                R(g, xx, yy, 2, 2, Q.mix(glass, reflection > 0.5 ? '#E5E9DC' : '#304C5D', Math.abs(reflection - 0.5) * 0.85));
                L.lights.push([xx, yy, 2, 2, xx * 5.7 + yy * 1.9 + seed]);
            }
        }
        R(g, x + 1, G - 7, w - 2, 7, '#1F2A3A'); R(g, x + Math.floor(w / 2) - 2, G - 6, 4, 6, '#9DD1E8');
        if (style % 2) { R(g, x + 3, top - 3, w - 6, 3, Q.mix(body, '#000000', 0.2)); R(g, x + Math.floor(w / 2), top - 10, 1, 7, '#C9CED8'); } else { R(g, x + 2, top - 2, w - 4, 2, '#DADDE3'); }
    };

    const tree = (g, x, h, kind = 0) => {
        if (kind === 2) {   // palma de la Plaza Grande
            R(g, x, G - h, 2, h, '#8A6B45'); for (let i = 0; i < h; i += 3) R(g, x, G - h + i, 2, 1, '#6B5134');
            [[-6, 0], [-4, -2], [-2, -4], [3, -4], [5, -2], [7, 0], [-5, 2], [6, 2]].forEach(([dx, dy]) => R(g, x + dx, G - h + dy, 3, 2, dx < 0 ? C.leaf : C.leafD));
            R(g, x - 1, G - h - 3, 4, 3, C.leafL);
            return;
        }
        const [c1, c2, c3] = kind === 1 ? ['#E58FB6', '#D46A9C', '#F5B8D2'] : [C.leaf, C.leafD, C.leafL];   // 1: arupo en flor
        const r = Math.max(4, Math.round(h * 0.38));
        R(g, x, G - Math.round(h * 0.5), 2, Math.round(h * 0.5), '#6B4226');
        disc(g, x + 1, G - h + r, r, c2); disc(g, x - 1, G - h + r - 1, r - 1, c1); disc(g, x - 2, G - h + r - 2, Math.max(1, r - 3), c3);
        for (let i = 0; i < 26; i++) {
            const dx = Math.round((hash(x + i * 3) * 2 - 1) * r), dy = Math.round((hash(x + i * 7 + 1) * 2 - 1) * r);
            if (dx * dx + dy * dy < r * r - 3) R(g, x + dx, G - h + r + dy, 2, 1, dx + dy < 0 ? c3 : c2);
        }
        line(g, x + 1, G - 7, x - 2, G - h + r + 3, '#6B5639');
    };

    const lamp = (g, x) => {
        R(g, x, G - 16, 1, 16, '#2A2A2E'); R(g, x - 1, G - 18, 3, 3, '#3A3A40'); R(g, x, G - 17, 1, 1, '#FFE9A8');
        Q.lamps.push([x, G - 17]);
    };

    // ───────────────────────── Los lugares ─────────────────────────
    const sanFrancisco = (x) => (g, L) => {
        surface(g, x, G - 26, 114, 26, C.white); tileRoof(g, x - 1, G - 29, 116);
        for (let i = 0; i < 4; i++) { win(g, L, x + 5 + i * 7, G - 20, 3, 5); win(g, L, x + 86 + i * 7, G - 20, 3, 5); }
        R(g, x + 16, G - 5, 82, 5, '#A9A39A'); R(g, x + 14, G - 3, 86, 3, '#989288');
        R(g, x + 48, G - 3, 18, 1, '#C4BEB2'); R(g, x + 46, G - 2, 22, 1, '#B5AFA3'); R(g, x + 44, G - 1, 26, 1, '#A9A39A');   // la escalinata redonda del atrio

        surface(g, x + 34, G - 48, 46, 43, C.white);
        surface(g, x + 47, G - 50, 20, 45, '#9A958E', true);
        [48, 52, 61, 65].forEach((dx) => R(g, x + dx, G - 48, 1, 43, '#B8B3AA'));
        R(g, x + 47, G - 30, 20, 1, '#77726B');
        R(g, x + 53, G - 19, 8, 14, C.door); R(g, x + 54, G - 20, 6, 1, C.door);
        win(g, L, x + 55, G - 40, 4, 7);
        R(g, x + 49, G - 53, 16, 3, '#9A958E'); R(g, x + 53, G - 55, 8, 2, '#9A958E'); R(g, x + 56, G - 59, 1, 4, '#3A3A40'); R(g, x + 55, G - 58, 3, 1, '#3A3A40');

        [x + 33, x + 67].forEach((tx) => {
            surface(g, tx, G - 66, 14, 61, C.white); R(g, tx + 12, G - 66, 2, 61, C.whiteD);
            R(g, tx - 1, G - 49, 16, 1, '#CFC8B8'); R(g, tx - 1, G - 67, 16, 1, '#CFC8B8');
            R(g, tx + 3, G - 61, 3, 7, C.glass); R(g, tx + 8, G - 61, 3, 7, C.glass);
            R(g, tx + 4, G - 59, 1, 2, '#C8A24A'); R(g, tx + 9, G - 59, 1, 2, '#C8A24A');   // campanas
            win(g, L, tx + 5, G - 42, 3, 5);
            R(g, tx + 1, G - 71, 12, 4, C.white); R(g, tx + 3, G - 75, 8, 4, C.whiteD); R(g, tx + 5, G - 78, 4, 3, '#B9B2A3');
            R(g, tx + 6, G - 83, 1, 5, '#3A3A40'); R(g, tx + 5, G - 82, 3, 1, '#3A3A40');
        });
    };

    const compania = (x) => (g, L) => {
        const st = '#8E8A86', sl = '#A9A59F', sd = '#6C6864';
        // Cúpulas de teja verde y amarilla.
        disc(g, x + 29, G - 56, 11, '#3E8E5A', true);
        for (let i = -9; i <= 9; i += 3) R(g, x + 29 + i, G - 62, 1, 6, '#E3C24A');
        R(g, x + 27, G - 71, 5, 5, '#D9D4C6'); R(g, x + 29, G - 75, 1, 4, '#3A3A40'); R(g, x + 28, G - 74, 3, 1, '#3A3A40');
        disc(g, x + 50, G - 50, 5, '#3E8E5A', true); R(g, x + 50, G - 58, 1, 3, '#E3C24A');

        surface(g, x, G - 48, 58, 48, st, true); R(g, x + 56, G - 48, 2, 48, sd);
        R(g, x, G - 48, 58, 1, sl); R(g, x, G - 25, 58, 1, sd); R(g, x, G - 2, 58, 2, sd);
        // Columnas salomónicas, sugeridas con un zigzag.
        [5, 12, 42, 49].forEach((dx) => { for (let yy = 0; yy < 22; yy++) R(g, x + dx + (yy % 4 < 2 ? 0 : 1), G - 24 + yy, 3, 1, yy % 4 < 2 ? sl : '#B9B5AE'); R(g, x + dx, G - 46, 4, 20, sl); });
        R(g, x + 23, G - 19, 12, 19, C.door); R(g, x + 24, G - 21, 10, 2, C.door); R(g, x + 26, G - 22, 6, 1, C.door);
        R(g, x + 28, G - 19, 1, 19, '#33200F');
        win(g, L, x + 26, G - 40, 6, 10); R(g, x + 27, G - 41, 4, 1, C.glass);
        R(g, x + 16, G - 58, 26, 10, st); R(g, x + 16, G - 58, 26, 1, sl); R(g, x + 21, G - 62, 16, 4, st); R(g, x + 25, G - 65, 8, 3, st);
        R(g, x + 28, G - 56, 3, 5, '#C8A24A');
        R(g, x + 29, G - 70, 1, 5, '#3A3A40'); R(g, x + 28, G - 69, 3, 1, '#3A3A40');
    };

    const catedral = (x) => (g, L) => {
        surface(g, x, G - 30, 76, 30, C.white); tileRoof(g, x - 1, G - 33, 78);
        R(g, x, G - 7, 76, 2, '#C9C3B6'); R(g, x, G - 5, 76, 5, '#A9A39A');
        for (let i = 0; i < 19; i++) R(g, x + i * 4, G - 9, 1, 2, '#C9C3B6');   // balaustrada
        for (let i = 0; i < 5; i++) win(g, L, x + 24 + i * 10, G - 24, 3, 7);
        R(g, x + 40, G - 26, 14, 21, '#9A958E'); R(g, x + 43, G - 18, 8, 13, C.door); R(g, x + 44, G - 20, 6, 2, C.door);
        R(g, x + 39, G - 28, 16, 2, '#B8B3AA'); R(g, x + 43, G - 31, 8, 3, '#B8B3AA');
        disc(g, x + 64, G - 33, 5, '#4E9A6A', true); R(g, x + 64, G - 41, 1, 3, '#E3C24A');

        surface(g, x + 4, G - 58, 14, 58, C.white); R(g, x + 16, G - 58, 2, 58, C.whiteD);
        R(g, x + 3, G - 42, 16, 1, '#CFC8B8'); R(g, x + 3, G - 59, 16, 1, '#CFC8B8');
        R(g, x + 7, G - 54, 3, 8, C.glass); R(g, x + 12, G - 54, 3, 8, C.glass);
        win(g, L, x + 9, G - 34, 4, 6);
        disc(g, x + 11, G - 59, 6, '#4E9A6A', true); R(g, x + 9, G - 68, 4, 3, '#D9D4C6'); R(g, x + 11, G - 72, 1, 4, '#3A3A40'); R(g, x + 10, G - 71, 3, 1, '#3A3A40');
    };

    const plaza = (x) => (g) => {
        const cx = x + 40;
        R(g, x, G, 80, 3, '#D6CFC0');
        R(g, x + 4, G - 2, 22, 2, C.leaf); R(g, x + 54, G - 2, 22, 2, C.leaf);
        [6, 12, 18, 58, 64, 70].forEach((dx, i) => R(g, x + dx, G - 3, 1, 1, pick(['#E0314F', '#F2C200', '#F06292'], i)));
        tree(g, x + 9, 36, 2); tree(g, x + 70, 34, 2); tree(g, x + 24, 20, 0); tree(g, x + 57, 22, 1);

        R(g, cx - 10, G - 3, 21, 3, '#B9B2A3'); R(g, cx - 8, G - 6, 17, 3, '#C9C3B6');
        R(g, cx - 5, G - 17, 11, 11, '#D9D4C6'); R(g, cx + 4, G - 17, 2, 11, '#B9B2A3');
        R(g, cx - 7, G - 9, 3, 2, '#3A3A3A'); R(g, cx - 8, G - 10, 2, 1, '#3A3A3A');   // el cóndor del pedestal
        R(g, cx - 1, G - 42, 3, 25, '#E8E4DA'); R(g, cx + 1, G - 42, 1, 25, '#C9C3B6'); R(g, cx - 2, G - 43, 5, 1, '#C9C3B6');
        R(g, cx - 1, G - 49, 3, 6, '#7A5B2E'); R(g, cx - 3, G - 48, 2, 3, '#8E6F3A'); R(g, cx + 2, G - 48, 2, 3, '#6B4E26');
        R(g, cx, G - 51, 1, 2, '#7A5B2E'); R(g, cx + 2, G - 53, 1, 3, '#7A5B2E'); R(g, cx + 2, G - 54, 1, 1, '#FFD23F');

        // La pila; el agua la anima actors.js.
        R(g, x + 30, G - 3, 9, 3, '#C9C3B6'); R(g, x + 31, G - 4, 7, 1, '#7FB3E0'); R(g, x + 34, G - 7, 1, 4, '#B9B2A3');
        Q.fountain = { x: x + 34, y: G - 8 };
    };

    const carondelet = (x) => (g, L) => {
        surface(g, x, G - 37, 114, 37, C.white);
        surface(g, x, G - 14, 114, 14, '#CFC8B8', true);
        for (let i = 0; i < 11; i++) if (i !== 5) R(g, x + 4 + i * 10, G - 10, 6, 10, '#3A2A1E');
        R(g, x + 50, G - 13, 14, 13, '#9A958E'); R(g, x + 53, G - 11, 8, 11, C.door);
        R(g, x + 2, G - 32, 110, 15, '#5A4E44');
        for (let i = 0; i < 19; i++) { R(g, x + 2 + i * 6, G - 32, 2, 15, C.white); if (i < 18) win(g, L, x + 5 + i * 6, G - 28, 2, 6, '#4A4038'); }
        R(g, x + 2, G - 19, 110, 2, '#E8E4DA');
        R(g, x - 1, G - 39, 116, 2, '#E8E4DA'); R(g, x, G - 41, 114, 2, C.roof);
        R(g, x + 44, G - 46, 26, 7, C.white); R(g, x + 47, G - 48, 20, 2, C.white); R(g, x + 51, G - 50, 12, 2, C.white); R(g, x + 55, G - 51, 4, 1, C.white);
        R(g, x + 55, G - 46, 4, 4, '#2B3A55'); R(g, x + 56, G - 45, 2, 2, '#EDE7D5');
        R(g, x + 57, G - 66, 1, 15, '#8A8A8A');
        Q.flag = { x: x + 58, y: G - 66 };

        // Granaderos de Tarqui en la puerta.
        [x + 48, x + 65].forEach((gx) => {
            R(g, gx, G - 3, 2, 3, '#F4F1E8'); R(g, gx, G - 7, 2, 4, '#1F3A8A'); R(g, gx, G - 6, 2, 1, '#D62828');
            R(g, gx, G - 9, 2, 2, '#D9A77A'); R(g, gx, G - 11, 2, 2, '#1A1A1A'); R(g, gx, G - 12, 1, 1, '#D62828');
            R(g, gx + 2, G - 14, 1, 14, '#B8B8B8'); R(g, gx + 3, G - 14, 2, 1, '#D62828');
        });
    };

    const basilica = (x) => (g, L) => {
        const st = C.stone, sd = C.stoneD, sl = C.stoneL;
        // Nave, con sus contrafuertes y vitrales.
        surface(g, x + 14, G - 46, 84, 46, st, true); R(g, x + 16, G - 57, 80, 11, C.slate); R(g, x + 18, G - 60, 76, 3, '#4C5962');
        for (let i = 0; i < 6; i++) {
            const bx = x + 38 + i * 9;
            R(g, bx, G - 44, 2, 44, sl); R(g, bx, G - 50, 2, 6, sd); R(g, bx, G - 52, 1, 2, sd);
            R(g, bx + 4, G - 34, 3, 20, C.glass); R(g, bx + 5, G - 36, 1, 2, C.glass);
            R(g, bx + 4, G - 31, 3, 2, '#C0392B'); R(g, bx + 4, G - 26, 3, 2, '#2E86C1'); R(g, bx + 5, G - 22, 1, 2, '#F1C40F');
            L.lights.push([bx + 4, G - 34, 3, 20, bx * 1.7]);
        }
        // Torre posterior, la de los cóndores.
        surface(g, x + 86, G - 70, 12, 70, st, true); R(g, x + 96, G - 70, 2, 70, sd); R(g, x + 90, G - 62, 3, 9, C.glass);
        for (let k = 0; k < 6; k++) R(g, x + 86 + k, G - 70 - (k + 1) * 4, 12 - k * 2, 4, C.slate);
        R(g, x + 91, G - 98, 1, 4, '#C9CED8');

        // Cuerpo central: rosetón, gablete y portada.
        R(g, x + 15, G - 54, 11, 54, st);
        R(g, x + 16, G - 59, 9, 5, st); R(g, x + 18, G - 63, 5, 4, st); R(g, x + 20, G - 66, 1, 3, sd);
        disc(g, x + 20, G - 42, 4, C.glass);
        R(g, x + 20, G - 46, 1, 9, '#C0392B'); R(g, x + 16, G - 42, 9, 1, '#2E86C1'); R(g, x + 20, G - 42, 1, 1, '#F1C40F');
        L.lights.push([x + 17, G - 45, 7, 7, x * 2.2]);
        R(g, x + 17, G - 17, 7, 17, C.door); R(g, x + 18, G - 19, 5, 2, C.door); R(g, x + 20, G - 21, 1, 2, C.door);

        // Las dos torres del frente.
        Q.clocks = [];
        [x + 1, x + 26].forEach((tx) => {
            surface(g, tx, G - 78, 14, 78, st, true); R(g, tx, G - 78, 1, 78, sl); R(g, tx + 12, G - 78, 2, 78, sd);
            R(g, tx, G - 62, 14, 1, sd); R(g, tx, G - 46, 14, 1, sd); R(g, tx, G - 24, 14, 1, sd);
            R(g, tx + 3, G - 75, 2, 11, C.glass); R(g, tx + 8, G - 75, 2, 11, C.glass);
            R(g, tx + 3, G - 59, 8, 8, '#3A3A40'); R(g, tx + 4, G - 58, 6, 6, '#EDE7D5');
            Q.clocks.push([tx + 7, G - 55]);
            R(g, tx + 5, G - 43, 3, 14, C.glass); R(g, tx + 6, G - 45, 1, 2, C.glass); win(g, L, tx + 5, G - 20, 3, 8);
            R(g, tx - 1, G - 86, 2, 9, sd); R(g, tx + 13, G - 86, 2, 9, sd); R(g, tx - 1, G - 88, 1, 2, sd); R(g, tx + 14, G - 88, 1, 2, sd);
            R(g, tx - 2, G - 63, 2, 1, sd); R(g, tx + 14, G - 63, 2, 1, sd);   // gárgolas
            for (let k = 0; k < 7; k++) R(g, tx + k, G - 78 - (k + 1) * 4, 14 - k * 2, 4, k % 2 ? '#4C5962' : C.slate);
            R(g, tx + 7, G - 111, 1, 5, '#C9CED8'); R(g, tx + 6, G - 110, 3, 1, '#C9CED8');
        });
        R(g, x - 2, G - 2, 46, 2, sl);
    };

    const metroEntrance = (g, x) => {
        R(g, x + 3, G - 9, 14, 9, '#1B2030'); for (let i = 0; i < 4; i++) R(g, x + 3, G - 8 + i * 2, 14, 1, '#3A4156');
        R(g, x, G - 13, 20, 2, '#2E5E9E'); R(g, x + 1, G - 11, 1, 11, '#C9CED8'); R(g, x + 18, G - 11, 1, 11, '#C9CED8');
        R(g, x + 21, G - 22, 1, 22, '#8A8A8A'); R(g, x + 18, G - 29, 7, 7, '#D62828'); Q.text(g, 'M', x + 19, G - 28, '#FFFFFF');
        R(g, x + 8, G + 17, 5, 8, '#2A2F40');
    };

    const stadium = (x) => (g, L) => {
        R(g, x, G - 22, 96, 22, '#B9BDC6'); R(g, x + 4, G - 26, 88, 4, '#C9CED8'); R(g, x + 12, G - 29, 72, 3, '#D6DAE1');
        for (let i = 0; i < 40; i++) R(g, x + 8 + i * 2, G - 27 + (i % 3), 1, 1, pick(['#F2C200', '#1F4FA3', '#D62828', '#FFFFFF'], i));
        for (let i = 0; i < 12; i++) { R(g, x + 2 + i * 8, G - 21, 1, 21, C.stone); R(g, x + 4 + i * 8, G - 12, 5, 12, '#5A6070'); }
        R(g, x + 34, G - 21, 28, 7, '#1F2A3A'); Q.text(g, 'QUITO', x + 38, G - 20, '#FFE500');
        Q.floods = [];
        [6, 34, 62, 90].forEach((dx) => { R(g, x + dx, G - 54, 1, 30, '#777C88'); R(g, x + dx - 3, G - 57, 7, 3, '#DADDE3'); Q.floods.push([x + dx, G - 56]); });
        L.lights.push([x + 12, G - 28, 72, 1, x]);
    };

    const mitad = (x) => (g) => {
        const cx = x + 60;
        R(g, x - 16, G, 150, 3, '#D8C9A3');
        R(g, cx - 26, G - 6, 52, 6, '#B9B2A3'); R(g, cx - 22, G - 10, 44, 4, '#A9A294');
        for (let k = 0; k < 44; k++) {
            const hw = 13 - Math.round(k * 5 / 44), y = G - 11 - k;
            R(g, cx - hw, y, hw * 2, 1, k % 7 === 0 ? '#8E877A' : '#A8A193');
            R(g, cx + Math.round(hw * 0.4), y, hw - Math.round(hw * 0.4), 1, k % 7 === 0 ? '#7A7468' : '#8E877A');
        }
        R(g, cx - 1, G - 24, 2, 8, '#4A463E'); R(g, cx - 1, G - 40, 2, 5, '#4A463E');
        Q.text(g, 'E', cx - 6, G - 18, '#4A463E');
        R(g, cx - 4, G - 58, 8, 3, '#8E877A');
        disc(g, cx, G - 65, 6, '#C8A24A'); R(g, cx - 6, G - 65, 13, 1, '#8E6F2B'); R(g, cx - 2, G - 70, 2, 2, '#E8CC7A'); R(g, cx - 3, G - 62, 5, 1, '#A8873A');
        R(g, cx, G - 5, 1, 5, '#F2C200'); R(g, cx - 1, G, 2, 16, '#F2C200');   // la línea ecuatorial

        [-44, -36, 36, 44].forEach((dx, i) => {
            R(g, cx + dx, G - 30, 1, 30, '#8A8A8A');
            R(g, cx + dx + 1, G - 30, 6, 2, '#F2C200'); R(g, cx + dx + 1, G - 28, 6, 1, pick(['#1F4FA3', '#1F4FA3'], i)); R(g, cx + dx + 1, G - 27, 6, 1, '#D62828');
        });
        R(g, x + 100, G - 11, 44, 9, '#8E877A'); R(g, x + 100, G - 11, 44, 1, '#A8A193');
        Q.text(g, 'LATITUD 0°', x + 103, G - 9, '#F4F1E8');
    };

    // ───────────────────────── La calle y el subsuelo ─────────────────────────
    const buildFront = () => {
        const L = mk('front', 1), g = L.g, w = L.w;
        Q.lamps = [];

        // Subsuelo.
        R(g, 0, G + 17, w, H - G - 17, '#3B2A20'); R(g, 0, G + 17, w, 2, '#2E2019');
        for (let i = 0; i < 520; i++) R(g, hash(i) * w, G + 20 + hash(i + 0.3) * 26, 2, 1, hash(i + 0.6) > 0.5 ? '#4A372B' : '#2E2019');
        R(g, 40, 191, 1290, 21, '#14161F');
        for (let x = 40; x < 1330; x += 12) R(g, x, 191, 1, 21, '#1E2230');
        R(g, 40, 209, 1290, 1, '#5A6070'); R(g, 40, 210, 1290, 2, '#2A2F40');

        Q.stations = [[190, 'SAN FRANCISCO'], [850, 'EL EJIDO'], [1010, 'LA CAROLINA']];
        Q.stations.forEach(([sx, name]) => {
            R(g, sx - 36, 189, 72, 23, '#262B3A'); R(g, sx - 36, 206, 72, 3, '#8C8F99'); R(g, sx - 36, 205, 72, 1, '#F2C200');
            R(g, sx - 34, 190, 68, 1, '#EDE7B0');
            const tw = Q.textW(name); R(g, sx - tw / 2 - 3, 193, tw + 6, 9, '#1E4FA3'); Q.text(g, name, sx - tw / 2, 195, '#FFFFFF');
        });

        // Calle: adoquín en el centro histórico, asfalto al norte.
        R(g, 0, G, w, 3, '#B8B2A6'); R(g, 0, G + 2, w, 1, '#8A857A');
        R(g, 0, G + 3, 720, 13, '#5E5A55'); R(g, 720, G + 3, w - 720, 13, '#3A3D46');
        for (let row = 0; row < 4; row++) {
            for (let x = -(row % 2) * 2; x < 720; x += 5) {
                R(g, x, G + 4 + row * 3, 4, 2, pick(['#6B675D', '#625F57', '#777165', '#5C5953'], x + row * 371));
                if (hash(x + row) > 0.7) R(g, x, G + 4 + row * 3, 3, 1, '#827C70');
            }
        }
        for (let x = 0; x < w; x += 10) R(g, x, G + 9, 5, 1, x < 720 ? '#8A857A' : '#C9C9B0');
        R(g, 0, G + 16, w, 1, '#8A857A');
        [316, 618, 908, 1196].forEach((zx) => { for (let i = 0; i < 6; i++) R(g, zx + i * 3, G + 4, 2, 11, '#D8D4C8'); });
        // Juntas de la vereda, alcantarillas y tapas de servicio.
        for (let x = 0; x < w; x += 7) R(g, x, G, 1, 2, '#9E978B');
        for (let x = 26; x < w; x += 91) {
            R(g, x, G + 3, 5, 2, '#303B3E');
            for (let k = 0; k < 5; k += 2) R(g, x + k, G + 3, 1, 1, '#83867D');
            R(g, x + 23, G + 12, 4, 2, '#484A47'); R(g, x + 24, G + 12, 2, 1, '#72756C');
        }

        // Sur: casas coloniales.
        house(g, L, 6, 34, 30, 1); house(g, L, 42, 24, 22, 2); house(g, L, 68, 36, 32, 3); house(g, L, 106, 22, 24, 4);
        lamp(g, 40); lamp(g, 104);

        const add = (id, x, y, w2, h2, fn, lit = true) => { fn(g, L); mark(L, id, x, y, w2, h2, fn, null, lit); };

        add('sanfrancisco', 132, G - 84, 116, 84, sanFrancisco(133));
        // Un carrito de espumillas en la plaza.
        R(g, 222, G - 6, 8, 5, '#F4F1E8'); R(g, 223, G - 1, 2, 1, '#2A2A2E'); R(g, 228, G - 1, 2, 1, '#2A2A2E');
        R(g, 226, G - 14, 1, 8, '#8A8A8A'); R(g, 221, G - 16, 11, 2, '#E0314F'); R(g, 223, G - 17, 7, 1, '#F2C200');
        R(g, 224, G - 8, 2, 2, '#F5B8D2'); R(g, 227, G - 8, 2, 2, '#FFFFFF');

        add('compania', 262, G - 76, 60, 76, compania(263));
        lamp(g, 258); lamp(g, 326);
        add('catedral', 336, G - 73, 80, 73, catedral(338));
        add('plaza', 420, G - 56, 82, 56, plaza(421), false);
        add('carondelet', 506, G - 68, 118, 68, carondelet(508));
        lamp(g, 502); lamp(g, 626);

        house(g, L, 634, 36, 32, 7); house(g, L, 672, 24, 24, 8); house(g, L, 698, 22, 30, 9);
        add('basilica', 722, G - 112, 104, 112, basilica(726));

        // El Ejido: árboles, arupos y el jardín del colibrí.
        [836, 848, 862, 880, 894, 906].forEach((tx, i) => tree(g, tx, 20 + (i * 7) % 12, i % 3 === 1 ? 1 : 0));
        R(g, 866, G - 3, 16, 3, C.leaf);
        [867, 870, 873, 876, 879].forEach((fx, i) => { R(g, fx, G - 5, 1, 2, C.leafD); R(g, fx, G - 6, 2, 2, pick(['#E0314F', '#FF8A3D', '#F06292', '#F2C200'], i)); });
        Q.garden = { x: 873, y: G - 10 };
        metroEntrance(g, 840);

        // Norte: torres, parque y metro.
        const x0 = 924;
        tower(g, L, 926, 26, 72, 0, 1); tower(g, L, 956, 22, 98, 1, 2);
        metroEntrance(g, 1000);
        tower(g, L, 1026, 30, 86, 2, 3); tower(g, L, 1060, 20, 112, 3, 4);
        // Centro comercial con pantalla.
        R(g, 1084, G - 26, 38, 26, '#D0D4DC'); R(g, 1084, G - 26, 38, 2, '#9AA0AC'); R(g, 1088, G - 8, 30, 8, '#1F2A3A');
        R(g, 1090, G - 22, 26, 11, '#10131C'); Q.billboard = { x: 1091, y: G - 21, w: 24, h: 9 };
        tower(g, L, 1126, 24, 64, 4, 5);
        [1156, 1168, 1182].forEach((tx, i) => tree(g, tx, 22 + i * 3, i === 1 ? 1 : 0));
        R(g, 1160, G - 2, 28, 2, '#5FA8D6'); R(g, 1170, G - 3, 4, 2, '#E0314F'); R(g, 1171, G - 5, 1, 2, '#FFFFFF');   // laguna con un bote
        mark(L, 'metro', 998, G - 30, 26, 30);
        mark(L, 'moderna', x0, G - 116, 270, 116);

        add('estadio', 1204, G - 58, 100, 58, stadium(1206), false);
        house(g, L, 1312, 24, 22, 12);

        add('mitad', 1340, G - 72, 156, 72, mitad(1350));

        // Bancas, bolardos, jardineras y una parada con marquesina de vidrio.
        [246, 412, 493, 829, 889, 1187].forEach((x) => {
            R(g, x, G - 5, 9, 2, '#87664B'); R(g, x, G - 2, 9, 1, '#AE8960');
            R(g, x + 1, G - 3, 1, 5, '#414747'); R(g, x + 7, G - 3, 1, 5, '#414747');
        });
        [250, 332, 417, 504, 628, 832, 920, 1198].forEach((x) => {
            R(g, x, G - 3, 1, 5, '#525957'); R(g, x, G - 3, 1, 1, '#C3BAA5');
        });
        [130, 418, 630, 918, 1189].forEach((x) => {
            R(g, x, G - 4, 4, 4, '#956A4C'); R(g, x - 1, G - 5, 6, 2, '#497C4F');
            R(g, x, G - 6, 2, 1, '#D5A96B'); R(g, x + 3, G - 6, 1, 1, '#DC9AAB');
        });
        R(g, 978, G - 15, 20, 1, '#5A6A6D'); R(g, 980, G - 14, 16, 10, '#98AFAC');
        R(g, 981, G - 13, 6, 8, '#BDCDC2');
        [979, 989, 997].forEach((x) => R(g, x, G - 14, 1, 14, '#4A5759'));
        R(g, 981, G - 4, 14, 1, '#6A5748'); R(g, 982, G - 3, 1, 3, '#4A5759');
        // Semáforos junto a los cruces (las luces se animan en actors.js).
        Q.signals = [331, 633, 923, 1211];
        Q.signals.forEach((x) => {
            R(g, x, G - 20, 1, 20, '#454E4C'); R(g, x - 2, G - 22, 4, 8, '#263638');
            R(g, x - 1, G - 21, 1, 1, '#8B4943'); R(g, x - 1, G - 19, 1, 1, '#928053'); R(g, x - 1, G - 17, 1, 1, '#3B6955');
        });
    };

    Q.buildWorld = () => { buildFar(); buildPichincha(); buildHills(); buildCity(); buildFront(); };
})();
