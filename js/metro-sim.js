'use strict';

/*
 * Jefe de línea: la simulación de un día de operación del Metro de Quito.
 *
 * Aquí no hay pantalla: solo los trenes, los pasajeros y la caja. Lo dibuja y
 * lo maneja js/juego.js. Así se puede probar y equilibrar fuera del navegador.
 *
 * De dónde salen los números:
 *   - Reales (Empresa Metro de Quito y prensa, 2024-2026): tarifa de 0,45;
 *     18 trenes de 1.230 pasajeros; 34 minutos de punta a punta; servicio de
 *     05:30 a 23:00 (sábados de 07:00 a 23:00, domingos y feriados de 07:00 a
 *     22:00); un tren cada 5 minutos en hora pico y cada 8 en valle; unos
 *     205.000 viajes en un día laborable; y el promedio diario de las
 *     estaciones más y menos usadas (Quitumbe, El Labrador, Iñaquito, San
 *     Francisco, El Recreo; La Pradera, Jipijapa, Cardenal de la Torre).
 *   - Estimados: el uso de las otras siete estaciones, el reparto por horas,
 *     cuánta gente paga con tarjeta, y todos los costos. Están ajustados para
 *     que el juego tenga tensión, no para llevar la contabilidad de verdad.
 *
 * El día avanza siempre en pasos iguales de un cuarto de minuto, y todo lo que
 * decide el jugador entra por `orden()`, que lo anota en una bitácora con el
 * número de paso. Con el mismo escenario y la misma bitácora el día sale
 * idéntico: así se guarda y se recupera un turno a medias (`restaurar`) sin
 * tener que copiar el estado entero.
 */
const JEFE = (() => {
    const TARIFA = 0.45, CAPACIDAD = 1230, FLOTA = 18, VIAJE_MIN = 34;
    const ABRE = 5.5 * 60, CIERRA = 23 * 60;        // minutos desde la medianoche
    const VIAJES_DIA = 205000;
    const PASO = 0.25;                                   // minutos de juego por paso de simulación

    // Las 15 estaciones, de sur a norte. «casa»: de dónde sale la gente en la mañana;
    // «destino»: a dónde va (trabajo, estudio, comercio). Cada columna suma 1.
    const ESTACIONES = [
        { n: 'Quitumbe', c: 'QUI', casa: 0.21, destino: 0.044 },
        { n: 'Morán Valverde', c: 'MOR', casa: 0.10, destino: 0.027 },
        { n: 'Solanda', c: 'SOL', casa: 0.11, destino: 0.027 },
        { n: 'Cardenal de la Torre', c: 'CAR', casa: 0.04, destino: 0.014 },
        { n: 'El Recreo', c: 'REC', casa: 0.09, destino: 0.037 },
        { n: 'La Magdalena', c: 'MAG', casa: 0.07, destino: 0.037 },
        { n: 'San Francisco', c: 'SFR', casa: 0.03, destino: 0.121 },
        { n: 'La Alameda', c: 'ALA', casa: 0.03, destino: 0.087 },
        { n: 'El Ejido', c: 'EJI', casa: 0.03, destino: 0.116 },
        { n: 'Universidad Central', c: 'UCE', casa: 0.04, destino: 0.116 },
        { n: 'La Pradera', c: 'PRA', casa: 0.015, destino: 0.027 },
        { n: 'La Carolina', c: 'CRL', casa: 0.035, destino: 0.120 },
        { n: 'Iñaquito', c: 'IÑA', casa: 0.04, destino: 0.126 },
        { n: 'Jipijapa', c: 'JIP', casa: 0.025, destino: 0.022 },
        { n: 'El Labrador', c: 'LAB', casa: 0.145, destino: 0.079 },
    ];
    const N = ESTACIONES.length;

    /** Una curva a partir de una tabla de [hora, valor]: interpola entre los puntos y se queda en los extremos. */
    const curva = (tabla) => (h) => {
        if (h <= tabla[0][0]) return tabla[0][1];
        for (let i = 1; i < tabla.length; i++) if (h <= tabla[i][0]) { const [h0, v0] = tabla[i - 1], [h1, v1] = tabla[i]; return v0 + (v1 - v0) * (h - h0) / (h1 - h0); }
        return tabla[tabla.length - 1][1];
    };
    // Cuánta gente llega según la hora (1 = el promedio del día). Dos picos: el de la mañana, más alto y más corto.
    const PERFIL = [[5.5, 0.3], [6.25, 0.9], [7, 1.9], [7.5, 2.2], [8.5, 1.8], [9.5, 1.15], [11, 0.9], [12.5, 1.05], [14, 0.95], [16, 1.05], [17, 1.6], [18, 1.9], [19, 1.55], [20, 1.0], [21, 0.65], [22, 0.4], [23, 0.15]];
    // De la mañana (0: de casa al trabajo) a la tarde (1: de vuelta).
    const VUELTA = [[10, 0], [12, 0.5], [14.5, 0.5], [16.5, 1]];
    const perfil = curva(PERFIL);
    let integral = 0; for (let h = 5.5; h < 23; h += 1 / 60) integral += perfil(h) / 60;

    // Las franjas del horario que decide el jugador.
    const FRANJAS = [
        { n: 'Madrugada', de: 5.5, a: 6.5 }, { n: 'Pico de la mañana', de: 6.5, a: 10 }, { n: 'Media mañana', de: 10, a: 12 },
        { n: 'Mediodía', de: 12, a: 14 }, { n: 'Tarde', de: 14, a: 17 }, { n: 'Pico de la tarde', de: 17, a: 20 }, { n: 'Noche', de: 20, a: 23 },
    ];
    const INTERVALOS = [3, 4, 5, 6, 8, 10, 12, 15];
    const franjaDe = (h) => { for (let i = 0; i < FRANJAS.length; i++) if (h < FRANJAS[i].a) return i; return FRANJAS.length - 1; };

    // La plata. Un día bien llevado deja un pequeño saldo a favor.
    const COSTO = { km: 6.5, trenMin: 0.45, ventanillaHora: 9, fijoHora: 1650, maquina: 2500, maquinaHora: 0.6 };
    const PAGO = { ventanilla: 7, maquina: 5 };     // pasajeros por minuto que despacha cada una
    const TARIFA_MEDIA = TARIFA * 0.85 + 0.22 * 0.12 + 0.10 * 0.03;    // la mayoría paga la tarifa completa
    /** Qué tan fuerte llueve a la hora `h`: 0, 1 (aguacero) o 2 (tormenta con granizo). */
    const lluviaDe = (dia, h) => (dia.lluvia && h >= dia.lluvia[0] && h < dia.lluvia[1] ? dia.lluvia[2] || 1 : 0);

    /** Cuánta gente llega por minuto a toda la línea, a la hora `h` de ese día. */
    const ritmoDe = (dia, h) => VIAJES_DIA / integral / 60 * (dia.perfil ? curva(dia.perfil) : perfil)(h) * (dia.demanda || 1) * (1 + 0.15 * lluviaDe(dia, h));
    /**
     * Cuánto «pesa» el reparto por horas de un día frente al de un día laborable (1 = igual). Sirve para fijar la
     * demanda de un feriado como fracción de los viajes de un día normal, tenga el reparto que tenga.
     */
    const nivelDe = (dia) => {
        const p = dia.perfil ? curva(dia.perfil) : perfil; let suma = 0;
        for (let h = dia.abre || 5.5; h < (dia.cierra || 23); h += 1 / 60) suma += p(h) / 60;
        return suma / integral;
    };
    /** El pronóstico: cuántos viajes se esperan en cada franja del horario. No sabe de imprevistos. */
    const pronostico = (dia, cierra = dia.cierra || 23) => FRANJAS.map((f, k) => {
        let suma = 0; const fin = k === FRANJAS.length - 1 ? Math.max(f.a, cierra) : f.a;
        for (let h = Math.max(f.de, dia.abre || 5.5); h < Math.min(fin, cierra) - 1e-9; h += 1 / 12) {
            suma += ritmoDe(dia, h) * 5;
            for (const ev of dia.eventos || []) if (h >= ev.de && h < ev.a) suma += ev.porMin * 5;
        }
        return suma;
    });

    /**
     * Un día nuevo. `largos` son los metros de cada estación medidos sobre la
     * línea real; `plan` es lo que se conserva de un día a otro (máquinas,
     * mejoras); `dia` es el escenario (lluvia, averías, eventos, decisiones).
     * El escenario no se modifica: se puede reusar.
     */
    const crear = (largos, plan, dia) => {
        const L = largos[N - 1] - largos[0], pos = largos.map((s) => s - largos[0]);
        const PARADA = 0.4 * (plan.anden ? 0.75 : 1);                 // minutos de parada en cada estación
        const VEL = L / (VIAJE_MIN - (N - 2) * 0.4);                  // metros por minuto, para que el viaje completo dure lo real
        const fuera0 = Math.max(0, (dia.trenesFuera || 0) - (plan.taller && dia.trenesFuera ? 1 : 0));      // los que hoy están en el taller
        const flota = FLOTA + (plan.trenes || 0) - fuera0;
        const ACHIQUE = plan.bombas ? 0.5 : 1;                        // con bombas, lo que cierra el agua reabre en la mitad del tiempo
        const AGUANTE = 2.5 + (plan.pantallas ? 1.2 : 0);             // minutos de andén que nadie reprocha
        const PACIENCIA = 11 + (plan.pantallas ? 2 : 0);              // y a partir de cuántos empiezan a irse
        const VENTANILLA = PAGO.ventanilla * (plan.cajeros ? 1.25 : 1);
        const INGRESO = 1 + 0.03 * (plan.publicidad || 0);            // la publicidad en estaciones y trenes suma a cada pasaje
        const FIJO = (dia.fijo || 1) * (1 - 0.06 * (plan.solar || 0));  // los paneles solares abaratan la operación de las estaciones
        const abre = (dia.abre || 5.5) * 60;

        const est = ESTACIONES.map((e, i) => ({
            i, n: e.n, c: e.c, pos: pos[i],
            ventanillas: plan.ventanillas ? plan.ventanillas[i] : (e.casa + e.destino > 0.2 ? 2 : 1), maquinas: plan.maquinas[i],
            cola: new Float32Array(N), colaTotal: 0, colaEdad: 0,
            anden: [{ d: new Float32Array(N), total: 0, edad: 0 }, { d: new Float32Array(N), total: 0, edad: 0 }],   // 0: hacia el norte · 1: hacia el sur
            animo: 78, entradas: 0, idos: 0, dejados: 0, esperaB: 0,
            cerrada: 0, gratis: 0, lenta: 0, lentaF: 1, prepago: 0, avisada: -999,
        }));
        // Los trenes amanecen repartidos entre las dos cabeceras.
        const trenes = Array.from({ length: flota }, (_, k) => ({ id: k + 1, estado: 'cochera', cab: k % 5 < 3 ? 0 : 1, dir: 0, s: 0, s0: 0, sig: 0, carga: new Float32Array(N), total: 0, espera: 0, km: 0, vuelve: 0 }));
        trenes.forEach((t) => { t.dir = t.cab; t.s = t.s0 = t.cab ? L : 0; });      // s0: dónde estaba un paso antes, para dibujarlo sin saltos

        const S = {
            t: abre, abre, cierra: (dia.cierra || 23) * 60, est, trenes, L, flota, enTaller: fuera0, terminado: false,
            pasos: 0, bitacora: [],                    // cuántos pasos lleva el día y qué ordenó el jugador en cada uno
            tarjeta: Math.min(0.92, 0.55 + 0.1 * (plan.tarjeta || 0)),
            horario: (plan.horario || [8, 8, 8, 8, 8, 8, 8]).slice(),
            tramo: [0, N - 1], corte: null,            // entre qué estaciones circulan los trenes, y hasta cuándo dura el corte
            ultimo: [-99, -99], avisos: [], bloqueos: [], maquinasRotas: [], oleadas: [], decisiones: [], elegidas: {}, notas: {},
            animo: 78, sumaAnimo: 0, pesoAnimo: 0, lluvia: 0,
            gratis: 0, gratisPaga: 0, lento: 0, lentoF: 1, paradaLenta: 0, paradaF: 1,
            cuenta: { viajes: 0, demanda: 0, idos: 0, idosFila: 0, idosAnden: 0, idosCierre: 0, dejados: 0, ingresos: 0, trenes: 0, personal: 0, fijo: 0, compras: 0, imprevistos: 0, esperaSuma: 0, esperaN: 0, km: 0, salidas: 0, refuerzos: 0, ociosas: 0 },
            porHora: [],
        };
        const hechos = new Set(), tareas = [];
        let alarma = -999, ronda = abre, acum = 0;
        const aviso = (tipo, texto, i = -1) => S.avisos.push({ tipo, texto, i, t: S.t });
        const miles = (v) => Math.round(v).toLocaleString('de-DE');

        /** Una opinión: `n` pasajeros que califican su viaje con `nota` (0 a 100). Mueve el ánimo general y el de la estación. */
        const opinar = (e, nota, n) => {
            if (n <= 0) return;
            nota = Math.max(0, Math.min(100, nota));
            S.sumaAnimo += nota * n; S.pesoAnimo += n;
            S.animo += (nota - S.animo) * (n / (n + 5000));
            if (e) e.animo += (nota - e.animo) * (n / (n + 700));
        };

        const fuera = (t) => t.estado === 'cochera' || t.estado === 'taller';
        const enServicio = () => trenes.filter((t) => !fuera(t)).length;
        const disponibles = (cab) => trenes.filter((t) => t.estado === 'cochera' && t.cab === cab).length;
        /** ¿Está cerrada la estación? Por un daño propio o porque quedó fuera del tramo en servicio. */
        const cerrada = (i) => est[i].cerrada > S.t || i < S.tramo[0] || i > S.tramo[1];
        /** ¿Es el final del recorrido para un tren que va en ese sentido? */
        const terminal = (dir, i) => (dir === 0 ? i >= S.tramo[1] : i <= S.tramo[0]);
        /** A dónde llega de verdad quien va de `i` a `j`: si su estación está cerrada, a la abierta más cercana por el camino. */
        const destinoDe = (i, j) => { let k = Math.max(S.tramo[0], Math.min(S.tramo[1], j)); const paso = k > i ? -1 : 1; while (k !== i && est[k].cerrada > S.t) k += paso; return k; };
        /** Quien estaba dentro de una estación que se cierra tiene que salir. */
        const evacuar = (e) => {
            const n = e.colaTotal + e.anden[0].total + e.anden[1].total;
            if (n > 1) { e.idos += n; S.cuenta.idos += n; S.cuenta.idosCierre += n; opinar(e, 25, n); }
            e.cola.fill(0); e.colaTotal = 0; e.colaEdad = 0; for (const a of e.anden) { a.d.fill(0); a.total = 0; a.edad = 0; }
        };

        /** Baja y sube gente en la estación `e`. Devuelve cuántos se movieron, para alargar la parada. */
        const intercambio = (t, e) => {
            const baja = t.carga[e.i]; t.total -= baja; t.carga[e.i] = 0; S.cuenta.viajes += baja;
            if (terminal(t.dir, e.i)) {
                // Fin del recorrido: si el tramo está cortado, aquí se baja también quien iba más lejos.
                const resto = t.total;
                if (resto > 1) { S.cuenta.viajes += resto; opinar(e, 40, resto * 0.7); t.carga.fill(0); t.total = 0; }
                return baja + resto;
            }
            const a = e.anden[t.dir], libre = Math.max(0, CAPACIDAD - t.total), sube = Math.min(a.total, libre);
            if (a.total > 0.01) {
                const media = a.edad / a.total, parte = sube / a.total, cola = e.esperaB;
                for (let j = 0; j < N; j++) { const b = a.d[j] * parte; if (b) { t.carga[j] += b; a.d[j] -= b; } }
                t.total += sube; a.total -= sube; a.edad -= media * sube;
                S.cuenta.esperaSuma += media * sube; S.cuenta.esperaN += sube;
                // Esperar un par de minutos no molesta a nadie; de ahí en adelante, cada minuto pesa.
                opinar(e, 100 - Math.max(0, media - AGUANTE) * 9 - Math.max(0, cola - 1.5) * 6, sube);
                if (a.total > 20) { opinar(e, 10, a.total * 0.8); e.dejados += a.total; S.cuenta.dejados += a.total; }
            }
            // Ir apretado también cuenta.
            const lleno = t.total / CAPACIDAD;
            if (lleno > 0.7) opinar(null, 100 - (lleno - 0.7) * 230, t.total / 5);
            return baja + sube;
        };
        /** Pone un tren en la cabecera `cab` (o donde termine hoy el tramo), con las puertas abiertas. */
        const sacar = (t, cab) => {
            const e = est[S.tramo[cab]];
            t.dir = cab; t.cab = cab; t.s = t.s0 = e.pos; t.sig = e.i; t.estado = 'parada'; t.espera = 0.3 + Math.min(1.3, intercambio(t, e) / 800); S.cuenta.salidas++;
        };

        const paso = (dt) => {
            if (S.terminado) return;
            const h = S.t / 60, abierto = S.t < S.cierra, lluvia = lluviaDe(dia, h);
            S.lluvia = lluvia;
            if (S.corte && S.t >= S.corte.hasta) S.reabrir();
            const hayCierres = S.tramo[0] > 0 || S.tramo[1] < N - 1 || est.some((e) => e.cerrada > S.t);

            // 1. Llega la gente.
            if (abierto) {
                const v = curva(dia.vuelta || VUELTA)(h), porMin = ritmoDe(dia, h), gratisTodo = S.gratis > S.t;
                let sumaO = 0; const O = [], D = [];
                for (let i = 0; i < N; i++) { const e = ESTACIONES[i]; O[i] = e.casa * (1 - v) + e.destino * v; D[i] = e.destino * (1 - v) + e.casa * v; sumaO += O[i]; }
                // Un imán: una estación a la que hoy quiere llegar mucha más gente (una procesión, la terminal de buses).
                for (const im of dia.imanes || []) if (h >= im.de && h < im.a) D[im.est] *= im.f;
                for (let i = 0; i < N; i++) {
                    const e = est[i], vaiven = 1 + 0.18 * Math.sin(S.t * 0.11 + i * 1.7) + 0.1 * Math.sin(S.t * 0.37 + i);
                    let llegan = porMin * (O[i] / sumaO) * vaiven * dt, pesos = 0; const w = [];
                    for (let j = 0; j < N; j++) { w[j] = j === i ? 0 : D[j] * (0.35 + 0.65 * Math.min(1, Math.abs(i - j) / 3)); pesos += w[j]; }
                    for (const ev of dia.eventos || []) if (ev.est === i && h >= ev.de && h < ev.a) llegan += ev.porMin * dt;
                    for (const ev of S.oleadas) if (ev.est === i && S.t >= ev.de && S.t < ev.a) llegan += ev.porMin * dt;
                    S.cuenta.demanda += llegan;
                    // Con la estación cerrada, quien llega se da la vuelta.
                    if (hayCierres && cerrada(i)) { e.idos += llegan; S.cuenta.idos += llegan; S.cuenta.idosCierre += llegan; opinar(e, 35, llegan); continue; }
                    e.entradas += llegan;
                    const gratis = gratisTodo || e.gratis > S.t, directo = gratis ? 1 : Math.min(0.95, S.tarjeta + (e.prepago > S.t ? 0.3 : 0));
                    for (let j = 0; j < N; j++) {
                        const n = llegan * w[j] / pesos; if (!n) continue;
                        let k = j;
                        if (hayCierres) {
                            k = destinoDe(i, j);
                            // No hay cómo llegar: se van. Y quien tiene que bajarse antes viaja, pero a disgusto.
                            if (k === i) { e.idos += n; S.cuenta.idos += n; S.cuenta.idosCierre += n; opinar(e, 35, n); continue; }
                            if (k !== j) opinar(e, 50, n * 0.5);
                        }
                        const pasan = n * directo, a = e.anden[k > i ? 0 : 1];
                        a.d[k] += pasan; a.total += pasan; S.cuenta.ingresos += pasan * TARIFA_MEDIA * INGRESO * (gratis ? S.gratisPaga : 1);
                        e.cola[k] += n - pasan; e.colaTotal += n - pasan;
                    }
                }
            }

            // 2. La boletería: ventanillas y máquinas despachan a los que pagan en efectivo.
            for (const e of est) {
                const rotas = S.maquinasRotas.filter((r) => r.i === e.i && r.hasta > S.t).length, gratis = S.gratis > S.t || e.gratis > S.t;
                const ritmo = gratis ? 400 : (e.ventanillas * VENTANILLA + Math.max(0, e.maquinas - rotas) * PAGO.maquina) * (e.lenta > S.t ? e.lentaF : 1);
                e.colaEdad += e.colaTotal * dt;
                e.esperaB = ritmo > 0 ? e.colaTotal / ritmo : e.colaTotal > 1 ? 99 : 0;
                if (e.colaTotal > 0.01) {
                    const pasan = Math.min(e.colaTotal, ritmo * dt), parte = pasan / e.colaTotal;
                    for (let j = 0; j < N; j++) { const n = e.cola[j] * parte; if (!n) continue; e.cola[j] -= n; const a = e.anden[j > e.i ? 0 : 1]; a.d[j] += n; a.total += n; }
                    e.colaEdad -= (e.colaEdad / e.colaTotal) * pasan; e.colaTotal -= pasan; S.cuenta.ingresos += pasan * TARIFA_MEDIA * INGRESO * (gratis ? S.gratisPaga : 1);
                    // Quien lleva más de cinco minutos en la fila empieza a irse.
                    if (e.esperaB > 5 && e.colaTotal > 0.01) { const sevan = e.colaTotal * Math.min(1, 0.09 * dt), p = sevan / e.colaTotal; for (let j = 0; j < N; j++) e.cola[j] *= 1 - p; e.colaTotal -= sevan; e.idos += sevan; S.cuenta.idos += sevan; S.cuenta.idosFila += sevan; opinar(e, 0, sevan); }
                }
                // En el andén la paciencia dura más, pero también se acaba.
                for (const a of e.anden) {
                    a.edad += a.total * dt;
                    if (a.total > 1 && a.edad / a.total > PACIENCIA) { const sevan = a.total * Math.min(1, 0.06 * dt), p = sevan / a.total; for (let j = 0; j < N; j++) a.d[j] *= 1 - p; a.edad *= 1 - p; a.total -= sevan; e.idos += sevan; S.cuenta.idos += sevan; S.cuenta.idosAnden += sevan; opinar(e, 0, sevan); }
                }
                if (!cerrada(e.i)) {
                    S.cuenta.personal += e.ventanillas * COSTO.ventanillaHora / 60 * dt + e.maquinas * COSTO.maquinaHora / 60 * dt;
                    if (abierto && e.colaTotal < 1 && e.ventanillas > 1) S.cuenta.ociosas += (e.ventanillas - 1) * dt;      // ventanillas abiertas de más, en minutos
                }
            }
            S.cuenta.fijo += COSTO.fijoHora * FIJO / 60 * dt;      // en fin de semana hay menos personal de planta

            // 3. Los trenes.
            const parada = PARADA * (1 + 0.15 * lluvia) * (S.paradaLenta > S.t ? S.paradaF : 1);
            const vel = VEL * (S.lento > S.t ? S.lentoF : 1);
            for (const t of trenes) {
                t.s0 = t.s;
                if (t.estado === 'taller') { if (t.vuelve && S.t >= t.vuelve) { t.estado = 'cochera'; t.vuelve = 0; t.s = t.cab ? L : 0; t.dir = t.cab; aviso('bien', `El tren ${t.id} sale del taller y queda disponible en ${t.cab ? 'El Labrador' : 'Quitumbe'}.`); } continue; }
                if (t.estado === 'cochera') continue;
                S.cuenta.trenes += COSTO.trenMin * dt;
                if (t.estado === 'averiado') { t.espera -= dt; if (t.espera <= 0) { t.estado = 'viaje'; aviso('bien', `El tren ${t.id} vuelve a andar.`); } continue; }
                if (t.estado === 'parada' || t.estado === 'vuelta') {
                    t.espera -= dt;
                    if (t.espera > 0) continue;
                    if (t.estado === 'vuelta') { t.estado = 'listo'; continue; }
                    if (terminal(t.dir, t.sig)) { t.estado = 'vuelta'; t.espera = 2.5; t.cab = t.dir === 0 ? 1 : 0; t.dir = t.cab; continue; }
                    t.sig += t.dir === 0 ? 1 : -1; t.estado = 'viaje';
                }
                if (t.estado !== 'viaje') continue;
                // No avanza si tiene otro tren demasiado cerca por delante, ni si la vía está cortada.
                let tope = Infinity;
                for (const o of trenes) { if (o === t || o.dir !== t.dir || fuera(o) || o.estado === 'listo' || o.estado === 'vuelta') continue; const d = (o.s - t.s) * (t.dir === 0 ? 1 : -1); if (d > 0 && d < tope) tope = d; }
                for (const b of S.bloqueos) { if (b.dir !== t.dir || b.hasta <= S.t) continue; const d = (b.s - t.s) * (t.dir === 0 ? 1 : -1); if (d > 0 && d < tope) tope = d; }
                const meta = est[t.sig].pos, falta = Math.abs(meta - t.s), avance = Math.min(vel * dt, falta, Math.max(0, tope - 320));
                t.s += avance * (t.dir === 0 ? 1 : -1); t.km += avance / 1000; S.cuenta.km += avance / 1000; S.cuenta.trenes += avance / 1000 * COSTO.km;
                if (Math.abs(meta - t.s) < 0.5) {
                    t.s = meta;
                    // Una estación cerrada se pasa de largo: quien iba a ella baja en la siguiente.
                    if (hayCierres && cerrada(t.sig) && !terminal(t.dir, t.sig)) { const sig = t.sig + (t.dir === 0 ? 1 : -1); t.carga[sig] += t.carga[t.sig]; t.carga[t.sig] = 0; t.sig = sig; continue; }
                    t.estado = 'parada'; t.espera = parada + Math.min(1.3, intercambio(t, est[t.sig]) / 800);
                }
            }

            // 4. Las salidas desde las cabeceras, cada tantos minutos según el horario.
            const cada = S.horario[franjaDe(h)];
            for (let cab = 0; cab < 2; cab++) {
                const listos = trenes.filter((t) => t.estado === 'listo' && t.cab === cab);
                if (abierto && S.t - S.ultimo[cab] >= cada) {
                    const t = listos[0] || trenes.find((q) => q.estado === 'cochera' && q.cab === cab);
                    if (t) { sacar(t, cab); S.ultimo[cab] = S.t; }
                    else if (!S.sinTren || S.t - S.sinTren > 45) { S.sinTren = S.t; aviso('mal', `No hay tren listo en ${est[S.tramo[cab]].n}: con ${enServicio()} trenes rodando no alcanza para salir cada ${cada} minutos.`, S.tramo[cab]); }
                }
                // Si sobran trenes esperando, los demás se guardan y dejan de costar.
                const sobran = trenes.filter((t) => t.estado === 'listo' && t.cab === cab);
                for (let k = abierto ? 2 : 0; k < sobran.length; k++) sobran[k].estado = 'cochera';
            }

            // 5. Lo que pasa hoy: averías, máquinas dañadas, cierres, avisos y decisiones.
            (dia.sucesos || []).forEach((ev, k) => {
                if (hechos.has(k) || h < ev.hora) return;
                hechos.add(k);
                if (ev.tipo === 'averia') S.averiar(ev.est, ev.min);
                else if (ev.tipo === 'maquina') S.danarMaquinas(ev.est, ev.min);
                else if (ev.tipo === 'aviso') aviso(ev.tono || 'info', ev.texto, ev.est === undefined ? -1 : ev.est);
                else if (ev.tipo === 'cierre') { S.cerrarEstacion(ev.est, ev.min); aviso('mal', ev.texto, ev.est); }
                else if (ev.tipo === 'corte') { S.cortarTramo(ev.de, ev.a, ev.min, ev.deja); aviso('mal', ev.texto, ev.a); }
                else if (ev.tipo === 'lenta') { S.boleteriaLenta(ev.est, ev.min, ev.f); if (ev.texto) aviso(ev.tono || 'info', ev.texto, ev.est); }
                else if (ev.tipo === 'oleada') S.oleada(ev.est, ev.min, ev.porMin);
                else if (ev.tipo === 'decision') S.decisiones.push(ev);
            });
            for (let k = tareas.length - 1; k >= 0; k--) if (S.t >= tareas[k].t) { const f = tareas[k].f; tareas.splice(k, 1); f(S); }

            // Con jefes de estación, las ventanillas se abren y se cierran solas según la fila.
            if (plan.jefes && abierto && S.t >= ronda) {
                ronda = S.t + 5;
                for (const e of est) { if (cerrada(e.i)) continue; if (e.esperaB > 2 && e.ventanillas < 5) e.ventanillas++; else if (e.esperaB < 0.3 && e.colaTotal < 5 && e.ventanillas > 1) e.ventanillas--; }
            }

            // 6. Las alarmas: un andén que ya no da más, o una fila que no avanza.
            if (abierto && dia.alarmas !== false && S.t - alarma > 20) {
                for (const e of est) {
                    if (S.t - e.avisada < 100 || cerrada(e.i)) continue;
                    const lleno = Math.max(e.anden[0].total, e.anden[1].total);
                    if (lleno > CAPACIDAD * 1.15) aviso('mal', `Andén saturado en ${e.n}: ${miles(lleno)} personas esperan un tren hacia el ${e.anden[0].total > e.anden[1].total ? 'norte' : 'sur'}.`, e.i);
                    else if (e.esperaB > 6 && e.colaTotal > 150) aviso('mal', `La fila de la boletería de ${e.n} ya pasa de ${Math.round(Math.min(e.esperaB, 60))} minutos. La gente se está yendo.`, e.i);
                    else continue;
                    e.avisada = S.t; alarma = S.t; break;
                }
            }

            // 7. La cuenta por horas, para el resumen.
            const hora = Math.floor(h);
            if (!S.porHora.length || S.porHora[S.porHora.length - 1].h !== hora) S.porHora.push({ h: hora, animo: S.animo });
            S.porHora[S.porHora.length - 1].animo = S.animo;

            S.t += dt; S.pasos++;
            // Una jornada de práctica se corta a la hora de cierre, sin más.
            if (dia.corte && S.t >= S.cierra) { S.terminado = true; return; }
            // Después del cierre, el día acaba cuando el último tren deja a su gente.
            if (S.t >= S.cierra && (S.t > S.cierra + 50 || trenes.every((t) => t.total < 1))) {
                for (const e of est) { const quedan = e.colaTotal + e.anden[0].total + e.anden[1].total; if (quedan > 1) { e.idos += quedan; S.cuenta.idos += quedan; opinar(e, 0, quedan); } }
                S.terminado = true;
            }
        };

        /**
         * Avanza `min` minutos de juego, siempre en pasos iguales: lo que no llega a un paso se guarda para la próxima
         * llamada. Se detiene si aparece una decisión: hay que resolverla antes de seguir.
         */
        S.avanzar = (min) => {
            acum += min;
            while (acum >= PASO - 1e-9) { if (S.terminado || S.decisiones.length) { acum = 0; break; } paso(PASO); acum -= PASO; }
        };
        /** Avanza hasta que el día lleve ese número de pasos (para repetir una bitácora). */
        S.correrHasta = (pasos) => { while (S.pasos < pasos && !S.terminado && !S.decisiones.length) paso(PASO); };
        /** Qué parte del próximo paso ya transcurrió (0 a 1), y dónde dibujar un tren entre un paso y otro. */
        S.alfa = () => Math.min(1, acum / PASO);
        S.ver = (t) => t.s0 + (t.s - t.s0) * S.alfa();
        S.enServicio = enServicio; S.disponibles = disponibles; S.cerrada = cerrada;
        /** Manda un tren extra, vacío, desde una cabecera. Devuelve si había alguno guardado. */
        S.refuerzo = (cab) => {
            const t = trenes.find((q) => q.estado === 'cochera' && q.cab === cab) || trenes.find((q) => q.estado === 'listo' && q.cab === cab);
            if (!t) return false;
            sacar(t, cab); S.cuenta.refuerzos++;
            return true;
        };
        /** Compra una máquina de boletos para una estación. */
        S.comprarMaquina = (i) => { est[i].maquinas++; plan.maquinas[i]++; S.cuenta.compras += COSTO.maquina; };
        /** Cuántos trenes hacen falta para sostener un intervalo en el tramo que está en servicio. */
        S.trenesPara = (cada) => Math.ceil(2 * (VIAJE_MIN * (est[S.tramo[1]].pos - est[S.tramo[0]].pos) / L + 2.5 + 2) / cada);
        S.balance = () => S.cuenta.ingresos - S.cuenta.trenes - S.cuenta.personal - S.cuenta.fijo - S.cuenta.compras - S.cuenta.imprevistos;
        S.animoDia = () => (S.pesoAnimo ? S.sumaAnimo / S.pesoAnimo : S.animo);
        S.esperaMedia = () => (S.cuenta.esperaN ? S.cuenta.esperaSuma / S.cuenta.esperaN : 0);
        S.pronostico = () => pronostico(dia, S.cierra / 60);

        // ───── Lo que un imprevisto o una decisión puede mover ─────
        const cuales = (i) => (i < 0 ? est : [est[i]]);
        /** Un gasto imprevisto. */
        S.gasto = (monto) => { S.cuenta.imprevistos += monto; };
        /** `n` personas opinan `nota` (0 a 100) en la estación `i`, o en toda la línea si `i` es −1. */
        S.opinion = (i, nota, n) => { if (i < 0) opinar(null, nota, n); else opinar(est[i], nota, n); };
        /** Una estación se cierra `min` minutos: nadie entra y los trenes pasan de largo. Devuelve cuánto dura de verdad: con bombas de achique, la mitad (salvo que el cierre sea `exacto`, por algo que no es agua). */
        S.cerrarEstacion = (i, min, exacto = false) => { const dura = min * (exacto ? 1 : ACHIQUE); est[i].cerrada = S.t + dura; evacuar(est[i]); return dura; };
        /** La abre antes de tiempo. */
        S.abrirEstacion = (i) => { est[i].cerrada = 0; };
        /**
         * Los trenes circulan solo entre las estaciones `a` y `b` durante `min`
         * minutos; las demás se cierran. Al terminar, las de `deja` ([estación,
         * minutos]) siguen cerradas un rato más.
         */
        S.cortarTramo = (a, b, min, deja = [], exacto = false) => {
            const f = exacto ? 1 : ACHIQUE;
            S.tramo = [a, b]; S.corte = { hasta: S.t + min * f, deja: deja.map(([i, m]) => [i, m * f]) };
            est.forEach((e) => { if (e.i < a || e.i > b) evacuar(e); });
        };
        /** Adelanta un corte activo y devuelve la hora de reapertura, en minutos. */
        S.adelantarReapertura = (min) => {
            if (!S.corte) return S.t;
            S.corte.hasta = Math.max(S.t, S.corte.hasta - Math.max(0, min));
            const hasta = S.corte.hasta;
            if (hasta <= S.t) S.reabrir();
            return hasta;
        };
        /** Vuelve el servicio a toda la línea. */
        S.reabrir = () => {
            const c = S.corte; if (!c) return;
            const eran = est.filter((e) => e.i < S.tramo[0] || e.i > S.tramo[1]);
            S.tramo = [0, N - 1]; S.corte = null;
            for (const [i, min] of c.deja) est[i].cerrada = S.t + min;
            const siguen = c.deja.map(([i]) => est[i].n);
            aviso('bien', `Vuelve el servicio de Quitumbe a El Labrador${siguen.length ? `, menos en ${siguen.join(' y ')}, que sigue cerrada: los trenes pasan de largo` : ''}.`, eran.length ? eran[0].i : -1);
            // Quien esperó a que escampe baja ahora al Metro, todo junto.
            for (const e of eran) if (e.cerrada <= S.t && S.t < S.cierra) S.oleada(e.i, 45, 14 + 260 * (ESTACIONES[e.i].casa + ESTACIONES[e.i].destino));
        };
        /** La vía se corta junto a una estación: los trenes de ese sentido (o de los dos, con −1) esperan detrás. */
        S.cortarVia = (i, min, dir = -1) => { for (const d of dir < 0 ? [0, 1] : [dir]) S.bloqueos.push({ dir: d, s: est[i].pos + (d === 0 ? 40 : -40), hasta: S.t + min }); };
        /** Todos los trenes andan más despacio un rato. */
        S.marchaLenta = (min, f) => { S.lento = S.t + min; S.lentoF = f; };
        /** Las paradas se alargan un rato. */
        S.paradas = (min, f) => { S.paradaLenta = S.t + min; S.paradaF = f; };
        /** Llega más gente a una estación durante `min` minutos (desde dentro de `desde` minutos). */
        S.oleada = (i, min, porMin, desde = 0) => { S.oleadas.push({ est: i, de: S.t + desde, a: S.t + desde + min, porMin }); };
        /** La boletería va más lenta (o más rápida) un rato. */
        S.boleteriaLenta = (i, min, f) => { for (const e of cuales(i)) { e.lenta = S.t + min; e.lentaF = f; } };
        /** Torniquetes abiertos: nadie hace fila ni paga. `paga` es la parte del pasaje que alguien más compensa. */
        S.entradaGratis = (i, min, paga = 0) => { S.gratisPaga = paga; if (i < 0) S.gratis = S.t + min; else est[i].gratis = S.t + min; };
        /** Más gente llega con el pasaje ya pagado a esa estación. */
        S.prepago = (i, min) => { est[i].prepago = S.t + min; };
        /** Se dañan máquinas de boletos. */
        S.danarMaquinas = (i, min, cuantas = 1, callado = false) => {
            if (est[i].maquinas < 1) return;
            for (let k = 0; k < Math.min(cuantas, est[i].maquinas); k++) S.maquinasRotas.push({ i, hasta: S.t + min });
            if (!callado) aviso('mal', `Se dañó una máquina de boletos en ${est[i].n}.`, i);
        };
        /** Un tren se queda parado en la vía cerca de una estación. */
        S.averiar = (i, min) => {
            const t = trenes.filter((q) => q.estado === 'viaje').sort((p, q) => Math.abs(p.s - est[i].pos) - Math.abs(q.s - est[i].pos))[0];
            if (!t) return null;
            t.estado = 'averiado'; t.espera = min * (plan.mantenimiento ? 0.4 : 1);
            aviso('mal', `¡Tren ${t.id} averiado cerca de ${est[i].n}! Estará parado unos ${Math.ceil(t.espera)} minutos y los que vienen detrás tienen que esperar.`, i);
            return t;
        };
        /** El tren más cercano a una estación baja ahí a su gente y se va al taller `min` minutos. */
        S.desalojar = (i, min) => {
            const t = trenes.filter((q) => q.estado === 'viaje' || q.estado === 'parada').sort((p, q) => Math.abs(p.s - est[i].pos) - Math.abs(q.s - est[i].pos))[0];
            if (!t) return null;
            const e = est[i];
            for (let j = 0; j < N; j++) { const n = t.carga[j]; if (!n || j === i) continue; const a = e.anden[j > i ? 0 : 1]; a.d[j] += n; a.total += n; }
            S.cuenta.viajes += t.carga[i]; opinar(e, 20, t.total * 0.6);
            t.carga.fill(0); t.total = 0; t.estado = 'taller'; t.vuelve = S.t + min; t.cab = t.dir === 0 ? 1 : 0;
            return t;
        };
        /** Manda `k` trenes guardados al taller durante `min` minutos. */
        S.retirar = (k, min) => { let n = 0; for (const t of trenes) { if (n >= k) break; if (t.estado === 'cochera') { t.estado = 'taller'; t.vuelve = S.t + min; n++; } } return n; };
        /** Cambia la hora de cierre de hoy. */
        S.extender = (hora) => { S.cierra = hora * 60; };
        /** Algo que pasará dentro de `min` minutos. */
        S.luego = (min, f) => { tareas.push({ t: S.t + min, f }); };
        S.avisar = aviso;
        /**
         * Lo que ordena el jugador. Cada orden queda en la bitácora con el paso en que se dio, para poder repetir el día.
         *   horario(franja, minutos) · ventanillas(estación, cuántas) · maquina(estación) · refuerzo(cabecera) · decidir(id, opción)
         */
        const ORDENES = {
            horario: (i, v) => { S.horario[i] = v; },
            ventanillas: (i, n) => { est[i].ventanillas = n; },
            maquina: (i) => S.comprarMaquina(i),
            refuerzo: (cab) => S.refuerzo(cab),
            decidir: (id, k) => { const ev = S.decisiones.find((d) => d.id === id); if (ev) S.decidir(ev, k); return !!ev; },
        };
        S.orden = (o, ...a) => { S.bitacora.push({ p: S.pasos, o, a }); return ORDENES[o](...a); };
        /** Resuelve una decisión pendiente con la opción `k`. */
        S.decidir = (ev, k) => {
            const j = S.decisiones.indexOf(ev); if (j >= 0) S.decisiones.splice(j, 1);
            const op = ev.opciones[k]; S.elegidas[ev.id] = k;
            const dicho = op.fx ? op.fx(S, plan) : null;
            if (dicho || op.r) aviso(op.tono || 'info', dicho || op.r, ev.est === undefined ? -1 : ev.est);
        };
        return S;
    };

    /**
     * Rehace un día a medias: el mismo escenario y el mismo plan del arranque, las órdenes de la bitácora en su paso,
     * y hasta el paso en que se guardó. Sale idéntico al que se dejó.
     */
    const restaurar = (largos, plan, dia, bitacora, pasos) => {
        const S = crear(largos, plan, dia);
        for (const b of bitacora) { S.correrHasta(b.p); S.orden(b.o, ...b.a); }
        S.correrHasta(pasos);
        return S;
    };

    return { crear, restaurar, pronostico, nivelDe, ESTACIONES, FRANJAS, INTERVALOS, franjaDe, COSTO, PAGO, PASO, TARIFA, CAPACIDAD, FLOTA, ABRE, CIERRA, N };
})();
if (typeof module !== 'undefined') module.exports = JEFE;
