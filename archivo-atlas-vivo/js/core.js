'use strict';

/*
 * Base compartida: tamaño del lienzo, utilidades de dibujo y la fuente de
 * píxeles. Todo cuelga de Q para que index.html funcione abriéndolo con doble
 * clic (los módulos ES no cargan desde file://).
 */
const Q = {
    W: 384,        // ancho del lienzo en píxeles lógicos
    H: 216,
    GROUND: 168,   // línea donde las casas tocan la vereda
    WORLD: 1500,   // largo de la ciudad, de sur (0) a norte
};
Q.MAXCAM = Q.WORLD - Q.W;

Q.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
Q.lerp = (a, b, t) => a + (b - a) * t;
Q.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
Q.pick = (list, seed) => list[Math.floor(Q.hash(seed) * list.length) % list.length];

// Ruido continuo: agrupa la textura en terreno y follaje, sin efecto de estática.
Q.noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const smooth = (v) => v * v * (3 - 2 * v);
    const u = smooth(x - ix), v = smooth(y - iy);
    const at = (dx, dy) => Q.hash((ix + dx) * 37.1 + (iy + dy) * 91.7);
    return Q.lerp(Q.lerp(at(0, 0), at(1, 0), u), Q.lerp(at(0, 1), at(1, 1), u), v);
};

Q.hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
Q.mix = (a, b, t) => {
    const A = Q.hex(a), B = Q.hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

Q.canvas = (w, h) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { cv, g };
};

Q.R = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };

/** Línea de un píxel entre dos puntos. */
Q.line = (g, x0, y0, x1, y1, color) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    g.fillStyle = color;
    for (let i = 0; i < 2000; i++) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) return;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
};

/** Disco relleno; sirve para cúpulas, copas de árbol y el globo del monumento. */
Q.disc = (g, cx, cy, r, color, onlyTop = false) => {
    for (let dy = -r; dy <= (onlyTop ? 0 : r); dy++) {
        const hw = Math.round(Math.sqrt(r * r - dy * dy));
        Q.R(g, cx - hw, cy + dy, hw * 2 + 1, 1, color);
    }
};

/** Cúmulo precalculado: silueta irregular, volumen y base en sombra. */
Q.cloudSprite = (seed, light = '#FFFDF5', shade = '#B5C8D6') => {
    const c = Q.canvas(76, 30), g = c.g;
    for (let i = 0; i < 7; i++) {
        const r = 5 + Math.floor(Q.hash(seed + i) * 6);
        Q.disc(g, 9 + i * 9, 19 - Math.sin(i / 6 * Math.PI) * 7, r, shade);
    }
    Q.R(g, 9, 19, 55, 7, shade);
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 7; i++) {
        const r = 5 + Math.floor(Q.hash(seed + i) * 6);
        const x = 8 + i * 9, y = 16 - Math.sin(i / 6 * Math.PI) * 7;
        Q.disc(g, x, y, r, Q.mix(light, shade, 0.22));
        Q.disc(g, x - 2, y - 3, Math.max(2, r - 2), light);
    }
    Q.R(g, 0, 24, 76, 2, Q.mix(light, shade, 0.82));
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 26, 76, 4);
    return c.cv;
};

// Fuente de 5 filas. El ancho sale del largo: 3 columnas casi todas; M, N y W
// usan 5 porque en 3 no se distinguen.
Q.FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '1000111011101011000110001', N: '1000111001101011001110001', O: '111101101101111',
    P: '110101110100100', Q: '111101101111001', R: '110101110101101', S: '011100010001110',
    T: '111010010010010', U: '101101101101111', V: '101101101101010',
    W: '1000110001101011101110001', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '.': '000000000000010', ':': '000010000010000', '-': '000000111000000', '!': '010010010000010',
    '°': '111101111000000', '·': '000000010000000',
};
Q.glyphW = (ch) => (Q.FONT[ch] ? Q.FONT[ch].length / 5 : 3);
Q.textW = (str) => [...str].reduce((w, ch) => w + Q.glyphW(ch) + 1, 0) - 1;
Q.text = (g, str, x, y, color) => {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = color;
    for (const ch of str) {
        const bits = Q.FONT[ch], w = Q.glyphW(ch);
        for (let b = 0; bits && b < bits.length; b++) {
            if (bits[b] === '1') g.fillRect(x + (b % w), y + Math.floor(b / w), 1, 1);
        }
        x += w + 1;
    }
};
/** Texto sobre una placa oscura, para los rótulos que flotan encima de la escena. */
Q.label = (g, str, cx, y, color = '#FFFFFF', bg = '#0B1020') => {
    const w = Q.textW(str), x = Math.round(Q.clamp(cx - w / 2, 3, Q.W - w - 3));
    Q.R(g, x - 2, y - 2, w + 4, 9, bg);
    Q.text(g, str, x, y, color);
};

// Estado que cambian los controles y lee todo lo demás.
Q.state = {
    cam: 330, camV: 0, camTarget: null,
    hour: 10, playing: true,
    weather: 'clear',      // clear | rain | fog
    fiestas: false, tour: false, sound: false,
    time: 0,               // segundos de animación
    mouse: { x: -99, y: -99, inside: false, movedAt: -99 },
    hover: null,
};

// Cuánto de noche es, de 0 (día) a 1. En Quito amanece y anochece casi a la
// misma hora todo el año: hacia las 6:10 y las 18:15.
Q.night = (h) => {
    if (h >= 6.6 && h <= 17.6) return 0;
    if (h > 17.6 && h < 19.4) return (h - 17.6) / 1.8;
    if (h > 5 && h < 6.6) return 1 - (h - 5) / 1.6;
    return 1;
};
// El resplandor naranja del amanecer y del atardecer.
Q.dusk = (h) => Math.max(0, 1 - Math.abs(h - 18.2) / 1.1, 1 - Math.abs(h - 6) / 0.9);
