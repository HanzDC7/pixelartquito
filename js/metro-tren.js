'use strict';

/*
 * Jefe de línea: un tren por dentro.
 *
 * Un corte del vagón del tren elegido: los asientos a lo largo, las barras
 * amarillas, las puertas y, por las ventanas, el túnel que pasa o el andén de
 * la estación donde está parado. La gente que se ve es la que lleva el tren en
 * la simulación en ese instante: primero se llenan los asientos y después el
 * pasillo. Arriba, el termómetro de la línea con la próxima estación.
 *
 * Todo se dibuja en «unidades» de unos 11 cm, que según el tamaño de la
 * pantalla valen de 2 a 5 píxeles: así se ve bien en un teléfono y en un monitor.
 */
(() => {
    const { R, hash, clamp } = Q, S = Q.state;
    const PIEL = ['#D9A77A', '#B98058', '#E8BF98', '#C89466'], PELO = ['#2A1E16', '#17171B', '#5A3A22', '#8A8F9C', '#3A2A1E'];
    const ROPA = ['#D62828', '#1F4FA3', '#F2C200', '#2FA36B', '#F4F1E8', '#8B5CF6', '#FF8A3D', '#3A3A40', '#C0392B', '#2A6FD6', '#E58FB6', '#6B4226'];
    const PANT = ['#2A2F40', '#3A2A1E', '#1F3A8A', '#4A4A52'];
    const MODULO = 46;        // cada cuántas unidades se repite el vagón: dos ventanas y una puerta

    /**
     * Pinta el interior del tren `t` en el rectángulo (0, 0, W, HH).
     * `info` trae lo que va en los letreros: { proxima, en, destino, eta }.
     */
    Q.dentroTren = (v, W, HH, sim, t, info) => {
        const tm = S.time, N = sim.est.length;
        const u = clamp(Math.min(Math.floor(HH * 0.58 / 30), Math.floor(W / 84)), 2, 5);
        const marcha = t.estado === 'viaje', parado = t.estado === 'parada', averiado = t.estado === 'averiado';
        const tiembla = marcha && Math.floor(tm * 9) % 5 === 0 ? 1 : 0;
        const techo = Math.round((HH - 30 * u) / 2) + 6 + tiembla, piso = techo + 20 * u;       // el vagón, centrado
        const lleno = t.total / JEFE.CAPACIDAD;
        const B = (x, y, w, h, c) => R(v, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c);

        // ───── Fuera del vagón: el túnel ─────
        B(0, 0, W, HH, '#0B0D14');
        for (let y = 6; y < techo - 4 * u; y += 9) B(0, y, W, 1, '#161A26');
        B(0, piso + 7 * u, W, HH, '#14161F'); B(0, piso + 7 * u, W, 1, '#5A6070');
        const corre = marcha ? tm * 260 : 0;
        for (let x = -((corre * 0.6) % 14); x < W; x += 14) B(x, piso + 7 * u + 2, 6, 2, '#2A2F40');      // los durmientes

        // ───── Lo que se ve por las ventanas y las puertas ─────
        const y0 = techo + 4 * u, y1 = techo + 13 * u;
        const fuera = (x, w, ya, yb) => {
            if (parado) {
                // La misma paleta de estación que en la vista exterior al vagón.
                B(x, ya, w, yb - ya, t.sig === 6 ? '#E9BD19' : '#E4E7E2'); B(x, ya + (y1 - y0) * 0.25, w, Math.max(2, u), '#C52D37');
                for (let k = Math.ceil(x / (4 * u)) * 4 * u; k < x + w; k += 4 * u) B(k, ya, 1, yb - ya, '#C3C9D4');
                if (yb > y1) { B(x, y1 + 2 * u, w, yb - y1 - 2 * u, '#A9ADB8'); B(x, y1 + 2 * u, w, Math.max(1, u >> 1), '#F2C200'); }
            } else {
                B(x, ya, w, yb - ya, '#10131C');
                B(x, ya + 2 * u, w, 1, '#262B3A'); B(x, ya + 5 * u, w, 1, '#1D212E');
                if (marcha) for (let k = 0; k < 6; k++) { const lx = W - ((corre + k * 173 + hash(k) * 90) % (W + 120)) + 40; if (lx + 5 * u > x && lx < x + w) { const a = Math.max(lx, x), b = Math.min(lx + 5 * u, x + w); B(a, ya + u, b - a, u, '#FFF6C8'); } }
            }
        };

        // ───── El vagón ─────
        B(0, techo - 3 * u, W, 3 * u, '#C9CED8'); B(0, techo - 3 * u, W, 1, '#E9ECF2'); B(0, techo - u, W, u, '#8A8F9C');
        B(0, techo, W, 20 * u, '#E9ECF2'); B(0, techo, W, u, '#FFFFFF'); B(0, techo + u, W, 1, '#C9CED8');
        for (let x = 4 * u; x < W; x += 16 * u) B(x, techo + 1, 8 * u, Math.max(1, u - 1), '#FFF6C8');      // las luces
        const x00 = Math.round(W / 2 - MODULO * u * Math.ceil(W / (MODULO * u * 2)) - 4.5 * u);      // una puerta, justo en el centro
        const puertas = [];
        for (let mx = x00; mx < W; mx += MODULO * u) {
            // La puerta: dos hojas con su ventana. Con el tren parado, abiertas.
            const px = mx, pw = 9 * u; puertas.push(px);
            B(px - u, techo + u, pw + 2 * u, 19 * u, '#B9BDC6');
            if (parado) {
                fuera(px, pw, techo + 2 * u, piso);
                B(px, techo + 2 * u, u, 18 * u, '#8A8F9C'); B(px + pw - u, techo + 2 * u, u, 18 * u, '#8A8F9C');
            } else {
                B(px, techo + 2 * u, pw, 18 * u, '#D5DAE3'); B(px + pw / 2 - 1, techo + 2 * u, 2, 18 * u, '#8A8F9C');
                fuera(px + u, 3 * u, y0, y1 - u); fuera(px + 5 * u, 3 * u, y0, y1 - u);
                B(px, piso - 3 * u, pw, u, '#D62828');
            }
            // Sobre la puerta, el letrero de la próxima estación.
            // Entre puerta y puerta: dos ventanas y, debajo, los asientos a lo largo.
            for (let k = 0; k < 2; k++) {
                const wx = mx + (11 + k * 17.5) * u, ww = 14 * u;
                B(wx - u, y0 - u, ww + 2 * u, y1 - y0 + 2 * u, '#8A8F9C'); fuera(wx, ww, y0, y1);
                const sx = wx - u, sw = ww + 2 * u, color = (Math.round((mx - x00) / (MODULO * u)) + k) % 2 ? '#1F4FA3' : '#C0392B';
                B(sx, piso - 7 * u, sw, 4 * u, color); B(sx, piso - 7 * u, sw, 1, Q.mix(color, '#FFFFFF', 0.3)); B(sx, piso - 3 * u, sw, u, Q.mix(color, '#000000', 0.25));
                B(sx + u, piso - 2 * u, u, 2 * u, '#8A8F9C'); B(sx + sw - 2 * u, piso - 2 * u, u, 2 * u, '#8A8F9C');
            }
        }
        // La franja roja y azul del Metro, por fuera, y los bajos del tren.
        B(0, piso, W, u, '#5A6070'); B(0, piso + u, W, u, '#D62828'); B(0, piso + 2 * u, W, u, '#1F4FA3'); B(0, piso + 3 * u, W, 2 * u, '#3A3D46');
        for (let x = x00 + 20 * u; x < W; x += MODULO * u * 2) { B(x, piso + 4 * u, 14 * u, 2 * u, '#2A2F40'); B(x + 2 * u, piso + 5 * u, 3 * u, 2 * u, '#17171B'); B(x + 9 * u, piso + 5 * u, 3 * u, 2 * u, '#17171B'); }

        // ───── La gente ─────
        /** Alguien sentado, de frente; (x, y) es la esquina del asiento donde va. */
        const sentado = (x, s) => {
            s = Math.abs(Math.round(s));      // la semilla elige colores de las listas: siempre un entero que no sea negativo
            const piel = PIEL[s % 4], ropa = ROPA[s % ROPA.length], y = piso - 3 * u;
            B(x + u * 0.5, y - 9 * u, 3 * u, 3 * u, piel); B(x + u * 0.5, y - 10 * u, 3 * u, u, PELO[s % 5]);
            if (u > 2) { B(x + u * 1.1, y - 8 * u, 1, 1, '#17171B'); B(x + u * 2.6, y - 8 * u, 1, 1, '#17171B'); }
            B(x, y - 6 * u, 4 * u, 5 * u, ropa); B(x, y - u, 4 * u, u, PANT[s % 4]);
            B(x + u * 0.3, y, u * 1.4, 3 * u, PANT[s % 4]); B(x + u * 2.3, y, u * 1.4, 3 * u, PANT[s % 4]);
            if (s % 6 === 0) B(x + u, y - 4 * u, 2 * u, 3 * u, '#F4F1E8');                 // lee el periódico
            else if (s % 6 === 1) B(x + u * 1.5, y - 3 * u, u, 2 * u, '#17171B');          // mira el teléfono
        };
        /** Alguien de pie, agarrado de la barra; (x) es su borde izquierdo. */
        const dePie = (x, s, fondo) => {
            s = Math.abs(Math.round(s));
            const piel = PIEL[s % 4], ropa = ROPA[(s * 3) % ROPA.length], vaiven = marcha ? Math.round(Math.sin(tm * 3 + s) * u * 0.5) : 0;
            const y = piso - (fondo ? u : 0), px = x + vaiven, alto = 14 + (s % 3);
            B(px + u * 0.5, y - alto * u, 3 * u, 3 * u, piel); B(px + u * 0.5, y - (alto + 1) * u, 3 * u, u, PELO[(s * 7) % 5]);
            if (s % 9 === 0) B(px, y - (alto + 2) * u, 4 * u, u, '#3A2A1E');               // con sombrero
            B(px, y - (alto - 3) * u, 4 * u, 6 * u, fondo ? Q.mix(ropa, '#2A2F40', 0.25) : ropa);
            B(px + u * 0.3, y - (alto - 9) * u, u * 1.4, (alto - 9) * u, PANT[s % 4]); B(px + u * 2.3, y - (alto - 9) * u, u * 1.4, (alto - 9) * u, PANT[s % 4]);
            if (s % 2) { B(px + 3 * u, y - (alto + 2) * u, u, 4 * u, piel); B(px + 3 * u, techo + 3 * u, 1, y - (alto + 2) * u - techo - 3 * u, '#3A3A40'); }      // un brazo arriba, a la agarradera
            else if (s % 5 === 0) B(px - u, y - (alto - 5) * u, u, 3 * u, '#6B4226');     // con bolso
        };
        // Primero los asientos: tres por banca. Se llenan con el primer cuarto de la carga.
        const sentados = clamp(lleno / 0.24, 0, 1);
        for (let mx = x00, m = 0; mx < W; mx += MODULO * u, m++) for (let k = 0; k < 2; k++) for (let a = 0; a < 3; a++) {
            const s = t.id * 131 + m * 17 + k * 5 + a;
            if (hash(s * 1.7) < sentados) sentado(mx + (10.6 + k * 17.5 + a * 5.2) * u, s);
        }
        // Después el pasillo: de pie, cada vez más juntos.
        const dens = clamp((lleno - 0.18) / 0.82, 0, 1), paso = 2.6 * u, cupo = Math.ceil(W / paso);
        for (let fila = 1; fila >= 0; fila--) for (let k = 0; k < cupo; k++) {
            const s = t.id * 977 + k * 13 + fila * 7;
            if (hash(s * 0.91) < dens * (fila ? 0.75 : 0.95)) dePie(k * paso + hash(s) * u * 1.5 - u, s, fila === 1);
        }
        // Con las puertas abiertas, alguien entra y alguien sale.
        if (parado) for (const px of puertas) if (px > -9 * u && px < W) { const f = (tm * 0.9 + px * 0.01) % 1; dePie(px + 2 * u, t.id + Math.round(px), true); if (f < 0.5) dePie(px + 4 * u + f * 4 * u, t.id * 3 + Math.round(px), false); }

        // Las barras: los postes junto a las puertas y el pasamanos de arriba, por delante de la gente.
        B(0, techo + 3 * u, W, Math.max(1, u >> 1), '#F2C200');
        for (const px of puertas) { B(px - 2 * u, techo + u, Math.max(1, u >> 1), 19 * u, '#F2C200'); B(px + 10.5 * u, techo + u, Math.max(1, u >> 1), 19 * u, '#F2C200'); }
        for (let x = x00 % (6 * u); x < W; x += 6 * u) B(x, techo + 3 * u, 1, 2 * u, '#C8A24A');

        // ───── Los letreros ─────
        const placa = (texto, x, y, fondo, color) => { const w = Q.textW(texto); R(v, x - 3, y - 2, w + 6, 9, fondo); Q.text(v, texto, x, y, color); return w + 6; };
        // El termómetro de la línea: las estaciones que ya pasó, la próxima (parpadea) y las que faltan.
        {
            const mx = 8, x0 = mx, x1 = W - mx, yy = Math.max(12, techo - 3 * u - 22);
            R(v, 0, yy - 10, W, 23, '#0B1020'); R(v, x0, yy, x1 - x0, 1, '#5E72A8');
            for (let i = 0; i < N; i++) {
                const x = Math.round(x0 + i / (N - 1) * (x1 - x0)), pasada = t.dir === 0 ? i < t.sig : i > t.sig, prox = i === t.sig, cerrada = sim.cerrada(i);
                const c = cerrada ? '#E0314F' : prox ? (Math.floor(tm * 3) % 2 ? '#FFE500' : '#FFFFFF') : pasada ? '#3A4670' : '#C8D4F0';
                R(v, x - 1, yy - 1, 3, 3, c);
                if (W >= 360 || prox) { const n = sim.est[i].c; Q.text(v, n, clamp(x - Math.floor(Q.textW(n) / 2), 2, W - Q.textW(n) - 2), yy + (W >= 360 && i % 2 ? -8 : 5), c); }
            }
        }
        const led = averiado ? 'TREN DETENIDO · ESPERE' : parado ? `ESTACION ${Q.plano(info.en)}` : `PROXIMA: ${Q.plano(info.proxima)}`;
        const lw = Q.textW(led) + 8, lx = Math.round(W / 2 - lw / 2);
        R(v, lx, techo + u + 1, lw, 9, '#0B0D14'); Q.text(v, led, lx + 4, techo + u + 3, averiado ? (Math.floor(tm * 3) % 2 ? '#E0314F' : '#5A2030') : '#FFB02E');
        let py = HH - 11;
        const carga = `${Math.round(t.total).toLocaleString('de-DE')} PASAJEROS · ${Math.round(lleno * 100)}%`;
        placa(carga, 6, py, lleno > 0.95 ? '#B01E3A' : lleno > 0.7 ? '#8A4A1E' : '#1E4FA3', '#FFFFFF'); py -= 11;
        placa(`TREN ${t.id} · A ${Q.plano(info.destino)}`, 6, py, '#0B1020', '#FFE500');
        if (info.eta !== null && marcha && W > 250) placa(`LLEGA EN ${Math.max(1, Math.ceil(info.eta))} MIN`, W - Q.textW(`LLEGA EN ${Math.max(1, Math.ceil(info.eta))} MIN`) - 9, HH - 11, '#0B1020', '#FFFFFF');
    };
})();
