'use strict';

/*
 * Jefe de línea: el calendario.
 *
 * Qué día es cada día de la partida (laborable, sábado, domingo o feriado) y
 * cuánta gente baja al Metro ese día, comparada con un día laborable normal.
 * El día 1 es el lunes 30 de noviembre de 2026; de ahí en adelante el
 * calendario sigue, año tras año.
 *
 * De dónde salen los números:
 *   - Los feriados son los de la Ley de Feriados del Ecuador (2016), con sus
 *     traslados: lo que cae en martes pasa al lunes; en miércoles o jueves, al
 *     viernes; en sábado, al viernes; en domingo, al lunes. El 1 de enero, el
 *     25 de diciembre y el carnaval no se mueven entre semana. El feriado de
 *     la Fundación de Quito (6 de diciembre) es local y sigue la misma regla:
 *     en 2026 cae en domingo y el descanso pasa al lunes 7.
 *   - Los factores marcados «real» salen de los viajes diarios que publica el
 *     Metro de Quito en su boletín estadístico mensual (ediciones de enero,
 *     febrero y mayo de 2025, noviembre de 2025 y marzo de 2026) y de sus
 *     comunicados. Cada uno lleva en «dato» la cifra de la que sale.
 *   - Los marcados como estimados no tienen una cifra publicada que yo haya
 *     encontrado: se les puso el valor del feriado más parecido.
 *   - Un feriado decretado a última hora (un puente, una emergencia) no está
 *     aquí: solo lo que fija la ley.
 *
 * Las estaciones se nombran por su número, como en js/metro-campana.js.
 */
const CALENDARIO = (() => {
    const DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const INICIO = [2026, 10, 30];       // el lunes 30 de noviembre de 2026

    // Un día normal, comparado con un martes, miércoles o jueves (boletín de marzo de 2026: febrero, día por día).
    const BASE = [0.98, 1, 1, 1, 1.07, 0.70, 0.47];
    // Cómo se reparte la gente en un sábado y en un domingo o feriado cualquiera (estimado).
    const PERFIL = {
        sabado: [[7, 0.3], [9, 0.7], [11, 1.05], [13, 1.2], [15, 1.1], [17, 1.2], [19, 1.25], [20.5, 1.05], [22, 0.7], [23, 0.35], [24, 0.3], [25.5, 0.15]],
        domingo: [[7, 0.3], [9, 0.75], [11, 1.2], [13, 1.35], [15, 1.25], [17, 1.3], [19, 1.1], [20.5, 0.8], [22, 0.35], [23, 0.25], [25.5, 0.1]],
    };
    const VUELTA = {
        sabado: [[7, 0.3], [13, 0.45], [17, 0.55], [20, 0.8], [23, 1]],
        domingo: [[7, 0.3], [11, 0.35], [14, 0.55], [17, 0.6], [19.5, 0.85], [22, 1]],
    };

    const fecha = (a, m, d) => new Date(a, m, d);
    const mas = (f, dias) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias);
    const clave = (f) => `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`;
    const dow = (f) => (f.getDay() + 6) % 7;       // 0 es lunes
    const texto = (f) => `${f.getDate()} de ${MES[f.getMonth()]}`;

    /** El domingo de Pascua de un año (cómputo gregoriano). */
    const pascua = (a) => {
        const g = a % 19, c = Math.floor(a / 100), h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
        const i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11)), j = (a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4)) % 7, l = i - j;
        const mes = 3 + Math.floor((l + 40) / 44), dia = l + 28 - 31 * Math.floor(mes / 4);
        return fecha(a, mes - 1, dia);
    };
    /** A qué día pasa el descanso de un feriado, según la ley. `fijo`: el 1 de enero y el 25 de diciembre no se mueven entre semana. */
    const traslado = (f, fijo = false) => {
        const d = dow(f);
        if (d === 5) return mas(f, -1);
        if (d === 6) return mas(f, 1);
        if (fijo) return f;
        return d === 1 ? mas(f, -1) : d === 2 ? mas(f, 2) : d === 3 ? mas(f, 1) : f;
    };
    /** El 2 y el 3 de noviembre van juntos y tienen su propia regla. Devuelve los dos días de descanso. */
    const difuntos = (a) => { const [p, q] = [[2, 3], [1, 2], [3, 4], [2, 3], [1, 2], [1, 4], [3, 4]][dow(fecha(a, 10, 2))]; return [fecha(a, 10, p), fecha(a, 10, q)]; };
    /** El domingo más cercano a una fecha. */
    const domingoCerca = (f) => { const d = dow(f); return mas(f, d === 6 ? 0 : d <= 2 ? -d - 1 : 6 - d); };

    const NAVIDAD = [[4, 1], [12, 0.8], [11, 0.7]];          // El Recreo, Iñaquito y La Carolina: los centros comerciales
    const CENTRO = [[6, 1], [7, 0.45], [8, 0.35]];           // San Francisco, La Alameda y El Ejido

    /**
     * Las fechas señaladas de un año: clave → { n, f o x, feriado, real, dato, … }.
     *   f        viajes de ese día respecto de un laborable normal (1 = igual)
     *   x        en vez de f: multiplica lo que ese día de la semana movería de todos modos
     *   feriado  día de descanso: horario de 07:00 a 22:00 y el día repartido como un domingo
     *   real     el factor sale de una cifra publicada (en «dato»)
     *   cierra   hora de cierre extendida · ev: gente que llega de golpe a unas estaciones
     */
    const anios = new Map();
    const delAnio = (a) => {
        if (anios.has(a)) return anios.get(a);
        const m = new Map(), pon = (f, o) => { if (f.getFullYear() === a) m.set(clave(f), Object.assign(m.get(clave(f)) || {}, o)); };
        const P = pascua(a), unDia = { f: 0.58, feriado: true, real: false, dato: 'No encontré su cifra: se usa la del feriado del 9 de octubre, cerca del 60% de un día laborable.' };

        // El día de descanso de un feriado que cayó en fin de semana (estimado: no encontré la cifra de ninguno).
        const corrido = (n) => ({ n: `Feriado de ${n}`, f: 0.58, x: undefined, feriado: true, real: false, dato: 'El descanso se traslada porque la fecha cae en fin de semana. Se estima como un feriado corriente: cerca del 60% de un día laborable.' });
        // Enero. Si el 1 de enero del año siguiente cae en sábado, su descanso es el 31 de diciembre de este.
        pon(fecha(a, 0, 1), { n: 'Año Nuevo', f: 0.30, feriado: true, real: true, dato: 'El 1 de enero de 2025 fue el día de menos viajes del año: 49.269. En 2024 fueron 67.244.' });
        for (const y of [a, a + 1]) { const f = traslado(fecha(y, 0, 1), true); if (f.getDate() !== 1) pon(f, corrido('Año Nuevo')); }
        // Carnaval: lunes y martes, 48 y 47 días antes de la Pascua.
        pon(mas(P, -51), { n: 'Víspera de carnaval', f: 1.13, real: true, dato: 'El viernes 13 de febrero de 2026, antes del carnaval, hubo 234.082 viajes: el máximo del mes.' });
        pon(mas(P, -50), { n: 'Sábado de carnaval', f: 0.64, carnaval: true, real: true, dec: ['carnavaleros', 15.5, 8], dato: 'El sábado de carnaval de 2024 movió 113.625 viajes, un 10% menos que un sábado normal.' });
        pon(mas(P, -49), { n: 'Domingo de carnaval', f: 0.45, carnaval: true, real: true, dec: ['carnavaleros', 14.5, 11], dato: 'El domingo de carnaval de 2026 hubo 91.564 viajes.' });
        pon(mas(P, -48), { n: 'Lunes de carnaval', f: 0.46, feriado: true, carnaval: true, real: true, dec: ['carnavaleros', 13.5, 4], dato: 'El lunes de carnaval de 2026 hubo 95.178 viajes: menos de la mitad de un lunes normal.' });
        pon(mas(P, -47), { n: 'Martes de carnaval', f: 0.42, feriado: true, carnaval: true, real: true, dec: ['carnavaleros', 15, 0], dato: 'El martes de carnaval de 2026 hubo 86.730 viajes: el día más flojo del mes.' });
        if (dow(fecha(a, 1, 14)) < 5 && !m.has(clave(fecha(a, 1, 14)))) pon(fecha(a, 1, 14), { n: 'San Valentín', x: 1.08, real: true, dato: 'El viernes 14 de febrero de 2025 hubo 226.634 viajes, el máximo del mes.' });
        // Semana Santa.
        pon(mas(P, -3), { n: 'Jueves Santo', f: 0.80, real: true, dato: 'El Jueves Santo de 2025 hubo 163.784 viajes: una quinta parte menos que un jueves normal.' });
        pon(mas(P, -2), {
            n: 'Viernes Santo', f: 0.60, feriado: true, real: true, dato: 'El Viernes Santo de 2025 hubo 122.388 viajes: poco para un viernes, mucho para un feriado, por la procesión de Jesús del Gran Poder.',
            ev: [{ n: 'Procesión de Jesús del Gran Poder', corto: 'Procesión', lugar: 'sanfrancisco', est: [[6, 1], [7, 0.6]], de: 15.2, a: 17.2, k: 0.9 }],
            aviso: [[9.5, 'Los cucuruchos y las verónicas ya se reúnen en San Francisco. La procesión sale al mediodía y termina hacia las 16:00.', 6]],
            dec: ['procesion', 10.4, 6],
        });
        pon(mas(P, -1), { n: 'Sábado Santo', f: 0.59, real: true, dato: 'El Sábado Santo de 2025 hubo 120.809 viajes, un 13% menos que un sábado normal.' });
        pon(P, { n: 'Domingo de Pascua', f: 0.46, real: true, dato: 'El Domingo de Pascua de 2025 hubo 97.286 viajes: el mínimo del mes.' });
        // Mayo: la carrera Quito 15K, el último domingo.
        { let v = fecha(a, 4, 31); while (dow(v) !== 6) v = mas(v, -1);
            pon(v, { n: 'Quito 15K', f: 0.74, real: true, dato: 'El domingo 31 de mayo de 2026, con la Quito 15K, hubo 151.203 viajes: el domingo de más viajes del año.', ev: [{ n: 'Meta de la Quito 15K', corto: 'Quito 15K', lugar: 'estadio', est: [[12, 1], [11, 0.6]], de: 9.5, a: 12.5, k: 0.6 }] }); }
        // Septiembre: el regreso a clases en la Sierra, el primer lunes (estimado).
        { let v = fecha(a, 8, 1); while (dow(v) !== 0) v = mas(v, 1);
            pon(v, { n: 'Regreso a clases', x: 1.05, real: false, dato: 'Vuelven los estudiantes. No encontré la cifra de ese día: se estima un 5% más que un lunes normal.', ev: [{ n: 'Salida de clases en la Universidad Central', corto: 'Regreso a clases', lugar: 'universidad', est: [[9, 1]], de: 12.5, a: 14, k: 0.35 }] }); }
        // Los feriados nacionales de un solo día.
        pon(traslado(fecha(a, 4, 1)), Object.assign({ n: 'Día del Trabajo' }, unDia));
        pon(traslado(fecha(a, 4, 24)), Object.assign({ n: 'Batalla de Pichincha' }, unDia));
        pon(traslado(fecha(a, 9, 9)), Object.assign({}, unDia, { n: 'Independencia de Guayaquil', real: true, dato: 'El feriado del 9 de octubre movió 114.233 viajes en 2024 y 112.931 en 2025: cerca del 60% de un día laborable.' }));
        const [d1, d2] = difuntos(a);
        pon(d1, Object.assign({ n: 'Día de Difuntos' }, unDia)); pon(d2, Object.assign({ n: 'Independencia de Cuenca' }, unDia));
        { let v = mas(d1, -1); while (dow(v) > 4) v = mas(v, -1); pon(v, { n: 'Víspera del feriado de Difuntos', f: 1.16, real: true, dato: 'El viernes 31 de octubre de 2025, antes del feriado de Difuntos, hubo 238.716 viajes: el máximo del mes.' }); }
        // Agosto: el Primer Grito y, alrededor, la Fiesta de la Luz en el Centro Histórico.
        const luz = domingoCerca(fecha(a, 7, 10));
        for (let k = -4; k <= 0; k++) {
            const finde = k >= -2;
            pon(mas(luz, k), {
                n: 'Fiesta de la Luz', x: finde ? 1.3 : 1.1, real: finde, cierra: k === -2 || k === -1 ? 25 : undefined,
                dato: 'Del 8 al 10 de agosto de 2025, con la Fiesta de la Luz, el Metro movió 575.000 viajes en tres días: un 18,7% más que en 2024.',
                ev: [{ n: 'Fiesta de la Luz en el Centro Histórico', corto: 'Fiesta de la Luz', lugar: 'plaza', est: CENTRO, de: 20.4, a: k === -2 || k === -1 ? 23.8 : 21.7, k: finde ? 0.8 : 0.5, noche: true }],
            });
        }
        pon(traslado(fecha(a, 7, 10)), { n: 'Primer Grito de Independencia', f: 0.72, x: undefined, feriado: true, real: false, dato: 'Es feriado, pero cae junto a la Fiesta de la Luz: en 2025 ese fin de semana largo sumó 575.000 viajes. El factor del día de descanso es estimado.' });
        // Noviembre: el viernes negro, que ya es el día de más viajes de la historia del Metro.
        { let v = fecha(a, 10, 1), jueves = 0; while (jueves < 4) { if (dow(v) === 3) jueves++; if (jueves < 4) v = mas(v, 1); }
            pon(mas(v, 1), { n: 'Viernes negro', f: 1.30, real: true, dato: 'El viernes 28 de noviembre de 2025 hubo 274.000 viajes: el récord de un solo día.', ev: [{ n: 'Viernes negro en los centros comerciales', corto: 'Viernes negro', lugar: 'recreo', est: NAVIDAD, de: 18.5, a: 21, k: 0.7 }] }); }
        // Diciembre: las Fiestas de Quito.
        pon(fecha(a, 11, 1), { n: 'Aniversario del Metro', x: 1.1, real: true, dato: 'El Metro abrió el 1 de diciembre de 2023. El 1 de diciembre de 2024, domingo de Fiestas y primer aniversario, hubo 124.648 viajes: un 13% más que un domingo normal.' });
        const seis = fecha(a, 11, 6), descanso = traslado(seis), vispera = fecha(a, 11, 5);
        if (clave(descanso) === clave(seis)) pon(seis, { n: 'Fundación de Quito', f: 0.89, feriado: true, real: true, fiestas: 9, dato: 'El viernes 6 de diciembre de 2024, feriado de Fundación, hubo 182.986 viajes: casi como un día laborable.' });
        else {
            // Entre semana, si el descanso se corre al viernes, el 6 se trabaja y se festeja igual.
            pon(seis, dow(seis) >= 5 ? { n: 'Día de Quito', f: 0.89, feriado: true, fiestas: 9, dato: 'El 6 de diciembre de 2024, que fue viernes, hubo 182.986 viajes. No hay cifra publicada de un 6 de diciembre en fin de semana: se usa la misma.' }
                : { n: 'Día de Quito', x: 1.05, fiestas: 16, dato: 'El descanso pasa al viernes: el 6 se trabaja y se festeja de noche. Sin cifra publicada; estimado.' });
            pon(descanso, corrido('la Fundación de Quito'));
        }
        if (clave(vispera) !== clave(descanso)) pon(vispera, {
            n: 'Víspera de la Fundación', f: dow(vispera) < 5 ? 1.21 : undefined, x: dow(vispera) < 5 ? undefined : 1.2, real: true, cierra: 25.5, fiestas: 17.5,
            dato: 'El jueves 5 de diciembre de 2024, víspera de la Fundación, hubo 248.188 viajes: el máximo del mes. En 2025 el Metro cerró a la 01:30.',
            ev: [{ n: 'Serenata quiteña en el Centro Histórico', corto: 'Serenata', lugar: 'plaza', est: CENTRO, de: 23.4, a: 24.9, k: 0.85, noche: true }],
        });
        // Navidad y fin de año.
        for (let d = 14; d <= 23; d++) {
            const f = fecha(a, 11, d), w = dow(f);
            pon(f, {
                n: 'Compras de Navidad', x: w === 5 ? 1.2 : w === 6 ? 1.32 : 1.06, real: true,
                dato: w === 5 ? 'El sábado 21 de diciembre de 2024 hubo 177.003 viajes: una cuarta parte más que un sábado normal.' : w === 6 ? 'El domingo 22 de diciembre de 2024 hubo 137.360 viajes, un 25% más que un domingo normal.' : 'Del 16 al 23 de diciembre de 2024 cada día laborable pasó de 204.000 viajes, y el viernes 20 llegó a 228.615.',
                ev: w >= 5 || w === 4 ? [{ n: 'Compras de Navidad en los centros comerciales', corto: 'Compras de Navidad', lugar: 'recreo', est: NAVIDAD, de: w >= 5 ? 16.5 : 18.6, a: w >= 5 ? 19.5 : 21, k: 0.55 }] : undefined,
                dec: d % 3 === 0 ? ['novena', 17.4, [6, 11, 4][(d / 3) % 3]] : undefined,
            });
        }
        const nav = fecha(a, 11, 25), navDescanso = traslado(nav, true);
        pon(fecha(a, 11, 24), { n: 'Nochebuena', x: 0.93, real: true, dato: 'El 24 de diciembre de 2024 hubo 191.146 viajes: un poco menos que un martes normal, y casi todos antes de las 19:00.' });
        pon(nav, { n: 'Navidad', f: 0.47, feriado: true, real: true, dato: 'El 25 de diciembre de 2024 hubo 96.365 viajes: menos de la mitad de un día laborable y el mínimo del mes.' });
        if (clave(navDescanso) !== clave(nav)) pon(navDescanso, corrido('Navidad'));
        for (let d = 26; d <= 30; d++) if (dow(fecha(a, 11, d)) < 5 && !m.has(clave(fecha(a, 11, d)))) pon(fecha(a, 11, d), { n: 'Semana de fin de año', x: 0.86, real: true, dato: 'Entre el 26 y el 30 de diciembre de 2024 los días laborables movieron de 171.000 a 179.000 viajes: un 14% menos de lo normal.' });
        if (!m.has(clave(fecha(a, 11, 31)))) pon(fecha(a, 11, 31), { n: 'Fin de año', x: 0.95, real: true, dec: ['viejos', 16.5, 8], dato: 'El 31 de diciembre de 2024 hubo 195.760 viajes, casi como un día normal: la gente sale a ver los años viejos y vuelve temprano.' });
        anios.set(a, m);
        return m;
    };

    /** Todo sobre una fecha: qué día es, cuánta gente se espera y por qué. */
    const de = (f) => {
        const w = dow(f), s = delAnio(f.getFullYear()).get(clave(f)) || null, feriado = !!(s && s.feriado);
        const base = BASE[w], factor = s ? (s.f !== undefined ? s.f : base * s.x) : base;
        const tipo = feriado ? 'feriado' : w === 5 ? 'sabado' : w === 6 ? 'domingo' : 'laborable';
        // Contra qué se compara: un feriado, contra el día laborable que habría sido; lo demás, contra su propio día de la semana.
        const normal = feriado && w < 5 ? 1 : base, cambio = factor / normal - 1;
        return {
            fecha: f, dow: w, dia: DIA[w], texto: texto(f), tipo, feriado, n: s ? s.n : '', factor, base, cambio,
            tono: cambio > 0.045 ? 'alza' : cambio < -0.045 ? 'baja' : '',
            real: !!(s && s.real), dato: s ? s.dato || '' : '', carnaval: !!(s && s.carnaval),
            abre: tipo === 'laborable' ? 5.5 : 7, cierra: (s && s.cierra) || (tipo === 'laborable' || tipo === 'sabado' ? 23 : 22),
            perfil: tipo === 'laborable' ? null : PERFIL[tipo === 'sabado' ? 'sabado' : 'domingo'], vuelta: tipo === 'laborable' ? null : VUELTA[tipo === 'sabado' ? 'sabado' : 'domingo'],
            ev: (s && s.ev) || [], aviso: (s && s.aviso) || [], dec: (s && s.dec) || null, fiestas: s && s.fiestas,
        };
    };
    /** La fecha del día `n` de la partida (el 1 es el lunes 30 de noviembre de 2026). */
    const fechaDe = (n) => fecha(INICIO[0], INICIO[1], INICIO[2] + n - 1);
    const dia = (n) => de(fechaDe(n));
    /** Los `cuantos` días que siguen al día `n`, para planear la caja. */
    const proximos = (n, cuantos = 7) => Array.from({ length: cuantos }, (_, k) => Object.assign(dia(n + k), { numero: n + k }));
    /** Las fechas señaladas de un año, en orden. */
    const delAnioEnOrden = (a) => { const l = []; for (let f = fecha(a, 0, 1); f.getFullYear() === a; f = mas(f, 1)) { const d = de(f); if (d.n) l.push(d); } return l; };
    /** «+21%», «−53%». */
    const pct = (c) => (c >= 0 ? '+' : '−') + Math.abs(Math.round(c * 100)) + '%';

    return { de, dia, fechaDe, proximos, anio: delAnioEnOrden, pascua, traslado, difuntos, pct, BASE, PERFIL, VUELTA, DIA, MES };
})();
if (typeof module !== 'undefined') module.exports = CALENDARIO;
