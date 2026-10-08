'use strict';

/*
 * Jefe de línea: lo que el día le hace a la ciudad, dibujado sobre el mapa real.
 *
 * El juego se maneja desde dentro de las estaciones y desde la línea de abajo;
 * esto es lo que se ve al salir al mapa:
 *   - Los eventos del día, en su sitio de verdad: el estadio, el parque, la
 *     plaza. Antes de que terminen, un aro y su rótulo con la hora; cuando
 *     terminan, la gente camina del sitio a su estación.
 *   - La línea cortada: el tramo sin servicio se pinta de rojo, y cada
 *     estación cerrada por el agua queda en medio de un charco.
 *   - El granizo de una tormenta fuerte.
 *   - Las estaciones en apuros, con una señal y su nombre, y a la escala de
 *     la región, la línea entera con el ánimo de cada estación.
 *
 * Lo llama js/juego.js desde su capa del mapa, dos veces por cuadro:
 *   Q.ciudad(v, X, Y, m, metro, enCamino)   al dibujar los trenes, con las funciones de proyección de
 *                                           ese cuadro (X e Y pasan de metros a píxeles) y `m`, los
 *                                           metros por píxel. Aquí solo se toma nota.
 *   Q.ciudad.encima(v)                      justo antes de la línea de abajo. Aquí se dibuja.
 * Son dos pasos porque la primera llamada cae antes de que el mapa oscurezca la
 * escena de noche, y casi todos los eventos son de noche: lo que se pintara
 * ahí no se vería. Lee el día de Q.juego.sim y Q.juego.dia y no cambia nada
 * de la partida.
 */
(() => {
    const { R, clamp, hash, lerp } = Q, S = Q.state;
    const GENTE = ['#FF5470', '#7CC4FF', '#FFE500', '#FFFFFF', '#C792EA', '#FF8A3D', '#3DDC84', '#FFB3C1'];
    const ORO = '#FFE500', ROJO = '#E0314F', VINO = '#8E2337', NOCHE = '#0B1020', SOMBRA = 'rgba(8,10,24,.55)';
    const sitio = (id) => (Q.SITIOS || []).find((s) => s.id === id);
    const hhmm = (h) => { const min = Math.round(h * 60); return String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); };
    const colorAnimo = (a) => (a >= 75 ? '#3DDC84' : a >= 55 ? '#F2C200' : ROJO);
    /** Un rótulo sobre una placa, centrado en `cx` y sin salirse de la pantalla. */
    const placa = (v, str, cx, y, color, fondo) => {
        const texto = Q.plano(str), w = Q.textW(texto), x = Math.round(clamp(cx - w / 2, 3, Q.W - w - 3));
        if (y < 3 || y > Q.H - 12) return;
        R(v, x - 2, y - 2, w + 4, 9, fondo); Q.text(v, texto, x, y, color);
    };
    /** Los eventos del día, juntados por sitio: cada uno con las estaciones a las que manda gente. */
    const porSitio = (D) => {
        const grupos = new Map();
        for (const ev of (D && D.eventos) || []) {
            const s = sitio(ev.sitio); if (!s) continue;
            const g = grupos.get(ev.sitio) || { s, n: '', de: ev.de, a: ev.a, destinos: [] };
            if (ev.n && !g.n) g.n = ev.n;
            g.de = Math.min(g.de, ev.de); g.a = Math.max(g.a, ev.a); g.destinos.push(ev);
            grupos.set(ev.sitio, g);
        }
        return [...grupos.values()];
    };
    let grupos = [], deQuien = null, toma = null, cuadro = 0, pintado = 0;

    /** Todo el dibujo, con la proyección que quedó anotada en este mismo cuadro. Si el mapa no se dibujó (se está dentro de una estación), no hace nada. */
    const encima = (v) => {
        if (!toma || pintado === cuadro) return;
        pintado = cuadro;
        const J = Q.juego, sim = J && J.sim; if (!sim) return;
        const { X, Y, m, metro, enCamino } = toma, D = J.dia || null, E = metro.est, N = sim.est.length; if (E.length !== N) return;
        const t = S.time, h = sim.t / 60, W = Q.W, H = Q.H, parpadeo = Math.floor(t * 3) % 2 === 1;
        const fuera = (x, y, margen = 24) => x < -margen || y < -margen || x > W + margen || y > H + margen;
        if (deQuien !== D) { deQuien = D; grupos = porSitio(D); }
        const mojado = sim.lluvia > 0 || !!(D && D.lluvia && h >= D.lluvia[0] && h < D.lluvia[1] + 3), granizo = sim.lluvia >= 2 || !!(mojado && D && D.lluvia && D.lluvia[2] >= 2);
        const chato = S.inclinada ? 0.6 : 1;

        // 1. El tramo sin servicio: una cinta roja y vino sobre la línea.
        if (sim.tramo[0] > 0 || sim.tramo[1] < N - 1) {
            const paso = m * 2, g = 2, sa = E[sim.tramo[0]].s, sb = E[sim.tramo[1]].s;
            const cinta = (de, a) => { for (let s = de, i = 0; s < a; s += paso, i++) { const q = enCamino(metro.p, metro.a, s), x = X(q[0]); if (x < -3 || x > W + 3) continue; const y = Y(q[0], q[1]); if (y > -3 && y < H + 3) R(v, x, y, g, g, Math.floor(i / 3) % 2 ? VINO : ROJO); } };
            cinta(0, sa); cinta(sb, metro.largo);
        }

        // 2. Las estaciones: cerradas, en apuros o, de lejos, con su ánimo.
        sim.est.forEach((e, i) => {
            const p = E[i], x = X(p.x), y = Y(p.x, p.y); if (fuera(x, y)) return;
            const cerrada = sim.cerrada(i), lleno = Math.max(e.anden[0].total, e.anden[1].total), apuro = !cerrada && (lleno > JEFE.CAPACIDAD || (e.esperaB > 4 && e.colaTotal > 150));
            if (m >= 32) {
                // A la escala de la región, la línea entera se lee como un tablero.
                R(v, x - 2, y - 2, 5, 5, NOCHE); R(v, x - 1, y - 1, 3, 3, cerrada ? '#5A6070' : apuro && parpadeo ? '#FFFFFF' : colorAnimo(e.animo)); if (cerrada) R(v, x, y, 1, 1, ROJO);
                return;
            }
            if (cerrada && mojado) {
                // El charco: una mancha de agua alrededor de la boca del Metro, con ondas que crecen.
                const rx = m === 8 ? 11 : m === 2 ? 17 : 24, ry = Math.max(3, Math.round(rx * 0.55 * (S.inclinada ? 0.8 : 1)));
                v.globalAlpha = 0.5;
                for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)) + Math.sin(t * 2 + dy) * 0.8); R(v, x - hw, y + dy, hw * 2 + 1, 1, '#2F6FC9'); }
                for (let k = 0; k < 2; k++) {
                    const f = (t * 0.55 + k / 2) % 1, ox = rx * (0.25 + f * 0.75), oy = ry * (0.25 + f * 0.75), puntos = Math.max(10, Math.round(ox * 3));
                    v.globalAlpha = (1 - f) * 0.9;
                    for (let a = 0; a < puntos; a++) { const an = a / puntos * 6.283; R(v, x + Math.cos(an) * ox, y + Math.sin(an) * oy, 1, 1, '#CFE8FF'); }
                }
                v.globalAlpha = 1;
                if (granizo) for (let k = 0; k < (m === 8 ? 5 : 14); k++) { const an = hash(i * 9 + k) * 6.283, d = Math.sqrt(hash(i * 5 + k * 3)); R(v, x + Math.cos(an) * rx * d, y + Math.sin(an) * ry * d, 1, 1, '#FFFFFF'); }
            }
            if (cerrada) {
                // La equis de estación cerrada, otra vez, para que no la tape el agua ni la noche.
                R(v, x - 4, y - 4, 9, 9, NOCHE); for (let k = -3; k <= 3; k++) { R(v, x + k, y + k, 1, 1, ROJO); R(v, x + k, y - k, 1, 1, ROJO); }
                if (!S.names) placa(v, `${e.n} cerrada`, x, y + 9, '#FFFFFF', VINO);
            } else if (apuro) {
                if (parpadeo) { R(v, x - 3, y - 19, 7, 11, NOCHE); R(v, x - 2, y - 18, 5, 9, ROJO); R(v, x, y - 17, 1, 4, '#FFFFFF'); R(v, x, y - 12, 1, 1, '#FFFFFF'); }
                if (!S.names) placa(v, e.n, x, y + 9, '#FFFFFF', '#1E4FA3');
            }
        });

        // 3. Los eventos, en su sitio.
        for (const g of grupos) {
            const s = g.s, sx = X(s.x), sy = Y(s.x, s.y), antes = h >= g.de - 2.5 && h < g.de, saliendo = h >= g.de && h < g.a + 0.2;
            if (!antes && !saliendo) continue;
            // La gente camina del sitio a su estación: un camino punteado y, sobre él, más puntos cuanta más gente sale.
            if (saliendo) for (const ev of g.destinos) {
                if (h < ev.de || h >= ev.a + 0.2) continue;
                const p = E[ev.est], largo = Math.hypot(p.x - s.x, p.y - s.y) || 1, nx = -(p.y - s.y) / largo, ny = (p.x - s.x) / largo;
                for (let d = (t * 30) % (m * 6); d < largo; d += m * 6) { const u = d / largo, x = X(lerp(s.x, p.x, u)), y = Y(lerp(s.x, p.x, u), lerp(s.y, p.y, u)); if (!fuera(x, y, 2)) R(v, x, y, 1, 1, ORO); }
                if (m >= 32) continue;
                const cuantos = Math.round(clamp(ev.porMin / (m <= 2 ? 5 : 9), 4, m <= 2 ? 40 : 22)), px = m === 1 ? 2 : m === 2 ? 2 : 1;
                for (let k = 0; k < cuantos; k++) {
                    const sem = k * 7.31 + ev.est, u = (t * (0.05 + hash(sem) * 0.035) + hash(sem + 3)) % 1, lado = (hash(sem + 9) - 0.5) * Math.min(70, largo * 0.14) * Math.sin(u * 3.1416);
                    const wx = lerp(s.x, p.x, u) + nx * lado, wy = lerp(s.y, p.y, u) + ny * lado, x = X(wx), y = Y(wx, wy);
                    if (fuera(x, y, 2)) continue;
                    v.fillStyle = SOMBRA; v.fillRect(x - 1, y - 1, px + 2, px + 2);
                    R(v, x, y, px, px, GENTE[Math.floor(hash(sem + 5) * GENTE.length)]);
                }
            }
            const r = Math.round(clamp((s.r || 60) / m * 0.6, 5, m === 1 ? 64 : 30));
            if (fuera(sx, sy, r + 4)) continue;
            if (m >= 32) { R(v, sx - 2, sy - 2, 5, 5, NOCHE); R(v, sx - 1, sy - 1, 3, 3, saliendo && parpadeo ? '#FFFFFF' : ORO); continue; }
            // Un aro alrededor del sitio: punteado mientras dura el evento, entero y latiendo cuando sale la gente.
            const rr = r + (saliendo ? Math.round(2 + 2 * Math.sin(t * 5)) : 1), puntos = Math.max(16, rr * 4);
            for (let a = 0; a < puntos; a++) { if (!saliendo && a % 2) continue; const an = a / puntos * 6.283 + (saliendo ? 0 : t * 0.5); R(v, sx + Math.cos(an) * rr, sy + Math.sin(an) * rr * chato, 1, 1, ORO); }
            if (g.n) placa(v, saliendo ? g.n : `${g.n} · termina ${hhmm(g.de)}`, sx, sy - Math.round(rr * chato) - 11, saliendo ? NOCHE : ORO, saliendo ? ORO : NOCHE);
        }

        // 4. La gente que llega de golpe a una estación sin venir de ningún sitio señalado (un paseo escolar, una reapertura).
        if (m <= 8) for (const o of sim.oleadas || []) {
            if (sim.t < o.de || sim.t >= o.a) continue;
            const p = E[o.est], cuantos = Math.round(clamp(o.porMin / 6, 4, 18));
            for (let k = 0; k < cuantos; k++) {
                const sem = k * 5.7 + o.est * 3, an = hash(sem) * 6.283, u = (t * 0.12 + hash(sem + 1)) % 1, d = (1 - u) * 170, wx = p.x + Math.cos(an) * d, wy = p.y + Math.sin(an) * d, x = X(wx), y = Y(wx, wy);
                if (fuera(x, y, 2)) continue;
                v.fillStyle = SOMBRA; v.fillRect(x - 1, y - 1, 3, 3); R(v, x, y, 1, 1, GENTE[k % GENTE.length]);
            }
        }

        // 5. El granizo: piedritas blancas que rebotan por toda la pantalla.
        if (sim.lluvia >= 2) for (let k = 0; k < 60; k++) { const x = Math.random() * W, y = Math.random() * H; R(v, x, y, 1, 1, '#FFFFFF'); if (k % 3 === 0) R(v, x + 1, y - 1, 1, 1, '#DCE8F7'); }
    };

    Q.ciudad = (v, X, Y, m, metro, enCamino) => { if (metro) { toma = { X, Y, m, metro, enCamino }; cuadro++; } };
    Q.ciudad.encima = encima;

    /**
     * A dónde conviene mirar ahora en el mapa: el sitio de un evento que está terminando o por terminar, o si no,
     * la primera estación cerrada. Devuelve { x, y, n } en metros del mapa, o null.
     */
    Q.ciudad.foco = () => {
        const J = Q.juego, sim = J && J.sim, M = Q.mapa; if (!sim || !M || !M.metro) return null;
        const h = sim.t / 60, g = porSitio(J.dia || null).filter((q) => h >= q.de - 2.5 && h < q.a + 0.2).sort((p, q) => p.de - q.de)[0];
        if (g) return { x: g.s.x, y: g.s.y, n: g.n || g.s.n };
        const i = sim.est.findIndex((e) => sim.cerrada(e.i)), p = i >= 0 && M.metro.est[i];
        return p ? { x: p.x, y: p.y, n: sim.est[i].n } : null;
    };
})();
