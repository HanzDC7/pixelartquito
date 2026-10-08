'use strict';

/*
 * Base del mapa real: utilidades de dibujo, la fuente de píxeles y el estado.
 * (La versión resumida, en /resumido, tiene la suya propia.)
 */
const Q = {
    W: 640,        // ancho del lienzo en píxeles lógicos
    H: 360,
};

Q.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
Q.lerp = (a, b, t) => a + (b - a) * t;
Q.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
Q.pick = (list, seed) => list[Math.floor(Q.hash(seed) * list.length) % list.length];

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
    for (let i = 0; i < 4000; i++) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) return;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
};

/** Disco relleno; sirve para cúpulas, copas de árbol y la rosa de los vientos. */
Q.disc = (g, cx, cy, r, color, onlyTop = false) => {
    for (let dy = -r; dy <= (onlyTop ? 0 : r); dy++) {
        const hw = Math.round(Math.sqrt(r * r - dy * dy));
        Q.R(g, cx - hw, cy + dy, hw * 2 + 1, 1, color);
    }
};

// Fuente de 5 filas. El ancho sale del largo: 3 columnas casi todas; M, N, Ñ y W
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
    '°': '111101111000000', '·': '000000010000000', ',': '000000000010100',
    'Ñ': '0111010001110011010110011',
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
/** El mismo texto, girado un cuarto de vuelta: se lee de abajo hacia arriba. Para las calles verticales. */
Q.textV = (g, str, x, y, color) => {
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = color;
    for (const ch of str) {
        const bits = Q.FONT[ch], w = Q.glyphW(ch);
        for (let b = 0; bits && b < bits.length; b++) {
            if (bits[b] === '1') g.fillRect(x + Math.floor(b / w), y - (b % w), 1, 1);
        }
        y -= w + 1;
    }
};
/** Texto sobre una placa oscura, para los rótulos que flotan encima de la escena. */
Q.label = (g, str, cx, y, color = '#FFFFFF', bg = '#0B1020') => {
    const w = Q.textW(str), x = Math.round(Q.clamp(cx - w / 2, 3, Q.W - w - 3));
    Q.R(g, x - 2, y - 2, w + 4, 9, bg);
    Q.text(g, str, x, y, color);
};
/** Mayúsculas sin tildes, que es lo que sabe dibujar la fuente; la Ñ se conserva. */
Q.plano = (str) => str.toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ').replace(/[^A-Z0-9Ñ .,:·°!-]/g, '');

// Estado que cambian los controles y lee todo lo demás.
Q.state = {
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
