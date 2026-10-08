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
 * El turno sin fin recorre el calendario de verdad, que está en
 * js/metro-calendario.js: los feriados nacionales con su traslado, el
 * carnaval y el Viernes Santo por la fecha de Pascua, las fechas de Quito, y
 * cuánta gente se mueve cada día según las cifras que publica el Metro. Aquí
 * se le suma lo que hace de cada fecha un día de juego: a dónde va la gente,
 * qué eventos hay y qué decisiones trae.
 */
const CAMPANA = (() => {
    // En el navegador la simulación y el calendario ya están cargados; en Node se piden.
    const SIM = typeof JEFE !== 'undefined' ? JEFE : require('./metro-sim.js');
    const CAL = typeof CALENDARIO !== 'undefined' ? CALENDARIO : require('./metro-calendario.js');
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
        carnavaleros: (i) => ({
            id: 'carnavaleros', est: i, titulo: 'Carnaval en el andén',
            texto: `Un grupo juega carnaval con espuma y globos de agua en el vestíbulo de ${NOMBRE[i]}. El piso ya está mojado y medio andén, también.`,
            opciones: [
                { t: 'Aquí adentro no se juega', d: 'Los guardias los sacan a la plaza. Se van protestando.', fx: (S) => { S.opinion(i, 60, 700); }, r: 'El carnaval sigue afuera, en la plaza.' },
                { t: 'Dejarlos: es carnaval', d: 'Risas y espuma, pero el piso resbala: las paradas de toda la línea se alargan un 15% durante dos horas.', fx: (S) => { S.paradas(120, 1.15); S.opinion(i, 90, 1200); }, r: `Espuma hasta en los torniquetes de ${NOMBRE[i]}.` },
                { t: 'Poner una zona de juego en la plaza (−$300)', d: 'Con tanque de agua y todo. Nadie se moja adentro.', fx: (S) => { S.gasto(300); S.opinion(i, 100, 1500); }, r: `Carnaval en la plaza de ${NOMBRE[i]}, con tanque de agua incluido.`, tono: 'bien' },
            ],
        }),
        procesion: () => ({
            id: 'procesion', est: 6, titulo: 'Sale la procesión',
            texto: 'En un rato sale de San Francisco la procesión de Jesús del Gran Poder: cucuruchos, verónicas y más de cien mil personas. La boca del Metro queda en medio.',
            opciones: [
                { t: 'Entrada solo por el bulevar 24 de Mayo, salida por la plaza', d: 'Es lo que hace el Metro cada año. Ordenado, pero la entrada a San Francisco va a poco más de la mitad hasta las 18:00.', fx: (S) => { S.boleteriaLenta(6, Math.max(60, 18 * 60 - S.t), 0.6); S.opinion(6, 90, 2500); }, r: 'San Francisco: se entra por el bulevar y se sale por la plaza. Recomienda La Alameda.' },
                { t: 'Todos los accesos abiertos', d: 'La estación trabaja a su ritmo, pero la gente que sale se cruza con la procesión.', fx: (S) => { S.opinion(6, 20, 3000); }, r: 'La salida de San Francisco se topa con la procesión.', tono: 'mal' },
                { t: 'Cerrar San Francisco dos horas y mandar a La Alameda', d: 'Nadie se cruza con nadie. Todo el centro entra y sale por La Alameda.', fx: (S) => { const min = S.cerrarEstacion(6, 120, true); S.oleada(7, min, 60); S.luego(min, (Q) => Q.avisar('bien', 'Pasó la procesión. San Francisco vuelve a abrir.', 6)); }, r: 'San Francisco cierra mientras pasa la procesión. La Alameda recibe a todos.', tono: 'mal' },
            ],
        }),
        novena: (i) => ({
            id: 'novena', est: i, titulo: 'Novena en el vestíbulo',
            texto: `Los vecinos piden rezar la novena, con villancicos y pristiños, en el vestíbulo de ${NOMBRE[i]} a las seis de la tarde.`,
            opciones: [
                { t: 'Que la recen aquí', d: 'Villancicos en el vestíbulo. La boletería va un 20% más lenta durante una hora.', fx: (S) => { S.boleteriaLenta(i, 60, 0.8); S.opinion(i, 100, 1800); }, r: `«Dulce Jesús mío» suena en ${NOMBRE[i]}.`, tono: 'bien' },
                { t: 'Mejor en la plaza de afuera', d: 'El vestíbulo queda libre.', fx: (S) => { S.opinion(i, 70, 500); }, r: 'La novena se reza en la plaza.' },
            ],
        }),
        viejos: (i) => ({
            id: 'viejos', est: i, titulo: 'Un año viejo en el andén',
            texto: `Unas «viudas» piden caridad en la entrada de ${NOMBRE[i]}, y un grupo quiere subir al tren con un monigote de dos metros para quemarlo en su barrio.`,
            opciones: [
                { t: 'Que pasen, con monigote y todo', d: 'Fotos, risas y un tren que tarda en cerrar puertas: las paradas se alargan un 10% durante una hora.', fx: (S) => { S.paradas(60, 1.1); S.opinion(i, 100, 2000); }, r: 'El año viejo viaja sentado, con su testamento.', tono: 'bien' },
                { t: 'El monigote no sube', d: 'Los trenes van a su ritmo. El grupo se va a pie, molesto.', fx: (S) => { S.opinion(i, 50, 700); }, r: 'El monigote se queda en la vereda.' },
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
                { hora: 19.5, tipo: 'aviso', texto: 'Empezó el partido. Tienes hasta las 21:15 para preparar la salida del estadio: trenes, ventanillas y máquinas.', est: 12, mapa: true },
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
                { hora: 17.6, tipo: 'aviso', tono: 'bien', texto: '¡Que viva Quito! Salen las chivas y empiezan las tarimas en el Centro Histórico.', est: 6, mapa: true },
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
                { hora: 19.6, tipo: 'aviso', texto: 'Última canción en el Parque Bicentenario. En media hora, cuarenta mil personas caminan hacia El Labrador y Jipijapa.', est: 14, mapa: true },
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

    // ───────────────────────── El turno sin fin ─────────────────────────
    // La fecha de cada día sale del calendario de verdad: qué día es, si es feriado y cuánta gente se mueve según
    // las cifras del Metro. Aquí se le suma lo que hace de esa fecha un día de juego.
    const mas = (f, n) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + n);
    const fechaTxt = (f) => `${f.getDate()} de ${CAL.MES[f.getMonth()]}` + (f.getFullYear() === 2026 ? '' : ` de ${f.getFullYear()}`);
    // Fechas con nombre por las que el turno no se detiene a propósito: si le toca caer en ellas se notan, pero no las busca.
    const DE_PASO = new Set(['Compras de Navidad', 'Semana de fin de año', 'Fiesta de la Luz', 'Sábado de carnaval', 'Domingo de carnaval', 'Martes de carnaval', 'Jueves Santo', 'Sábado Santo', 'Domingo de Pascua', 'Independencia de Cuenca', 'Aniversario del Metro']);
    /** ¿Es una fecha señalada, de las que el turno nunca se salta? Devuelve lo que dice de ella el calendario. */
    const senalada = (f) => { const c = CAL.de(f); return c.n && !DE_PASO.has(c.n) ? c : null; };

    const TEMPRANO = [[5.5, 0.3], [7, 1.5], [8.5, 1.4], [10, 1.2], [12, 1.5], [14, 1.85], [16, 1.9], [18, 1.3], [19.5, 0.6], [21, 0.25], [23, 0.1]];      // un día que se acaba pronto: todos en casa antes de la noche
    const A_CASA = [[9, 0], [12, 0.5], [15, 1]];
    const FIESTA_QUITO = (f) => ({
        eventos: [{ est: 11, de: 12.6, a: 14, porMin: 95 * f, sitio: 'carolina', n: 'Desfile de la confraternidad' }, { est: 12, de: 12.6, a: 14, porMin: 80 * f, sitio: 'carolina' }, { est: 14, de: 20.2, a: 21.5, porMin: 190 * f, sitio: 'bicentenario', n: 'Concierto del Bicentenario' }],
        parte: ['Desfile al mediodía en La Carolina y concierto de cierre junto a El Labrador'],
    });
    /**
     * Lo que el juego le pone a una fecha del calendario, además de la cantidad de gente: a dónde quiere llegar esa
     * gente (imanes), qué eventos hay, cómo se reparte el día y qué se le advierte al jugador. `f` es la fuerza de
     * los eventos, que crece con los días.
     */
    const TEXTURA = {
        'Víspera de carnaval': () => ({
            imanes: [{ est: 0, de: 12.5, a: 20.5, f: 3.2 }, { est: 14, de: 12.5, a: 20.5, f: 1.8 }],
            parte: ['Desde el mediodía, media ciudad va a la Terminal Quitumbe: los trenes al sur salen llenos'],
            avisos: [[12.2, 'Empieza el éxodo de carnaval. Los andenes hacia el sur se van a llenar: Quitumbe es la terminal de buses.', 0]],
        }),
        'Viernes Santo': () => ({ imanes: [{ est: 6, de: 7, a: 12.5, f: 5 }, { est: 7, de: 7, a: 12.5, f: 2.5 }], parte: ['Poca gente en la línea y muchísima en el centro: La Alameda es la alternativa a San Francisco'] }),
        'Nochebuena': (f) => ({
            perfil: TEMPRANO, vuelta: A_CASA,
            eventos: [{ est: 6, de: 12.5, a: 17.5, porMin: 60 * f, sitio: 'plaza', n: 'Últimas compras en el centro' }, { est: 11, de: 13, a: 18, porMin: 50 * f, sitio: 'carolina', n: 'Compras en el norte' }, { est: 4, de: 13.5, a: 18, porMin: 35 * f, sitio: 'recreo' }],
            parte: ['Tarde de últimas compras en el centro, La Carolina y El Recreo', 'Desde las 20:00 no queda nadie: los trenes de la noche van vacíos'],
        }),
        'Fin de año': (f) => ({
            perfil: TEMPRANO, vuelta: A_CASA,
            eventos: [{ est: 8, de: 14, a: 19, porMin: 65 * f, sitio: 'mariscal', n: 'Años viejos en la avenida Amazonas' }, { est: 11, de: 14.5, a: 19, porMin: 40 * f, sitio: 'carolina' }],
            parte: ['Monigotes y viudas en la avenida Amazonas toda la tarde', 'A las 22:00 todo el mundo está en su casa, quemando el año viejo'],
        }),
        'Día del Trabajo': (f) => ({
            imanes: [{ est: 8, de: 7, a: 10.5, f: 2.5 }, { est: 6, de: 7, a: 10.5, f: 2 }],
            eventos: [{ est: 6, de: 12, a: 13.8, porMin: 85 * f, sitio: 'plaza', n: 'Marcha del Primero de Mayo' }, { est: 7, de: 12, a: 13.8, porMin: 45 * f, sitio: 'plaza' }],
            parte: ['La marcha de los trabajadores baja de El Ejido a la Plaza de San Francisco y se disuelve al mediodía'], decisiones: [['protesta', 9.6, 6]],
        }),
        'Día de Difuntos': (f) => ({
            imanes: [{ est: 6, de: 8, a: 12, f: 2.2 }], eventos: [{ est: 6, de: 11.5, a: 14.5, porMin: 55 * f, sitio: 'sanfrancisco', n: 'Cementerio de San Diego' }],
            parte: ['Colada morada, guaguas de pan y visita al cementerio de San Diego, a unas cuadras de San Francisco'],
        }),
        'Fundación de Quito': FIESTA_QUITO, 'Día de Quito': FIESTA_QUITO,
        'Quito 15K': () => ({ imanes: [{ est: 1, de: 7, a: 8.2, f: 3 }, { est: 2, de: 7, a: 8.2, f: 2.5 }], parte: ['Los corredores van al sur temprano y salen del norte, cansados, desde las 09:30'] }),
        'Regreso a clases': () => ({ imanes: [{ est: 9, de: 6, a: 8.5, f: 1.8 }], parte: ['La Universidad Central se nota en los dos picos y al mediodía'] }),
    };

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
     * señalada: si hay una en el camino, cae en ella. Así un turno largo recorre el año entero.
     */
    const fechaDe = (n, semilla) => {
        let f = new Date(2026, 11, 6);
        for (let k = 8; k <= n; k++) {
            const salto = k === 8 ? 1 : 2 + Math.floor(azar(semilla * 977 + k * 131)() * 5);
            let sig = mas(f, salto);
            for (let d = 1; d < salto; d++) if (senalada(mas(f, d))) { sig = mas(f, d); break; }
            f = sig;
        }
        return f;
    };
    const subeDe = (c) => (c.tono === 'alza' ? 1 : c.tono === 'baja' ? -1 : 0);
    /** Las próximas fechas señaladas después de `f`: [{ fecha, dia, n, sube, pct }]. */
    const proximas = (f, cuantas = 3) => {
        const lista = [];
        for (let d = 1; d < 250 && lista.length < cuantas; d++) { const c = senalada(mas(f, d)); if (c) lista.push({ fecha: fechaTxt(c.fecha), dia: c.dia, n: c.n, sube: subeDe(c), pct: CAL.pct(c.cambio) }); }
        return lista;
    };

    /**
     * El día número `n` del turno sin fin. Con la misma semilla sale siempre el mismo día. La fecha manda: el
     * calendario dice qué día es y cuánta gente se mueve; encima, cada día hay un poco más de gente que el
     * anterior, una meta algo más alta y más cosas pasando a la vez.
     */
    const generar = (n, semilla) => {
        const rnd = azar(semilla * 131 + n * 7919), entre = (a, b) => a + rnd() * (b - a), ent = (a, b) => Math.floor(entre(a, b + 1)), uno = (l) => l[Math.floor(rnd() * l.length)];
        const fecha = fechaDe(n, semilla), c = CAL.de(fecha), k = n - 7, crece = Math.min(2, 1 + 0.03 * k), fuerza = Math.min(1.6, 1 + 0.025 * k);
        const X = c.n && TEXTURA[c.n] ? TEXTURA[c.n](fuerza) : {}, feriado = c.feriado, flojo = c.tono === 'baja' && (feriado || c.dow >= 5);
        const D = { n: c.dia, corto: `Día ${n}`, fecha: fechaTxt(fecha), sinfin: true, numero: n };
        if (c.tipo !== 'laborable') { D.abre = c.abre; D.fijo = c.tipo === 'sabado' ? 0.68 : 0.62; D.calma = feriado ? 2 : 1; }      // sin apuro: se espera más tranquilo
        if (c.cierra !== 23) D.cierra = c.cierra;
        if (X.perfil || c.perfil) { D.perfil = X.perfil || c.perfil; D.vuelta = X.vuelta || c.vuelta; }
        if (c.fiestas) D.fiestas = c.fiestas;
        const sucesos = [], eventos = (X.eventos || []).slice(), parte = [], titulos = [], abre = D.abre || 5.5, cierra = D.cierra || 23;
        // Los eventos que el calendario le pone a la fecha: `k` es su tamaño; a la estación principal llegan unas 210 personas por minuto con k = 1.
        for (const ev of c.ev) ev.est.forEach(([i, peso], q) => eventos.push({ est: i, de: ev.de, a: Math.min(ev.a, cierra - 0.05), porMin: 210 * ev.k * peso * fuerza, sitio: ev.lugar, n: q ? undefined : ev.n }));
        for (const [hora, texto, est] of (c.aviso || []).concat(X.avisos || [])) sucesos.push({ hora, tipo: 'aviso', texto, est });
        // Cuánta gente: la fracción de un día laborable que dice el calendario, por lo que crece el turno. Lo que la fecha
        // trae por su cuenta (la procesión, las compras) ya está dentro de esa fracción, así que se descuenta del resto; y
        // se divide por el peso del reparto por horas para que la fracción se cumpla sea cual sea ese reparto.
        const propios = eventos.reduce((a, e) => a + e.porMin * (e.a - e.de) * 60, 0) / 205000;
        D.demanda = Math.max(c.factor * crece * 0.5, c.factor * crece - propios) / SIM.nivelDe(D);
        if (D.fijo || crece > 1) D.fijo = (D.fijo || 1) * crece;      // más gente es también más personal, más limpieza y más seguridad
        D.meta = Math.min(86, 74 + Math.floor(k / 2)) - (flojo ? 4 : 0);
        if (X.imanes) D.imanes = X.imanes;
        // Lo que dice el calendario de la fecha: el tablero lo muestra aparte, con su cifra.
        D.hito = c.n ? { n: c.n, sube: subeDe(c), pct: CAL.pct(c.cambio), frente: feriado && c.dow < 5 ? 'un día laborable' : `un ${c.dia.toLowerCase()} normal`, real: c.real, dato: c.dato, feriado } : null;
        parte.push(c.tipo === 'laborable' ? `Día laborable: de 05:30 a ${hhmm(cierra)}` : `${feriado ? 'Feriado' : c.tipo === 'sabado' ? 'Sábado' : 'Domingo'}: de 07:00 a ${hhmm(cierra)}`);
        if (X.parte) parte.push(...X.parte);
        if (flojo) parte.push('Con tan pocos pasajes, lo difícil hoy es la caja: espacia los trenes');
        parte.push(`Además, el Metro ya lleva un ${Math.round((crece - 1) * 100)}% más de gente que cuando lo recibiste`);
        // Cuántas cosas más pasan hoy: dos al principio (una, si la fecha ya trae lo suyo), y cada dos días una más.
        const seca = fecha.getMonth() >= 5 && fecha.getMonth() <= 8;      // de junio a septiembre casi no llueve en Quito
        const bolsa = ['lluvia', 'taller', 'averias', 'evento', 'maquinas', 'paro', 'granizada', 'evento']
            .filter((q) => !(seca && (q === 'lluvia' || q === 'granizada') && rnd() < 0.85) && !(feriado && q === 'paro') && !(flojo && q === 'evento'));      // en un feriado flojo no hay paro ni conciertos
        for (let i = bolsa.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]]; }
        let mojado = false, hora0 = 0;
        for (const q of bolsa.slice(0, Math.min(6, (c.n ? 1 : 2) + Math.floor(k / 2)))) {
            if (q === 'lluvia' && !mojado) {
                const de = entre(13, 17.5), a = Math.min(de + entre(1.5, 3), cierra); mojado = true; hora0 = de; D.lluvia = [de, a, 1];
                titulos.push('Aguacero'); parte.push(`Aguacero de ${hhmm(de)} a ${hhmm(a)}`);
                sucesos.push({ hora: de - 0.3, tipo: 'aviso', texto: 'El cielo se cierra sobre el Pichincha. En minutos empieza a llover.' });
            } else if (q === 'granizada' && !mojado) {
                const de = entre(13.5, 16.5), ct = uno(CORTES), min = ent(80, 130) + Math.min(60, k * 4); mojado = true; hora0 = de; D.lluvia = [de, Math.min(de + 3.2, cierra), 2];
                titulos.push('Granizada'); parte.push(`Tormenta con granizo hacia las ${hhmm(de)}: puede haber estaciones cerradas`);
                sucesos.push({ hora: de - 0.2, tipo: 'aviso', tono: 'mal', texto: 'Aviso del INAMHI: tormenta eléctrica con granizo sobre Quito. Empieza en minutos.' },
                    { hora: de + 0.45, tipo: 'corte', de: ct.de, a: ct.a, min, deja: [], texto: 'El agua y el hielo entran por las bocas del Metro. ' + ct.t });
            } else if (q === 'taller' && !D.trenesFuera) {
                D.trenesFuera = Math.min(4, ent(1, 2) + Math.floor(k / 6)); titulos.push('Trenes en el taller'); parte.push(`${D.trenesFuera} ${D.trenesFuera > 1 ? 'trenes' : 'tren'} en el taller`);
            } else if (q === 'averias') {
                const cuantas = Math.min(4, ent(1, 2) + Math.floor(k / 5));
                for (let i = 0; i < cuantas; i++) sucesos.push({ hora: entre(abre + 1, cierra - 2), tipo: 'averia', est: ent(1, 13), min: ent(7, 12) });
                titulos.push('Averías'); parte.push('El taller avisa de trenes con fallas pendientes: puede haber averías');
            } else if (q === 'evento') {
                const libres = EVENTOS.filter((e) => !eventos.some((x) => x.est === e.est[0][0])); if (!libres.length) continue;
                const ev = uno(libres), fin = entre(Math.max(abre + 5, 12.5), cierra - 1.6);
                ev.est.forEach(([i, peso], x) => eventos.push({ est: i, de: fin, a: fin + 1.2, porMin: Math.min(270, 130 + 12 * k) * peso, sitio: ev.sitio, n: x ? undefined : ev.n }));
                titulos.push(ev.corto); parte.push(`${ev.n}: termina a las ${hhmm(fin)}`);
                sucesos.push({ hora: fin - 1.4, tipo: 'aviso', texto: `${ev.n}: termina a las ${hhmm(fin)}. Prepara trenes y boleterías en ${NOMBRE[ev.est[0][0]]}.`, est: ev.est[0][0], mapa: true });
            } else if (q === 'maquinas') {
                for (let i = 0, m = ent(2, 4); i < m; i++) sucesos.push({ hora: entre(abre + 0.5, cierra - 3), tipo: 'maquina', est: uno([0, 4, 6, 12, 14]), min: ent(120, 240) });
            } else if (q === 'paro' && !D.paro) {
                D.paro = true; D.demanda *= 1.15; titulos.push('Paro de buses'); parte.push('Paro de buses en media ciudad: un 15% más de gente en el Metro, todo el día');
            }
        }
        // Las decisiones: las que trae la fecha y, además, de una a cuatro del repertorio, repartidas en el día.
        const usadas = new Set(), propias = (c.dec ? [c.dec] : []).concat(X.decisiones || []);
        for (const [d, hora, est] of propias) if (DECISIONES[d] && hora < cierra - 0.5) { usadas.add(d); sucesos.push(dec(d, hora, est)); }
        const libres = ['musico', 'colegio', 'vendedores', 'puerta', 'viral', 'via', 'tension', 'mochila', 'desmayo', 'bono', 'perro', 'tarjetas', 'escalera', 'carterista', 'aire', 'grafiti']
            .concat(mojado ? ['gotera', 'gotera'] : [], c.tipo !== 'laborable' ? ['bicis'] : ['visita', 'protesta'], c.carnaval ? ['carnavaleros'] : []).filter((d) => !(c.tipo !== 'laborable' && (d === 'colegio' || d === 'bono')));
        const cuantas = Math.max(0, Math.min(4, 1 + Math.floor(k / 3) + (rnd() < 0.5 ? 1 : 0)) - propias.length), ESTACION = { gotera: [5, 7, 9, 13], vendedores: [0, 2, 4, 14], musico: [6, 8, 11], tarjetas: [0, 4, 12, 14], carterista: [0, 4, 6, 11, 12], carnavaleros: [0, 4, 8, 11] };
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
        const resto = titulos.slice(0, c.n ? 1 : 2).map((t, i) => (i || c.n ? t.charAt(0).toLowerCase() + t.slice(1) : t));
        D.t = c.n ? c.n + (resto.length ? ` y ${resto[0]}` : '') : resto.length ? resto.join(' y ') : 'Día sin sobresaltos';
        D.intro = `Día ${n} al frente de la línea.` + (c.n ? ` En el calendario: ${c.n}.` : '') + ` Mientras el ánimo no baje de ${D.meta - 10} y la caja no quede en rojo, el cargo sigue siendo tuyo.`;
        // En los días flojos el reto es la caja; en los demás, cualquiera.
        D.reto = (flojo ? RETOS.azul : RETOS[uno(['idos', 'espera', 'saldo', 'llenos'])])(k);
        return D;
    };

    return { DIAS, MEJORAS, RANGOS, DECISIONES, generar, fechaDe, proximas, NOMBRE };
})();
if (typeof module !== 'undefined') module.exports = CAMPANA;
