'use strict';
/*
 * Pruebas de la simulación y de la campaña, sin navegador:  node tools/prueba-simulacion.cjs
 *
 *   - Determinismo: un día cortado a medias y rehecho con su bitácora termina idéntico (así se recupera un turno).
 *   - El informe: lo que reparte «Por qué salió así» suma exactamente lo que le faltó al ánimo para llegar a 100.
 *   - Lo que queda para mañana: cada nota de una decisión se convierte en sucesos válidos al día siguiente.
 *   - Las misiones y la dificultad: datos completos y funciones que no fallan.
 *   - El balance de la semana, con tres jugadores de mentira:
 *       pasivo  hace solo lo que pide la guía y no toca nada más;
 *       normal  pide el horario sugerido y atiende las boleterías (como si tuviera jefes de estación);
 *       experto lo anterior, con las mejoras de la tienda.
 *     Se exige que el normal saque dos estrellas o más cada día, que el pasivo no las saque todos los días y que el
 *     turno sin fin, con el crecimiento de la demanda, no se dispare: la línea crece despacio, como en Quito.
 *
 * Sale con código 1 si algo falla.
 */
const JEFE = require('../js/metro-sim.js');
const CAMPANA = require('../js/metro-campana.js');

const largos = Array.from({ length: JEFE.N }, (_, i) => 22600 * (0.02 + 0.96 * i / (JEFE.N - 1)));
const MAQUINAS = [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2, 0, 2];
const estrellas = (a, s, m) => (a >= m + 10 && s >= 0 ? 3 : a >= m ? 2 : a >= m - 10 ? 1 : 0);
let fallas = 0, hechas = 0;
const ok = (nombre, cond, extra = '') => { hechas++; if (!cond) fallas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nombre + (extra ? ` — ${extra}` : '')); };

const plan = (D, extra = {}) => Object.assign({ maquinas: MAQUINAS.slice(), horario: [8, 8, 8, 8, 8, 8, 8], ventanillas: null, jefes: D.autoBoleteria ? 1 : 0 }, extra);
/** Corre un día entero. `elegir(ev)` dice qué opción tomar en cada decisión; `antes(S)` hace algo al empezar. */
function correr(D, p, { elegir = () => 0, antes } = {}) {
    const S = JEFE.crear(largos, p, D);
    if (antes) antes(S);
    while (!S.terminado) { S.avanzar(5); while (S.decisiones.length) { const ev = S.decisiones[0]; S.orden('decidir', ev.id, Math.min(elegir(ev), ev.opciones.length - 1)); } }
    return S;
}
const huella = (S) => JSON.stringify([S.t, S.pasos, S.cuenta, S.animo, S.est.map((e) => [e.ventanillas, e.colaTotal, e.anden[0].total, e.anden[1].total, e.animo]), S.trenes.map((t) => [t.estado, t.s, t.total]), S.horario, S.secuelas]);

// ───── Determinismo ─────
console.log('Determinismo');
const dias = CAMPANA.DIAS.map((D, i) => [D.n, D]).concat([8, 11, 15, 22, 40].map((n) => [`día ${n}`, CAMPANA.generar(n, 4242)]));
for (const [n, D0] of dias) {
    const D = CAMPANA.conSecuelas(D0, [{ s: 'reglamento' }, { s: 'escalera', i: 4 }, { s: 'feria', i: 2, dias: 2 }], { i: 6, dias: 3 });
    const p0 = plan(D, { horario: [8, 5, 8, 8, 8, 5, 8] }), copia = JSON.parse(JSON.stringify(p0));
    // Un día con órdenes en pasos distintos: horario, ventanillas, una máquina, un refuerzo y las decisiones (alternando opciones).
    const S = JEFE.crear(largos, p0, D); let k = 0;
    const corte = Math.round((S.cierra - S.abre) / JEFE.PASO * 0.55); let mitad = null;
    while (!S.terminado) {
        if (S.pasos === 400) S.orden('horario', 2, 6);
        if (S.pasos === 900) S.orden('ventanillas', 0, 4);
        if (S.pasos === 1300) S.orden('maquina', 12);
        if (S.pasos === 1700) S.orden('refuerzo', 1);
        if (S.pasos >= corte && !mitad) mitad = { pasos: S.pasos, bitacora: JSON.parse(JSON.stringify(S.bitacora)), h: huella(S) };
        S.avanzar(JEFE.PASO);
        while (S.decisiones.length) { const ev = S.decisiones[0]; S.orden('decidir', ev.id, (k++) % ev.opciones.length); }
    }
    const R = JEFE.restaurar(largos, Object.assign({}, copia, { maquinas: copia.maquinas.slice() }), D, mitad.bitacora, mitad.pasos);
    const igualMitad = huella(R) === mitad.h;
    let j = 0; while (!R.terminado) { R.avanzar(JEFE.PASO); while (R.decisiones.length) { const ev = R.decisiones[0]; R.orden('decidir', ev.id, (k + j++) % ev.opciones.length); } }
    ok(`${n}: el turno rehecho coincide a mitad del día`, igualMitad);
}

// ───── El informe ─────
console.log('El informe');
for (const D of [CAMPANA.DIAS[0], CAMPANA.DIAS[4], CAMPANA.DIAS[6], CAMPANA.generar(12, 9)]) {
    const S = correr(D, plan(D), { elegir: (ev) => ev.opciones.length - 1 });
    const suma = Object.values(S.porCausa()).reduce((a, b) => a + b, 0), por = S.porque();
    ok(`${D.n}: las causas suman lo que faltó (${(100 - S.animoDia()).toFixed(2)})`, Math.abs(100 - S.animoDia() - suma) < 1e-6, suma.toFixed(2));
    ok(`${D.n}: el «por qué» trae estación, horas y causa`, por.length > 0 && por.every((q) => q.a > q.de && q.i >= -1 && q.i < JEFE.N && q.puntos > 0));
}

// ───── Lo que queda para mañana ─────
console.log('Lo que queda para mañana');
{
    const notas = [{ s: 'tarjetas' }, { s: 'video' }, { s: 'reglamento' }, { s: 'grafiti' }, { s: 'escalera', i: 4 }, { s: 'vendedores', i: 2 }, { s: 'feria', i: 2, dias: 3 }, { s: 'carteristas', i: 6 }, { s: 'aire' }, { s: 'inspeccion' }, { s: 'serenata', bien: true }, { s: 'serenata', bien: false }];
    for (const D0 of [CAMPANA.DIAS[1], CAMPANA.DIAS[6], CAMPANA.generar(9, 1)]) {
        const D = CAMPANA.conSecuelas(D0, notas, { i: 11, dias: 3 });
        ok(`${D0.n}: cada nota suma su línea al parte`, D.parte.filter((t) => t.startsWith('Lo de ayer')).length === notas.length + 1);
        ok(`${D0.n}: los sucesos quedan en orden y antes del cierre`, D.sucesos.every((q, k, l) => !k || l[k - 1].hora <= q.hora) && D.sucesos.every((q) => q.hora < (D.cierra || 23)));
        ok(`${D0.n}: el escenario original no se toca`, D0.sucesos.length < D.sucesos.length && !D0.parte.some((t) => t.startsWith('Lo de ayer')));
        const S = correr(D, plan(D));
        ok(`${D0.n}: el día con todas las notas se juega entero`, S.terminado && S.decididas.some((d) => d.id === 'paro') && S.decididas.some((d) => d.id === 'veterinario'));
    }
    ok('Las notas de varios días se descuentan', JSON.stringify(CAMPANA.siguen([{ s: 'feria', i: 2, dias: 3 }, { s: 'video' }])) === JSON.stringify([{ s: 'feria', i: 2, dias: 2 }]));
    // Las decisiones que dejan algo para mañana lo dejan de verdad.
    const S = JEFE.crear(largos, plan(CAMPANA.DIAS[3]), CAMPANA.DIAS[3]);
    S.decidir(Object.assign({ hora: 6 }, CAMPANA.DECISIONES.viral()), 2); S.decidir(Object.assign({ hora: 6 }, CAMPANA.DECISIONES.perro(5)), 1);
    ok('Una decisión puede dejar notas para mañana', S.secuelas.some((x) => x.s === 'video') && S.secuelas.some((x) => x.s === 'durmiente' && x.i === 5));
}

// ───── Misiones y dificultad ─────
console.log('Misiones y dificultad');
{
    const S = correr(CAMPANA.DIAS[2], plan(CAMPANA.DIAS[2]));
    const ids = new Set();
    for (const m of CAMPANA.MISIONES) {
        ids.add(m.id);
        const bien = m.n && m.de && m.d && m.plazo > 0 && m.premio > 0 && (m.suma ? typeof m.medida === 'function' : m.veces > 0 && typeof m.ok === 'function') && typeof m.valor === 'function';
        let corre = true; try { if (m.suma) m.medida(S); else m.ok(S, { est: 2, D: CAMPANA.DIAS[2] }); m.valor(S, { est: 2 }); } catch (e) { corre = false; }
        ok(`Misión «${m.n}»`, bien && corre);
    }
    ok('Los nombres de las misiones no se repiten', ids.size === CAMPANA.MISIONES.length);
    ok('Hay misiones desde el lunes, el martes y el miércoles', [0, 1, 2].every((d) => CAMPANA.MISIONES.some((m) => m.desde === d)));
    const dif = CAMPANA.DIFICULTADES;
    ok('Tres dificultades, de menos a más exigente', dif.tranquilo.meta < dif.normal.meta && dif.normal.meta < dif.exigente.meta && dif.tranquilo.caja > dif.exigente.caja);
}

// ───── Franjas y horario sugerido ─────
console.log('Franjas y horario sugerido');
{
    const sab = JEFE.crear(largos, plan(CAMPANA.DIAS[5]), CAMPANA.DIAS[5]), lun = JEFE.crear(largos, plan(CAMPANA.DIAS[0]), CAMPANA.DIAS[0]);
    ok('El sábado usa las franjas de fin de semana', sab.finde && sab.franjas === JEFE.FRANJAS_FINDE && sab.franjas[0].de === 7);
    ok('El lunes usa las de entre semana', !lun.finde && lun.franjas === JEFE.FRANJAS);
    ok('El pronóstico tiene una cifra por franja', sab.pronostico().length === JEFE.FRANJAS_FINDE.length && sab.pronostico().every((v) => v >= 0));
    const sug = lun.sugerir();
    ok('La sugerencia del lunes acorta los picos', sug[1] <= 6 && sug[5] <= 6 && sug[2] >= 8, sug.join(','));
    ok('La sugerencia nunca pide más trenes de los que hay', [CAMPANA.DIAS[2], CAMPANA.DIAS[6]].every((D) => { const S = JEFE.crear(largos, plan(D), D); return S.sugerir().every((c) => S.trenesPara(c) <= S.flota || c === 15); }));
}

// ───── Balance de la semana ─────
console.log('Balance de la semana');
{
    const filas = [];
    let pasivoTres = 0;
    const horarioSabado = correr(CAMPANA.DIAS[5], plan(CAMPANA.DIAS[5]), { antes: (S) => S.sugerir().forEach((v, k) => S.orden('horario', k, v)) }).horario;
    CAMPANA.DIAS.forEach((D, i) => {
        const finde = JEFE.esFinde(D);
        // El pasivo hace lo que pide la guía: el lunes baja los picos a 5; el sábado pide la sugerencia (y el domingo la repite).
        const pasivo = correr(D, plan(D, { horario: finde ? (i === 5 ? [8, 8, 8, 8, 8, 8, 8] : horarioSabado) : [8, 5, 8, 8, 8, 5, 8] }), { antes: finde ? (S) => S.sugerir().forEach((v, k) => S.orden('horario', k, v)) : null });
        const normal = correr(D, plan(D, { jefes: 1 }), { antes: (S) => S.sugerir().forEach((v, k) => S.orden('horario', k, v)) });
        const experto = correr(D, plan(D, { jefes: 1, tarjeta: 1, cajeros: 1, anden: i >= 2 ? 1 : 0, mantenimiento: i >= 2 ? 1 : 0, pantallas: i >= 3 ? 1 : 0, bombas: i >= 4 ? 1 : 0 }), { antes: (S) => S.sugerir().forEach((v, k) => S.orden('horario', k, v)) });
        const e = (S) => estrellas(S.animoDia(), S.balance(), D.meta);
        if (e(pasivo) === 3) pasivoTres++;
        filas.push(`    ${D.n.padEnd(10)} meta ${D.meta} · pasivo ★${e(pasivo)} (${pasivo.animoDia().toFixed(0)}) · normal ★${e(normal)} (${normal.animoDia().toFixed(0)}, ${Math.round(normal.balance())}) · experto ★${e(experto)} (${experto.animoDia().toFixed(0)})`);
        ok(`${D.n}: el jugador normal saca dos estrellas o más`, e(normal) >= 2, `ánimo ${normal.animoDia().toFixed(1)}, meta ${D.meta}`);
        ok(`${D.n}: el experto no saca menos que el normal`, e(experto) >= e(normal));
    });
    console.log(filas.join('\n'));
    ok('El jugador pasivo no gana tres estrellas todos los días', pasivoTres <= 2, `${pasivoTres} días de tres estrellas`);
}

// ───── Turno sin fin ─────
console.log('Turno sin fin');
{
    const c = CAMPANA.crecimiento;
    ok('La línea crece despacio: menos de 10% el primer año', c(new Date(2027, 11, 7)) < 1.1 && c(new Date(2027, 11, 7)) > 1.05);
    ok('Y no pasa de un 22% más (unos 250.000 viajes)', c(new Date(2040, 0, 1)) <= 1.22);
    const julio = CAMPANA.generar(80, 3), metas = [8, 14, 20, 30, 60].map((n) => CAMPANA.generar(n, 5).meta);
    ok('La meta sube con los días, hasta 86', metas.every((m, k) => !k || m >= metas[k - 1] - 4) && Math.max(...metas) <= 86, metas.join(','));
    ok('El generador es repetible', JSON.stringify(CAMPANA.generar(33, 77).parte) === JSON.stringify(CAMPANA.generar(33, 77).parte));
    ok('Ningún día del turno pasa de 1,6 veces la demanda base', Array.from({ length: 120 }, (_, k) => CAMPANA.generar(8 + k, 11)).every((D) => D.demanda < 1.6), julio.fecha);
}

console.log(`\n${hechas - fallas} de ${hechas} comprobaciones pasaron`);
process.exit(fallas ? 1 : 0);
