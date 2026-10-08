'use strict';

/*
 * Jefe de línea: una estación por dentro.
 *
 * Un corte de la estación elegida, en tres niveles: la calle, el vestíbulo
 * (ventanillas, máquinas de boletos, torniquetes) y los dos andenes con sus
 * vías. Todo lo que se ve sale de la simulación en ese instante: cuánta gente
 * hace fila, cuánta espera en cada andén, qué tren está llegando y qué tan
 * lleno viene. Las ventanillas y las máquinas se manejan tocándolas.
 *
 * En pantallas angostas (un teléfono de pie) el vestíbulo se aprieta: las
 * máquinas pasan a la izquierda de las ventanillas y los rótulos se acortan.
 * Una estación cerrada se ve cerrada: la reja abajo, charcos y nadie adentro.
 */
(() => {
    const { R, hash, clamp } = Q, S = Q.state;
    const PIEL = ['#D9A77A', '#B98058', '#E8BF98'], PANT = ['#2A2F40', '#3A2A1E', '#1F3A8A', '#4A4A52'];
    const ROPA = ['#D62828', '#1F4FA3', '#F2C200', '#2FA36B', '#F4F1E8', '#8B5CF6', '#FF8A3D', '#3A3A40', '#C0392B', '#2A6FD6', '#E58FB6'];
    // Qué hay arriba, en la calle, según la estación.
    const BARRIO = ['terminal', 'barrio', 'barrio', 'barrio', 'barrio', 'barrio', 'colonial', 'parque', 'parque', 'campus', 'torres', 'torres', 'torres', 'barrio', 'terminal'];
    // Quitumbe y San Francisco: referencias fotográficas en docs/referencias-metro.md.
    // Las demás usan una interpretación de los materiales comunes, sin atribuirles una paleta exacta.
    const estilo = (i) => i === 6
        ? { pared: '#E9BD19', junta: '#CDA419', piso: '#CEBDA0' }
        : { pared: '#E4E7E2', junta: '#BFC6C3', piso: '#A4B1B4' };

    /** Una persona de pie; (x, y) son sus pies. */
    const persona = (v, x, y, s, apurada = false) => {
        const paso = apurada ? Math.floor(S.time * 6 + s) % 2 : 0;
        R(v, x, y - 7, 2, 2, PIEL[s % 3]); R(v, x, y - 5, 2, 3, ROPA[s % ROPA.length]);
        R(v, x, y - 2, 1, 2 - paso, PANT[s % 4]); R(v, x + 1, y - 2, 1, 1 + paso, PANT[s % 4]);
        if (s % 7 === 0) { R(v, x - 1, y - 8, 4, 1, '#3A2A1E'); R(v, x, y - 9, 2, 1, '#3A2A1E'); }      // con sombrero
        else if (s % 5 === 0) R(v, x - 1, y - 4, 1, 2, '#6B4226');                                       // con bolso
    };

    /** Un vagón: blanco, con la franja roja y azul. Las ventanas muestran qué tan lleno va. */
    const vagon = (v, x, y, w, h, lleno, abierto, sem, color) => {
        R(v, x, y, w, h, '#E9ECF2'); R(v, x, y, w, 1, '#FFFFFF'); R(v, x, y + 1, w, 1, '#C9CED8');
        R(v, x, y + h - 5, w, 1, '#D62828'); R(v, x, y + h - 4, w, 1, '#1F4FA3'); R(v, x, y + h - 1, w, 1, '#8A8F9C');
        const nv = Math.max(3, Math.floor((w - 6) / 9)), paso = (w - 6) / nv;
        for (let i = 0; i < nv; i++) {
            const wx = Math.round(x + 4 + i * paso), ww = Math.max(4, Math.round(paso) - 3);
            R(v, wx, y + 3, ww, 5, lleno > 0.02 ? '#FFE9A8' : '#2B3A55');
            // Cabezas en la ventana: más cuanto más lleno.
            for (let k = 0; k < ww - 1; k += 2) if (hash(sem * 3.1 + i * 7.7 + k) < lleno * 1.15) { R(v, wx + k, y + 4 + (k % 4 ? 1 : 0), 1, 2, color); if (lleno > 0.8) R(v, wx + k + 1, y + 5, 1, 2, '#3A3A40'); }
        }
        [0.18, 0.5, 0.82].forEach((d) => { const px = Math.round(x + w * d) - 3; R(v, px, y + 2, 6, h - 7, abierto ? '#FFF6C8' : '#D5DAE3'); if (!abierto) R(v, px + 3, y + 2, 1, h - 7, '#8A8F9C'); else R(v, px, y + 2, 1, h - 7, '#8A8F9C'); });
        R(v, x + 5, y + h, 6, 2, '#17171B'); R(v, x + w - 11, y + h, 6, 2, '#17171B');
        R(v, x, y + 2, 1, h - 3, '#8A8F9C'); R(v, x + w - 1, y + 2, 1, h - 3, '#8A8F9C');
    };

    const bx0Aprox = (W) => Math.round(W * 0.5);
    /** Un rótulo como los del Metro: placa azul con letras blancas. */
    const placa = (v, texto, x, y, fondo = '#1E4FA3', color = '#FFFFFF') => { const w = Q.textW(texto); R(v, x - 3, y - 2, w + 6, 9, fondo); Q.text(v, texto, x, y, color); return w + 6; };

    /**
     * Pinta la estación `i` en el rectángulo (0, 0, W, HH). `zonas` se llena con
     * lo que responde al clic; `eta(d)` da los minutos que faltan para el próximo
     * tren en cada sentido.
     */
    Q.dentro = (v, W, HH, sim, i, zonas, eta) => {
        const e = sim.est[i], t = S.time, noche = Q.night(S.hour), N = sim.est.length, pal = estilo(i);
        const c1 = Math.round(HH * 0.21), v0 = c1 + 7, v1 = v0 + Math.round(HH * 0.29), a0 = v1 + 6;
        const ppm = (W - 30) / 128, xc = Math.round(W / 2);      // píxeles por metro: el andén mide unos 115 m
        const angosto = W < 300, cerrada = sim.cerrada(i), lluvia = +sim.lluvia || 0;
        zonas.length = 0;

        // ───── La calle ─────
        const cielo = Q.mix(Q.mix('#7CC4FF', lluvia > 1 ? '#5A6272' : '#8792A3', lluvia ? 0.8 : 0), '#0C1230', noche);
        R(v, 0, 0, W, c1, cielo);
        for (let x = 0; x < W; x++) {      // el Pichincha, siempre al fondo
            const y = c1 - 16 - Math.round(Math.exp(-(((x - W * 0.42) / (W * 0.2)) ** 2)) * c1 * 0.5 + Math.exp(-(((x - W * 0.7) / (W * 0.16)) ** 2)) * c1 * 0.36 + Math.sin(x * 0.09) * 1.5);
            R(v, x, y, 1, c1 - y, Q.mix(Q.mix('#4F8242', '#7B7682', clamp((c1 - 34 - y) / 26)), '#0A0E2A', noche * 0.7));
        }
        const tipo = BARRIO[i] || 'barrio';
        for (let x = -4, k = 0; x < W; k++) {
            const s = hash(i * 31 + k * 7.3), s2 = hash(i * 17 + k * 3.9), bw = 9 + Math.floor(s * 14);
            let bh, col, techo = null, vent = '#42556F';
            if (tipo === 'colonial') { bh = 9 + Math.floor(s2 * 6); col = ['#F4F1E8', '#F6E7B8', '#EBD9C4', '#DCE6EA'][k % 4]; techo = '#B5532F'; vent = '#3A3040'; }
            else if (tipo === 'torres') { bh = 14 + Math.floor(s2 * (c1 - 26)); col = ['#5B7FA6', '#3F6A78', '#6B7385', '#8A8F9C', '#C9CED8'][k % 5]; vent = '#9DD1E8'; }
            else if (tipo === 'parque') { bh = s2 > 0.7 ? 8 + Math.floor(s * 8) : 0; col = '#D8DCE2'; }
            else if (tipo === 'campus') { bh = 8 + Math.floor(s2 * 10); col = ['#C9B8A0', '#D8DCE2', '#B9BDC6'][k % 3]; }
            else if (tipo === 'terminal') { bh = 7 + Math.floor(s2 * 5); col = ['#C9CED8', '#B9BDC6', '#D8DCE2'][k % 3]; }
            else { bh = 7 + Math.floor(s2 * 12); col = ['#D9D4C6', '#E8D2B0', '#C9D3DA', '#A89888', '#BFC9B8', '#E6C9B0'][k % 6]; }
            const y = c1 - 6 - bh;
            if (bh) {
                R(v, x, y, bw, bh, Q.mix(col, '#0A0E2A', noche * 0.6)); R(v, x + bw - 1, y, 1, bh, Q.mix(col, '#000000', 0.25 + noche * 0.4));
                if (techo) { R(v, x - 1, y - 2, bw + 2, 2, Q.mix(techo, '#0A0E2A', noche * 0.6)); }
                for (let wy = y + 2; wy < c1 - 9; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) R(v, wx, wy, 1, 2, noche > 0.4 && hash(wx * 3.3 + wy) > 0.45 ? '#FFD98A' : vent);
            } else { const r = 3 + Math.floor(s * 3); R(v, x + 4, c1 - 10, 1, 4, '#6B4226'); Q.disc(v, x + 4, c1 - 11 - r, r, Q.mix(k % 4 === 1 ? '#D46A9C' : '#3E8E4E', '#0A0E2A', noche * 0.6)); }
            x += bw + (tipo === 'torres' ? 2 : tipo === 'parque' ? 4 : 1);
        }
        if (tipo === 'colonial') [W * 0.28, W * 0.34].forEach((tx) => { tx = Math.round(tx); R(v, tx, c1 - 34, 8, 28, Q.mix('#F4F1E8', '#0A0E2A', noche * 0.5)); R(v, tx + 2, c1 - 30, 2, 4, '#2B3A55'); R(v, tx + 5, c1 - 30, 2, 4, '#2B3A55'); R(v, tx + 1, c1 - 37, 6, 3, Q.mix('#D9D4C6', '#0A0E2A', noche * 0.5)); R(v, tx + 3, c1 - 41, 1, 4, '#3A3A40'); R(v, tx + 2, c1 - 40, 3, 1, '#3A3A40'); });
        R(v, 0, c1 - 6, W, 2, '#B8B2A6'); R(v, 0, c1 - 4, W, 4, '#3A3D46'); for (let x = (-(t * 10) % 12); x < W; x += 12) R(v, x, c1 - 2, 5, 1, '#C9C9B0');
        // La boca del Metro, con su tótem.
        const boca = Math.round(W * 0.1);
        R(v, boca - 12, c1 - 15, 26, 2, '#2E5E9E'); R(v, boca - 11, c1 - 13, 1, 9, '#C9CED8'); R(v, boca + 12, c1 - 13, 1, 9, '#C9CED8'); R(v, boca - 9, c1 - 12, 20, 8, '#1B2030');
        for (let k = 0; k < 4; k++) R(v, boca - 9, c1 - 11 + k * 2, 20, 1, '#3A4156');
        R(v, boca + 17, c1 - 26, 1, 22, '#8A8A8A'); R(v, boca + 14, c1 - 33, 7, 7, '#D62828'); Q.text(v, 'M', boca + 15, c1 - 32, '#FFFFFF');
        if (cerrada) { R(v, boca - 9, c1 - 12, 20, 8, '#5A6070'); for (let k = 0; k < 4; k++) R(v, boca - 9, c1 - 12 + k * 2, 20, 1, '#8A8F9C'); R(v, boca - 4, c1 - 10, 10, 3, '#D62828'); }
        for (let k = 0; k < (angosto ? 5 : 9); k++) { const s = i * 13 + k, x = ((hash(s) * W + t * (6 + (s % 5)) * (s % 2 ? 1 : -1)) % (W + 20) + W + 20) % (W + 20) - 10; persona(v, Math.round(x), c1 - 4, s, true); if (lluvia) { R(v, Math.round(x) - 2, c1 - 15, 6, 1, ROPA[s % ROPA.length]); R(v, Math.round(x) - 1, c1 - 16, 4, 1, ROPA[s % ROPA.length]); R(v, Math.round(x) + 1, c1 - 14, 1, 3, '#2A2A2E'); } }
        if (lluvia) for (let k = 0; k < (lluvia > 1 ? 150 : 70); k++) { const x = (hash(k) * W + t * 40) % W, y = (hash(k + 0.5) * c1 + t * (lluvia > 1 ? 220 : 160)) % c1; R(v, W - x, y, 1, 3, '#BFD3EE'); }
        // Con granizo: las bolitas que rebotan y la capa blanca que se va juntando en la vereda.
        if (lluvia > 1) { for (let k = 0; k < 60; k++) { const x = (hash(k * 1.9) * W + t * 25) % W, y = (hash(k + 0.2) * c1 + t * 260) % c1; R(v, W - x, y, 1, 1, '#FFFFFF'); } for (let x = 0; x < W; x += 3) if (hash(x * 0.7 + Math.floor(t * 2)) > 0.35) R(v, x, c1 - 6, 2, 1, '#F4F7FB'); }
        R(v, 0, c1, W, 7, '#3B2A20'); for (let k = 0; k < 60; k++) R(v, hash(k + i) * W, c1 + 1 + hash(k + 9) * 5, 2, 1, k % 2 ? '#4A372B' : '#2E2019');

        // ───── El vestíbulo ─────
        const piso = v1 - 3;
        R(v, 0, v0, W, v1 - v0, pal.pared); for (let x = 0; x < W; x += 22) R(v, x, v0, 1, v1 - v0, pal.junta); R(v, 0, v0 + Math.round((v1 - v0) * 0.55), W, 1, pal.junta);
        R(v, 0, v0, W, 4, '#383C3F'); R(v, 0, v0 + 4, W, 4, '#C52D37'); R(v, 0, v0 + 8, W, 1, '#FFF6EB');
        for (let x = 12; x < W; x += 34) { R(v, x, v0 + 2, 22, 1, '#FFFFFF'); }
        R(v, 0, piso, W, 3, pal.piso); R(v, 0, piso, W, 1, '#DADECE'); R(v, 0, v1, W, 6, '#6E717C');
        for (let x = Math.round(W * 0.33); x < bx0Aprox(W) - 40; x += 96) { R(v, x, v0 + 3, 6, piso - v0 - 3, '#B9BDC6'); R(v, x, v0 + 3, 1, piso - v0 - 3, '#D9DEE6'); R(v, x + 5, v0 + 3, 1, piso - v0 - 3, '#9AA0AC'); }
        // La escalera que baja de la calle.
        for (let k = 0; k < 12; k++) {
            const sx = boca - 10 + k * 2, sy = v0 + 3 + Math.round(k * (piso - v0 - 3) / 12);
            R(v, sx, sy, 16, 2, '#717D80'); R(v, sx, sy, 16, 1, '#DDE3DD');
            R(v, sx - 3, sy - 7, 2, 7, '#B8D5D2'); R(v, sx - 3, sy - 8, 2, 1, '#42494A');
            R(v, sx + 17, sy - 7, 2, 7, '#B8D5D2'); R(v, sx + 17, sy - 8, 2, 1, '#42494A');
        }
        R(v, boca - 12, c1, 26, 7, '#1B2030');
        const rx = Math.max(Math.round(W * 0.2), 40);
        placa(v, Q.plano(e.n), rx, v0 + 13, '#252B2E');
        // El reloj.
        placa(v, String(Math.floor(sim.t / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(sim.t % 60)).padStart(2, '0'), rx + Q.textW(Q.plano(e.n)) + 12, v0 + 13, '#0B1020', '#FFE500');

        // Ventanillas (efectivo): las abiertas, encendidas y con su boletero. Tocar una la abre o la cierra.
        const tx0 = angosto ? W - 35 : W - 52, bw = angosto ? 11 : 15, bx0 = angosto ? tx0 - 4 - 5 * (bw + 1) : Math.round(W * 0.5), sep = angosto ? 1 : 2, bh = Math.min(26, piso - v0 - 22), by = piso - bh;
        Q.text(v, angosto ? 'EFECTIVO' : 'BOLETERIA · EFECTIVO', bx0, by - 9, '#3A3A40');
        for (let k = 0; k < 5; k++) {
            const x = bx0 + k * (bw + sep), abierta = k < e.ventanillas && !cerrada;
            R(v, x, by, bw, bh, '#8A8F9C'); R(v, x + 1, by + 1, bw - 2, bh - 2, abierta ? '#F4F1E8' : '#5A6070');
            const cx = x + (bw >> 1);
            if (abierta) { R(v, x + 2, by + 3, bw - 4, 9, '#BFE3F0'); R(v, cx - 1, by + 5, 3, 3, PIEL[k % 3]); R(v, cx - 2, by + 8, 5, 4, '#1F4FA3'); R(v, x + 2, by + 12, bw - 4, 2, '#C8A24A'); R(v, cx - 1, by + 1, 3, 1, '#3DDC84'); }
            else { for (let r = 3; r < bh - 3; r += 2) R(v, x + 2, by + r, bw - 4, 1, '#3A4156'); R(v, cx - 1, by + 1, 3, 1, '#D62828'); }
            if (!cerrada) zonas.push({ x, y: by, w: bw + sep, h: bh, tipo: 'ventanilla', k, abierta });
        }
        // Máquinas (efectivo justo o tarjeta bancaria). La casilla vacía compra otra.
        const caben = angosto ? 3 : Math.max(1, Math.floor((W - (bx0 + 5 * (bw + 2) + 10) - 62) / 12)), mp = angosto ? 10 : 12;
        const mx0 = angosto ? bx0 - 5 - (caben + 1) * mp : bx0 + 5 * (bw + 2) + 10, rotas = sim.maquinasRotas.filter((r) => r.i === i && r.hasta > sim.t).length;
        Q.text(v, angosto ? 'MAQ.' : 'MAQUINAS', mx0, by - 9, '#3A3A40');
        if (angosto && e.maquinas > caben) Q.text(v, 'X' + e.maquinas, mx0 + Q.textW('MAQ.') + 3, by - 9, '#1E4FA3');
        for (let k = 0; k <= Math.min(e.maquinas, caben); k++) {
            const x = mx0 + k * mp, hay = k < e.maquinas, rota = hay && (k >= e.maquinas - rotas || (k === caben - 1 && rotas > 0 && e.maquinas > caben));
            if (hay) { R(v, x, by + 4, 9, bh - 4, '#2A2F40'); R(v, x + 1, by + 6, 7, 6, rota ? (Math.floor(t * 3) % 2 ? '#E0314F' : '#5A2030') : '#5FB8E6'); R(v, x + 2, by + 14, 5, 2, '#F2C200'); R(v, x + 2, by + 18, 5, 1, '#8A8F9C'); }
            else if (!cerrada) { R(v, x, by + 4, 9, bh - 4, '#B9BDC6'); R(v, x + 1, by + 5, 7, bh - 6, '#D9DEE6'); R(v, x + 4, by + 10, 1, 7, '#5E72A8'); R(v, x + 1, by + 13, 7, 1, '#5E72A8'); zonas.push({ x: x - 1, y: by, w: 11, h: bh, tipo: 'maquina' }); }
        }
        // La fila: serpentea hacia la escalera. Una figura por cada cuatro personas, más o menos.
        const fila = Math.min(110, Math.ceil(e.colaTotal / 4)), ancho = bx0 - boca - 34, porFila = Math.max(6, Math.floor(ancho / 5));
        for (let k = 0; k < fila; k++) { const f = Math.floor(k / porFila), c = k % porFila, x = f % 2 ? boca + 30 + c * 5 : bx0 - 8 - c * 5; persona(v, x, piso - f * 3, i * 7 + k); }
        if (e.colaTotal > 5) placa(v, `FILA ${Math.round(e.colaTotal)} · ${e.esperaB > 60 ? 'CERRADA' : e.esperaB.toFixed(0) + ' MIN'}`, angosto ? boca + 30 : bx0 - 92, by - (angosto ? 24 : 11), e.esperaB > 4 ? '#B01E3A' : '#3A3A40');
        // Los torniquetes: quien lleva tarjeta pasa directo.
        const tp = angosto ? 8 : 9;
        Q.text(v, 'TARJETA', tx0 - 2, by - 9, '#3A3A40');
        for (let k = 0; k < 4; k++) { const x = tx0 + k * tp; R(v, x, piso - 9, 4, 9, '#909F9F'); R(v, x, piso - 8, 1, 8, '#E4E8E1'); R(v, x, piso - 10, 4, 2, '#242C2E'); R(v, x + 1, piso - 9, 2, 1, cerrada ? '#D62828' : '#3DDC84'); R(v, x + 4, piso - 6, tp - 5, 5, '#BDD6D2'); }
        if (!cerrada) for (let k = 0; k < (angosto ? 3 : 5); k++) { const s = i * 3 + k, x = (hash(s) * 60 + t * 22) % 70; persona(v, Math.round(tx0 - 30 + x), piso, s + 40, true); }
        // Cerrada: a media luz, con charcos y conos, y el letrero.
        if (cerrada) {
            v.globalAlpha = 0.45; R(v, 0, v0, W, v1 - v0, '#0B1020'); v.globalAlpha = 1;
            for (let k = 0; k < (angosto ? 5 : 9); k++) { const x = Math.round(hash(i * 5 + k * 3.3) * (W - 30)) + 6, w = 8 + Math.floor(hash(k + i) * 14); R(v, x, piso + 1, w, 1, '#5FB8E6'); R(v, x + 2, piso, w - 5, 1, '#8FD0F0'); }
            for (let k = 0; k < 3; k++) { const x = Math.round(W * (0.3 + k * 0.2)); R(v, x, piso - 4, 3, 4, '#FF8A3D'); R(v, x + 1, piso - 6, 1, 2, '#FF8A3D'); R(v, x, piso - 3, 3, 1, '#FFFFFF'); }
            const txt = 'ESTACION CERRADA'; placa(v, txt, Math.round(W / 2 - Q.textW(txt) / 2), v0 + Math.round((v1 - v0) * 0.42), '#B01E3A', '#FFFFFF');
        }

        // ───── Los andenes ─────
        // De arriba abajo: la pared con los letreros, el andén del fondo, las dos vías y el andén de adelante.
        const A = HH - a0, nh = clamp(Math.round(A * 0.27), 26, 46), ah = clamp(Math.round(A * 0.16), 16, 24), P2 = HH - nh, P1 = P2 - 2 * (ah + 6) + 1, via1 = P1 + ah - 6, via2 = P2 - 3;
        R(v, 0, a0, W, HH - a0, pal.pared); R(v, 0, a0, W, 9, '#33373A');
        for (let x = 6; x < W; x += 40) { R(v, x, a0 + 3, 30, 1, '#FAFFFF'); R(v, x, a0 + 5, 30, 1, '#8E9C9C'); }
        R(v, 0, a0 + 9, W, 4, '#C52D37'); R(v, 0, a0 + 13, W, 1, '#FFFFFF');
        for (let x = 0; x < W; x += 26) R(v, x, a0 + 14, 1, P1 - a0 - 14, pal.junta);
        // Columnas de acero con reflejo y dos anillos rojos; bancos metálicos.
        for (let x = Math.round(W * 0.3); x < W - 30; x += Math.max(80, Math.round(W * 0.28))) {
            R(v, x - 2, a0 + 7, 12, 3, '#D1D7D4'); R(v, x, a0 + 10, 8, P1 - a0 - 12, '#879492');
            R(v, x + 1, a0 + 10, 2, P1 - a0 - 12, '#E1E5DC'); R(v, x + 6, a0 + 10, 2, P1 - a0 - 12, '#636F70');
            R(v, x, P1 - 11, 8, 1, '#C52D37'); R(v, x, P1 - 8, 8, 1, '#C52D37');
        }
        for (let x = Math.round(W * (angosto ? 0.08 : 0.14)); x < W - 60; x += angosto ? W : Math.round(W * 0.3)) { placa(v, Q.plano(e.n), x, P1 - 30 > a0 + 30 ? P1 - 32 : a0 + 30, '#F4F1E8', '#282E30'); R(v, x + 70, P1 - 10, 22, 4, '#ADB9B5'); R(v, x + 70, P1 - 10, 22, 1, '#F2F4EC'); R(v, x + 72, P1 - 6, 1, 4, '#515D5D'); R(v, x + 89, P1 - 6, 1, 4, '#515D5D'); }
        R(v, 0, a0 + 13, 5, P2 - a0 - 13, '#0B0D14'); R(v, W - 5, a0 + 13, 5, P2 - a0 - 13, '#0B0D14');      // las bocas del túnel
        // Andén del fondo (hacia el sur) y su gente.
        R(v, 0, P1 - 3, W, 5, pal.piso); R(v, 0, P1 - 2, W, 2, '#E8D578');
        for (let x = 1; x < W; x += 3) R(v, x, P1 - 2, 1, 1, '#B8A556');
        const lejos = i > 0 ? e.anden[1] : null, cerca = i < N - 1 ? e.anden[0] : null;
        const gente = (an, y, filas, sem, frente) => {
            if (!an) return;
            const n = Math.min(frente ? 170 : 120, Math.ceil(an.total / 7));
            for (let k = 0; k < n; k++) { const s = sem + k, x = 8 + Math.floor(hash(s * 1.37) * (W - 16)), f = Math.floor(hash(s * 2.11) * filas); persona(v, x, y + f * (frente ? 4 : 2), s); }
        };
        gente(lejos, P1 - 2, 2, i * 101, false);
        // Las vías y los trenes. El que va al sur corre por la vía del fondo; el que va al norte, por la de adelante.
        R(v, 0, P1 + 2, W, P2 - P1 - 2, '#575D5D');
        for (let x = 0; x < W; x += 8) { R(v, x, via1 - 2, 3, 5, '#7B817D'); R(v, x, via2 - 2, 3, 5, '#7B817D'); }
        [via1, via2].forEach((y) => { R(v, 0, y - 1, W, 1, '#B8C2C0'); R(v, 0, y + 2, W, 1, '#2C3434'); });
        const tren = (dir, yb) => {
            for (const tr of sim.trenes) {
                if (tr.dir !== dir || tr.estado === 'cochera' || tr.estado === 'taller' || tr.estado === 'listo' || tr.estado === 'vuelta') continue;
                const d = tr.s - e.pos; if (Math.abs(d) > 190) continue;
                const cw = Math.round(18 * ppm), largo = cw * 6 + 5, x0 = Math.round(xc + d * ppm - largo / 2), parado = tr.estado === 'parada' && Math.abs(d) < 1, lleno = tr.total / 1230;
                const col = lleno > 0.95 ? '#B01E3A' : lleno > 0.7 ? '#8A4A1E' : '#3A3A40';
                for (let k = 0; k < 6; k++) vagon(v, x0 + k * (cw + 1), yb - ah, cw, ah, lleno, parado, tr.id * 10 + k, col);
                R(v, dir === 0 ? x0 + largo - 1 : x0, yb - 6, 1, 2, '#FFF6C8');
                if (parado) placa(v, `TREN ${tr.id} · ${Math.round(lleno * 100)}%`, clamp(xc - 26, 4, W - 80), yb - ah - 10, lleno > 0.95 ? '#B01E3A' : '#0B1020', '#FFFFFF');
            }
        };
        tren(1, via1); tren(0, via2);
        // Andén de adelante (hacia el norte) y su gente, por delante del tren.
        R(v, 0, P2, W, HH - P2, pal.piso);
        for (let x = 0; x < W; x += 22) R(v, x, P2 + 3, 1, HH - P2, pal.junta);
        for (let y = P2 + 10; y < HH; y += 9) R(v, 0, y, W, 1, pal.junta);
        R(v, 0, P2, W, 3, '#E8D578'); for (let x = 1; x < W; x += 3) R(v, x, P2 + 1, 1, 1, '#B8A556');
        gente(cerca, P2 + 9, Math.max(2, Math.floor((nh - 12) / 4)), i * 211 + 5, true);
        // Los letreros: a dónde va cada andén y cuánto falta para el próximo tren.
        const letrero = (an, dir, x, y) => {
            if (!an) { placa(v, 'FIN DE LA LINEA', x, y, '#3A3A40'); return; }
            if (cerrada) { placa(v, angosto ? 'LOS TRENES NO PARAN' : 'CERRADA · LOS TRENES NO PARAN', x, y, '#B01E3A'); return; }
            const min = eta(dir), lleno = an.total > 1230;
            const w = placa(v, `${angosto ? (dir ? 'AL SUR' : 'AL NORTE') : dir ? 'SUR · QUITUMBE' : 'NORTE · EL LABRADOR'} · ${min === null ? 'SIN TREN' : min < 0.6 ? 'LLEGANDO' : Math.ceil(min) + ' MIN'}`, x, y, '#0B1020', '#FFE500');
            placa(v, `${Math.round(an.total)} ESPERAN`, x + w + 3, y, lleno ? '#B01E3A' : '#1E4FA3');
        };
        letrero(lejos, 1, 8, a0 + 17); letrero(cerca, 0, 8, HH - 9);
    };
})();
