'use strict';

/*
 * Jefe de línea: la campaña.
 *
 * Los siete días de la semana de Fiestas de Quito (del lunes 30 de noviembre
 * al domingo 6 de diciembre de 2026) y, después, el turno sin fin: días
 * armados al azar, cada vez más cargados. Son solo datos; la simulación está
 * en js/metro-sim.js y la pantalla en js/juego.js.
 *
 * Cada día de la semana entrega una mecánica nueva (campo «nuevo»): el lunes
 * solo se decide el horario y el resto lo lleva el Puesto Central; el martes
 * llegan las boleterías; el miércoles, los trenes de refuerzo; el jueves, las
 * decisiones; el viernes, los cierres por lluvia; el sábado, el fin de semana.
 * Las mejoras de la tienda también se van ofreciendo de a poco («desde»).
 *
 * Las estaciones se nombran por su número, de sur a norte:
 *   0 Quitumbe · 1 Morán Valverde · 2 Solanda · 3 Cardenal de la Torre ·
 *   4 El Recreo · 5 La Magdalena · 6 San Francisco · 7 La Alameda · 8 El Ejido ·
 *   9 Universidad Central · 10 La Pradera · 11 La Carolina · 12 Iñaquito ·
 *   13 Jipijapa · 14 El Labrador
 *
 * Lo que está tomado de la realidad: los horarios de sábado (07:00 a 23:00) y
 * de domingo y feriado (07:00 a 22:00); el cierre a la 01:30 en la víspera del
 * 6 de diciembre (así fue en 2025); y la granizada del viernes, calcada de la
 * del 7 de octubre de 2026, cuando el Metro cerró siete estaciones, circuló
 * solo entre Quitumbe y La Alameda y dejó La Pradera cerrada al reabrir. La
 * inundación de El Labrador es la del 4 de octubre de 2026. Lo demás es
 * inventado.
 *
 * El turno sin fin recorre el calendario de verdad (ver «El calendario»):
 * los feriados nacionales con su traslado, Carnaval y Viernes Santo por la
 * fecha de Pascua, y las fechas de Quito. Qué días sube y qué días baja la
 * gente sale de cifras publicadas por el Metro cuando las hay (el récord de
 * 273.997 viajes del viernes de fiestas de 2025, los 150.068 de un viernes
 * feriado contra 201.624 del jueves anterior, los 136.405 de un sábado, los
 * 102.077 del día más flojo de diciembre, los 151.203 del domingo de la
 * Quito 15K, la procesión del Viernes Santo con el ingreso restringido en San
 * Francisco); donde no hay cifra, la proporción es estimada y lo dice.
 */
const CAMPANA = (() => {
    const SIM = typeof JEFE !== 'undefined' ? JEFE : require('./metro-sim.js');      // en el navegador ya está cargada; en Node se pide
    const miles = (v) => Math.round(v).toLocaleString('de-DE');
    const coma = (v) => v.toFixed(1).replace('.', ',');
    const NOMBRE = ['Quitumbe', 'Morán Valverde', 'Solanda', 'Cardenal de la Torre', 'El Recreo', 'La Magdalena', 'San Francisco', 'La Alameda', 'El Ejido', 'Universidad Central', 'La Pradera', 'La Carolina', 'Iñaquito', 'Jipijapa', 'El Labrador'];
    const hhmm = (h) => { const m = Math.round(h * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    const saldoTxt = (S) => `saldo de ${S.balance() < 0 ? '−' : ''}$${miles(Math.abs(S.balance()))}`;

    // ───────────────────────── Las decisiones ─────────────────────────
    // Cada una es una función de la estación `i` (si le hace falta) que devuelve la tarjeta que verá el jugador.
    const DECISIONES = {
        musico: (i) => ({
            id: 'musico', est: i, titulo: `Un músico en ${NOMBRE[i]}`,
            texto: `Un guitarrista toca pasillos en el vestíbulo de ${NOMBRE[i]}. A la gente le gusta, pero el corro estorba frente a los torniquetes.`,
            opciones: [
                { t: 'Dejarlo tocar', d: 'La gente sonríe. La boletería va más lenta durante una hora.', fx: (S) => { S.opinion(i, 100, 900); S.boleteriaLenta(i, 60, 0.8); }, r: `Suena «Vasija de barro» en ${NOMBRE[i]}.`, tono: 'bien' },
                { t: 'Darle un rincón señalado (−$150)', d: 'Música sin estorbo.', fx: (S) => { S.gasto(150); S.opinion(i, 100, 900); }, r: 'El músico toca junto a la escalera, sin estorbar a nadie.', tono: 'bien' },
                { t: 'Pedirle que se retire', d: 'El paso queda libre. Algún pasajero lo lamenta.', fx: (S) => { S.opinion(i, 55, 300); }, r: 'El músico guarda la guitarra.' },
            ],
        }),
        colegio: (i) => ({
            id: 'colegio', est: i, titulo: 'Paseo escolar',
            texto: `Una escuela lleva a 300 estudiantes de paseo y quiere entrar por ${NOMBRE[i]}, todos juntos, ahora.`,
            opciones: [
                { t: 'Que pasen ya, con un guía', d: `Entran por la puerta de servicio, sin fila. El próximo tren sale de ${NOMBRE[i]} con 300 pasajeros más.`, fx: (S) => { S.oleada(i, 4, 75); S.opinion(i, 100, 1200); }, r: `Trescientos mandiles bajan en fila al andén de ${NOMBRE[i]}.`, tono: 'bien' },
                { t: 'Que vengan en 40 minutos', d: 'Habrá menos gente, pero los niños esperan en la calle.', fx: (S) => { S.oleada(i, 4, 75, 40); S.opinion(i, 45, 700); }, r: 'La escuela espera afuera, al sol.' },
            ],
        }),
        vendedores: (i) => ({
            id: 'vendedores', est: i, titulo: 'Vendedores en las gradas',
            texto: `Una docena de vendedores se instaló en el acceso de ${NOMBRE[i]}. Venden bien, pero estorban la entrada.`,
            opciones: [
                { t: 'Que los guardias despejen', d: 'La entrada fluye. Algunos clientes se molestan.', fx: (S) => { S.opinion(i, 55, 500); }, r: 'Los vendedores recogen sus cosas.' },
                { t: 'Dejarlos por hoy', d: 'La gente compra su café, pero la boletería va un 30% más lenta durante cuatro horas.', fx: (S) => { S.boleteriaLenta(i, 240, 0.7); S.opinion(i, 95, 700); }, r: `Huele a empanadas de viento en ${NOMBRE[i]}.` },
                { t: 'Reubicarlos en la plaza (−$400)', d: 'Cuesta montar los puestos, y todos contentos.', fx: (S) => { S.gasto(400); S.opinion(i, 100, 900); }, r: 'Los puestos quedan en la plaza, a la salida del Metro.', tono: 'bien' },
            ],
        }),
        gotera: (i) => ({
            id: 'gotera', est: i, titulo: `Agua en ${NOMBRE[i]}`,
            texto: `La lluvia desbordó una alcantarilla y entra agua al vestíbulo de ${NOMBRE[i]}. El piso está resbaloso.`,
            opciones: [
                { t: 'Cerrar la estación 25 minutos y secar', d: `Nadie entra por ${NOMBRE[i]} en ese rato y los trenes la pasan de largo.`, fx: (S) => { const min = S.cerrarEstacion(i, 25); S.luego(min, (Q) => Q.avisar('bien', `${NOMBRE[i]} vuelve a abrir, con el piso seco.`, i)); }, r: `${NOMBRE[i]} cierra un rato. Los trenes pasan de largo.`, tono: 'mal' },
                { t: 'Cuadrilla de emergencia (−$1.200)', d: 'Bombean y secan sin cerrar.', fx: (S) => { S.gasto(1200); }, r: `La cuadrilla bombea el agua. ${NOMBRE[i]} sigue abierta.`, tono: 'bien' },
                { t: 'Poner conos y seguir', d: 'Sigue abierta, pero la boletería va a la mitad durante una hora y más de uno resbala.', fx: (S) => { S.boleteriaLenta(i, 60, 0.5); S.opinion(i, 15, 700); }, r: `Conos amarillos en el vestíbulo de ${NOMBRE[i]}.`, tono: 'mal' },
            ],
        }),
        puerta: (i) => ({
            id: 'puerta', est: i, titulo: 'Una puerta que no cierra',
            texto: `Un tren no puede cerrar una puerta cerca de ${NOMBRE[i]}. Detrás vienen otros.`,
            opciones: [
                { t: 'Que la arreglen ahí mismo', d: 'El tren se queda parado unos 12 minutos y frena a los que vienen detrás. Con mantenimiento preventivo, menos de la mitad.', fx: (S) => { S.averiar(i, 12); } },
                { t: 'Desalojarlo y mandarlo al taller', d: `Su gente baja en ${NOMBRE[i]} a esperar el siguiente. La línea no se frena, pero pierdes ese tren dos horas.`, fx: (S) => { const t = S.desalojar(i, 120); return t ? `El tren ${t.id} deja a su gente en ${NOMBRE[i]} y se va vacío al taller.` : null; }, tono: 'mal' },
            ],
        }),
        viral: () => ({
            id: 'viral', titulo: 'Un video viral',
            texto: 'Un video de las filas y los andenes llenos tiene 200.000 vistas: «Así nos trata el Metro». Los noticieros ya lo pasan.',
            opciones: [
                { t: 'Regalar 2.000 tarjetas cargadas (−$1.800)', d: 'Más gente pasa directo por los torniquetes hasta el fin del día, y el gesto cae bien.', fx: (S) => { S.gasto(1800); S.tarjeta = Math.min(0.92, S.tarjeta + 0.04); S.opinion(-1, 100, 2500); }, r: 'Hay fila en Quitumbe, pero para recibir la tarjeta.', tono: 'bien' },
                { t: 'Dar la cara en la radio', d: 'No cuesta nada. Convence a medias.', fx: (S) => { S.opinion(-1, 62, 2000); }, r: 'Entrevista en la radio: «Pedimos paciencia, estamos reforzando el servicio».' },
                { t: 'No responder', d: 'Mañana nadie se acuerda. Hoy, sí.', fx: (S) => { S.opinion(-1, 25, 2500); }, r: 'El video sigue sumando vistas.', tono: 'mal' },
            ],
        }),
        via: (i) => ({
            id: 'via', est: i, titulo: 'Alguien en la vía',
            texto: `Una persona bajó a la vía en ${NOMBRE[i]} para recoger algo que se le cayó. Hay que cortar la corriente.`,
            opciones: [
                { t: 'Sacarla con calma', d: `Diez minutos de corte: los trenes esperan a los dos lados de ${NOMBRE[i]}.`, fx: (S) => { S.cortarVia(i, 10); }, r: `Corte de corriente en ${NOMBRE[i]}: diez minutos.`, tono: 'mal' },
                { t: 'Que baje el personal de andén de las estaciones vecinas', d: 'Cuatro minutos de corte. Sin sus guías, las paradas de toda la línea se alargan un 30% durante una hora.', fx: (S) => { S.cortarVia(i, 4); S.paradas(60, 1.3); }, r: `Cuatro minutos de corte en ${NOMBRE[i]}.` },
            ],
        }),
        tension: () => ({
            id: 'tension', titulo: 'Baja de tensión',
            texto: 'La Empresa Eléctrica avisa una baja de tensión en la red durante los próximos 45 minutos. Los trenes no pueden ir a toda marcha.',
            opciones: [
                { t: 'Marcha lenta', d: 'Todos los trenes van al 60% de su velocidad durante 45 minutos.', fx: (S) => { S.marchaLenta(45, 0.6); }, r: 'Marcha lenta en toda la línea por 45 minutos.', tono: 'mal' },
                { t: 'Encender los generadores de respaldo (−$1.800)', d: 'El diésel cuesta, pero nadie nota nada.', fx: (S) => { S.gasto(1800); }, r: 'Los generadores sostienen la línea a marcha normal.', tono: 'bien' },
            ],
        }),
        mochila: (i) => ({
            id: 'mochila', est: i, titulo: 'Una mochila sin dueño',
            texto: `Hay una mochila abandonada en el andén de ${NOMBRE[i]}. El protocolo dice que nadie la toca.`,
            opciones: [
                { t: 'Cerrar la estación 15 minutos', d: `La Policía la revisa con calma. Nadie entra por ${NOMBRE[i]} y los trenes pasan de largo.`, fx: (S) => { const min = S.cerrarEstacion(i, 15, true); S.luego(min, (Q) => Q.avisar('bien', `Falsa alarma en ${NOMBRE[i]}: eran cuadernos. La estación vuelve a abrir.`, i)); }, r: `${NOMBRE[i]} cierra mientras revisan la mochila.`, tono: 'mal' },
                { t: 'Unidad canina, sin cerrar (−$700)', d: `Los trenes esperan cinco minutos a los dos lados de ${NOMBRE[i]} y la estación sigue abierta.`, fx: (S) => { S.gasto(700); S.cortarVia(i, 5); }, r: `Un perro policía revisa la mochila en ${NOMBRE[i]}. Eran cuadernos.` },
            ],
        }),
        desmayo: (i) => ({
            id: 'desmayo', est: i, titulo: 'Pasajero descompensado',
            texto: `Una señora se desmayó dentro de un tren que llega a ${NOMBRE[i]}. El conductor pide instrucciones.`,
            opciones: [
                { t: 'Que el tren espere a la ambulancia', d: 'Unos siete minutos detenido, con los trenes de atrás esperando.', fx: (S) => { S.averiar(i, 7); S.opinion(i, 90, 400); } },
                { t: 'Atenderla en el andén con el personal (−$250)', d: 'La bajan con cuidado y el tren sigue. El botiquín y el relevo cuestan algo.', fx: (S) => { S.gasto(250); S.opinion(i, 100, 500); }, r: `Atienden a la señora en el andén de ${NOMBRE[i]}. Ya está mejor.`, tono: 'bien' },
            ],
        }),
        bono: () => ({
            id: 'bono', titulo: 'Los cajeros piden un bono',
            texto: 'Con el día que se viene, los cajeros piden un bono por jornada pesada. Si no, trabajarán «a reglamento».',
            opciones: [
                { t: 'Pagar el bono (−$1.500)', d: 'Las boleterías trabajan normal.', fx: (S) => { S.gasto(1500); }, r: 'Bono pagado. Las ventanillas atienden a buen ritmo.', tono: 'bien' },
                { t: 'Negarse', d: 'Todas las boleterías atienden un 25% más lento durante tres horas.', fx: (S) => { S.boleteriaLenta(-1, 180, 0.75); }, r: 'Los cajeros cuentan cada moneda dos veces.', tono: 'mal' },
            ],
        }),
        perro: (i) => ({
            id: 'perro', est: i, titulo: 'Un perro en el andén',
            texto: `Un perro callejero bajó las gradas de ${NOMBRE[i]} y pasea por el borde del andén. La gente le da pan; el conductor que llega no quiere arrancar.`,
            opciones: [
                { t: 'Que los guardias lo saquen con calma', d: `Tres minutos con los trenes detenidos junto a ${NOMBRE[i]}.`, fx: (S) => { S.cortarVia(i, 3); }, r: 'El perro sale moviendo la cola.' },
                { t: 'Adoptarlo como mascota de la estación (−$120)', d: 'Los mismos tres minutos, más la comida y la vacuna. A la gente le va a encantar.', fx: (S) => { S.cortarVia(i, 3); S.gasto(120); S.opinion(i, 100, 1500); }, r: `Desde hoy, ${NOMBRE[i]} tiene mascota. Ya le dicen «Durmiente».`, tono: 'bien' },
            ],
        }),
        protesta: () => ({
            id: 'protesta', est: 6, titulo: 'Una marcha hacia la Plaza Grande',
            texto: 'Una manifestación avanza hacia el Centro Histórico y va a pasar junto a la boca de San Francisco. Ya ha ocurrido que el Metro cierre la estación por algo así.',
            opciones: [
                { t: 'Cerrar San Francisco mientras pasa', d: 'Cuarenta y cinco minutos sin entradas; los trenes la pasan de largo.', fx: (S) => { const min = S.cerrarEstacion(6, 45, true); S.luego(min, (Q) => Q.avisar('bien', 'La marcha ya pasó. San Francisco vuelve a abrir.', 6)); }, r: 'San Francisco cierra mientras pasa la marcha.', tono: 'mal' },
                { t: 'Pedir resguardo policial y seguir abiertos (−$1.200)', d: 'La estación trabaja normal.', fx: (S) => { S.gasto(1200); }, r: 'Un cordón policial cuida la boca de San Francisco.', tono: 'bien' },
                { t: 'Seguir abiertos sin más', d: 'El gentío traba la entrada: la boletería va a poco más de la mitad durante hora y media, y hay sustos.', fx: (S) => { S.boleteriaLenta(6, 90, 0.6); S.opinion(6, 20, 1200); }, r: 'Bombos y pancartas en la boca de San Francisco.', tono: 'mal' },
            ],
        }),
        visita: () => ({
            id: 'visita', est: 6, titulo: 'Visita oficial',
            texto: 'Una comitiva del Gobierno recorre el Centro Histórico esta mañana y pide cerrar San Francisco durante dos horas. No sería la primera vez.',
            opciones: [
                { t: 'Cerrar las dos horas', d: 'Nadie entra por San Francisco y los trenes la pasan de largo.', fx: (S) => { const min = S.cerrarEstacion(6, 120, true); S.luego(min, (Q) => Q.avisar('bien', 'Se fue la comitiva. San Francisco vuelve a abrir.', 6)); }, r: 'San Francisco cierra por la visita oficial.', tono: 'mal' },
                { t: 'Ofrecer un solo acceso abierto', d: 'La estación sigue, con la boletería a la mitad durante dos horas.', fx: (S) => { S.boleteriaLenta(6, 120, 0.5); }, r: 'San Francisco trabaja con un solo acceso.' },
                { t: 'Negarse (−$800 de multa)', d: 'La estación trabaja normal y la gente lo agradece. La queja formal sale cara.', fx: (S) => { S.gasto(800); S.opinion(6, 100, 1500); }, r: 'La comitiva entra a pie, como todo el mundo.', tono: 'bien' },
            ],
        }),
        grafiti: () => ({
            id: 'grafiti', titulo: 'Un tren amaneció pintado',
            texto: 'En la cochera, alguien cubrió medio tren con grafiti durante la noche. Está listo para salir, pero se ve.',
            opciones: [
                { t: 'Que salga así', d: 'No pierdes el tren. Sale en todas las redes antes de las ocho.', fx: (S) => { S.opinion(-1, 45, 2500); }, r: 'El tren pintado ya circula. Las fotos también.' },
                { t: 'Limpiarlo antes de sacarlo', d: 'Un tren menos durante dos horas.', fx: (S) => { S.retirar(1, 120); }, r: 'Agua a presión en la cochera: el tren sale en dos horas.' },
            ],
        }),
        tarjetas: (i) => ({
            id: 'tarjetas', est: i, titulo: 'Se acabaron las tarjetas',
            texto: `En ${NOMBRE[i]} y en media línea se terminó el lote de Tarjeta Ciudad. Quien quería comprar la suya va a parar a la fila de efectivo.`,
            opciones: [
                { t: 'Traer un lote urgente (−$600)', d: 'Todo sigue igual.', fx: (S) => { S.gasto(600); }, r: 'Llega una caja de tarjetas desde la bodega de Quitumbe.', tono: 'bien' },
                { t: 'Esperar al camión de mañana', d: 'Hoy un 5% menos de gente pasa directo por los torniquetes.', fx: (S) => { S.tarjeta = Math.max(0.3, S.tarjeta - 0.05); }, r: '«Tarjetas agotadas», dice el letrero de la ventanilla.', tono: 'mal' },
            ],
        }),
        escalera: (i) => ({
            id: 'escalera', est: i, titulo: 'Escalera eléctrica detenida',
            texto: `La escalera eléctrica principal de ${NOMBRE[i]} se detuvo. La gente sube y baja por las gradas, despacio.`,
            opciones: [
                { t: 'Técnico de urgencia (−$900)', d: 'En veinte minutos vuelve a andar.', fx: (S) => { S.gasto(900); }, r: `La escalera de ${NOMBRE[i]} vuelve a andar.`, tono: 'bien' },
                { t: 'Que la revisen en la noche', d: 'El vestíbulo se atasca: la boletería va un 20% más lenta durante tres horas, y la gente reclama.', fx: (S) => { S.boleteriaLenta(i, 180, 0.8); S.opinion(i, 30, 900); }, r: `Fila en las gradas de ${NOMBRE[i]}.`, tono: 'mal' },
            ],
        }),
        bicis: () => ({
            id: 'bicis', titulo: 'Ciclistas en el andén',
            texto: 'Un grupo de ciclistas pide subir con sus bicicletas. No es hora pico, pero cada bicicleta ocupa el sitio de tres personas y demora las puertas.',
            opciones: [
                { t: 'Hoy, en el último vagón', d: 'Las paradas se alargan un 15% durante tres horas. Buena prensa.', fx: (S) => { S.paradas(180, 1.15); S.opinion(-1, 100, 2500); }, r: 'Bicicletas en el último vagón. Alguien ya lo publicó.', tono: 'bien' },
                { t: 'No está permitido', d: 'Los trenes van a su ritmo. Los ciclistas se van molestos.', fx: (S) => { S.opinion(-1, 55, 600); }, r: 'Los ciclistas siguen su camino por la ciclovía.' },
            ],
        }),
        carterista: (i) => ({
            id: 'carterista', est: i, titulo: 'Carteristas en el andén',
            texto: `Tres denuncias en una hora en ${NOMBRE[i]}: carteristas que aprovechan el apretón al subir.`,
            opciones: [
                { t: 'Reforzar la guardia hoy (−$800)', d: 'Se nota, y la gente lo agradece.', fx: (S) => { S.gasto(800); S.opinion(i, 100, 900); }, r: `Más guardias en los andenes de ${NOMBRE[i]}.`, tono: 'bien' },
                { t: 'Avisar por los parlantes', d: 'No cuesta nada y ayuda algo.', fx: (S) => { S.opinion(i, 60, 600); }, r: '«Cuide sus pertenencias», repiten los parlantes.' },
                { t: 'Es asunto de la Policía', d: 'Nada cambia. Las denuncias, tampoco.', fx: (S) => { S.opinion(i, 15, 900); }, r: 'Otra denuncia más.', tono: 'mal' },
            ],
        }),
        aire: () => ({
            id: 'aire', titulo: 'Un tren sin ventilación',
            texto: 'A uno de los trenes se le dañó la ventilación. Con gente adentro, es un horno.',
            opciones: [
                { t: 'Guardarlo hora y media para repararlo', d: 'Un tren menos mientras tanto, si queda alguno en la cochera para reemplazarlo.', fx: (S) => { S.retirar(1, 90); }, r: 'El tren entra al taller. Vuelve en hora y media.' },
                { t: 'Que siga rodando', d: 'No pierdes el tren. Quien viaja en él lo recuerda.', fx: (S) => { S.opinion(-1, 35, 3000); }, r: 'Ventanas empañadas y abanicos improvisados.', tono: 'mal' },
            ],
        }),
    };
    /** Una decisión del repertorio, a una hora y en una estación. */
    const dec = (cual, hora, i) => Object.assign({ hora, tipo: 'decision' }, DECISIONES[cual](i));

    const SABADO = { abre: 7, cierra: 23, fijo: 0.68, perfil: [[7, 0.25], [9, 0.6], [11, 0.95], [13, 1.1], [15, 1.0], [17, 1.2], [19, 1.5], [20.5, 1.4], [22, 1.05], [23, 0.8], [24, 0.6], [25.5, 0.25]], vuelta: [[7, 0.35], [15, 0.4], [18, 0.15], [21, 0.3], [22.5, 0.9]] };
    const DOMINGO = { abre: 7, cierra: 22, fijo: 0.8, perfil: [[7, 0.3], [9, 0.8], [10.5, 1.3], [12, 1.5], [13.5, 1.35], [15, 1.2], [17, 1.35], [19, 1.3], [20.5, 1.1], [21.5, 0.7], [22, 0.4], [23, 0.2]], vuelta: [[7, 0.3], [11, 0.35], [14, 0.6], [17, 0.45], [19.5, 0.8], [22, 1]] };

    // ───────────────────────── La semana ─────────────────────────
    const DIAS = [
        {
            n: 'Lunes', corto: 'Lun', fecha: '30 de noviembre', t: 'Tu primer día', meta: 78, autoBoleteria: true,
            nuevo: { n: 'El horario', d: 'Cada cuánto sale un tren en cada franja del día. Hoy es lo único que decides: de las boleterías se encarga el Puesto Central.' },
            intro: 'Recibes la Línea 1 un lunes cualquiera: unos 205.000 viajes. Los trenes salen cada 8 minutos todo el día, y en los picos no va a alcanzar.',
            parte: ['Día laborable, cielo despejado', 'Los 18 trenes disponibles', 'Dos picos: de 06:30 a 10:00 hacia el norte, de 17:00 a 20:00 de vuelta'],
            reto: { t: 'Que la espera media en el andén no pase de 3,6 minutos', premio: 2000, ok: (S) => S.cuenta.esperaN > 1000 && S.esperaMedia() <= 3.6, valor: (S) => `${coma(S.esperaMedia())} min` },
            sucesos: [
                { hora: 12.2, tipo: 'aviso', texto: 'Hora floja. Si en el Horario espacias los trenes de la media mañana y de la noche, ahorras sin que nadie sufra.' },
                { hora: 16.6, tipo: 'aviso', texto: 'Se acerca el pico de la tarde. Ahora la gente vuelve: los andenes llenos serán los del centro y el norte.' },
            ],
        },
        {
            n: 'Martes', corto: 'Mar', fecha: '1 de diciembre', t: 'Aguacero', meta: 76, demanda: 1.02, lluvia: [16.5, 19.5, 1],
            nuevo: { n: 'Las boleterías', d: 'Desde hoy abres y cierras ventanillas y compras máquinas de boletos. Si la fila para pagar pasa de cinco minutos, la gente se va.' },
            intro: 'Se anuncia un aguacero para la tarde. Cuando llueve en Quito, más gente baja al Metro y los trenes tardan más en cada parada. Y desde hoy las boleterías son cosa tuya.',
            parte: ['Aguacero de 16:30 a 19:30, encima del pico de la tarde', 'Los 18 trenes disponibles', 'Casi todas las estaciones empiezan con una sola ventanilla abierta'],
            reto: { t: 'Que se vayan sin viajar menos de 2.500 personas', premio: 2000, ok: (S) => S.cuenta.idos < 2500, valor: (S) => `${miles(S.cuenta.idos)} se fueron` },
            sucesos: [
                { hora: 7.2, tipo: 'aviso', texto: 'Mira las filas de Quitumbe y El Recreo: la barrita amarilla de la línea de abajo. Abre ventanillas donde haga falta.', est: 0 },
                { hora: 9.3, tipo: 'maquina', est: 12, min: 150 },
                { hora: 10.4, tipo: 'aviso', texto: 'Pasó el pico. Las ventanillas abiertas sin fila cuestan igual: cierra las que sobren.' },
                { hora: 16.2, tipo: 'aviso', texto: 'El cielo se cierra sobre el Pichincha. En minutos empieza a llover.' },
            ],
        },
        {
            n: 'Miércoles', corto: 'Mié', fecha: '2 de diciembre', t: 'Trenes en el taller', meta: 77, demanda: 1.05, trenesFuera: 2,
            nuevo: { n: 'Los trenes de refuerzo', d: 'Desde hoy mandas trenes extra desde las cabeceras y ves la flota tren por tren. Hace falta: hay averías.' },
            intro: 'Dos trenes amanecieron en el taller, para el perfilado de ruedas. Tienes 16 y es el día laborable de más viajes. Con la flota justa, una avería se nota el doble.',
            parte: ['Dos trenes en el taller: tienes 16', 'El día laborable de más viajes', 'El taller avisa que hay trenes con fallas pendientes: puede haber averías'],
            reto: { t: 'Terminar con un ánimo de 84 o más a pesar de las averías', premio: 2500, ok: (S) => S.t > S.abre + 600 && S.animoDia() >= 84, valor: (S) => `ánimo de ${Math.round(S.animoDia())}` },
            sucesos: [
                { hora: 7.6, tipo: 'averia', est: 4, min: 12 },
                { hora: 7.7, tipo: 'aviso', texto: 'Detrás del tren averiado se juntan los demás, y adelante los andenes se llenan. Un tren extra desde El Labrador ayuda a los que van al sur.' },
                { hora: 13.5, tipo: 'maquina', est: 0, min: 150 },
                { hora: 18.1, tipo: 'averia', est: 9, min: 9 },
            ],
        },
        {
            n: 'Jueves', corto: 'Jue', fecha: '3 de diciembre', t: 'Noche de partido', meta: 76, demanda: 1.03,
            nuevo: { n: 'Las decisiones', d: 'Cuando pasa algo, el Puesto Central te consulta: el reloj se detiene y eliges. Cada opción cuesta algo.' },
            intro: 'Hay partido en el Estadio Atahualpa. A las 21:15 salen más de treinta mil personas, y buena parte quiere irse en Metro por Iñaquito y La Carolina.',
            parte: ['Partido a las 19:30 en el Estadio Atahualpa', 'A las 21:15 salen unas 20.000 personas hacia Iñaquito y La Carolina', 'El Metro cierra a las 23:00: hay menos de dos horas para llevarlas'],
            reto: { t: 'Que de Iñaquito y La Carolina se vayan sin viajar menos de 1.500 personas', premio: 2500, ok: (S) => S.est[11].idos + S.est[12].idos < 1500, valor: (S) => `${miles(S.est[11].idos + S.est[12].idos)} se fueron` },
            eventos: [{ est: 12, de: 21.25, a: 22.5, porMin: 185, sitio: 'estadio', n: 'Partido en el Atahualpa' }, { est: 11, de: 21.25, a: 22.5, porMin: 105, sitio: 'estadio' }],
            sucesos: [
                dec('colegio', 6.1, 2),
                { hora: 8.4, tipo: 'maquina', est: 0, min: 120 },
                dec('vendedores', 15.6, 4),
                {
                    hora: 18.3, tipo: 'decision', id: 'previa', est: 12, titulo: 'Antes del partido',
                    texto: 'Los hinchas ya llegan al Atahualpa. A la salida, veinte mil personas van a querer pagar su pasaje al mismo tiempo.',
                    opciones: [
                        { t: 'Vender el pasaje de vuelta en la entrada del estadio (−$900)', d: 'Quien ya pagó no hace fila a la salida: en Iñaquito y La Carolina casi todos pasarán directo esta noche.', fx: (S) => { S.gasto(900); S.prepago(11, 300); S.prepago(12, 300); }, r: 'Boleteros con chaleco venden el pasaje de vuelta en las puertas del estadio.', tono: 'bien' },
                        { t: 'Nada especial: que paguen al salir', d: 'No cuesta nada ahora. Las boleterías de Iñaquito y La Carolina tendrán que aguantar.', r: 'Las boleterías esperan el pitazo final.' },
                    ],
                },
                { hora: 19.5, tipo: 'aviso', texto: 'Empezó el partido. Tienes hasta las 21:15 para preparar la salida del estadio: trenes, ventanillas y máquinas.', est: 12 },
                {
                    hora: 21.27, tipo: 'decision', id: 'barras', est: 12, titulo: 'Pitazo final',
                    texto: 'Salen treinta mil personas. Las barras llegan primero a Iñaquito, cantando y con ganas de entrar todas a la vez.',
                    opciones: [
                        { t: 'Entrada por tandas, con vallas', d: 'Orden en la escalera. La boletería de Iñaquito trabaja un 30% más lenta durante 40 minutos.', fx: (S) => { S.boleteriaLenta(12, 40, 0.7); S.opinion(12, 85, 1200); }, r: 'Vallas en Iñaquito: entran de cien en cien.' },
                        { t: 'Abrir los torniquetes 20 minutos', d: 'El vestíbulo se vacía de golpe y el andén se llena. Esos pasajes no se cobran.', fx: (S) => { S.entradaGratis(12, 20); }, r: 'Torniquetes abiertos en Iñaquito. El andén se llena en minutos.' },
                        { t: 'Pedir apoyo a la Policía (−$1.500)', d: 'Ordenan a las barras afuera y la estación trabaja normal.', fx: (S) => { S.gasto(1500); S.opinion(12, 100, 1200); }, r: 'La Policía arma un cordón afuera. Iñaquito trabaja normal.', tono: 'bien' },
                    ],
                },
            ],
        },
        {
            n: 'Viernes', corto: 'Vie', fecha: '4 de diciembre', t: 'Granizada', meta: 64, demanda: 1.06, lluvia: [15.3, 18.6, 2],
            nuevo: { n: 'Los cierres por lluvia', d: 'Si entra agua, una estación se cierra: nadie entra y los trenes pasan de largo. Si son varias seguidas, los trenes dan la vuelta antes.' },
            intro: 'El pronóstico habla de lluvias por la tarde. Octubre ya enseñó lo que puede pasar: con granizo, el agua y el hielo entran por las bocas del Metro y hay que cerrar estaciones.',
            parte: ['Tormenta con granizo desde las 15:15, sobre el centro y el norte', 'Si entra agua, las estaciones afectadas se cierran y los trenes dan la vuelta antes', 'Es viernes de fiestas: el del año pasado fue el día de más viajes en la historia del Metro, con 273.997'],
            reto: { t: 'Llevar a su destino a 212.000 personas a pesar de la tormenta', premio: 3000, ok: (S) => S.cuenta.viajes >= 212000, valor: (S) => `${miles(S.cuenta.viajes)} viajes` },
            sucesos: [
                dec('musico', 10.6, 6),
                { hora: 13.5, tipo: 'maquina', est: 6, min: 200 },
                { hora: 15.1, tipo: 'aviso', tono: 'mal', texto: 'Aviso del INAMHI: tormenta eléctrica con granizo sobre el centro y el norte de Quito. Empieza en minutos.' },
                {
                    hora: 15.75, tipo: 'corte', de: 0, a: 7, min: 150, deja: [[10, 600]],
                    texto: 'El agua y el hielo entran por las bocas del norte. Se cierran siete estaciones, de El Ejido a El Labrador. Los trenes circulan solo entre Quitumbe y La Alameda.',
                },
                {
                    hora: 16.1, tipo: 'decision', id: 'achique', est: 8, titulo: 'Siete estaciones con agua',
                    texto: 'El Ejido, Universidad Central, La Pradera, La Carolina, Iñaquito, Jipijapa y El Labrador están cerradas. Sacar el agua y el granizo con el personal de turno va a tomar un buen rato, y se viene el pico de la tarde.',
                    opciones: [
                        { t: 'Contratar bombas y cuadrillas (−$3.500)', d: 'El norte reabre una hora antes.', fx: (S) => { S.gasto(3500); return `Llegan las bombas a El Ejido y La Carolina. El norte reabre hacia las ${hhmm(S.adelantarReapertura(60) / 60)}.`; }, tono: 'bien' },
                        { t: 'Mandar a ayudar a los cajeros del sur', d: 'El norte reabre 40 minutos antes. Mientras tanto, las boleterías de Quitumbe a La Alameda trabajan a poco más de la mitad.', fx: (S) => { const h = S.adelantarReapertura(40); for (let i = 0; i <= 7; i++) S.boleteriaLenta(i, Math.max(20, h - S.t), 0.6); return `Los cajeros del sur suben con escobas y baldes. El norte reabre hacia las ${hhmm(h / 60)}.`; } },
                        { t: 'Solo con el personal de turno', d: 'No cuesta nada. El norte sigue cerrado hasta que terminen.', fx: (S) => `El personal del norte saca el agua con lo que tiene. Reabre hacia las ${hhmm(S.adelantarReapertura(0) / 60)}.` },
                    ],
                },
                {
                    hora: 18.5, tipo: 'decision', id: 'pradera', est: 10, titulo: 'La Pradera sigue cerrada',
                    texto: 'El resto del norte ya funciona, pero en La Pradera el hielo llegó hasta el vestíbulo. Los trenes pasan de largo; la alternativa para la gente es caminar a La Carolina.',
                    opciones: [
                        { t: 'Dejarla cerrada hasta mañana', d: 'Lo prudente. Quien iba a La Pradera baja en La Carolina.', r: 'La Pradera queda cerrada por hoy. Se recomienda usar La Carolina.' },
                        { t: 'Cuadrilla de limpieza ahora (−$1.500)', d: 'La Pradera reabre en media hora.', fx: (S) => { S.gasto(1500); S.luego(30, (Q) => { Q.abrirEstacion(10); Q.avisar('bien', 'La Pradera vuelve a abrir.', 10); }); }, r: 'Una cuadrilla pica el hielo en el vestíbulo de La Pradera.' },
                    ],
                },
            ],
        },
        Object.assign({
            n: 'Sábado', corto: 'Sáb', fecha: '5 de diciembre', t: 'Víspera de fiestas', meta: 76, demanda: 0.82,
            nuevo: { n: 'El fin de semana', d: 'El Metro abre a las 07:00, no hay picos de oficina y entra menos plata. El horario de entre semana aquí pierde dinero: hay que mirar el pronóstico.' },
            intro: 'Sábado de chivas, canelazo y serenata. La mañana es floja; de la tarde en adelante todo el mundo va al centro, y a la medianoche todos quieren volver.',
            parte: ['Horario de sábado: de 07:00 a 23:00', 'Sin picos de oficina: la gente sale desde el mediodía y no para', 'Serenata quiteña en el Centro Histórico: termina a la medianoche'],
            reto: { t: 'Cerrar el día con la caja a favor', premio: 3000, ok: (S) => S.balance() >= 0, valor: saldoTxt },
            eventos: [{ est: 6, de: 22.6, a: 24.4, porMin: 115, sitio: 'plaza', n: 'Serenata quiteña' }, { est: 8, de: 22.8, a: 24.2, porMin: 55, sitio: 'mariscal', n: 'Chivas en La Mariscal' }, { est: 11, de: 22.5, a: 24, porMin: 60, sitio: 'carolina', n: 'Tarima en La Carolina' }],
            fiestas: 17.5,
            sucesos: [
                { hora: 14, tipo: 'maquina', est: 6, min: 240 },
                {
                    hora: 16, tipo: 'decision', id: 'cuarenta', est: 8, titulo: 'Campeonato de cuarenta',
                    texto: 'Los barrios piden el vestíbulo de El Ejido para la final del campeonato de cuarenta, de 17:00 a 19:00. «¡Dos por shunsho!».',
                    opciones: [
                        { t: 'Que jueguen en el vestíbulo', d: 'Fiesta en El Ejido: sube el ánimo y llega más gente. La boletería trabaja un 30% más lenta entre el gentío.', fx: (S) => { S.opinion(8, 100, 2500); S.boleteriaLenta(8, 180, 0.7); S.oleada(8, 120, 14, 60); }, r: 'Mesas, barajas y barra brava en el vestíbulo de El Ejido.', tono: 'bien' },
                        { t: 'Mejor en el parque, arriba', d: 'El vestíbulo queda libre.', fx: (S) => { S.opinion(8, 70, 600); }, r: 'El campeonato se juega en el parque El Ejido.' },
                    ],
                },
                { hora: 17.6, tipo: 'aviso', tono: 'bien', texto: '¡Que viva Quito! Salen las chivas y empiezan las tarimas en el Centro Histórico.', est: 6 },
                { hora: 19.7, tipo: 'averia', est: 8, min: 8 },
                {
                    hora: 20.5, tipo: 'decision', id: 'serenata', est: 6, titulo: 'Serenata hasta la medianoche',
                    texto: 'La serenata quiteña termina a las 00:00 y el Metro cierra a las 23:00. Miles de personas van a salir del Centro Histórico sin cómo volver. El año pasado, en esta fecha, el Metro cerró a la 01:30.',
                    opciones: [
                        { t: 'Extender el servicio hasta la 01:30 (−$2.800)', d: 'Horas extra para todo el personal y más trenes rodando, pero nadie se queda botado.', fx: (S) => { S.gasto(2800); S.extender(25.5); S.opinion(-1, 100, 3000); }, r: 'Hoy el Metro cierra a la 01:30. La franja de la noche se alarga.', tono: 'bien' },
                        { t: 'Cerrar a las 23:00, como todo sábado', d: 'La caja lo agradece. Quien salga de la serenata tendrá que buscar taxi.', fx: (S) => { S.luego(150, (Q) => { Q.opinion(-1, 5, 7000); Q.avisar('mal', 'El Metro cerró y la serenata sigue. Miles de personas buscan taxi en el Centro Histórico.', 6); }); }, r: 'El Metro cierra a las 23:00.' },
                    ],
                },
                dec('via', 22.2, 7),
            ],
        }, SABADO),
        Object.assign({
            n: 'Domingo', corto: 'Dom', fecha: '6 de diciembre', t: 'Día de Quito', meta: 75, demanda: 0.9, trenesFuera: 1,
            nuevo: { n: 'Todo junto', d: 'Feriado, desfile, aguacero, concierto y un tren menos. Hoy no hay nada nuevo que aprender: hay que usarlo todo.' },
            intro: 'Feriado: 492 años de la fundación. Desfile de la confraternidad en el norte al mediodía, aguacero anunciado para la tarde y concierto de cierre en el Parque Bicentenario, junto a El Labrador. Un tren quedó en el taller después de la granizada.',
            parte: ['Horario de feriado: de 07:00 a 22:00', 'Un tren en el taller: tienes 17', 'Desfile en La Carolina e Iñaquito hasta las 13:30', 'Aguacero de 15:30 a 17:30', 'El concierto del Parque Bicentenario termina a las 20:15'],
            reto: { t: 'Récord para un feriado: 192.000 viajes', premio: 4000, ok: (S) => S.cuenta.viajes >= 192000, valor: (S) => `${miles(S.cuenta.viajes)} viajes` },
            lluvia: [15.5, 17.5, 1],
            eventos: [{ est: 11, de: 12.6, a: 14, porMin: 95, sitio: 'carolina', n: 'Desfile de la confraternidad' }, { est: 12, de: 12.6, a: 14, porMin: 80, sitio: 'carolina' }, { est: 14, de: 20.25, a: 21.6, porMin: 210, sitio: 'bicentenario', n: 'Concierto del Bicentenario' }, { est: 13, de: 20.3, a: 21.4, porMin: 55, sitio: 'bicentenario' }],
            fiestas: 18,
            sucesos: [
                {
                    hora: 9.4, tipo: 'decision', id: 'tv', est: 11, titulo: 'En vivo desde el andén',
                    texto: 'Un canal quiere transmitir en vivo desde el andén de La Carolina a las 13:00, cuando termine el desfile y la estación esté a reventar.',
                    opciones: [
                        { t: 'Bienvenidos', d: 'Si a las 13:00 La Carolina va bien (ánimo de 72 o más), lo ve todo el país y sube el ánimo de la línea. Si va mal, también lo ven.', fx: (S) => { S.luego(216, (Q) => { if (Q.est[11].animo >= 72) { Q.opinion(-1, 100, 6000); Q.avisar('bien', 'En vivo desde La Carolina: «El Metro responde en el Día de Quito». Aplausos en el andén.', 11); } else { Q.opinion(-1, 5, 5000); Q.avisar('mal', 'En vivo desde La Carolina: «Caos en el Metro en pleno feriado». Lo está viendo todo el país.', 11); } }); }, r: 'El canal instala sus cámaras en La Carolina. Salen al aire a las 13:00.' },
                        { t: 'Hoy no', d: 'Sin riesgo y sin premio.', r: 'El canal transmitirá desde la calle.' },
                    ],
                },
                { hora: 12.55, tipo: 'averia', est: 11, min: 9 },
                {
                    hora: 13.4, tipo: 'decision', id: 'red', titulo: 'Se cayó la red de pagos',
                    texto: 'Las máquinas de boletos no pueden cobrar con tarjeta bancaria. Hasta que vuelva la red, a las 15:00, la mitad queda fuera de servicio.',
                    opciones: [
                        { t: 'Cajeros volantes con cambio (−$1.400)', d: 'Personal extra cobra en efectivo junto a las máquinas: las boleterías trabajan normal.', fx: (S) => { S.gasto(1400); }, r: 'Cajeros con canguro cobran junto a las máquinas.', tono: 'bien' },
                        { t: 'Abrir los torniquetes media hora', d: 'Nadie hace fila en toda la línea. Esos pasajes no se cobran, y después la mitad de las máquinas sigue caída una hora.', fx: (S) => { S.entradaGratis(-1, 30); S.est.forEach((e) => S.danarMaquinas(e.i, 95, Math.ceil(e.maquinas / 2), true)); }, r: 'Torniquetes abiertos en toda la línea hasta las 13:55.' },
                        { t: 'Aguantar hasta las 15:00', d: 'La mitad de las máquinas de cada estación no funciona durante hora y media.', fx: (S) => { S.est.forEach((e) => S.danarMaquinas(e.i, 95, Math.ceil(e.maquinas / 2), true)); }, r: 'Media línea de máquinas con el letrero «Solo efectivo justo».', tono: 'mal' },
                    ],
                },
                { hora: 15.3, tipo: 'aviso', texto: 'Empieza a llover sobre el norte. El concierto del Parque Bicentenario sigue.' },
                {
                    hora: 17, tipo: 'decision', id: 'labrador', est: 14, titulo: 'Agua en El Labrador',
                    texto: 'Como en octubre: con el aguacero se acumuló agua en El Labrador. A tres horas de que cuarenta mil personas salgan del concierto por esa estación.',
                    opciones: [
                        { t: 'Bombas y cuadrillas ya (−$3.000)', d: 'El Labrador cierra solo 40 minutos; los trenes dan la vuelta en Jipijapa mientras tanto.', fx: (S) => { S.gasto(3000); S.cortarTramo(0, 13, 40, [], true); }, r: 'El Labrador cierra 40 minutos para sacar el agua. Los trenes dan la vuelta en Jipijapa.' },
                        { t: 'Cerrarla y limpiar con el personal', d: 'No cuesta nada, pero El Labrador pierde dos horas y media y reabre justo antes de la salida del concierto.', fx: (S) => { S.cortarTramo(0, 13, 150); }, r: 'El Labrador queda cerrada. Los trenes dan la vuelta en Jipijapa.', tono: 'mal' },
                        { t: 'Seguir abiertos con el piso mojado', d: 'Nadie pierde su tren, pero la boletería de El Labrador trabaja a la mitad hasta el cierre y habrá resbalones.', fx: (S) => { S.boleteriaLenta(14, 300, 0.5); S.opinion(14, 10, 1500); }, r: 'El Labrador sigue abierta, entre baldes y conos.', tono: 'mal' },
                    ],
                },
                { hora: 19.6, tipo: 'aviso', texto: 'Última canción en el Parque Bicentenario. En media hora, cuarenta mil personas caminan hacia El Labrador y Jipijapa.', est: 14 },
            ],
        }, DOMINGO),
    ];

    // ───────────────────────── Las mejoras ─────────────────────────
    // «desde»: a partir de qué día (0 es el lunes) se ofrece en la tienda.
    const MEJORAS = [
        { id: 'tarjeta', n: 'Campaña Tarjeta Ciudad', precio: 9000, max: 3, desde: 1, d: 'Más gente paga con tarjeta y pasa directo, sin hacer fila (+10% por nivel).' },
        { id: 'cajeros', n: 'Capacitación de cajeros', precio: 5000, max: 1, desde: 1, d: 'Cada ventanilla despacha un 25% más rápido.' },
        { id: 'anden', n: 'Personal de andén', precio: 6000, max: 1, desde: 2, d: 'Ordenan la subida: cada parada dura un 25% menos.' },
        { id: 'mantenimiento', n: 'Mantenimiento preventivo', precio: 7000, max: 1, desde: 2, d: 'Las averías se resuelven en menos de la mitad del tiempo.' },
        { id: 'taller', n: 'Turno de noche en el taller', precio: 8000, max: 1, desde: 2, d: 'Los días con trenes en el taller, recuperas uno.' },
        { id: 'pantallas', n: 'Pantallas de próximo tren', precio: 6500, max: 1, desde: 3, d: 'Quien sabe cuánto falta espera más tranquilo: la gente aguanta más en el andén.' },
        { id: 'bombas', n: 'Bombas de achique', precio: 7000, max: 1, desde: 4, d: 'Una estación cerrada por el agua vuelve a abrir en la mitad del tiempo.' },
        { id: 'jefes', n: 'Jefes de estación', precio: 8000, max: 1, desde: 5, d: 'Abren y cierran ventanillas por su cuenta según la fila. Tú sigues pudiendo mandar.' },
        { id: 'trenes', n: 'Tren nuevo', precio: 22000, sube: 8000, max: 8, desde: 7, d: 'Un tren más para la flota, para siempre. Cada uno cuesta más que el anterior, y la demanda del turno sin fin no deja de crecer.' },
        { id: 'publicidad', n: 'Publicidad en estaciones y trenes', precio: 15000, sube: 5000, max: 3, desde: 7, d: 'Cada nivel suma un 3% a lo que deja cada pasaje.' },
        { id: 'solar', n: 'Paneles solares en las cocheras', precio: 18000, sube: 6000, max: 3, desde: 7, d: 'Cada nivel baja un 6% lo que cuesta mantener las estaciones.' },
    ];

    // ───────────────────────── El final de la semana ─────────────────────────
    const RANGOS = [
        { de: 19, n: 'Leyenda del Metro', d: 'Siete días casi perfectos. En Quitumbe ya quieren ponerle tu nombre a un tren.' },
        { de: 15, n: 'Jefe de línea de primera', d: 'La semana más difícil del año, y la línea respondió. El directorio te renueva sin discusión.' },
        { de: 10, n: 'Jefe de línea', d: 'Sacaste adelante la semana de fiestas. Hubo días duros, pero la gente llegó.' },
        { de: 0, n: 'Jefe a prueba', d: 'La semana terminó. Te la juegas de nuevo: repite los días flojos para subir de rango.' },
    ];

    // ───────────────────────── El calendario ─────────────────────────
    const DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mas = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
    const clave = (f) => f.getFullYear() * 10000 + (f.getMonth() + 1) * 100 + f.getDate();
    const fechaTxt = (f) => `${f.getDate()} de ${MES[f.getMonth()]}` + (f.getFullYear() === 2026 ? '' : ` de ${f.getFullYear()}`);
    /** El domingo de Pascua de ese año (cómputo gregoriano). De él salen Carnaval y el Viernes Santo. */
    const pascua = (a) => {
        const g = a % 19, c = Math.floor(a / 100), h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
        const i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11)), j = (a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
        const l = i - j, m = 3 + Math.floor((l + 40) / 44);
        return new Date(a, m - 1, l + 28 - 31 * Math.floor(m / 4));
    };
    /**
     * El día en que de verdad se descansa por un feriado nacional, según la ley de feriados: si cae sábado pasa al
     * viernes; domingo, al lunes; martes, al lunes; miércoles o jueves, al viernes. No se mueven el 1 de enero, el
     * 25 de diciembre ni el Carnaval.
     */
    const traslado = (f) => mas(f, [1, 0, -1, 2, 1, 0, -1][f.getDay()]);
    const hasta = (f, dia, paso) => { while (f.getDay() !== dia) f = mas(f, paso); return f; };
    /** Las fechas señaladas de un año: [fecha, cuál]. */
    const fechasDe = (a) => {
        const P = pascua(a);
        return [
            [new Date(a, 0, 1), 'anioNuevo'], [mas(P, -51), 'exodo'], [mas(P, -48), 'carnaval'], [mas(P, -2), 'viernesSanto'],
            [traslado(new Date(a, 4, 1)), 'trabajo'], [traslado(new Date(a, 4, 24)), 'pichincha'], [hasta(new Date(a, 4, 31), 0, -1), 'carrera'],
            [traslado(new Date(a, 7, 10)), 'agosto'], [hasta(new Date(a, 8, 1), 1, 1), 'clases'], [traslado(new Date(a, 9, 9)), 'octubre'],
            [traslado(new Date(a, 10, 2)), 'difuntos'], [hasta(new Date(a, 11, 5), 5, -1), 'viernesFiestas'], [new Date(a, 11, 6), 'quito'],
            [new Date(a, 11, 24), 'nochebuena'], [new Date(a, 11, 25), 'navidad'], [new Date(a, 11, 31), 'anioViejo'],
        ];
    };
    const tablas = new Map();
    /** ¿Es una fecha señalada? Devuelve cuál, o nada. */
    const hito = (f) => {
        const a = f.getFullYear();
        if (!tablas.has(a)) tablas.set(a, new Map(fechasDe(a).map(([d, cual]) => [clave(d), cual])));
        return tablas.get(a).get(clave(f));
    };

    // Un feriado cualquiera: abre a las 07:00, cierra a las 22:00 y mueve unos 150.000 viajes (así fue el viernes 9 de agosto de 2024).
    const FERIADO = { abre: 7, cierra: 22, fijo: 0.62, perfil: [[7, 0.25], [9, 0.6], [11, 0.95], [13, 1.05], [15, 1.0], [17, 1.05], [19, 0.95], [20.5, 0.7], [22, 0.35]], vuelta: [[7, 0.35], [13, 0.5], [18, 0.75], [22, 1]] };
    const TEMPRANO = [[5.5, 0.3], [7, 1.5], [8.5, 1.4], [10, 1.2], [12, 1.5], [14, 1.85], [16, 1.9], [18, 1.3], [19.5, 0.6], [21, 0.25], [23, 0.1]];      // un día que se acaba pronto: todos a casa antes de la noche
    /**
     * Lo que trae cada fecha señalada. `demanda` es la fracción de los viajes de un día laborable (1 = unos 205.000);
     * `sube` dice si ese día hay más o menos gente que en uno normal; `cuanto` lo resume para el jugador; `real` marca lo que sale de cifras publicadas. `f` es la fuerza de los eventos, que
     * crece con los días.
     */
    const HITOS = {
        anioNuevo: () => ({ n: 'Año Nuevo', sube: -1, feriado: true, demanda: 0.48, cuanto: 'De los días más flojos del año', parte: ['Feriado: de 07:00 a 22:00', 'La ciudad amanece tarde: muy poca gente hasta el mediodía', 'Con tan pocos pasajes, lo difícil hoy es la caja'] }),
        exodo: (f) => ({
            n: 'Viernes de Carnaval', sube: 1, demanda: 1.08, cuanto: 'Tarde de éxodo hacia las terminales',
            imanes: [{ est: 0, de: 12.5, a: 20.5, f: 3.2 }, { est: 14, de: 12.5, a: 20.5, f: 1.8 }],
            eventos: [{ est: 6, de: 13, a: 18, porMin: 45 * f }, { est: 11, de: 13, a: 18, porMin: 45 * f }],
            parte: ['Día laborable, y esta tarde empieza el feriado de Carnaval', 'Desde el mediodía, media ciudad va a la Terminal Quitumbe: los trenes al sur salen llenos', 'En un feriado salen por las terminales de Quito más de 130.000 personas'],
            sucesos: [{ hora: 12.2, tipo: 'aviso', texto: 'Empieza el éxodo de Carnaval. Los andenes hacia el sur se van a llenar: Quitumbe es la terminal de buses.', est: 0 }],
        }),
        carnaval: () => ({ n: 'Lunes de Carnaval', sube: -1, feriado: true, demanda: 0.5, cuanto: 'La ciudad se fue de viaje', parte: ['Feriado: de 07:00 a 22:00', 'Quien se quedó juega con espuma y agua; casi nadie va a trabajar', 'Pocos pasajes: espaciar los trenes o cerrar en rojo'] }),
        viernesSanto: (f) => ({
            n: 'Viernes Santo', sube: 1, feriado: true, demanda: 0.8, cuanto: 'Procesión de Jesús del Gran Poder: el centro se desborda', real: true,
            imanes: [{ est: 6, de: 7, a: 12.5, f: 5 }, { est: 7, de: 7, a: 12.5, f: 2.5 }],
            eventos: [{ est: 6, de: 15, a: 18, porMin: 170 * f, sitio: 'sanfrancisco', n: 'Procesión de Jesús del Gran Poder' }, { est: 7, de: 15, a: 18, porMin: 90 * f, sitio: 'sanfrancisco' }],
            parte: ['Feriado: de 07:00 a 22:00', 'Más de 100.000 personas en la procesión, que sale de San Francisco al mediodía', 'En San Francisco se entra solo por el bulevar 24 de Mayo hasta las 18:00: la boletería va más lenta', 'La Alameda es la alternativa'],
            sucesos: [
                { hora: 7.05, tipo: 'lenta', est: 6, min: 655, f: 0.6, texto: 'Viernes Santo: en San Francisco se entra solo por el bulevar 24 de Mayo y se sale por la plaza. Recomienda La Alameda.' },
                { hora: 14.6, tipo: 'aviso', texto: 'Termina la procesión. Cien mil personas con túnicas moradas y cucuruchos buscan la boca del Metro.', est: 6 },
            ],
        }),
        trabajo: (f) => ({
            n: 'Día del Trabajo', sube: -1, feriado: true, demanda: 0.68, cuanto: 'Feriado, con marcha en el centro por la mañana',
            imanes: [{ est: 8, de: 7, a: 10.5, f: 2.5 }, { est: 6, de: 7, a: 10.5, f: 2 }],
            eventos: [{ est: 6, de: 12, a: 13.8, porMin: 85 * f, sitio: 'plaza', n: 'Marcha del Primero de Mayo' }, { est: 7, de: 12, a: 13.8, porMin: 45 * f, sitio: 'plaza' }],
            parte: ['Feriado: de 07:00 a 22:00', 'La marcha de los trabajadores baja de El Ejido a la Plaza de San Francisco y se disuelve al mediodía'],
            decisiones: [['protesta', 9.6]],
        }),
        pichincha: () => ({ n: 'Batalla de Pichincha', sube: -1, feriado: true, demanda: 0.62, cuanto: 'Feriado largo: media ciudad salió', parte: ['Feriado: de 07:00 a 22:00', 'Ceremonia en la Cima de la Libertad, lejos del Metro', 'Pocos pasajes: hoy manda la caja'] }),
        carrera: (f) => ({
            n: 'Quito 15K', sube: 1, demanda: 0.74, cuanto: 'El domingo de más viajes del año', real: true,
            dia: { abre: 5.5 },
            imanes: [{ est: 1, de: 5.5, a: 7.5, f: 4 }, { est: 2, de: 5.5, a: 7.5, f: 3 }],
            eventos: [{ est: 12, de: 9.5, a: 12.5, porMin: 120 * f, sitio: 'estadio', n: 'Meta de la Quito 15K' }, { est: 11, de: 9.5, a: 12.5, porMin: 70 * f, sitio: 'estadio' }],
            parte: ['Domingo, pero hoy el Metro abre a las 05:30 por la carrera', 'Miles de corredores van al sur antes de las 07:00 y salen del norte, cansados, desde las 09:30', 'En 2026 fue el domingo de más viajes del año: 151.203'],
        }),
        agosto: (f) => ({
            n: 'Primer Grito de Independencia', sube: 1, feriado: true, demanda: 0.93, cuanto: 'Feriado con Fiesta de la Luz: noche llena en el centro', real: true,
            dia: { cierra: 24 },
            imanes: [{ est: 6, de: 17, a: 21, f: 4 }, { est: 7, de: 17, a: 21, f: 2 }],
            eventos: [{ est: 6, de: 20.5, a: 23.6, porMin: 150 * f, sitio: 'plaza', n: 'Fiesta de la Luz' }, { est: 7, de: 20.5, a: 23.6, porMin: 70 * f, sitio: 'plaza' }],
            parte: ['Feriado, y el Metro cierra a las 00:00 por el festival de luces', 'Las fachadas del Centro Histórico se iluminan desde las 19:00', 'En 2025, San Francisco fue la estación más usada del feriado'],
        }),
        clases: (f) => ({
            n: 'Regreso a clases', sube: 1, demanda: 1.07, cuanto: 'Vuelven los estudiantes: picos más altos',
            eventos: [{ est: 9, de: 12.5, a: 14, porMin: 60 * f, sitio: 'universidad', n: 'Salida de clases' }, { est: 9, de: 17.5, a: 19, porMin: 50 * f, sitio: 'universidad' }],
            imanes: [{ est: 9, de: 6, a: 8.5, f: 1.8 }],
            parte: ['Primer día de clases en la Sierra', 'La Universidad Central se nota en los dos picos y al mediodía'],
        }),
        octubre: () => ({ n: 'Feriado del 9 de Octubre', sube: -1, feriado: true, demanda: 0.62, cuanto: 'Feriado largo: media ciudad salió', parte: ['Feriado: de 07:00 a 22:00', 'Pocos pasajes: hoy manda la caja'] }),
        difuntos: (f) => ({
            n: 'Día de los Difuntos', sube: -1, feriado: true, demanda: 0.7, cuanto: 'Feriado, con romería a los cementerios',
            imanes: [{ est: 6, de: 8, a: 12, f: 2.2 }],
            eventos: [{ est: 6, de: 11.5, a: 14.5, porMin: 55 * f, sitio: 'sanfrancisco', n: 'Cementerio de San Diego' }],
            parte: ['Feriado: de 07:00 a 22:00', 'Colada morada, guaguas de pan y visita al cementerio de San Diego, a unas cuadras de San Francisco'],
        }),
        viernesFiestas: (f) => ({
            n: 'Viernes de fiestas', sube: 1, demanda: 1.25, cuanto: 'El día de más viajes del año', real: true,
            dia: { fiestas: 17.5 },
            eventos: [{ est: 6, de: 21.2, a: 22.8, porMin: 140 * f, sitio: 'plaza', n: 'Tarimas del Centro Histórico' }, { est: 8, de: 21, a: 22.8, porMin: 80 * f, sitio: 'mariscal', n: 'Chivas en La Mariscal' }, { est: 11, de: 21, a: 22.7, porMin: 80 * f, sitio: 'carolina' }],
            parte: ['Día laborable, con las Fiestas de Quito encima', 'El viernes de fiestas de 2025 el Metro hizo 273.997 viajes: su récord', 'Tarimas y chivas hasta el cierre'],
        }),
        quito: (f) => ({
            n: 'Día de Quito', sube: 1, feriado: true, demanda: 0.95, cuanto: 'Feriado de la ciudad, con desfile y concierto',
            dia: { fiestas: 18 },
            eventos: [{ est: 11, de: 12.6, a: 14, porMin: 95 * f, sitio: 'carolina', n: 'Desfile de la confraternidad' }, { est: 12, de: 12.6, a: 14, porMin: 80 * f, sitio: 'carolina' }, { est: 14, de: 20.2, a: 21.5, porMin: 200 * f, sitio: 'bicentenario', n: 'Concierto del Bicentenario' }],
            parte: ['Feriado de la ciudad: de 07:00 a 22:00', 'Desfile al mediodía en La Carolina y concierto de cierre junto a El Labrador'],
        }),
        nochebuena: (f) => ({
            n: 'Nochebuena', sube: 0, demanda: 0.93, cuanto: 'Mañana normal, tarde de compras y noche vacía',
            dia: { perfil: TEMPRANO, vuelta: [[9, 0], [12, 0.5], [15, 1]] },
            eventos: [{ est: 6, de: 12.5, a: 17.5, porMin: 70 * f, sitio: 'plaza', n: 'Últimas compras en el centro' }, { est: 11, de: 13, a: 18, porMin: 60 * f, sitio: 'carolina', n: 'Compras en el norte' }, { est: 4, de: 13.5, a: 18, porMin: 40 * f, sitio: 'recreo' }],
            parte: ['Día laborable: de 05:30 a 23:00', 'Tarde de últimas compras en el centro, La Carolina y El Recreo', 'Desde las 20:00 no queda nadie: los trenes de la noche van vacíos'],
        }),
        navidad: () => ({ n: 'Navidad', sube: -1, feriado: true, demanda: 0.5, cuanto: 'El día de menos viajes de diciembre', real: true, parte: ['Feriado: de 07:00 a 22:00', 'En 2025, el día más flojo de diciembre tuvo 102.077 viajes: menos de la mitad de un día normal', 'Con tan pocos pasajes, lo difícil hoy es la caja'] }),
        anioViejo: (f) => ({
            n: 'Año viejo', sube: 0, demanda: 0.93, cuanto: 'Tarde de monigotes y viudas; noche vacía',
            dia: { perfil: TEMPRANO, vuelta: [[9, 0], [12, 0.5], [15, 1]] },
            eventos: [{ est: 8, de: 14, a: 19, porMin: 75 * f, sitio: 'mariscal', n: 'Años viejos en la Amazonas' }, { est: 11, de: 14.5, a: 19, porMin: 45 * f, sitio: 'carolina' }],
            parte: ['Día laborable: de 05:30 a 23:00', 'Monigotes y viudas en la avenida Amazonas toda la tarde', 'A las 22:00 todo el mundo está en su casa, quemando el año viejo'],
        }),
    };
    /** Las temporadas: no son un día, pero se notan si el turno cae en ellas. */
    const temporada = (f) => {
        const m = f.getMonth(), d = f.getDate(), finDeMes = mas(f, 1).getDate() === 1;
        if ((m === 10 && d >= 28) || (m === 11 && d <= 5)) return { n: 'Fiestas de Quito', sube: 1, demanda: 1.15, cuanto: 'Semana de fiestas: más gente todo el día', fiestas: 17.5 };
        if (m === 11 && d >= 10 && d <= 23) return { n: 'Compras de Navidad', sube: 1, demanda: 1.08, cuanto: 'Novenas y compras: tardes más cargadas' };
        if (m === 6 || (m === 7 && d <= 28)) return { n: 'Vacaciones escolares', sube: -1, demanda: 0.93, cuanto: 'Sin estudiantes: picos más bajos' };
        if (d === 15 || finDeMes) return { n: 'Día de pago', sube: 1, demanda: 1.04, cuanto: 'Quincena: algo más de movimiento' };
        return null;
    };

    // ───────────────────────── El turno sin fin ─────────────────────────
    const EVENTOS = [
        { n: 'Concierto en el Parque Bicentenario', corto: 'Concierto', sitio: 'bicentenario', est: [[14, 1], [13, 0.3]] },
        { n: 'Partido en el Estadio Atahualpa', corto: 'Partido', sitio: 'estadio', est: [[12, 1], [11, 0.55]] },
        { n: 'Feria en el Centro Histórico', corto: 'Feria en el centro', sitio: 'plaza', est: [[6, 1], [7, 0.4]] },
        { n: 'Festival en el parque La Carolina', corto: 'Festival', sitio: 'carolina', est: [[11, 1], [12, 0.4]] },
        { n: 'Graduaciones en la Universidad Central', corto: 'Graduaciones', sitio: 'universidad', est: [[9, 1]] },
        { n: 'Feria en Quitumbe', corto: 'Feria en el sur', sitio: 'quitumbe', est: [[0, 1], [1, 0.3]] },
        { n: 'Concierto en el parque El Ejido', corto: 'Concierto', sitio: 'ejido', est: [[8, 1], [7, 0.4]] },
        { n: 'Bazar en El Recreo', corto: 'Bazar', sitio: 'recreo', est: [[4, 1], [5, 0.3]] },
        { n: 'Concierto en la Plaza de Toros', corto: 'Concierto', sitio: 'plazatoros', est: [[13, 1], [12, 0.35]] },
        { n: 'Función en la Casa de la Cultura', corto: 'Función', sitio: 'casacultura', est: [[8, 1], [7, 0.3]] },
        { n: 'Festival en el parque Las Cuadras', corto: 'Festival en el sur', sitio: 'cuadras', est: [[1, 1], [0, 0.35]] },
        { n: 'Feria en Solanda', corto: 'Feria en Solanda', sitio: 'solanda', est: [[2, 1], [3, 0.3]] },
        { n: 'Teatro en la calle en La Alameda', corto: 'Teatro en la calle', sitio: 'alameda', est: [[7, 1], [8, 0.3]] },
        { n: 'Feria en La Magdalena', corto: 'Feria', sitio: 'magdalena', est: [[5, 1], [4, 0.3]] },
    ];
    const CORTES = [
        { de: 0, a: 7, t: 'Se cierran siete estaciones, de El Ejido a El Labrador. Los trenes circulan solo entre Quitumbe y La Alameda.' },
        { de: 0, a: 10, t: 'Se cierran La Carolina, Iñaquito, Jipijapa y El Labrador. Los trenes dan la vuelta en La Pradera.' },
        { de: 4, a: 14, t: 'Se cierran Quitumbe, Morán Valverde, Solanda y Cardenal de la Torre. Los trenes dan la vuelta en El Recreo.' },
        { de: 0, a: 13, t: 'Se cierra El Labrador. Los trenes dan la vuelta en Jipijapa.' },
        { de: 2, a: 14, t: 'Se cierran Quitumbe y Morán Valverde. Los trenes dan la vuelta en Solanda.' },
    ];
    const RETOS = {
        idos: (k) => ({ t: 'Que se vayan sin viajar menos de 3.000 personas', premio: 2500 + 250 * k, ok: (S) => S.cuenta.idos < 3000, valor: (S) => `${miles(S.cuenta.idos)} se fueron` }),
        espera: (k) => ({ t: 'Que la espera media en el andén no pase de 3,4 minutos', premio: 2500 + 250 * k, ok: (S) => S.cuenta.esperaN > 1000 && S.esperaMedia() <= 3.4, valor: (S) => `${coma(S.esperaMedia())} min` }),
        saldo: (k) => ({ t: 'Cerrar el día con al menos $2.000 a favor', premio: 2500 + 250 * k, ok: (S) => S.balance() >= 2000, valor: saldoTxt }),
        llenos: (k) => ({ t: 'Que menos de 4.000 personas vean pasar un tren lleno sin poder subir', premio: 2500 + 250 * k, ok: (S) => S.cuenta.dejados < 4000, valor: (S) => `${miles(S.cuenta.dejados)} se quedaron en el andén` }),
        azul: (k) => ({ t: 'Cerrar el día sin números rojos', premio: 3000 + 250 * k, ok: (S) => S.balance() >= 0, valor: saldoTxt }),
    };
    /** Números al azar que se repiten con la misma semilla. */
    const azar = (semilla) => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

    /**
     * En qué fecha cae el día `n` del turno sin fin. El 7 es el domingo 6 de diciembre de 2026 y el 8, el lunes
     * siguiente. De ahí en adelante el turno salta de dos a seis días cada vez, pero nunca se salta una fecha
     * señalada: si hay una en el camino, cae en ella.
     */
    const fechaDe = (n, semilla) => {
        let f = new Date(2026, 11, 6);
        for (let k = 8; k <= n; k++) {
            const salto = k === 8 ? 1 : 2 + Math.floor(azar(semilla * 977 + k * 131)() * 5);
            let sig = mas(f, salto);
            for (let d = 1; d < salto; d++) if (hito(mas(f, d))) { sig = mas(f, d); break; }
            f = sig;
        }
        return f;
    };
    /** Las próximas fechas señaladas después de `f`: [{ fecha, n, sube }]. */
    const proximas = (f, cuantas = 3) => {
        const lista = [];
        for (let d = 1; d < 200 && lista.length < cuantas; d++) { const c = mas(f, d), cual = hito(c); if (cual) { const H = HITOS[cual](1); lista.push({ fecha: fechaTxt(c), dia: DIA[(c.getDay() + 6) % 7], n: H.n, sube: H.sube }); } }
        return lista;
    };

    /**
     * El día número `n` del turno sin fin. Con la misma semilla sale siempre el mismo día. La fecha manda: si es
     * feriado o fecha señalada, trae lo suyo; y encima, cada día hay un poco más de gente, una meta algo más alta
     * y más cosas pasando a la vez.
     */
    const generar = (n, semilla) => {
        const rnd = azar(semilla * 131 + n * 7919), entre = (a, b) => a + rnd() * (b - a), ent = (a, b) => Math.floor(entre(a, b + 1)), uno = (l) => l[Math.floor(rnd() * l.length)];
        const fecha = fechaDe(n, semilla), dow = (fecha.getDay() + 6) % 7, k = n - 7, crece = Math.min(2, 1 + 0.03 * k), fuerza = Math.min(1.6, 1 + 0.025 * k);
        const cual = hito(fecha), H = cual ? HITOS[cual](fuerza) : null, T = H ? null : temporada(fecha), feriado = !!(H && H.feriado);
        const base = feriado ? FERIADO : dow === 5 ? SABADO : dow === 6 ? Object.assign({}, SABADO, { cierra: 22, fijo: 0.62 }) : {};
        const D = Object.assign({ n: DIA[dow], corto: `Día ${n}`, fecha: fechaTxt(fecha), sinfin: true, numero: n }, base, H && H.dia);
        // Cuánta gente, como fracción de los viajes de un día laborable: lo propio del día (un sábado mueve unos 136.000
        // de 205.000; un domingo, menos) o lo que diga la fecha señalada, por lo que crece el turno. Se divide por el
        // peso del reparto por horas para que la fracción se cumpla sea cual sea ese reparto.
        const fraccion = H ? H.demanda : (dow === 5 ? 0.665 : dow === 6 ? 0.55 : 1) * (T ? T.demanda : 1);
        // Lo que la fecha trae por su cuenta (la procesión, las compras) ya está dentro de esa fracción: se descuenta del resto.
        const propios = ((H && H.eventos) || []).reduce((a, e) => a + e.porMin * (e.a - e.de) * 60, 0) / 205000;
        D.demanda = Math.max(fraccion * crece * 0.5, fraccion * crece - propios) / SIM.nivelDe(D);
        D.fijo = (D.fijo || 1) * crece;      // más gente es también más personal, más limpieza y más seguridad
        D.meta = Math.min(86, 74 + Math.floor(k / 2));
        if (T && T.fiestas) D.fiestas = T.fiestas;
        D.hito = H ? { n: H.n, sube: H.sube, cuanto: H.cuanto, real: !!H.real, feriado } : T ? { n: T.n, sube: T.sube, cuanto: T.cuanto, temporada: true } : null;
        const sucesos = (H && H.sucesos ? H.sucesos.slice() : []), eventos = (H && H.eventos ? H.eventos.slice() : []), parte = [], titulos = [], abre = D.abre || 5.5, cierra = D.cierra || 23;
        if (H) parte.push(...H.parte); else parte.push(dow >= 5 ? `Horario de ${dow === 5 ? 'sábado: de 07:00 a 23:00' : 'domingo: de 07:00 a 22:00'}` : 'Día laborable: de 05:30 a 23:00');
        if (T) parte.push(`${T.n}: ${T.cuanto.charAt(0).toLowerCase() + T.cuanto.slice(1)}`);
        parte.push(`Además, el Metro ya lleva un ${Math.round((crece - 1) * 100)}% más de gente que cuando lo recibiste`);
        if (H && H.imanes) D.imanes = H.imanes;
        // Cuántas cosas más pasan hoy: dos al principio (una, si la fecha ya trae lo suyo), y cada dos días una más.
        const seca = fecha.getMonth() >= 5 && fecha.getMonth() <= 8;      // de junio a septiembre casi no llueve en Quito
        const bolsa = ['lluvia', 'taller', 'averias', 'evento', 'maquinas', 'paro', 'granizada', 'evento'].filter((c) => !(seca && (c === 'lluvia' || c === 'granizada') && rnd() < 0.85) && !(feriado && c === 'paro') && !(H && H.sube < 0 && c === 'evento'));      // en un feriado flojo no hay paro ni conciertos
        for (let i = bolsa.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]]; }
        let mojado = false, hora0 = 0;
        for (const c of bolsa.slice(0, Math.min(6, (H ? 1 : 2) + Math.floor(k / 2)))) {
            if (c === 'lluvia' && !mojado) {
                const de = entre(13, 17.5), a = Math.min(de + entre(1.5, 3), cierra); mojado = true; hora0 = de; D.lluvia = [de, a, 1];
                titulos.push('Aguacero'); parte.push(`Aguacero de ${hhmm(de)} a ${hhmm(a)}`);
                sucesos.push({ hora: de - 0.3, tipo: 'aviso', texto: 'El cielo se cierra sobre el Pichincha. En minutos empieza a llover.' });
            } else if (c === 'granizada' && !mojado) {
                const de = entre(13.5, 16.5), ct = uno(CORTES), min = ent(80, 130) + Math.min(60, k * 4); mojado = true; hora0 = de; D.lluvia = [de, Math.min(de + 3.2, cierra), 2];
                titulos.push('Granizada'); parte.push(`Tormenta con granizo hacia las ${hhmm(de)}: puede haber estaciones cerradas`);
                sucesos.push({ hora: de - 0.2, tipo: 'aviso', tono: 'mal', texto: 'Aviso del INAMHI: tormenta eléctrica con granizo sobre Quito. Empieza en minutos.' },
                    { hora: de + 0.45, tipo: 'corte', de: ct.de, a: ct.a, min, deja: [], texto: 'El agua y el hielo entran por las bocas del Metro. ' + ct.t });
            } else if (c === 'taller' && !D.trenesFuera) {
                D.trenesFuera = Math.min(4, ent(1, 2) + Math.floor(k / 6)); titulos.push('Trenes en el taller'); parte.push(`${D.trenesFuera} ${D.trenesFuera > 1 ? 'trenes' : 'tren'} en el taller`);
            } else if (c === 'averias') {
                const cuantas = Math.min(4, ent(1, 2) + Math.floor(k / 5));
                for (let i = 0; i < cuantas; i++) sucesos.push({ hora: entre(abre + 1, cierra - 2), tipo: 'averia', est: ent(1, 13), min: ent(7, 12) });
                titulos.push('Averías'); parte.push('El taller avisa de trenes con fallas pendientes: puede haber averías');
            } else if (c === 'evento') {
                const libres = EVENTOS.filter((e) => !eventos.some((q) => q.est === e.est[0][0])); if (!libres.length) continue;
                const ev = uno(libres), fin = entre(Math.max(abre + 5, 12.5), cierra - 1.6);
                ev.est.forEach(([i, peso], q) => eventos.push({ est: i, de: fin, a: fin + 1.2, porMin: Math.min(270, 130 + 12 * k) * peso, sitio: ev.sitio, n: q ? undefined : ev.n }));
                titulos.push(ev.corto); parte.push(`${ev.n}: termina a las ${hhmm(fin)}`);
                sucesos.push({ hora: fin - 1.4, tipo: 'aviso', texto: `${ev.n}: termina a las ${hhmm(fin)}. Prepara trenes y boleterías en ${NOMBRE[ev.est[0][0]]}.`, est: ev.est[0][0] });
            } else if (c === 'maquinas') {
                for (let i = 0, m = ent(2, 4); i < m; i++) sucesos.push({ hora: entre(abre + 0.5, cierra - 3), tipo: 'maquina', est: uno([0, 4, 6, 12, 14]), min: ent(120, 240) });
            } else if (c === 'paro' && !D.paro) {
                D.paro = true; D.demanda *= 1.15; titulos.push('Paro de buses'); parte.push('Paro de buses en media ciudad: un 15% más de gente en el Metro, todo el día');
            }
        }
        // Las decisiones: las que trae la fecha y, además, de una a cuatro del repertorio, repartidas en el día.
        const usadas = new Set();
        for (const [d, hora] of (H && H.decisiones) || []) { usadas.add(d); sucesos.push(dec(d, hora, 6)); }
        const libres = ['musico', 'colegio', 'vendedores', 'puerta', 'viral', 'via', 'tension', 'mochila', 'desmayo', 'bono', 'perro', 'tarjetas', 'escalera', 'carterista', 'aire', 'grafiti']
            .concat(mojado ? ['gotera', 'gotera'] : [], dow >= 5 || feriado ? ['bicis'] : ['visita', 'protesta']).filter((d) => !(feriado && (d === 'colegio' || d === 'bono')));
        const cuantas = Math.min(4, 1 + Math.floor(k / 3) + (rnd() < 0.5 ? 1 : 0)), ESTACION = { gotera: [5, 7, 9, 13], vendedores: [0, 2, 4, 14], musico: [6, 8, 11], tarjetas: [0, 4, 12, 14], carterista: [0, 4, 6, 11, 12] };
        for (let i = 0; i < cuantas; i++) {
            let d = uno(libres), vueltas = 0; while (usadas.has(d) && vueltas++ < 30) d = uno(libres);
            if (usadas.has(d)) break;
            usadas.add(d);
            const tramo = (cierra - abre - 3) / cuantas;
            const hora = d === 'gotera' ? hora0 + entre(0.5, 1.2) : d === 'bono' || d === 'grafiti' ? abre + 0.3 + i * 0.1 : d === 'visita' ? 8.8 : entre(abre + 1 + i * tramo, abre + 1 + (i + 1) * tramo);
            sucesos.push(dec(d, hora, ESTACION[d] ? uno(ESTACION[d]) : ent(1, 13)));
        }
        sucesos.sort((p, q) => p.hora - q.hora);
        D.sucesos = sucesos; D.eventos = eventos; D.parte = parte;
        const resto = titulos.slice(0, H ? 1 : 2).map((t, i) => (i || H ? t.charAt(0).toLowerCase() + t.slice(1) : t));
        D.t = H ? H.n + (resto.length ? ` y ${resto[0]}` : '') : resto.length ? resto.join(' y ') : T ? T.n : 'Día sin sobresaltos';
        D.intro = `Día ${n} al frente de la línea` + (H ? `, y cae en ${H.n === 'Año viejo' ? 'el año viejo' : H.n}: ${H.cuanto.charAt(0).toLowerCase() + H.cuanto.slice(1)}.` : '.') + ` Mientras el ánimo no baje de ${D.meta - 10} y la caja no quede en rojo, el cargo sigue siendo tuyo.`;
        // En los días flojos el reto es la caja; en los demás, cualquiera.
        D.reto = (H && H.sube < 0 ? RETOS.azul : RETOS[uno(['idos', 'espera', 'saldo', 'llenos'])])(k);
        return D;
    };

    return { DIAS, MEJORAS, RANGOS, DECISIONES, HITOS, generar, fechaDe, proximas, pascua, fechasDe, NOMBRE };
})();
if (typeof module !== 'undefined') module.exports = CAMPANA;
