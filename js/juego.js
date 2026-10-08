'use strict';

/*
 * Jefe de línea: el juego, sobre el mapa real.
 *
 * Diriges el Metro de Quito durante la semana de Fiestas. Decides cada cuánto
 * sale un tren en cada franja del día, cuántas ventanillas abres y dónde pones
 * máquinas de boletos, y resuelves lo que se presente. La simulación está en
 * js/metro-sim.js y la campaña (los días y sus decisiones) en
 * js/metro-campana.js; aquí están la pantalla, los controles, las guías, la
 * tienda y las partidas guardadas.
 *
 * Los trenes se ven dos veces: en el mapa, sobre la línea de verdad, y en la
 * tira de abajo, que es la misma línea estirada.
 *
 * Todo lo que ordena el jugador pasa por `orden()`, que lo anota en la bitácora
 * de la simulación y guarda el turno: si la página se cierra a medias, al
 * volver el día se rehace igual, con las mismas órdenes y hasta el mismo paso.
 *
 * Los paneles se arman una sola vez al abrirse y después solo se les cambia el
 * texto: si se rehicieran en cada refresco, un botón podría desaparecer entre
 * que se lo aprieta y se lo suelta, y el clic se perdería.
 *
 * La semana entrega una mecánica nueva cada día (ver DESDE y GUIAS): el lunes
 * solo el horario, el martes las boleterías, el miércoles los trenes de
 * refuerzo… Al terminarla empieza el turno sin fin, con días generados al azar.
 *
 * Para probar sin jugar (cuadro fijo):
 *   index.html#shot&juego=1&jdia=4&jplan=real&jt=1000&jsel=8&jpanel=horario
 *   jdia: de 0 a 6, la semana; 7 o más, el turno sin fin (con jsemilla=123 para fijar el azar)
 *   jtren=3 elige un tren · jdentro=1 lo muestra por dentro · jguia=0 deja a la vista ese paso de la guía del día
 *   jfin=1 corre el día entero · jmenu=titulo|semana|final|ayuda (con jhecho=7 para dar la semana por terminada)
 *   jdec=1 deja a la vista la decisión pendiente
 * Los recorridos completos, con un navegador de verdad, están en tools/playtest*.py.
 */
(() => {
    const { R, clamp } = Q, S = Q.state, M = Q.mapa, $ = (s) => document.querySelector(s);
    if (!M || !M.metro || typeof JEFE === 'undefined' || typeof CAMPANA === 'undefined') return;
    const N = JEFE.N, params = new URLSearchParams(location.hash.slice(1));
    const { DIAS, MEJORAS, RANGOS, MISIONES, DIFICULTADES } = CAMPANA;
    // Dónde está cada estación sobre la línea real, en metros. Si el mapa no trae las 15, se reparten parejo.
    const reales = M.metro.est.length === N;
    const largos = reales ? M.metro.est.map((e) => e.s) : Array.from({ length: N }, (_, i) => M.metro.largo * (0.02 + 0.96 * i / (N - 1)));
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
    const con = (padre, ...hijos) => { padre.append(...hijos); return padre; };
    const boton = (txt, fn, cls = '', titulo = '') => { const b = el('button', cls, txt); b.type = 'button'; if (titulo) b.title = titulo; if (fn) b.addEventListener('click', fn); return b; };
    const plata = (v) => (v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('de-DE');
    const miles = (v) => Math.round(v).toLocaleString('de-DE');
    const coma = (v) => v.toFixed(1).replace('.', ',');
    const hhmm = (min) => String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(min % 60)).padStart(2, '0');
    const son = (n, ...a) => { try { if (Q.sfx && Q.sfx[n]) Q.sfx[n](...a); } catch (e) { /* el sonido nunca detiene el juego */ } };
    const angosta = () => innerWidth <= 720;
    const estrellasTxt = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

    // ───────────────────────── Las partidas guardadas ─────────────────────────
    const CLAVE = 'quito-jefe-de-linea', HUECOS = 3;
    const prueba = params.get('juego') === '1';
    const nueva = () => ({
        dia: 0, estrellas: [], retos: [], dias: [], caja: 8000, maquinas: [2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0, 2, 0, 2],
        tarjeta: 0, cajeros: 0, anden: 0, pantallas: 0, mantenimiento: 0, taller: 0, jefes: 0, bombas: 0, trenes: 0, publicidad: 0, solar: 0,
        horario: [8, 8, 8, 8, 8, 8, 8], ventanillas: null, notas: {}, fin: false, segundos: 0, fecha: 0,
        horarioFinde: [8, 8, 8, 8, 8, 8, 8],      // sábados, domingos y feriados tienen otras franjas y su propio horario
        dificultad: 'normal',
        misiones: { activas: [], hechas: [], vencidas: 0, rota: 0 },      // los encargos aceptados, con su avance y su plazo
        secuelas: null,     // lo que dejó el último día para el siguiente: { para: número de día, lista }
        mascota: null,      // { i: estación, dias } si se adoptó a Durmiente
        guias: [],          // qué días ya se jugaron con su guía
        sinfin: null,       // el turno sin fin: { n: día por jugar, semilla, mejor: récord de días }
        turno: null,        // el día que quedó a medias: { dia, t, pasos, plan, bitacora }
        perdida: false,     // la semana cerró con la caja en rojo
        total: { dias: 0, viajes: 0, km: 0 },      // lo acumulado en todos los días terminados
    });
    let almacen = { v: 2, actual: 0, partidas: Array(HUECOS).fill(null), logros: {}, records: {} }, partida = nueva();
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
        if (g && g.v === 2 && Array.isArray(g.partidas)) almacen = Object.assign(almacen, g);
        else if (g && Array.isArray(g.maquinas) && g.maquinas.length === N) {
            // Una partida de la primera versión, de cinco días: se conservan la caja, las mejoras y los cuatro primeros días, que son los mismos.
            const p = Object.assign(nueva(), g); p.estrellas = (g.estrellas || []).slice(0, 4); p.dia = Math.min(g.dia || 0, 4); p.dias = []; p.retos = [];
            almacen.partidas[0] = p;
        }
    } catch (e) { /* sin almacenamiento, la partida dura lo que dure la visita */ }
    const cargar = (k) => { almacen.actual = k; partida = Object.assign(nueva(), almacen.partidas[k] || {}); };
    if (almacen.partidas[almacen.actual]) cargar(almacen.actual);
    const guardar = () => { if (prueba) return; partida.fecha = Date.now(); almacen.partidas[almacen.actual] = partida; try { localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* idem */ } };
    const dificultad = (p = partida) => DIFICULTADES[p.dificultad] || DIFICULTADES.normal;
    const totalEstrellas = (p) => (p.estrellas || []).reduce((a, b) => a + (b || 0), 0);
    const rangoDe = (n) => RANGOS.find((r) => n >= r.de);

    // ───────────────────────── Estado del día ─────────────────────────
    const VEL = [0, 2.5, 5, 10];          // minutos de juego por segundo real: pausa, ×1, ×2, ×4. A ×1, un día dura unos siete minutos
    let sim = null, dia = 0, D = null, vel = 0, sel = -1, selTren = 0, llueve = 0, fiesta = false, refresco = 0;
    let vista = '';                        // '' el mapa · 'est' la estación elegida por dentro · 'tren' el tren elegido por dentro
    let panel = '', panelAct = null, fichaAct = null, decision = null, velAntes = 1;
    const zonas = [], enMapa = [];         // lo que responde al clic dentro de una estación, y dónde quedó cada tren en el mapa
    let sugerido = false;                  // si hoy ya se pidió un horario sugerido (para la guía del sábado)
    let sinCiudad = false, planInicial = null, ahorro = 0;      // la capa de ciudad se apaga si falla · el plan con que arrancó el día · el reloj del guardado
    const activo = (t) => t.estado !== 'cochera' && t.estado !== 'taller' && t.estado !== 'listo';
    const estrellasDe = (animo, saldo, meta) => (animo >= meta + 10 && saldo >= 0 ? 3 : animo >= meta ? 2 : animo >= meta - 10 ? 1 : 0);
    const disponible = () => partida.caja - sim.cuenta.compras;     // lo que hay en caja para comprar ahora
    /** El horario que se cambia se recuerda para el próximo día del mismo tipo: entre semana, o fin de semana y feriado. */
    const guardarHorario = () => { partida[sim.finde ? 'horarioFinde' : 'horario'] = sim.horario.slice(); guardarTurno(); };
    /** Cada día de la semana entrega algo nuevo: las boleterías llegan el martes y los trenes de refuerzo, el miércoles. */
    const DESDE = { boleterias: 1, trenes: 2, misiones: 1, sugerir: 5 };
    const puede = (que) => dia >= DESDE[que];

    // ───────────────────────── Pantalla ─────────────────────────
    const ui = {};
    const dato = (texto, id, titulo) => { const s = el('span', '', texto + ' '); if (titulo) s.title = titulo; ui[id] = el('b'); s.append(ui[id]); return s; };
    const hud = el('div'); hud.id = 'jefe'; hud.hidden = true;
    {
        ui.dia = el('strong'); ui.hora = el('span', 'hora');
        ui.vel = con(el('span', 'jvel'), boton('Pausar', null, '', 'Pausar o reanudar (Espacio)'), boton('×1', null, '', 'Tecla 1'), boton('×2', null, '', 'Tecla 2'), boton('×4', null, '', 'Tecla 3'));
        ui.vel.setAttribute('role', 'group'); ui.vel.setAttribute('aria-label', 'Velocidad');
        ui.estado = el('span', 'jestado'); ui.estado.setAttribute('role', 'status');
        ui.bvista = boton('Ver mapa', () => { if (vista) verDentro(''); else { if (sel < 0 && !selTren) elegir(0, true); verDentro(selTren ? 'tren' : 'est'); } refrescar(); });
        ui.estacion = el('select'); ui.estacion.setAttribute('aria-label', 'Ver estación');
        M.metro.est.forEach((e, i) => { const op = el('option', '', e.nombre); op.value = i; ui.estacion.append(op); });
        ui.estacion.addEventListener('change', () => { elegir(+ui.estacion.value, true); verDentro('est'); ficha.hidden = true; refrescar(); });
        ui.detalles = boton('Gestionar estación', () => { if (sel < 0 && !selTren) elegir(0, true); else ficha.hidden = !ficha.hidden; refrescar(); });
        ui.barra = el('i'); ui.meta = el('em'); ui.reto = el('p', 'jreto'); ui.misiones = el('div', 'jmisiones');
        ui.bhor = boton('Horario', null, '', 'Cada cuánto sale un tren (tecla H)');
        ui.bbol = boton('Boleterías', null, '', 'Ventanillas y máquinas de todas las estaciones (tecla B)');
        ui.btre = boton('Trenes', null, '', 'La flota, tren por tren (tecla T)');
        ui.sur = boton('Tren extra ▸', null, '', 'Manda un tren vacío desde la cabecera sur');
        ui.nor = boton('◂ Tren extra', null, '', 'Manda un tren vacío desde la cabecera norte');
        ui.ayuda = boton('?', null, 'chico', 'Cómo se juega'); ui.salir = boton('Salir', null, '', 'Dejar el día y volver a la semana');
        ui.mas = boton('Más', () => { const abierta = hud.classList.toggle('mas-controles'); ui.mas.setAttribute('aria-expanded', String(abierta)); ui.mas.textContent = abierta ? 'Menos' : 'Más'; }, 'jmas', 'Refuerzos, ayuda y salir');
        ui.mas.setAttribute('aria-expanded', 'false');
        [ui.sur, ui.nor, ui.ayuda, ui.salir].forEach((b) => b.classList.add('secundario'));
        con(hud,
            con(el('div', 'j1'), ui.dia, ui.hora, ui.vel, ui.estado),
            con(el('div', 'j2'), dato('Ánimo', 'animo', 'Qué tan contenta va la gente, de 0 a 100'), con(el('span', 'jb'), ui.barra, ui.meta), dato('Hoy', 'caja', 'Ingresos menos costos de hoy'), dato('Viajes', 'viajes'), dato('Trenes', 'trenes', 'En servicio, de los que tienes')),
            ui.reto, ui.misiones,
            con(el('div', 'j3'), ui.bhor, ui.bbol, ui.btre, ui.mas, ui.sur, ui.nor, ui.ayuda, ui.salir),
            con(el('div', 'jvista'), ui.bvista, ui.estacion, ui.detalles));
    }
    const pan = el('section'); pan.id = 'jpanel'; pan.hidden = true;
    const ficha = el('aside'); ficha.id = 'jest'; ficha.hidden = true;
    const avisos = el('div'); avisos.id = 'javisos'; avisos.setAttribute('aria-live', 'polite');
    const tutBox = el('div'); tutBox.id = 'jtut'; tutBox.hidden = true;
    const dec = el('div'); dec.id = 'jdec'; dec.hidden = true;
    const fin = el('div'); fin.id = 'jfin'; fin.hidden = true;
    $('#stage').append(hud, pan, ficha, avisos, tutBox, dec, fin);
    const situarPaneles = () => document.documentElement.style.setProperty('--juego-hud-bottom', `${Math.ceil(hud.getBoundingClientRect().bottom) + 8}px`);
    new ResizeObserver(situarPaneles).observe(hud);
    addEventListener('resize', situarPaneles);

    /** Un aviso que se va solo. Si nombra una estación, al tocarlo se la abre. */
    const avisar = (a) => {
        // Lo que pasa en la ciudad (un cierre, un evento que termina) se mira en el mapa: el aviso lleva hasta ahí.
        const alMapa = () => { if (vista) verDentro(''); ficha.hidden = true; const f = (Q.ciudad && Q.ciudad.foco && Q.ciudad.foco()) || (reales && a.i >= 0 ? M.metro.est[a.i] : null); if (f) M.irA(f.x, f.y); refrescar(); };
        const d = boton(a.texto + (a.mapa ? ' Ver en el mapa ▸' : ''), () => { if (sim) { if (a.mapa) alMapa(); else if (a.i >= 0) elegir(a.i, true); } d.remove(); }, 'aviso ' + (a.tipo || 'info'));
        avisos.prepend(d); while (avisos.children.length > (angosta() ? 2 : 3)) avisos.lastChild.remove();
        setTimeout(() => d.remove(), 10000);
        if (a.sonido === 'tren') son('dispatch'); else son('notify', a.tipo);
    };

    // ───── Los paneles: horario, boleterías y trenes ─────
    const cerrarPanel = () => { panel = ''; panelAct = null; pan.hidden = true; pan.textContent = ''; [ui.bhor, ui.bbol, ui.btre].forEach((b) => b.classList.remove('on')); };
    const cabecera = (titulo) => { const x = boton('×', cerrarPanel, 'cerrar'); x.setAttribute('aria-label', 'Cerrar'); return con(el('header'), el('h3', '', titulo), x); };
    const PANELES = {
        // El horario: un intervalo por franja, junto al pronóstico de viajes.
        horario() {
            const nota = el('p', 'nota'), pro = sim.pronostico(), tope = Math.max(...pro, 1);
            pan.append(cabecera(sim.finde ? 'Horario · fin de semana y feriados' : 'Horario · entre semana'), nota);
            const filas = sim.franjas.map((f, i) => {
                const k = () => JEFE.INTERVALOS.indexOf(sim.horario[i]);
                const poner = (j) => { orden('horario', i, JEFE.INTERVALOS[clamp(j, 0, JEFE.INTERVALOS.length - 1)]); guardarHorario(); pintar(); tutRevisar(); };
                const menos = boton('−', () => poner(k() - 1), 'menos', 'Más seguido'), mas = boton('+', () => poner(k() + 1), 'mas', 'Más espaciado');
                const cada = el('span', 'cada'), barra = el('i'), cuanto = el('span', 'pro');
                const fila = con(el('div', 'franja'), el('span', 'nombre', f.n), con(el('span', 'horas'), `${hhmm(f.de * 60)}–${hhmm(f.a * 60)} · `, cuanto), con(el('span', 'prob'), barra), menos, cada, mas);
                pan.append(fila);
                return { fila, menos, mas, cada, barra, cuanto, f, i, k };
            });
            // La sugerencia: un horario armado con el pronóstico, para las franjas que todavía no pasan.
            const sugerir = boton('Sugerir horario', () => {
                const sug = sim.sugerir(), cambia = [];
                sim.franjas.forEach((f, i) => { if ((f.a * 60 > sim.t || i === sim.franjas.length - 1) && sug[i] !== sim.horario[i]) { orden('horario', i, sug[i]); cambia.push(`${f.n.toLowerCase()} cada ${sug[i]}`); } });
                guardarHorario(); sugerido = true; son('click');
                avisar({ tipo: 'info', texto: cambia.length ? `Horario sugerido: ${cambia.join(', ')}. No sabe de la caja ni de imprevistos: ajústalo a tu gusto.` : 'El horario ya coincide con lo que sugiere el pronóstico.', i: -1 });
                pintar(); tutRevisar();
            }, 'sugerir', 'Arma un horario a partir del pronóstico de viajes de hoy');
            if (puede('sugerir')) pan.append(con(el('div', 'acciones'), sugerir));
            const pintar = () => {
                const ahora = sim.franjaDe(sim.t / 60), abierto = sim.t < sim.cierra, p = sim.pronostico(), corto = sim.tramo[0] > 0 || sim.tramo[1] < N - 1;
                nota.textContent = `Cada cuántos minutos sale un tren de cada cabecera. Tienes ${sim.flota} trenes: menos intervalo es menos espera, pero más trenes rodando y más gasto.` + (sim.finde ? ' Este horario vale para sábados, domingos y feriados; el de entre semana se guarda aparte.' : '') + (corto ? ` Ahora los trenes circulan solo entre ${sim.est[sim.tramo[0]].n} y ${sim.est[sim.tramo[1]].n}.` : '');
                for (const q of filas) {
                    const ultima = q.i === sim.franjas.length - 1, fuera = q.f.a * 60 <= sim.abre || (q.f.de * 60 >= sim.cierra), pasada = q.f.a * 60 <= sim.t && !ultima || !abierto;
                    const cada = sim.horario[q.i], hacen = sim.trenesPara(cada), k = q.k();
                    q.fila.className = 'franja' + (q.i === ahora && abierto && !fuera ? ' ahora' : '') + (fuera ? ' fuera' : pasada && q.i !== ahora ? ' pasada' : '');
                    q.cada.className = 'cada' + (hacen > sim.flota ? ' falta' : '');
                    q.cada.textContent = fuera ? 'cerrado' : `cada ${cada} min · ${hacen} trenes`;
                    q.cada.title = hacen > sim.flota ? 'No hay tantos trenes: saldrán cuando haya uno libre' : '';
                    q.menos.disabled = fuera || k <= 0; q.mas.disabled = fuera || k >= JEFE.INTERVALOS.length - 1;
                    q.cuanto.textContent = fuera ? '—' : `≈ ${miles(p[q.i] / 1000)} mil viajes`;
                    q.barra.style.width = Math.round(p[q.i] / Math.max(tope, ...p) * 100) + '%';
                }
                sugerir.disabled = !abierto;
            };
            return pintar;
        },
        // Las boleterías de las 15 estaciones, de un vistazo.
        boleterias() {
            const nota = el('p', 'nota');
            pan.append(cabecera('Boleterías'), nota);
            const filas = sim.est.map((e) => {
                const poner = (n) => { orden('ventanillas', e.i, clamp(n, 0, 5)); partida.ventanillas = sim.est.map((q) => q.ventanillas); pintar(); tutRevisar(); };
                const nombre = boton(e.n, () => elegir(e.i, true), 'nombre'), cola = el('span', 'cola'), v = el('b'), maq = el('span', 'maq');
                const menos = boton('−', () => poner(e.ventanillas - 1), 'menos', 'Cerrar una ventanilla'), mas = boton('+', () => poner(e.ventanillas + 1), 'mas', 'Abrir una ventanilla');
                const comprar = boton('+', () => { if (disponible() < JEFE.COSTO.maquina) return; orden('maquina', e.i); son('purchase'); pintar(); }, 'compra', `Comprar una máquina de boletos: ${plata(JEFE.COSTO.maquina)}`);
                const fila = con(el('div', 'bol'), nombre, cola, menos, v, mas, maq, comprar);
                pan.append(fila);
                return { e, fila, cola, v, maq, menos, mas, comprar };
            });
            const pintar = () => {
                nota.textContent = `El ${Math.round(sim.tarjeta * 100)}% entra con tarjeta, sin fila. El resto paga en ventanilla (${plata(JEFE.COSTO.ventanillaHora)} la hora cada una) o en máquina (${plata(JEFE.COSTO.maquina)}). En caja: ${plata(disponible())}.` + (partida.jefes && dia >= 0 ? ' Los jefes de estación ajustan las ventanillas por su cuenta.' : '');
                for (const q of filas) {
                    const e = q.e, cerrada = sim.cerrada(e.i), rotas = sim.maquinasRotas.filter((r) => r.i === e.i && r.hasta > sim.t).length;
                    q.fila.className = 'bol' + (cerrada ? ' cerrada' : e.esperaB > 4 ? ' mal' : e.esperaB > 2 ? ' regular' : '') + (e.i === sel ? ' sel' : '');
                    q.cola.textContent = cerrada ? 'cerrada' : e.colaTotal < 3 ? 'sin fila' : `${miles(e.colaTotal)} · ${e.esperaB > 60 ? '∞' : coma(e.esperaB)} min`;
                    q.v.textContent = String(e.ventanillas); q.menos.disabled = e.ventanillas <= 0; q.mas.disabled = e.ventanillas >= 5;
                    q.maq.textContent = `${e.maquinas} máq.` + (rotas ? ` (${rotas} mal)` : ''); q.maq.className = 'maq' + (rotas ? ' mal' : '');
                    q.comprar.disabled = disponible() < JEFE.COSTO.maquina;
                }
            };
            return pintar;
        },
        // La flota, tren por tren.
        trenes() {
            const nota = el('p', 'nota');
            pan.append(cabecera('Trenes'), nota);
            const filas = sim.trenes.map((t) => {
                const estado = el('span', 'estado'), barra = el('i'), pct = el('span', 'pct');
                const fila = boton('', () => elegirTren(t.id, true), 'tren');
                con(fila, el('strong', '', 'T' + String(t.id).padStart(2, '0')), estado, con(el('span', 'carga'), barra), pct);
                pan.append(fila);
                return { t, fila, estado, barra, pct };
            });
            const pintar = () => {
                const guardados = sim.trenes.filter((t) => t.estado === 'cochera').length;
                nota.textContent = `${sim.enServicio()} en servicio y ${guardados} guardados, de ${sim.flota}.` + (sim.enTaller ? ` Hoy hay ${sim.enTaller} en el taller todo el día.` : '') + ' Toca un tren para verlo.';
                for (const q of filas) {
                    const t = q.t, l = t.total / JEFE.CAPACIDAD;
                    q.fila.className = 'tren' + (t.id === selTren ? ' on' : '') + (t.estado === 'averiado' ? ' mal' : activo(t) || t.estado === 'vuelta' ? '' : ' quieto');
                    q.estado.textContent = estadoTren(t);
                    q.barra.style.width = Math.round(clamp(l, 0, 1) * 100) + '%'; q.barra.className = l > 0.95 ? 'mal' : l > 0.7 ? 'regular' : '';
                    q.pct.textContent = activo(t) ? Math.round(l * 100) + '%' : '';
                }
            };
            return pintar;
        },
    };
    const abrirPanel = (nombre) => {
        if (!sim) return;
        if (panel === nombre) { cerrarPanel(); return; }
        cerrarPanel(); panel = nombre; pan.hidden = false; pan.className = nombre;
        ({ horario: ui.bhor, boleterias: ui.bbol, trenes: ui.btre })[nombre].classList.add('on');
        panelAct = PANELES[nombre](); panelAct();
        if (angosta() && !vista) cerrarFicha();
        tutRevisar();
    };
    const estadoTren = (t) => {
        const cab = sim.est[sim.tramo[t.cab]].n, e = sim.est[t.sig];
        if (t.estado === 'cochera') return `Guardado en ${t.cab ? 'El Labrador' : 'Quitumbe'}`;
        if (t.estado === 'taller') return t.vuelve ? `En el taller hasta las ${hhmm(t.vuelve)}` : 'En el taller';
        if (t.estado === 'averiado') return `Averiado cerca de ${e.n}`;
        if (t.estado === 'vuelta' || t.estado === 'listo') return `Da la vuelta en ${cab}`;
        return `${t.dir ? '◂' : '▸'} ${t.estado === 'parada' ? 'en' : 'hacia'} ${e.n}`;
    };

    // ───── La ficha: una estación o un tren ─────
    const cerrarFicha = () => { sel = -1; selTren = 0; fichaAct = null; ficha.hidden = true; ficha.textContent = ''; if (vista) verDentro(''); };
    const ocultarFicha = () => { if (vista) ficha.hidden = true; else cerrarFicha(); refrescar(); };
    const par = (dl, k) => { const d = el('div'), dd = el('dd'); con(d, el('dt', '', k), dd); dl.append(d); return { d, dd }; };
    const fichaEstacion = () => {
        const e = sim.est[sel], a = e.anden;
        ficha.hidden = false; ficha.textContent = ''; ficha.className = 'estacion';
        const cerrar = boton('×', ocultarFicha, 'cerrar'); cerrar.setAttribute('aria-label', 'Cerrar');
        const zona = el('p', 'zona'), dl = el('dl', 'datos');
        const animo = par(dl, 'Ánimo'), entradas = par(dl, 'Entradas hoy'), idos = par(dl, 'Se fueron sin viajar');
        const norte = sel < N - 1 ? par(dl, 'Andén al norte') : null, sur = sel > 0 ? par(dl, 'Andén al sur') : null, cola = par(dl, 'Fila de la boletería');
        const dentro = boton('', () => verDentro(vista === 'est' ? '' : 'est'), 'dentro', 'Tecla I');
        const poner = (n) => { orden('ventanillas', e.i, clamp(n, 0, 5)); partida.ventanillas = sim.est.map((q) => q.ventanillas); pintar(); tutRevisar(); };
        const vm = boton('−', () => poner(e.ventanillas - 1), 'vmenos', 'Cerrar una ventanilla'), vp = boton('+', () => poner(e.ventanillas + 1), 'vmas', 'Abrir una ventanilla'), vb = el('b'), mb = el('b');
        const comprar = boton(`Comprar otra · ${plata(JEFE.COSTO.maquina)}`, () => { if (disponible() < JEFE.COSTO.maquina) return; orden('maquina', e.i); son('purchase'); pintar(); });
        const nota = el('p', 'nota'), mandos = el('div', 'mandos');
        con(mandos,
            con(el('div', 'fila'), el('span', 'nombre', 'Ventanillas abiertas'), vm, vb, vp, el('span', 'nota', `${plata(JEFE.COSTO.ventanillaHora)} la hora cada una · efectivo`)),
            con(el('div', 'fila'), el('span', 'nombre', 'Máquinas de boletos'), mb, comprar, el('span', 'nota', 'efectivo justo o tarjeta bancaria')), nota);
        const aun = el('p', 'nota', 'Hoy las boleterías las lleva el Puesto Central. Desde el martes las manejas tú.');
        mandos.hidden = !puede('boleterias'); aun.hidden = puede('boleterias');
        ficha.append(cerrar, zona, el('h2', '', e.n), dl, dentro, mandos, aun);
        const espera = (x) => (x.total > 1 ? coma(x.edad / x.total) + ' min' : '—');
        const pintar = () => {
            const cerrada = sim.cerrada(sel), rotas = sim.maquinasRotas.filter((r) => r.i === sel && r.hasta > sim.t).length;
            zona.textContent = `Estación ${sel + 1} de ${N}` + (cerrada ? ' · cerrada: los trenes pasan de largo' : ''); zona.className = 'zona' + (cerrada ? ' mal' : '');
            animo.dd.textContent = String(Math.round(e.animo)); animo.d.className = e.animo < 55 ? 'mal' : '';
            entradas.dd.textContent = miles(e.entradas); idos.dd.textContent = miles(e.idos); idos.d.className = e.idos > 300 ? 'mal' : '';
            if (norte) { norte.dd.textContent = `${miles(a[0].total)} · ${espera(a[0])}`; norte.d.className = a[0].total > JEFE.CAPACIDAD ? 'mal' : ''; }
            if (sur) { sur.dd.textContent = `${miles(a[1].total)} · ${espera(a[1])}`; sur.d.className = a[1].total > JEFE.CAPACIDAD ? 'mal' : ''; }
            cola.dd.textContent = `${miles(e.colaTotal)} · ${e.esperaB > 60 ? 'sin atención' : coma(e.esperaB) + ' min'}`; cola.d.className = e.esperaB > 4 ? 'mal' : '';
            dentro.textContent = vista === 'est' ? '← Volver al mapa' : 'Ver la estación por dentro'; dentro.classList.toggle('on', vista === 'est');
            vb.textContent = String(e.ventanillas); vm.disabled = e.ventanillas <= 0; vp.disabled = e.ventanillas >= 5;
            mb.textContent = String(e.maquinas) + (rotas ? ` (${rotas} dañada${rotas > 1 ? 's' : ''})` : ''); comprar.disabled = disponible() < JEFE.COSTO.maquina;
            nota.textContent = vista === 'est' && puede('boleterias') ? 'Aquí también puedes tocar una ventanilla para abrirla o cerrarla, y la casilla con el signo + para comprar una máquina.' : `El ${Math.round(sim.tarjeta * 100)}% entra con tarjeta, sin hacer fila. El resto paga los 45 centavos en ventanilla o en máquina.`;
        };
        fichaAct = pintar; pintar();
    };
    const fichaTren = () => {
        const t = sim.trenes.find((q) => q.id === selTren); if (!t) { cerrarFicha(); return; }
        ficha.hidden = false; ficha.textContent = ''; ficha.className = 'untren';
        const cerrar = boton('×', ocultarFicha, 'cerrar'); cerrar.setAttribute('aria-label', 'Cerrar');
        const zona = el('p', 'zona', `Tren ${t.id} de ${sim.flota} · seis vagones`), h2 = el('h2'), dl = el('dl', 'datos');
        const estado = par(dl, 'Dónde está'), carga = par(dl, 'Pasajeros'), llega = par(dl, 'Llega en'), km = par(dl, 'Recorrido hoy');
        const dentro = boton('', () => verDentro(vista === 'tren' ? '' : 'tren'), 'dentro', 'Tecla I');
        const ir = boton('Buscarlo en el mapa', () => { if (vista) verDentro(''); const q = M.enCamino(M.metro.p, M.metro.a, clamp(largos[0] + t.s, 0, M.metro.largo)); M.irA(q[0], q[1]); });
        const nota = el('p', 'nota', 'Cada tren lleva hasta 1.230 personas. Con más del 70% la gente ya va incómoda, y con el tren lleno, quien espera en el andén lo ve pasar.');
        ficha.append(cerrar, zona, h2, dl, dentro, con(el('div', 'mandos'), ir, nota));
        const pintar = () => {
            const l = t.total / JEFE.CAPACIDAD, min = etaTren(t);
            h2.textContent = `Tren ${t.id}` + (activo(t) ? ` · al ${t.dir ? 'sur' : 'norte'}` : '');
            estado.dd.textContent = estadoTren(t); estado.d.className = t.estado === 'averiado' ? 'mal' : '';
            carga.dd.textContent = `${miles(t.total)} · ${Math.round(l * 100)}%`; carga.d.className = l > 0.95 ? 'mal' : '';
            llega.dd.textContent = t.estado === 'viaje' && min !== null ? `${Math.max(1, Math.ceil(min))} min` : '—';
            km.dd.textContent = `${miles(t.km)} km`;
            dentro.textContent = vista === 'tren' ? '← Volver al mapa' : 'Ver el tren por dentro'; dentro.classList.toggle('on', vista === 'tren');
            ir.disabled = !reales || !activo(t);
        };
        fichaAct = pintar; pintar();
    };
    const verDentro = (v) => {
        vista = (v === 'est' && sel >= 0) || (v === 'tren' && selTren > 0) ? v : '';
        document.body.classList.toggle('dentro', !!vista);
        if (vista) cerrarPanel();
        if (fichaAct) fichaAct();
        tutRevisar();
    };
    const elegir = (i, centrar) => {
        if (sel !== i) son('select');
        const eraTren = selTren > 0; sel = i; selTren = 0;
        if (vista === 'tren') vista = '', document.body.classList.remove('dentro');
        if (eraTren || !fichaAct || ficha.className !== 'estacion' || ficha.dataset.i !== String(i)) { fichaEstacion(); ficha.dataset.i = String(i); } else fichaAct();
        ficha.hidden = false;
        if (angosta() && !vista) cerrarPanel();
        if (centrar && reales && !vista) { const e = M.metro.est[i]; M.irA(e.x, e.y); }
        tutRevisar();
    };
    const elegirTren = (id, centrar) => {
        if (selTren !== id) son('select');
        selTren = id; sel = -1; ficha.dataset.i = '';
        if (vista === 'est') vista = '', document.body.classList.remove('dentro');
        fichaTren();
        if (angosta() && !vista) cerrarPanel();
        const t = sim.trenes.find((q) => q.id === id);
        if (centrar && reales && !vista && t && activo(t)) { const q = M.enCamino(M.metro.p, M.metro.a, clamp(largos[0] + t.s, 0, M.metro.largo)); M.irA(q[0], q[1]); }
        tutRevisar();
    };

    // ───── Cuánto falta para el próximo tren ─────
    const velocidad = () => sim.L / (34 - (N - 2) * 0.4);
    const entre = (a, b) => sim.est.filter((q) => q.pos > Math.min(a, b) + 1 && q.pos < Math.max(a, b) - 1 && !sim.cerrada(q.i)).length;
    /** Minutos que faltan para el próximo tren en la estación `i`, en ese sentido (0 al norte, 1 al sur). */
    const etaEn = (i, dir) => {
        const e = sim.est[i]; let mejor = null;
        if (sim.cerrada(i)) return null;
        for (const t of sim.trenes) {
            if (t.dir !== dir || !activo(t) || t.estado === 'vuelta') continue;
            const d = (e.pos - t.s) * (dir === 0 ? 1 : -1); if (d < -1) continue;
            if (d < 1 && t.estado === 'parada') return 0;
            const min = d / velocidad() + entre(t.s, e.pos) * 0.5 + (t.estado === 'parada' || t.estado === 'averiado' ? Math.max(0, t.espera) : 0);
            if (mejor === null || min < mejor) mejor = min;
        }
        if (mejor === null && sim.t < sim.cierra && (sim.disponibles(dir) || sim.trenes.some((t) => t.estado === 'listo' && t.cab === dir))) {
            const cab = sim.est[sim.tramo[dir]].pos;     // todavía no sale: lo que falta para la próxima salida, más el viaje hasta aquí
            if ((e.pos - cab) * (dir === 0 ? 1 : -1) >= 0) mejor = Math.max(0, sim.horario[sim.franjaDe(sim.t / 60)] - (sim.t - sim.ultimo[dir])) + Math.abs(e.pos - cab) / velocidad() + entre(cab, e.pos) * 0.5;
        }
        return mejor;
    };
    const etaTren = (t) => (activo(t) ? Math.abs(sim.est[t.sig].pos - t.s) / velocidad() + (t.estado === 'averiado' ? Math.max(0, t.espera) : 0) : null);

    // ───── Las decisiones ─────
    const mostrarDecision = (ev) => {
        decision = ev; velAntes = vel || velAntes || 1; vel = 0;
        dec.hidden = false; dec.textContent = '';
        const caja = el('div', 'caja');
        caja.append(el('p', 'zona', `Puesto Central · ${hhmm(sim.t)}` + (ev.est !== undefined ? ` · ${sim.est[ev.est].n}` : '')), el('h2', '', ev.titulo), el('p', 'texto', ev.texto));
        if (tut.on && PASOS[tut.k] && PASOS[tut.k].decision) caja.append(el('p', 'consejo', textoPaso(PASOS[tut.k])));
        ev.opciones.forEach((op, k) => {
            const b = boton('', () => { dec.hidden = true; decision = null; orden('decidir', ev.id, k); vel = velAntes; son('select'); refrescar(); }, 'opcion');
            con(b, el('strong', '', op.t), el('span', '', op.d));
            caja.append(b);
        });
        dec.append(caja); son('notify', 'info');
        if (reales && ev.est !== undefined && !vista) { const e = M.metro.est[ev.est]; M.irA(e.x, e.y); }
        refrescar();
    };

    // ───── Las guías ─────
    // La primera vez que se juega cada día de la semana, el Puesto Central presenta en pocos pasos lo que trae de nuevo.
    const correr = () => { if (!vel && !decision) vel = 1; };
    const franja = (i, que) => { const f = pan.querySelectorAll('.franja')[i]; return f && f.querySelector(que); };
    const GUIAS = [
        [   // Lunes: lo básico y el horario
            { t: 'Aquí Puesto Central. Hoy recibes la Línea 1: 22 kilómetros y 15 estaciones, de Quitumbe a El Labrador. Te la voy entregando de a poco: hoy solo decides el horario. De las boleterías me encargo yo.', sig: true, pausa: true },
            { t: 'Abajo está la línea entera, estirada. Cada cuadro es una estación y su color es el ánimo de la gente ahí. Las barras claras son quienes esperan (hacia arriba, al norte; hacia abajo, al sur) y los trenes son las barras que se mueven.', sig: true, pausa: true, tira: true },
            { t: 'Los trenes salen cada 8 minutos todo el día, y en el pico de la mañana no va a alcanzar. Abre el Horario.', foco: () => [ui.bhor], espera: () => panel === 'horario', pausa: true },
            { t: () => `Con el botón −, baja el «Pico de la mañana» a un tren cada 5 minutos. Al lado ves cuántos trenes pide ese ritmo: tienes ${sim.flota}.`, foco: () => [franja(1, '.menos')], espera: () => sim.horario[1] <= 5, pausa: true, alEntrar: () => { if (panel !== 'horario') abrirPanel('horario'); } },
            { t: 'Ahora haz lo mismo con el «Pico de la tarde». En las demás franjas mira la barra verde, que es el pronóstico de viajes: donde es corta puedes espaciar los trenes, porque cada tren cuesta por kilómetro.', foco: () => [franja(5, '.menos')], espera: () => sim.horario[5] <= 5, pausa: true, alEntrar: () => { if (panel !== 'horario') abrirPanel('horario'); } },
            { t: 'Arriba está el ánimo: la nota que pone la gente, de 0 a 100, con una raya blanca en la meta de hoy. «Hoy» es la caja del día. Para las tres estrellas hacen falta mucho ánimo y no cerrar en rojo.', foco: () => [ui.barra.parentNode, ui.caja.parentNode], sig: true, pausa: true, alEntrar: () => { if (angosta()) cerrarPanel(); } },
            { t: 'Eso es todo por hoy. Pulsa ×1 para que el día corra: con ×2 y ×4 pasas rápido las horas tranquilas, y puedes pausar cuando quieras. Para cambiar de estación, tócala en la línea de abajo; «Ver mapa» te saca a la ciudad.', foco: () => [ui.vel.children[1]], espera: () => vel > 0, pausa: true },
        ],
        [   // Martes: las boleterías
            { t: 'Desde hoy las boleterías son tuyas. Quien tiene tarjeta pasa directo; el resto paga los 45 centavos en una ventanilla, en efectivo, o en una máquina, con efectivo justo o tarjeta bancaria. Si la fila pasa de cinco minutos, la gente se va.', sig: true, pausa: true },
            { t: 'Abre «Boleterías».', foco: () => [ui.bbol], espera: () => panel === 'boleterias', pausa: true },
            { t: 'Aquí están las 15 estaciones, cada una con su fila. Abre una ventanilla más en Quitumbe con el botón +.', foco: () => [pan.querySelector('.bol .mas')], espera: () => sim.est[0].ventanillas >= 3, pausa: true, alEntrar: () => { if (panel !== 'boleterias') abrirPanel('boleterias'); } },
            { t: 'Cada ventanilla abierta cuesta $9 la hora: ábrelas en los picos y ciérralas cuando no haya fila. Una máquina cuesta $2.500 y se queda para siempre. En la línea de abajo, la barrita amarilla junto a una estación es su fila; cuando se pone roja, ya es larga.', sig: true, pausa: true, tira: true, alEntrar: () => { if (angosta()) cerrarPanel(); } },
            { t: 'También puedes abrir y cerrar ventanillas tocándolas dentro de la estación. Y desde hoy la tienda ofrece mejoras: pasa por ella antes de cada turno.', sig: true, pausa: true },
        ],
        [   // Miércoles: los trenes de refuerzo
            { t: 'Hoy tienes trenes en el taller y hay fallas pendientes. Desde hoy también mandas los refuerzos.', sig: true, pausa: true },
            { t: '«Tren extra» saca un tren vacío de una cabecera sin esperar al horario. Sirve cuando un andén se llena o cuando una avería deja un hueco. Pruébalo ahora con cualquiera de los dos.', foco: () => [ui.sur, ui.nor], espera: () => sim.cuenta.refuerzos > 0 || (!sim.disponibles(0) && !sim.disponibles(1)), pausa: true },
            { t: 'En «Trenes» está toda la flota: dónde va cada tren y qué tan lleno. Ábrelo y toca un tren.', foco: () => (panel === 'trenes' ? [...pan.querySelectorAll('.tren:not(.quieto)')].slice(0, 1) : [ui.btre]), espera: () => selTren > 0, pausa: true },
            { t: 'Cada tren se puede ver por dentro con el botón de su ficha: los asientos se llenan primero y después el pasillo. Cuando va apretado, a esa hora hace falta otro.', sig: true, pausa: true },
        ],
        [   // Jueves: las decisiones
            { t: 'Desde hoy, cuando pase algo, te consulto: el reloj se detiene y eliges. No hay respuesta perfecta; cada opción cuesta plata, tiempo o ánimo. La primera consulta llega enseguida.', sig: true, pausa: true },
            { t: 'El reloj se detiene hasta que elijas. Lee lo que cuesta cada opción.', decision: true, espera: () => sim.elegidas.colegio !== undefined && !decision, alEntrar: correr },
        ],
        [   // Viernes: los cierres por lluvia
            { t: 'Hoy puede granizar. Si entra agua a una estación, se cierra: nadie entra y los trenes pasan de largo. En la línea de abajo se marca con una equis roja.', sig: true, pausa: true, tira: true },
            { t: 'Si se cierran varias seguidas, los trenes dan la vuelta antes y la línea queda más corta. Con los mismos trenes puedes dar mejor frecuencia al tramo que sigue abierto: cuando pase, revisa el Horario.', sig: true, pausa: true },
        ],
        [   // Sábado: el horario de fin de semana y la sugerencia
            { t: 'Sábado: el Metro abre a las 07:00, no hay picos de oficina y entra menos plata. Los fines de semana y los feriados tienen sus propias franjas y su propio horario, que se guarda aparte del de entre semana. Abre el Horario.', foco: () => [ui.bhor], espera: () => panel === 'horario', pausa: true },
            { t: 'Mira los nombres: «Tarde de paseo», «Vuelta a casa»… Pulsa «Sugerir horario»: arma uno a partir de la barra verde, que es el pronóstico de viajes de cada franja.', foco: () => [pan.querySelector('.sugerir')], espera: () => sugerido, pausa: true, alEntrar: () => { if (panel !== 'horario') abrirPanel('horario'); } },
            { t: 'La sugerencia no sabe de imprevistos ni de la caja: es un punto de partida. El reto de hoy es cerrar a favor, así que donde la barra es corta puedes espaciar todavía más. El domingo usará este mismo horario.', sig: true, pausa: true },
        ],
        [   // Domingo: todo junto
            { t: 'Día de Quito: feriado, desfile, aguacero, concierto y un tren menos. Hoy no hay nada nuevo que aprender; ya tienes todas las herramientas.', sig: true, pausa: true },
            { t: 'Ojo con el horario: es el mismo de ayer, que estaba hecho para cuidar la caja de un sábado. Hoy el pico es al mediodía, con el desfile, y en la noche, con el concierto. Abre el Horario y pide una sugerencia para hoy; después ajústala. Suerte.', foco: () => [panel === 'horario' ? pan.querySelector('.sugerir') : ui.bhor], espera: () => sugerido, pausa: true },
        ],
    ];
    let PASOS = GUIAS[0];
    const textoPaso = (p) => (typeof p.t === 'function' ? p.t() : p.t);
    const tut = { on: false, k: 0, focos: [] };
    const tutLimpiar = () => { tut.focos.forEach((e) => e.classList.remove('tut-foco')); tut.focos = []; };
    /** En el teléfono la guía va entre el panel de arriba y las hojas: hay que decirle a la hoja de estilos cuánto ocupa. */
    const medirGuia = () => document.documentElement.style.setProperty('--guia', tutBox.hidden ? '0px' : `${tutBox.offsetHeight + 6}px`);
    const tutFin = () => { tutLimpiar(); tut.on = false; tutBox.hidden = true; medirGuia(); };
    const tutPintar = () => {
        const p = PASOS[tut.k]; tutBox.textContent = '';
        const pie = el('div', 'acciones');
        if (p.sig) pie.append(boton('Siguiente', () => tutIr(tut.k + 1), 'on'));
        else if (p.hasta) pie.append(el('span', 'nota', vel ? 'El reloj corre…' : 'El reloj está en pausa: pulsa ×1.'));
        else pie.append(el('span', 'nota', 'Hazlo para seguir.'));
        pie.append(boton('Saltar la guía', guiaHecha, 'chico'));
        tutBox.append(el('p', 'zona', `Puesto Central · ${tut.k + 1} de ${PASOS.length}`), el('p', 'texto', textoPaso(p)), pie);
        tutBox.hidden = !!(p.decision && decision); medirGuia();
    };
    /** Empieza la guía del día `k` de la semana. */
    const guiar = (k) => { PASOS = GUIAS[k]; tutIr(0); };
    /** La guía del día terminó (o se saltó): no vuelve a salir sola, y el reloj sigue. */
    function guiaHecha() {
        tutFin();
        if (dia < DIAS.length && !partida.guias[dia]) { partida.guias[dia] = true; guardar(); }
        correr(); refrescar();
    }
    function tutIr(k) {
        tutLimpiar();
        if (sim && k >= PASOS.length) { guiaHecha(); return; }
        if (!sim) { tut.on = false; tutBox.hidden = true; return; }
        tut.on = true; tut.k = k;
        const p = PASOS[k];
        if (p.pausa) vel = 0;
        if (p.alEntrar) p.alEntrar();
        tutPintar(); son('select'); refrescar();
    }
    /** ¿Ya hizo lo que se le pidió? Entonces, al paso siguiente. */
    function tutRevisar() {
        if (!tut.on || !sim) return;
        const p = PASOS[tut.k];
        if ((p.espera && p.espera()) || (p.hasta && sim.t / 60 >= p.hasta)) { tutIr(tut.k + 1); return; }
        // El foco se vuelve a buscar cada vez: los paneles se abren y se cierran.
        const focos = (p.foco ? p.foco() : []).filter(Boolean);
        if (focos.length !== tut.focos.length || focos.some((e, i) => e !== tut.focos[i])) {
            tutLimpiar(); tut.focos = focos; focos.forEach((e) => e.classList.add('tut-foco'));
            if (focos[0] && pan.contains(focos[0])) focos[0].scrollIntoView({ block: 'center' });      // lo que hay que tocar, a la vista
        }
        tutBox.hidden = !!(p.decision && decision); medirGuia();
        const nota = tutBox.querySelector('.acciones .nota'); if (nota && p.hasta) nota.textContent = vel ? 'El reloj corre…' : 'El reloj está en pausa: pulsa ×1.';
    }

    // ───── Lo que cambia todo el tiempo ─────
    const refrescar = () => {
        if (!sim) return;
        const a = sim.animo, meta = D.meta, b = sim.balance(), cerro = sim.t >= sim.cierra;
        ui.hora.textContent = hhmm(sim.t) + (cerro ? ' · cerrando' : '');
        ui.animo.textContent = Math.round(a); ui.barra.style.width = clamp(a, 0, 100) + '%';
        ui.barra.className = !meta || a >= meta ? 'bien' : a >= meta - 10 ? 'regular' : 'mal'; ui.meta.style.left = meta + '%'; ui.meta.hidden = !meta;
        ui.caja.textContent = plata(b); ui.caja.className = b < 0 ? 'rojo' : '';
        ui.viajes.textContent = miles(sim.cuenta.viajes); ui.trenes.textContent = `${sim.enServicio()}/${sim.flota}`;
        ui.sur.disabled = !sim.disponibles(0) || cerro; ui.nor.disabled = !sim.disponibles(1) || cerro;
        [...ui.vel.children].forEach((bt, i) => { bt.classList.toggle('on', i === vel); bt.disabled = !!decision; });
        ui.vel.children[0].textContent = vel ? 'Pausar' : 'Reanudar';
        const estado = decision ? 'Elige una opción para continuar' : vel ? `En marcha · ×${[0, 1, 2, 4][vel]}` : 'En pausa';
        if (ui.estado.textContent !== estado) ui.estado.textContent = estado;
        ui.estado.classList.toggle('pausa', !vel);
        ui.bvista.textContent = vista ? 'Ver mapa' : 'Ver interior';
        if (sel >= 0) ui.estacion.value = sel;
        ui.detalles.textContent = ficha.hidden ? (selTren ? 'Ver tren' : 'Gestionar estación') : 'Ocultar detalles';
        ui.detalles.setAttribute('aria-expanded', String(!ficha.hidden));
        // Las misiones aceptadas: cómo va hoy cada una.
        const act = partida.misiones.activas.map((a) => [a, misionDe(a.id)]).filter(([, m]) => m);
        if (ui.misiones.dataset.n !== String(act.length)) { ui.misiones.textContent = ''; act.forEach(() => ui.misiones.append(el('p', 'jreto jmision'))); ui.misiones.dataset.n = String(act.length); }
        act.forEach(([a, m], q) => {
            const p = ui.misiones.children[q], ok = m.suma ? a.prog + m.medida(sim) >= m.suma : m.ok(sim, { est: estrellasDe(sim.animoDia(), sim.balance(), D.meta), D });
            p.textContent = `Misión: ${m.n} · ${m.valor(sim, { est: estrellasDe(sim.animoDia(), sim.balance(), D.meta) })} · ${m.suma ? `${miles(a.prog + m.medida(sim))} de ${miles(m.suma)}` : `${a.prog} de ${m.veces}`}`;
            p.className = 'jreto jmision' + (ok ? ' bien' : '');
        });
        if (D.reto) { const ok = D.reto.ok(sim); ui.reto.textContent = `Reto: ${D.reto.t.charAt(0).toLowerCase() + D.reto.t.slice(1)} · ${D.reto.valor(sim)}`; ui.reto.className = 'jreto' + (ok ? ' bien' : ''); ui.reto.hidden = false; } else ui.reto.hidden = true;
        if (fichaAct) fichaAct();
        if (panelAct) panelAct();
        // Las hojas se apoyan sobre la tira de abajo, que es parte del dibujo: hay que decirle a la hoja de estilos cuánto mide.
        const r = $('#view').getBoundingClientRect(), raiz = document.documentElement.style;
        raiz.setProperty('--tira', Math.round(r.height * extra.alto / Q.H) + 'px'); raiz.setProperty('--hud', hud.offsetHeight + 'px');
        tutRevisar();
    };

    // ───────────────────────── Empezar y terminar un día ─────────────────────────
    /** El turno sin fin de esta partida; si todavía no existe, lo crea con una semilla nueva. */
    const sinFin = () => { if (!partida.sinfin) partida.sinfin = { n: DIAS.length + 1, semilla: Math.floor(Math.random() * 1e9), mejor: 0 }; return partida.sinfin; };
    /**
     * El escenario del día `i`: de 0 a 6 la semana, y de ahí en adelante el turno sin fin. Con la meta movida por la
     * dificultad y, en la semana, los textos que nombran la flota corregidos según lo comprado (trenes nuevos, turno
     * de noche en el taller).
     */
    const diaDe = (i) => {
        const D = i >= DIAS.length ? CAMPANA.generar(i + 1, sinFin().semilla) : Object.assign({}, DIAS[i]);
        D.meta += dificultad().meta;
        if (!D.sinfin) {
            const fuera = D.trenesFuera || 0, recupera = partida.taller && fuera ? 1 : 0, flota = JEFE.FLOTA + (partida.trenes || 0) - fuera + recupera;
            const corrige = (t) => t.replace(/([Tt]ienes) \d+/, `$1 ${flota}`).replace(/Los \d+ trenes disponibles/, `Los ${flota} trenes disponibles`);
            D.intro = corrige(D.intro); D.parte = (D.parte || []).map(corrige);
            if (recupera) D.parte.push('El turno de noche del taller recuperó un tren');
        }
        return D;
    };
    /** Lo que dejó el día anterior para el día `i`, si es ese el que se juega. */
    const pendientes = (i) => (partida.secuelas && partida.secuelas.para === i ? partida.secuelas.lista : []);
    /** El día `i` tal como se va a jugar: el escenario, más lo que dejó ayer y la mascota, si la hay. */
    const escenario = (i, lista = pendientes(i), m = partida.mascota) => CAMPANA.conSecuelas(diaDe(i), lista, m);
    /** El turno se guarda como lo que hace falta para rehacerlo: el plan del arranque, las órdenes y el paso. */
    function guardarTurno() {
        if (!sim || sim.terminado || prueba) return;
        partida.turno = { v: JEFE.VERSION, dia, t: sim.t, pasos: sim.pasos, plan: planInicial, bitacora: sim.bitacora };
        guardar();
    }
    /** Una orden del jugador: se ejecuta, queda en la bitácora y el turno se guarda. */
    function orden(...a) { const r = sim.orden(...a); guardarTurno(); return r; }
    /** Pone la pantalla del día: el panel, el clima, la cámara y la estación que se ve al entrar. */
    const montar = (estacionInicial) => {
        llueve = 0; fiesta = false; decision = null; avisos.textContent = '';
        cerrarFicha(); cerrarPanel(); tutFin();
        document.body.classList.add('jugando'); hud.hidden = false; fin.hidden = true; dec.hidden = true;
        hud.classList.remove('mas-controles'); ui.mas.textContent = 'Más'; ui.mas.setAttribute('aria-expanded', 'false');
        if (Q.ficha) Q.ficha.cerrar();
        // El nombre del día va aparte de su título: en el teléfono solo cabe el nombre.
        ui.dia.textContent = ''; ui.dia.append(el('span', '', D.sinfin ? `Día ${D.numero}` : D.n), el('span', 'jtit', (D.sinfin ? ` · ${D.n} ${D.fecha}` : '') + ` · ${D.t}`));
        ui.bbol.hidden = !puede('boleterias'); ui.btre.hidden = ui.sur.hidden = ui.nor.hidden = !puede('trenes');
        S.playing = false; S.tour = false; S.metro = true; S.fiestas = false; S.hour = sim.t / 60; M.setWeather('clear'); M.syncButtons();
        M.extra = extra; M.ajustar(); M.limitar();
        if (reales && S.nivel < 2) M.zoom(2 - S.nivel);
        elegir(estacionInicial, true); verDentro('est'); ficha.hidden = true;
    };
    const empezar = (i, estacionInicial = 0) => {
        const lista = pendientes(i), m = partida.mascota ? Object.assign({}, partida.mascota) : null;
        dia = i; D = escenario(i, lista, m); sugerido = false;
        const finde = JEFE.esFinde(D);
        const plan = {
            maquinas: partida.maquinas, tarjeta: partida.tarjeta, cajeros: partida.cajeros, anden: partida.anden, pantallas: partida.pantallas, mantenimiento: partida.mantenimiento,
            taller: partida.taller, bombas: partida.bombas, trenes: partida.trenes, publicidad: partida.publicidad, solar: partida.solar,
            jefes: partida.jefes || (D.autoBoleteria ? 1 : 0),      // el primer día, las boleterías las lleva el Puesto Central
            horario: finde ? partida.horarioFinde : partida.horario, ventanillas: partida.ventanillas,
            secuelas: lista, mascota: m,      // para rehacer el mismo día si se recupera el turno
        };
        planInicial = JSON.parse(JSON.stringify(plan));
        sim = JEFE.crear(largos, plan, D);
        vel = prueba ? 0 : 1; ahorro = 0;
        montar(estacionInicial);
        // La primera vez que se juega un día de la semana, el Puesto Central presenta lo que trae de nuevo.
        if (GUIAS[i] && !partida.guias[i] && !prueba) guiar(i);
        else avisar({ tipo: 'info', texto: puede('boleterias') ? '¡En marcha! Los trenes salen solos. Usa Horario para ajustar su frecuencia y Gestionar estación para atender las filas.' : '¡En marcha! Los trenes salen solos. Usa Horario para ajustar cada cuánto salen.', i: -1 });
        refrescar(); son('start'); guardarTurno();
    };
    /** Vuelve al turno que quedó a medias: rehace el día con las mismas órdenes y hasta el mismo paso. Devuelve si pudo. */
    const reanudar = (estacionInicial = 0) => {
        const t = partida.turno; if (!t) return false;
        // Un turno guardado con otras reglas ya no se puede rehacer igual: se descarta, y lo comprado ese día se deshace.
        if (t.v !== JEFE.VERSION) { descartarTurno(); turnoViejo = true; return false; }
        try {
            dia = t.dia; D = escenario(dia, t.plan.secuelas || [], t.plan.mascota || null); sugerido = false;
            partida.maquinas = t.plan.maquinas.slice();      // las máquinas compradas hoy vuelven a comprarse al repetir la bitácora
            planInicial = t.plan;
            sim = JEFE.restaurar(largos, Object.assign({}, t.plan, { maquinas: partida.maquinas }), D, t.bitacora, t.pasos);
        } catch (e) {
            console.error('Jefe de línea: no se pudo recuperar el turno a medias', e);
            sim = null; partida.turno = null; guardar(); return false;
        }
        vel = 0; ahorro = 0;
        if (dia < DIAS.length) partida.guias[dia] = true;
        montar(estacionInicial);
        sim.avisos.length = 0;      // los avisos del rato ya jugado no se repiten
        avisar({ tipo: 'bien', texto: `Turno recuperado: ${D.n.toLowerCase()}, ${hhmm(sim.t)}. Está en pausa: pulsa Reanudar cuando quieras.`, i: -1 });
        refrescar(); return true;
    };
    let turnoViejo = false;      // se descartó un turno a medias de una versión anterior: el tablero lo avisa una vez
    /** Descarta el turno a medias sin jugarlo: lo comprado ese día se deshace. */
    const descartarTurno = () => { if (partida.turno) { partida.maquinas = partida.turno.plan.maquinas.slice(); partida.turno = null; guardar(); } };
    /** Sale del día sin terminarlo. Lo comprado, comprado está. */
    const dejar = () => { if (!sim) return; partida.caja -= sim.cuenta.compras; partida.turno = null; guardar(); };
    const apagar = () => {
        tutFin(); verDentro(''); cerrarFicha(); cerrarPanel(); sim = null; decision = null; M.extra = null;
        hud.hidden = true; dec.hidden = true; avisos.textContent = '';
        S.playing = true; S.fiestas = false; M.setWeather('clear'); M.syncButtons(); M.ajustar(); M.limitar();
    };
    const salir = () => { guardarTurno(); apagar(); fin.hidden = true; document.body.classList.remove('jugando'); M.ajustar(); M.limitar(); };

    // ───── Logros y récords: valen para todas las partidas ─────
    const LOGROS = [
        { id: 'primer', n: 'Primer día', d: 'Termina tu primer día al frente de la línea.' },
        { id: 'redondo', n: 'Día redondo', d: 'Tres estrellas en un día.' },
        { id: 'puntual', n: 'Reloj suizo', d: 'Un día con menos de tres minutos de espera media en el andén.' },
        { id: 'nadie', n: 'Nadie se queda', d: 'Un día en que se vayan sin viajar menos de 100 personas.' },
        { id: 'granizo', n: 'A prueba de granizo', d: 'Dos estrellas o más en la granizada del viernes.' },
        { id: 'record', n: 'Día récord', d: 'Más de 230.000 viajes en un solo día.' },
        { id: 'retos', n: 'Reto tras reto', d: 'Cumple cinco retos de la semana.' },
        { id: 'semana', n: 'La semana', d: 'Termina la semana de Fiestas de Quito.' },
        { id: 'azul', n: 'Semana en azul', d: 'Termina la semana sin un solo día en rojo.' },
        { id: 'leyenda', n: 'Leyenda del Metro', d: 'Termina la semana con 19 estrellas o más.' },
        { id: 'tienda', n: 'Todo incluido', d: 'Compra todas las mejoras de la semana.' },
        { id: 'tren', n: 'Flota nueva', d: 'Compra un tren.' },
        { id: 'sinfin5', n: 'Cinco días más', d: 'Aguanta cinco días en el turno sin fin.' },
        { id: 'sinfin10', n: 'Diez días más', d: 'Aguanta diez días en el turno sin fin.' },
        { id: 'sinfin15', n: 'Quince días más', d: 'Aguanta quince días en el turno sin fin.' },
        { id: 'navidad', n: 'Feliz Navidad', d: 'Llega al 25 de diciembre en el turno sin fin.' },
        { id: 'anio', n: 'Año nuevo, línea nueva', d: 'Llega al 1 de enero en el turno sin fin.' },
        { id: 'carnaval', n: 'Carnaval', d: 'Llega al carnaval en el turno sin fin.' },
        { id: 'mision', n: 'Encargo cumplido', d: 'Cumple tu primera misión.' },
        { id: 'misiones5', n: 'De palabra', d: 'Cumple cinco misiones.' },
        { id: 'finde', n: 'Fin de semana redondo', d: 'Tres estrellas en un sábado, un domingo o un feriado.' },
        { id: 'durmiente', n: 'Durmiente', d: 'Adopta al perro del andén como mascota de una estación.' },
    ];
    /** Da los logros que ya se cumplen y devuelve los que son nuevos. `c` trae lo del día que acaba de terminar, si lo hay. */
    const revisarLogros = (c = {}) => {
        const p = partida, hecha = p.dia >= DIAS.length, n = totalEstrellas(p), s = c.s, hito = (c.D && c.D.hito && c.D.hito.n) || '', cumple = {
            primer: !!s, redondo: c.est === 3, puntual: !!s && s.cuenta.esperaN > 1000 && s.esperaMedia() < 3, nadie: !!s && s.cuenta.idos < 100,
            granizo: c.dia === 4 && c.est >= 2, record: !!s && s.cuenta.viajes > 230000,
            retos: p.retos.filter(Boolean).length >= 5, semana: hecha, azul: hecha && p.dias.slice(0, DIAS.length).every((d) => d && d.saldo >= 0), leyenda: hecha && n >= 19,
            tienda: MEJORAS.filter((mj) => mj.desde < DIAS.length).every((mj) => (p[mj.id] || 0) >= mj.max), tren: (p.trenes || 0) > 0,
            sinfin5: c.aguantados >= 5, sinfin10: c.aguantados >= 10, sinfin15: c.aguantados >= 15,
            navidad: hito === 'Navidad', anio: hito === 'Año Nuevo', carnaval: /carnaval/i.test(hito),
            mision: (p.misiones.hechas || []).length >= 1, misiones5: (p.misiones.hechas || []).length >= 5,
            finde: c.est === 3 && !!c.D && JEFE.esFinde(c.D), durmiente: !!p.mascota,
        };
        const nuevos = LOGROS.filter((l) => cumple[l.id] && !almacen.logros[l.id]);
        nuevos.forEach((l) => { almacen.logros[l.id] = Date.now(); });
        if (nuevos.length) guardar();
        return nuevos;
    };

    // ───── Las misiones ─────
    const misionDe = (id) => MISIONES.find((m) => m.id === id);
    const premioMision = (m) => Math.round(m.premio * dificultad().premio * (dia >= DIAS.length || partida.dia >= DIAS.length ? 1 + 0.03 * Math.max(0, (partida.sinfin ? partida.sinfin.n : 8) - 8) : 1) / 50) * 50;
    const metaMision = (m) => m.suma || m.veces;
    /** Las misiones que se ofrecen ahora: tres, de las abiertas para este punto de la semana, que no estén aceptadas. Se van rotando. */
    const ofertas = () => {
        const M0 = partida.misiones, activas = new Set(M0.activas.map((a) => a.id)), hechas = new Set(M0.hechas);
        let l = MISIONES.filter((m) => m.desde <= partida.dia && !activas.has(m.id));
        if (l.some((m) => !hechas.has(m.id))) l = l.filter((m) => !hechas.has(m.id));      // primero las que nunca se hicieron
        const r = (M0.rota || 0) % Math.max(1, l.length);
        return l.slice(r).concat(l.slice(0, r)).slice(0, 3);
    };
    const aceptar = (m) => { if (partida.misiones.activas.length >= 2) return; partida.misiones.activas.push({ id: m.id, prog: 0, quedan: m.plazo }); guardar(); son('select'); };
    /** Al terminar un día: avanza cada misión aceptada, paga las cumplidas y quita las vencidas. Devuelve qué pasó con cada una. */
    const evaluarMisiones = (s, c) => {
        const M0 = partida.misiones, res = [];
        M0.activas = M0.activas.filter((a) => {
            const m = misionDe(a.id); if (!m) return false;
            const hoy = m.suma ? m.medida(s) : m.ok(s, c) ? 1 : 0;
            if (m.suma) a.prog += hoy; else if (hoy) a.prog++; else if (m.seguidos) a.prog = 0;
            a.quedan--;
            if (a.prog >= metaMision(m)) {
                const premio = premioMision(m); partida.caja += premio; M0.hechas.push(m.id); M0.rota = (M0.rota || 0) + 1;
                res.push({ m, estado: 'hecha', premio, a }); return false;
            }
            if (a.quedan <= 0) { M0.vencidas = (M0.vencidas || 0) + 1; M0.rota = (M0.rota || 0) + 1; res.push({ m, estado: 'vencida', a }); return false; }
            res.push({ m, estado: hoy ? 'avanza' : m.seguidos && a.prog === 0 ? 'corta' : 'nada', a });
            return true;
        });
        return res;
    };
    const progresoTxt = (m, a) => (m.suma ? `${miles(a.prog)} de ${miles(m.suma)}` : `${a.prog} de ${m.veces}${m.seguidos ? ' seguidos' : ''}`) + ` · ${a.quedan} ${a.quedan === 1 ? 'día' : 'días'} de plazo`;

    /**
     * Lo que el día deja para el siguiente: las notas de las decisiones (más las que duran varios días) y la mascota.
     * `para` es el número del día que las va a recibir.
     */
    const dejarSecuelas = (para) => {
        const nuevas = sim.secuelas.filter((x) => x.s !== 'durmiente'), adopta = sim.secuelas.find((x) => x.s === 'durmiente');
        if (adopta && !partida.mascota) partida.mascota = { i: adopta.i, dias: 0 };
        else if (partida.mascota) partida.mascota.dias++;
        const lista = CAMPANA.siguen(planInicial.secuelas).concat(nuevas);
        partida.secuelas = lista.length && para !== null ? { para, lista } : null;
    };

    const terminar = () => {
        const c = sim.cuenta, animo = sim.animoDia(), saldo = sim.balance(), s = sim, est = estrellasDe(animo, saldo, D.meta), reto = !!D.reto.ok(s), premio = reto ? Math.round(D.reto.premio * dificultad().premio / 50) * 50 : 0;
        const misiones = evaluarMisiones(s, { est, D });
        vel = 0; tutFin(); if (vista) verDentro(''); dec.hidden = true;
        partida.turno = null;
        partida.total = partida.total || { dias: 0, viajes: 0, km: 0 };
        partida.total.dias++; partida.total.viajes += c.viajes; partida.total.km += c.km;
        const R0 = almacen.records = almacen.records || {};
        R0.viajes = Math.max(R0.viajes || 0, Math.round(c.viajes)); R0.animo = Math.max(R0.animo || 0, Math.round(animo));
        if (dia >= DIAS.length) {
            // El turno sin fin no se repite: cada día cuenta una sola vez. Se acaba con un día sin estrellas o con la caja en rojo.
            const f = sinFin();
            partida.caja += saldo + premio;      // el saldo ya trae descontadas las compras
            const quiebra = partida.caja < 0, sigue = est > 0 && !quiebra, aguantados = f.n - DIAS.length - 1 + (sigue ? 1 : 0), record = aguantados > (f.mejor || 0);
            f.mejor = Math.max(f.mejor || 0, aguantados); R0.sinfin = Math.max(R0.sinfin || 0, aguantados);
            if (sigue) f.n++;
            else { f.n = DIAS.length + 1; f.semilla = Math.floor(Math.random() * 1e9); if (quiebra) partida.caja = 3000; }      // tras una quiebra, el Municipio cubre el hueco y deja un fondo para volver a empezar
            dejarSecuelas(sigue ? f.n - 1 : null);
            const logros = revisarLogros({ s, est, dia, D, aguantados });
            guardar(); son('result', sigue ? est : 0);
            informe(s, { est, animo, saldo, reto, premio, supera: true, sinfin: true, sigue, quiebra, aguantados, record, mejor: f.mejor, logros, misiones });
            return;
        }
        const antes = partida.dias[dia], operativo = saldo + c.compras, diaAntes = partida.dia;
        // La caja de un día cuenta una sola vez: al repetirlo, vale el mejor resultado. Las compras se pagan siempre.
        const supera = !antes || est > antes.estrellas || (est === antes.estrellas && animo > antes.animo);
        partida.caja -= c.compras;
        if (supera) {
            partida.caja += operativo - (antes ? antes.operativo : 0);
            partida.dias[dia] = {
                estrellas: est, animo, operativo, saldo, viajes: c.viajes, km: c.km, idos: c.idos, premio: antes ? antes.premio : 0,
                // Las cuentas del día, para saber después en qué se fue la plata.
                cuentas: { ingresos: c.ingresos, trenes: c.trenes, personal: c.personal, fijo: c.fijo, imprevistos: c.imprevistos, compras: c.compras, ociosas: c.ociosas },
            };
        }
        if (reto && !partida.retos[dia]) { partida.retos[dia] = true; partida.caja += premio; partida.dias[dia].premio = premio; }
        partida.estrellas[dia] = Math.max(partida.estrellas[dia] || 0, est);
        if (est > 0 && partida.dia === dia) partida.dia = Math.min(DIAS.length, dia + 1);
        // La semana no puede cerrar en rojo: quien la termina debiendo, pierde el cargo. Se mira una sola vez, al cerrar
        // el domingo por primera vez; repetir un día después de terminada la semana ya no pone en juego la partida.
        if (diaAntes < DIAS.length && partida.dia >= DIAS.length && partida.caja < 0) partida.perdida = true;
        dejarSecuelas(dia + 1 < DIAS.length ? dia + 1 : sinFin().n - 1);
        const logros = revisarLogros({ s, est, dia, D });
        guardar();
        son('result', partida.perdida ? 0 : est);
        informe(s, { est, animo, saldo, reto, premio, supera, antes, logros, misiones });
    };

    // ───────────────────────── Menús ─────────────────────────
    const modal = (...hijos) => {
        if (sim) apagar();
        document.body.classList.add('jugando'); fin.hidden = false; fin.textContent = '';
        const caja = el('div', 'caja'); caja.append(...hijos); fin.append(caja); fin.scrollTop = 0;
        return caja;
    };
    const acciones = (...b) => con(el('div', 'acciones'), ...b);

    /** El menú principal: las partidas guardadas. */
    const titulo = () => {
        const lista = el('div', 'huecos');
        almacen.partidas.forEach((p, k) => {
            const h = el('div', 'hueco' + (p ? '' : ' vacio') + (p && k === almacen.actual ? ' on' : ''));
            if (p) {
                const n = totalEstrellas(p), hecho = p.dia >= DIAS.length;
                h.append(el('strong', '', `Partida ${k + 1}`),
                    el('span', '', p.perdida ? 'Partida perdida: la semana cerró en rojo' : hecho ? `Semana completa · ${rangoDe(n).n}` + (p.sinfin && p.sinfin.mejor ? ` · sin fin: récord de ${p.sinfin.mejor} ${p.sinfin.mejor === 1 ? 'día' : 'días'}` : '') : p.estrellas.length ? `Va por el ${DIAS[p.dia].n.toLowerCase()}` + (p.turno ? `, con el turno a medias (${hhmm(p.turno.t)})` : '') : 'Recién empezada'),
                    el('em', '', `★ ${n} de ${DIAS.length * 3} · caja ${plata(p.caja)} · ${dificultad(p).n.toLowerCase()}`),
                    acciones(boton(p.perdida ? 'Ver qué pasó' : 'Continuar', () => { cargar(k); semana(); }, 'on'), boton('Borrar', () => { if (confirm(`¿Borrar la partida ${k + 1}? Se pierden sus estrellas, su caja y sus mejoras.`)) { almacen.partidas[k] = null; if (almacen.actual === k) partida = nueva(); try { if (!prueba) localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* idem */ } titulo(); } })));
            } else h.append(el('strong', '', `Partida ${k + 1}`), el('span', '', 'Vacía'), acciones(boton('Nueva partida', () => elegirDificultad(k), 'on')));
            lista.append(h);
        });
        const sonido = boton(S.sound ? 'Sonido: activado' : 'Sonido: apagado', () => { if (Q.sfx && Q.sfx.enable) Q.sfx.enable(!S.sound); setTimeout(() => { sonido.textContent = S.sound ? 'Sonido: activado' : 'Sonido: apagado'; }, 250); });
        modal(el('p', 'zona', 'Metro de Quito · Línea 1'), el('h2', 'grande', 'Jefe de línea'),
            el('p', 'texto', 'Diriges los 22 kilómetros y las 15 estaciones del Metro durante la semana de Fiestas de Quito: siete días, del lunes 30 de noviembre al domingo 6 de diciembre, y después, el calendario entero. La semana dura alrededor de una hora. Todo se guarda solo, también a mitad de un turno.'),
            lista, acciones(boton('Trayectoria', () => trayectoria(titulo), '', 'Logros y récords'), boton('Cómo se juega', () => ayuda(titulo)), sonido, boton('Volver al mapa', salir)));
    };

    /** Antes de una partida nueva: qué tan exigente va a ser. Se puede elegir solo al empezar. */
    function elegirDificultad(k, volver = titulo) {
        const lista = el('div', 'dificultades');
        Object.entries(DIFICULTADES).forEach(([id, d]) => {
            const b = boton('', () => { almacen.actual = k; partida = nueva(); partida.dificultad = id; partida.caja = d.caja; guardar(); semana(); }, 'dificultad' + (id === 'normal' ? ' on' : ''));
            b.append(el('strong', '', d.n), el('span', '', d.d), el('em', '', `Caja inicial: ${plata(d.caja)}` + (d.meta ? ` · metas ${d.meta > 0 ? '+' : '−'}${Math.abs(d.meta)}` : '')));
            lista.append(b);
        });
        modal(el('p', 'zona', `Partida ${k + 1} · nueva`), el('h2', '', '¿Qué tan exigente?'), el('p', 'texto', 'La dificultad mueve la meta de ánimo de todos los días, la plata con que empiezas y los premios. No se cambia después.'), lista, acciones(boton('Volver', volver)));
    }

    /** El tablero de la semana: los días, el parte del día elegido y la tienda. Con `i` igual al número de días muestra el turno sin fin. */
    const semana = (i) => {
        if (partida.perdida) { pantallaPerdida(); return; }
        const completa = partida.dia >= DIAS.length;
        if (i === undefined || i < 0) i = completa && partida.sinfin ? DIAS.length : Math.min(partida.dia, DIAS.length - 1);
        if (i >= DIAS.length && !completa) i = DIAS.length - 1;
        const sf = i >= DIAS.length, f = sf ? sinFin() : null, k = sf ? f.n - 1 : i, Dd = escenario(k), n = totalEstrellas(partida);
        const dias = (q) => `${q} ${q === 1 ? 'día' : 'días'}`, minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);
        const caja = modal(el('p', 'zona', `Partida ${almacen.actual + 1} · ${sf ? 'después de las fiestas' : 'semana de Fiestas de Quito'} · ${dificultad().n.toLowerCase()}`), el('h2', '', sf ? `Turno sin fin · día ${Dd.numero}` : `La semana · ★ ${n} de ${DIAS.length * 3}`));
        if (turnoViejo) { turnoViejo = false; caja.append(el('p', 'consejo', 'El juego se actualizó y el turno que dejaste a medias era de la versión anterior: no se puede rehacer igual, así que se descartó. Lo demás de la partida está intacto.')); }
        // Un turno a medias: se puede seguir donde quedó o descartarlo.
        const medio = partida.turno;
        if (medio) {
            const Dm = escenario(medio.dia, (medio.plan && medio.plan.secuelas) || [], medio.plan && medio.plan.mascota);
            caja.append(con(el('div', 'consejo'), el('span', '', `Dejaste a medias el ${Dm.sinfin ? 'día ' + Dm.numero : Dm.n.toLowerCase()}, a las ${hhmm(medio.t)}. `),
                boton('Seguir ese turno', () => { if (!reanudar()) semana(i); }, 'on'), boton('Descartarlo', () => { if (confirm('¿Descartar el turno a medias? Se pierde lo avanzado de ese día.')) { descartarTurno(); semana(i); } })));
        }
        if (partida.caja < 0) {
            caja.append(con(el('div', 'consejo mal'), el('span', '', sf ? `La caja está en ${plata(partida.caja)}. ` : `La caja está en ${plata(partida.caja)}. Si la semana termina en rojo, pierdes el cargo. `), boton('Ver dónde recortar', () => cuentasSemana(() => semana(i)))));
        }
        if (sf) caja.append(el('p', 'consejo', 'El calendario sigue, de fecha en fecha: feriados, vísperas y días corrientes, cada uno con más gente y más cosas pasando a la vez. El turno dura hasta que un día termine sin estrellas o deje la caja en rojo.' + (f.mejor ? ` Tu récord: ${dias(f.mejor)}.` : '')));
        else if (completa) caja.append(el('p', 'consejo', `Terminaste la semana como ${rangoDe(n).n}. Puedes repetir cualquier día para mejorarlo, o seguir en el turno sin fin.`));
        const lista = el('div', 'dias' + (completa ? ' ocho' : ''));
        DIAS.forEach((d, q) => {
            const libre = q <= partida.dia, b = boton('', () => semana(q), 'dia' + (!sf && q === i ? ' on' : ''));
            b.disabled = !libre;
            b.append(el('strong', '', d.corto), el('span', '', libre ? d.t : 'Por abrir'), el('em', '', libre ? estrellasTxt(partida.estrellas[q] || 0) + (partida.retos[q] ? ' ◆' : '') : '· · ·'));
            lista.append(b);
        });
        if (completa) { const b = boton('', () => semana(DIAS.length), 'dia sinfin' + (sf ? ' on' : '')); b.append(el('strong', '', '∞'), el('span', '', 'Sin fin'), el('em', '', partida.sinfin && partida.sinfin.mejor ? `récord: ${partida.sinfin.mejor}` : 'nuevo')); lista.append(b); }
        const parte = el('ul', 'parte'); (Dd.parte || []).forEach((t) => parte.append(el('li', '', t)));
        caja.append(lista, el('h3', '', `${Dd.n} ${Dd.fecha} · ${Dd.t}`), el('p', 'texto', Dd.intro));
        if (Dd.nuevo) caja.append(con(el('p', 'nuevo'), el('strong', '', `Nuevo hoy: ${minuscula(Dd.nuevo.n)}. `), Dd.nuevo.d));
        // Lo que dice el calendario de esa fecha, con la cifra real del Metro cuando la hay.
        const cal = typeof CALENDARIO !== 'undefined' ? CALENDARIO : null;
        if (sf && Dd.hito) caja.append(con(el('p', 'fecha ' + (Dd.hito.sube > 0 ? 'alza' : Dd.hito.sube < 0 ? 'baja' : '')), el('strong', '', `${Dd.hito.sube > 0 ? '▲' : Dd.hito.sube < 0 ? '▼' : '◆'} ${Dd.hito.n}: ${Dd.hito.pct} de gente frente a ${Dd.hito.frente}${Dd.hito.real ? '' : ' (estimado)'}. `), Dd.hito.dato || ''));
        else if (!sf && cal) { const c = cal.dia(i + 1); if (c.n) caja.append(con(el('p', 'fecha ' + (c.tono || '')), el('strong', '', `En el calendario: ${c.n}. `), c.dato || '')); }
        if (sf) { const prox = CAMPANA.proximas(CAMPANA.fechaDe(k + 1, f.semilla), 3); if (prox.length) caja.append(el('p', 'nota', 'Lo que viene: ' + prox.map((q) => `${q.dia.toLowerCase()} ${q.fecha}, ${q.n} (${q.pct})`).join(' · ') + '.')); }
        const cumplido = !sf && partida.retos[i];
        caja.append(parte,
            el('p', 'reto' + (cumplido ? ' hecho' : ''), `${cumplido ? '◆ Reto cumplido' : '◇ Reto'}: ${minuscula(Dd.reto.t)}` + (Dd.reto.premio ? ` (premio de ${plata(Dd.reto.premio)}).` : ' (por el honor).')),
            el('p', 'nota', sf ? `Con un ánimo de ${Dd.meta - 10} o más y la caja sin rojo sigues al día siguiente; si no, termina el turno. Las estrellas son las de siempre: ${Dd.meta} para dos y ${Dd.meta + 10} sin cerrar el día en rojo para tres.`
                : `Ánimo de ${Dd.meta - 10} para una estrella, de ${Dd.meta} para dos y de ${Dd.meta + 10} sin cerrar la caja del día en rojo para tres. Con una estrella se abre el día siguiente.`));
        // La tienda se va abriendo con los días: cada mejora se ofrece desde el suyo.
        const tienda = el('div', 'tienda'), hoy = partida.dia;
        tienda.append(el('h3', '', `Tienda · en caja ${plata(partida.caja)}`));
        const abiertas = MEJORAS.filter((mj) => (mj.desde || 0) <= hoy), despues = MEJORAS.filter((mj) => (mj.desde || 0) > hoy);
        if (!abiertas.length) tienda.append(el('p', 'nota', 'La tienda abre mañana. Hoy, todo lo que puedes mejorar está en el Horario.'));
        abiertas.forEach((mj) => {
            const nivel = partida[mj.id] || 0, estreno = mj.desde === hoy && !nivel, precio = mj.precio + (mj.sube || 0) * nivel;
            const b = boton(nivel >= mj.max ? (mj.max > 1 ? 'Completa' : 'Comprada') : plata(precio), () => { if (partida.caja < precio) return; partida.caja -= precio; partida[mj.id] = nivel + 1; guardar(); son('purchase'); revisarLogros(); semana(i); });
            b.disabled = nivel >= mj.max || partida.caja < precio;
            tienda.append(con(el('div', 'fila' + (nivel >= mj.max ? ' hecha' : '') + (estreno ? ' estreno' : '')), el('span', 'nombre', (estreno ? 'Nuevo · ' : '') + mj.n + (mj.max > 1 ? ` (${nivel}/${mj.max})` : '')), el('span', 'nota', mj.d), b));
        });
        if (despues.length) tienda.append(el('p', 'nota', 'Más adelante: ' + despues.map((mj) => `${minuscula(mj.n)} (${mj.desde < DIAS.length ? 'desde el ' + DIAS[mj.desde].n.toLowerCase() : 'en el turno sin fin'})`).join(', ') + '.'));
        if (hoy >= DESDE.boleterias) tienda.append(el('p', 'nota', `Las máquinas de boletos (${plata(JEFE.COSTO.maquina)}) se compran durante el turno, en Boleterías o dentro de cada estación.`));
        caja.append(misionesTablero(() => semana(i)), tienda);
        if (!sf && i === DIAS.length - 1 && partida.caja < 0) caja.append(el('p', 'consejo mal', `Es el último día: para no perder el cargo, hoy tienes que cerrar con al menos ${plata(-partida.caja)} a favor, contando el premio del reto.`));
        const pie = acciones(boton(sf ? `Empezar el día ${Dd.numero}` : `Empezar el ${Dd.n.toLowerCase()}`, () => { descartarTurno(); empezar(k); }, medio ? '' : 'on'));
        if (!sf && GUIAS[i] && partida.guias[i]) pie.append(boton('Repetir con la guía', () => { partida.guias[i] = false; empezar(i); }, '', 'Vuelve a mostrar la explicación de lo nuevo de este día'));
        if (completa) pie.append(boton('Ver el final', final));
        if (partida.dias.some(Boolean)) pie.append(boton('Cuentas', () => cuentasSemana(() => semana(i)), '', 'En qué se va la plata, día por día'));
        pie.append(boton('Trayectoria', () => trayectoria(() => semana(i)), '', 'Logros y récords'), boton('Cómo se juega', () => ayuda(() => semana(i))), boton('Menú principal', titulo));
        caja.append(pie);
    };

    /** Las misiones en el tablero: las aceptadas, con su avance, y las que se ofrecen. */
    function misionesTablero(volver) {
        const sec = el('div', 'misiones'), M0 = partida.misiones;
        sec.append(el('h3', '', `Misiones · ${M0.activas.length} de 2 aceptadas` + (M0.hechas.length ? ` · ${M0.hechas.length} cumplidas` : '')));
        if (partida.dia < DESDE.misiones) { sec.append(el('p', 'nota', 'Desde el martes, los vecinos, el directorio y el Municipio te van a pedir encargos de varios días, con premio.')); return sec; }
        M0.activas.forEach((a) => {
            const m = misionDe(a.id); if (!m) return;
            sec.append(con(el('div', 'fila activa'), el('span', 'nombre', `${m.n} · ${m.de}`), el('span', 'nota', `${m.d} Premio: ${plata(premioMision(m))}. Vas ${progresoTxt(m, a)}.`), el('em', '', 'Aceptada')));
        });
        if (M0.activas.length >= 2) { sec.append(el('p', 'nota', 'Puedes llevar dos misiones a la vez. Al cumplir o vencer una, se libera el cupo y aparecen otras.')); return sec; }
        ofertas().forEach((m) => {
            const b = boton('Aceptar', () => { aceptar(m); volver(); });
            sec.append(con(el('div', 'fila'), el('span', 'nombre', `${m.n} · ${m.de}`), el('span', 'nota', `${m.d} Plazo: ${m.plazo} días jugados. Premio: ${plata(premioMision(m))}.`), b));
        });
        return sec;
    }

    /** En qué se fue la plata y qué recortar, a partir de las cuentas de los días jugados. */
    const consejosDeCaja = () => {
        const jugados = partida.dias.filter((d) => d && d.cuentas), suma = (q) => jugados.reduce((a, d) => a + (d.cuentas[q] || 0), 0), l = [];
        const ing = suma('ingresos'), tre = suma('trenes'), imp = suma('imprevistos'), com = suma('compras'), oci = suma('ociosas') * JEFE.COSTO.ventanillaHora / 60;
        if (ing && tre / ing > 0.56) l.push(`Los trenes se llevaron ${plata(tre)}: el ${Math.round(tre / ing * 100)}% de lo que entró por pasajes. En las franjas flojas (madrugada, media mañana, mediodía y noche) alcanza con un tren cada 10 o 12 minutos: guíate por la barra del pronóstico en el Horario.`);
        if (oci > 600) l.push(`Pagaste unos ${plata(oci)} por ventanillas abiertas sin nadie en la fila. Ciérralas cuando pase el pico` + (partida.dia >= 5 ? ', o compra los jefes de estación, que lo hacen solos.' : '.'));
        if (imp > 2500) l.push(`Las decisiones te costaron ${plata(imp)}. Las opciones gratis cuestan ánimo o tiempo, no plata: cuando el ánimo va sobrado, convienen.`);
        if (com > 5000) l.push(`Compraste máquinas de boletos por ${plata(com)}. Sirven para siempre, pero se pagan de golpe: convienen donde hay fila todos los días (Quitumbe, El Recreo, San Francisco, Iñaquito, El Labrador).`);
        if (!l.length) l.push('No hay un gasto fuera de lugar: lo que falta es ingreso. Cada persona que se va de la fila o del andén son 45 centavos menos: mira «se fueron sin viajar» en el informe de cada día.');
        return l;
    };
    /** Las cuentas de la semana, día por día. Con `auditoria`, es el directorio el que llama porque la caja está en rojo a media semana. */
    function cuentasSemana(volver, auditoria = false) {
        const t = el('table', 'cuentas');
        t.append(con(el('tr', 'cab'), el('td', '', 'Día'), el('td', '', 'Entró'), el('td', '', 'Salió'), el('td', '', 'Saldo')));
        partida.dias.forEach((d, k) => { if (!d || !d.cuentas || k >= DIAS.length) return; const q = d.cuentas, sale = q.trenes + q.personal + q.fijo + q.imprevistos + q.compras; t.append(con(el('tr'), el('td', '', DIAS[k].n), el('td', '', plata(q.ingresos)), el('td', '', plata(-sale)), el('td', q.ingresos - sale < 0 ? 'rojo' : '', plata(q.ingresos - sale)))); });
        t.append(con(el('tr', 'total'), el('td', '', 'En caja, con premios y compras de tienda'), el('td'), el('td'), el('td', partida.caja < 0 ? 'rojo' : '', plata(partida.caja))));
        const caja = modal(el('p', 'zona', auditoria ? 'Miércoles en la noche · llama el directorio' : `Partida ${almacen.actual + 1}`), el('h2', '', auditoria ? 'Media semana en rojo' : 'Las cuentas de la semana'));
        if (auditoria) caja.append(el('p', 'texto', `Van tres días y la caja está en ${plata(partida.caja)}. El directorio no pide milagros: pide que el domingo, al cierre, la semana no deba nada. Si termina en rojo, nombran a otro jefe de línea.`));
        caja.append(t, el('h3', '', partida.caja < 0 ? 'Dónde recortar' : 'En qué se va la plata'));
        consejosDeCaja().forEach((x) => caja.append(el('p', 'consejo', x)));
        if (!auditoria && partida.dia < DIAS.length) caja.append(el('p', 'nota', 'Repetir un día y hacerlo mejor también mejora la caja: cuenta el mejor resultado de cada uno. Si la semana termina en rojo, pierdes el cargo.'));
        caja.append(acciones(boton(auditoria ? 'Entendido: al jueves →' : 'Volver', volver, 'on')));
    }
    /** La semana cerró en rojo: se pierde el cargo y, con él, la partida. */
    function pantallaPerdida() {
        const caja = modal(el('p', 'zona', 'Domingo 6 de diciembre · cierre de la semana'), el('h2', 'grande', 'Relevado del cargo'),
            el('p', 'texto', `La semana de Fiestas cerró con la caja en ${plata(partida.caja)}. La gente llegó, pero el Metro no puede gastar más de lo que entra, y el directorio nombró a otra persona para la jefatura de la línea.`),
            el('h3', '', 'En qué se fue la plata'));
        caja.classList.add('perdida');
        consejosDeCaja().forEach((x) => caja.append(el('p', 'consejo', x)));
        caja.append(el('p', 'nota', `Terminaste con ${totalEstrellas(partida)} de ${DIAS.length * 3} estrellas. Esta partida ya no sigue; los logros que ganaste se conservan.`),
            acciones(boton('Empezar una partida nueva', () => { partida = nueva(); guardar(); semana(); }, 'on'), boton('Trayectoria', () => trayectoria(pantallaPerdida)), boton('Menú principal', titulo)));
    }
    /** Los logros y los récords, que valen para todas las partidas. */
    function trayectoria(volver) {
        const R0 = almacen.records || {}, lista = el('div', 'logros'), tengo = LOGROS.filter((l) => almacen.logros[l.id]).length, dl = el('dl', 'datos');
        LOGROS.forEach((l) => lista.append(con(el('div', 'logro' + (almacen.logros[l.id] ? ' hecho' : '')), el('strong', '', (almacen.logros[l.id] ? '✦ ' : '· ') + l.n), el('span', '', l.d))));
        [['Más viajes en un día', R0.viajes ? miles(R0.viajes) : '—'], ['Mejor ánimo de un día', R0.animo ? String(R0.animo) : '—'], ['Récord en el turno sin fin', R0.sinfin ? `${R0.sinfin} ${R0.sinfin === 1 ? 'día' : 'días'}` : '—'],
            ['Esta partida: días terminados', String((partida.total && partida.total.dias) || 0)], ['Esta partida: viajes', miles((partida.total && partida.total.viajes) || 0)], ['Esta partida: tiempo de juego', `${Math.round((partida.segundos || 0) / 60)} min`]]
            .forEach(([q, val]) => dl.append(con(el('div'), el('dt', '', q), el('dd', '', val))));
        modal(el('p', 'zona', 'Jefe de línea'), el('h2', '', `Trayectoria · ${tengo} de ${LOGROS.length} logros`), dl, lista, acciones(boton('Volver', volver, 'on')));
    }

    /** El ánimo hora por hora, en barras. */
    const grafico = (s, meta) => {
        const g = el('div', 'grafico'); g.title = 'Ánimo de la gente, hora por hora';
        s.porHora.forEach((p) => { const b = el('i', p.animo >= meta ? 'bien' : p.animo >= meta - 10 ? 'regular' : 'mal'); b.style.height = clamp(p.animo, 4, 100) + '%'; b.title = `${String(p.h % 24).padStart(2, '0')}:00 · ánimo ${Math.round(p.animo)}`; g.append(con(el('span'), b, el('small', '', p.h % 3 === 0 ? String(p.h % 24) : ''))); });
        const raya = el('em'); raya.style.bottom = meta + '%'; g.append(raya);
        return g;
    };
    const cuentas = (c, saldo) => {
        const t = el('table', 'cuentas');
        [['Pasajes', c.ingresos, 1], ['Trenes (energía, conductores, desgaste)', -c.trenes, 1], ['Boleterías', -c.personal, 1], ['Estaciones, seguridad y limpieza', -c.fijo, 1], ['Imprevistos y decisiones', -c.imprevistos, 0], ['Máquinas compradas', -c.compras, 0], ['Saldo del día', saldo, 2]]
            .forEach(([k, val, modo]) => { if (!modo && !val) return; t.append(con(el('tr', modo === 2 ? 'total' : ''), el('td', '', k), el('td', val < 0 ? 'rojo' : '', plata(val)))); });
        return t;
    };

    // ───── Por qué salió así ─────
    const CAUSA = {
        anden: 'Esperar en el andén', fila: 'La fila de la boletería', lleno: 'Ver pasar trenes llenos', apretado: 'Viajar apretados',
        cierre: 'Estaciones cerradas', fin: 'Quedarse sin tren al cierre', decision: 'Las decisiones', evento: 'Lo que pasó en la ciudad',
    };
    const horas = (de, a) => `entre las ${hhmm(de * 60)} y las ${hhmm(a * 60)}`;
    /** Una línea que explica una de las causas que más pesaron, con lo que se podría haber hecho. */
    const explicar = (s, q) => {
        const lugar = q.i >= 0 ? `en ${s.est[q.i].n}` : 'en toda la línea', pts = `${coma(q.puntos)} ${q.puntos >= 0.95 && q.puntos < 1.05 ? 'punto' : 'puntos'}`;
        const k = s.franjaDe((q.de + q.a) / 2), f = s.franjas[k], cada = s.horario[k], franjaTxt = `«${f.n}» (ibas cada ${cada} min)`;
        // Para un andén lleno, el tren extra conviene desde la cabecera de la que vienen los trenes a esa estación.
        if (q.causa === 'anden') return `La espera en el andén ${lugar}, ${horas(q.de, q.a)}, te costó ${pts}. Faltaron trenes en ${franjaTxt}: prueba con un intervalo más corto, o manda un tren extra cuando veas el andén crecer.`;
        if (q.causa === 'lleno') return `${q.i >= 0 ? s.est[q.i].n : 'La línea'}, ${horas(q.de, q.a)}: los trenes llegaban llenos y la gente los veía pasar (${pts}). En ${franjaTxt} hacía falta más capacidad; un tren extra vacío ayuda justo donde se acumula.`;
        if (q.causa === 'apretado') return `Los que subieron ${lugar}, ${horas(q.de, q.a)}, viajaron apretados (${pts}). Con más del 70% del tren ocupado la gente ya se queja: en ${franjaTxt} conviene un tren más seguido.`;
        if (q.causa === 'fila') return dia < DESDE.boleterias ? `La fila de la boletería ${lugar}, ${horas(q.de, q.a)}, costó ${pts}. Desde el martes las boleterías son tuyas.` : `La fila de la boletería ${lugar}, ${horas(q.de, q.a)}, te costó ${pts}. Abre ventanillas antes de que llegue la gente, o compra una máquina ahí si la fila se repite todos los días.`;
        if (q.causa === 'cierre') return `Que ${q.i >= 0 ? s.est[q.i].n + ' estuviera cerrada' : 'hubiera estaciones cerradas'} (${horas(q.de, q.a)}) costó ${pts}.` + (partida.bombas ? ' Las bombas de achique ya acortaron el cierre.' : MEJORAS.some((mj) => mj.id === 'bombas' && mj.desde <= partida.dia) ? ' Con las bombas de achique de la tienda, lo que cierra el agua reabre en la mitad del tiempo.' : ' Algunas decisiones permiten reabrir antes.');
        if (q.causa === 'fin') return `Al cierre quedó gente sin tren ${lugar} (${pts}). La última franja necesita trenes hasta el final.`;
        if (q.causa.startsWith('d:')) { const d = s.decididas.find((x) => 'd:' + x.id === q.causa); return d ? `Elegir «${d.opcion.replace(/ \(−\$[\d.]+\)$/, '')}» en «${d.titulo}» te costó ${pts} de ánimo.` : `Una decisión te costó ${pts}.`; }
        return `Lo que pasó en la ciudad ${lugar} (${horas(q.de, q.a)}) restó ${pts}.`;
    };
    /** La sección «Por qué salió así»: cuánto pesó cada causa en el día y las tres que más pesaron, explicadas. */
    const porQue = (s, r) => {
        const sec = el('div', 'porque'), pc = s.porCausa(), tope = Math.max(...Object.values(pc), 0.01);
        sec.append(el('h3', '', 'Por qué salió así'), el('p', 'nota', `El ánimo del día fue ${Math.round(r.animo)}. Cada barra es cuánto le restó cada cosa: sumadas, dan lo que faltó para llegar a 100.`));
        const tabla = el('div', 'causas');
        Object.entries(pc).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
            const b = el('i'); b.style.width = Math.max(2, Math.round(v / tope * 100)) + '%';
            tabla.append(con(el('div', 'causa'), el('span', 'nombre', CAUSA[k] || k), con(el('span', 'barra'), b), el('span', 'pts', '−' + coma(v))));
        });
        sec.append(tabla);
        // Lo que pesó menos de un punto no merece consejo: en un día muy bueno, mejor decirlo.
        const top = s.porque().filter((q) => q.puntos >= 1).slice(0, 3);
        if (top.length) top.forEach((q) => sec.append(el('p', 'consejo', explicar(s, q))));
        else sec.append(el('p', 'consejo', 'Ninguna estación ni ninguna hora te costó más de un punto: la gente viajó bien todo el día.'));
        return sec;
    };

    /** El resumen del día. */
    const informe = (s, r) => {
        const c = s.cuenta, Dd = D, k = dia;
        // Lo que no sale del ánimo: la plata y lo que no dependía de ti.
        const consejos = [];
        if (c.idosCierre > 3000) consejos.push(`${miles(c.idosCierre)} personas encontraron su estación cerrada o tuvieron que bajarse antes.`);
        if (r.saldo < 0) consejos.push('El día cerró en rojo. Los trenes cuestan por cada kilómetro: en las horas flojas puedes espaciarlos sin que nadie sufra. Mira el pronóstico de cada franja en el Horario.');
        if (r.est >= 3 && !consejos.length) consejos.push('Un día redondo: la gente llegó a tiempo y las cuentas cuadran.');
        const peor = s.est.slice().sort((p, q) => p.animo - q.animo)[0];
        const dl = el('dl', 'datos');
        [['Ánimo de la gente', `${Math.round(r.animo)} de 100 (meta ${Dd.meta})`], ['Viajes', `${miles(c.viajes)} de ${miles(c.demanda)}`], ['Espera en el andén', coma(s.esperaMedia()) + ' min'], ['Se fueron sin viajar', miles(c.idos)], ['Kilómetros de tren', miles(c.km)], ['Estación más descontenta', `${peor.n} (${Math.round(peor.animo)})`]]
            .forEach(([q, val]) => dl.append(con(el('div'), el('dt', '', q), el('dd', '', val))));
        const caja = modal(el('p', 'zona', (r.sinfin ? `Turno sin fin · día ${Dd.numero} · ` : '') + `${Dd.n} ${Dd.fecha} · ${Dd.t}`),
            el('h2', '', r.sinfin && !r.sigue ? 'Te relevaron del cargo' : r.est >= 3 ? 'Un día redondo' : r.est === 2 ? 'Buen día de servicio' : r.est === 1 ? 'Día salvado, por poco' : 'Un día para olvidar'),
            el('p', 'estrellas', estrellasTxt(r.est)),
            el('p', 'reto' + (r.reto ? ' hecho' : ''), `${r.reto ? '◆ Reto cumplido' : '◇ Reto pendiente'}: ${Dd.reto.t.charAt(0).toLowerCase() + Dd.reto.t.slice(1)} · ${Dd.reto.valor(s)}` + (r.reto && r.premio ? ` · premio de ${plata(r.premio)}` : '')),
            dl, grafico(s, Dd.meta), porQue(s, r), cuentas(c, r.saldo));
        const dias = (q) => `${q} ${q === 1 ? 'día' : 'días'}`;
        if (r.sinfin) caja.append(el('p', 'consejo' + (r.record ? ' record' : ''), (r.sigue ? `Día ${Dd.numero} superado: llevas ${dias(r.aguantados)} en el turno sin fin` : (r.quiebra ? 'El día dejó la caja en rojo, y sin plata no hay Metro. ' : `Hacía falta un ánimo de ${Dd.meta - 10} para seguir. `) + `Aguantaste ${dias(r.aguantados)} en el turno sin fin`) + (r.record ? ', y es tu récord.' : `. Tu récord es de ${dias(r.mejor)}.`) + (r.sigue ? '' : r.quiebra ? ' El Municipio cubre el hueco y te deja un fondo de $3.000 para el próximo intento; las mejoras se conservan.' : ' Conservas la caja y las mejoras para el próximo intento.')));
        else if (r.est === 0) caja.append(el('p', 'consejo', `Hacía falta un ánimo de ${Dd.meta - 10} para pasar al día siguiente. Hay que repetir el ${Dd.n.toLowerCase()}.`));
        else if (!r.supera) caja.append(el('p', 'nota', `No superaste tu mejor resultado de este día (${estrellasTxt(r.antes.estrellas)}, ánimo ${Math.round(r.antes.animo)}): la caja se queda como estaba.`));
        (r.logros || []).forEach((l) => caja.append(con(el('p', 'logro'), el('strong', '', `✦ Logro: ${l.n}. `), l.d)));
        consejos.forEach((t) => caja.append(el('p', 'consejo', t)));
        // Las misiones: cuáles avanzaron, cuáles se cumplieron y cuáles vencieron.
        if (r.misiones && r.misiones.length) {
            caja.append(el('h3', '', 'Misiones'));
            r.misiones.forEach(({ m, estado, premio, a }) => caja.append(el('p', 'mision ' + estado,
                estado === 'hecha' ? `◆ ${m.n}: cumplida. ${m.de} te paga ${plata(premio)}.`
                    : estado === 'vencida' ? `◇ ${m.n}: se venció el plazo (${progresoTxt(m, a).split(' · ')[0]}).`
                        : `${estado === 'avanza' ? '▲' : estado === 'corta' ? '↺' : '·'} ${m.n}: ${estado === 'corta' ? 'se cortó la racha. ' : estado === 'nada' ? 'hoy no sumó. ' : ''}${progresoTxt(m, a)}.`)));
        }
        const estrenos = r.sinfin || r.est === 0 ? [] : MEJORAS.filter((mj) => mj.desde === k + 1);
        caja.append(el('p', 'nota', `En caja: ${plata(partida.caja)}.` + (estrenos.length ? ` Nuevo en la tienda: ${estrenos.map((mj) => mj.n).join(', ')}.` : '')));
        const pie = acciones();
        if (r.sinfin) pie.append(boton(r.sigue ? `Día ${Dd.numero + 1} →` : 'Empezar otro turno →', () => semana(DIAS.length), 'on'), boton('La semana', () => semana(DIAS.length - 1)));
        else if (partida.perdida) pie.append(boton('Ver el cierre de la semana →', pantallaPerdida, 'on'));
        else {
            // A media semana, con la caja en rojo, antes del jueves pasa el directorio.
            if (r.est > 0 && k + 1 < DIAS.length) pie.append(boton(`${DIAS[k + 1].n}: ${DIAS[k + 1].t} →`, () => (k === 2 && partida.caja < 0 ? cuentasSemana(() => semana(k + 1), true) : semana(k + 1)), 'on'));
            else if (r.est > 0) pie.append(boton('Ver el final →', final, 'on'));
            pie.append(boton('Repetir el día', () => empezar(k), r.est === 0 ? 'on' : ''), boton('La semana', () => semana(k)));
        }
        caja.append(pie);
    };
    /** El final de la semana: el rango y las cuentas de los siete días. */
    const final = () => {
        partida.fin = true; guardar();
        const n = totalEstrellas(partida), rango = rangoDe(n), dias = partida.dias.filter(Boolean), suma = (k) => dias.reduce((a, d) => a + (d[k] || 0), 0);
        const dl = el('dl', 'datos');
        [['Estrellas', `${n} de ${DIAS.length * 3}`], ['Retos cumplidos', `${partida.retos.filter(Boolean).length} de ${DIAS.length}`], ['Viajes en la semana', miles(suma('viajes'))], ['Kilómetros de tren', miles(suma('km'))], ['Se fueron sin viajar', miles(suma('idos'))], ['Caja final', plata(partida.caja)], ['Tiempo de juego', `${Math.max(1, Math.round(partida.segundos / 60))} min`]]
            .forEach(([q, val]) => dl.append(con(el('div'), el('dt', '', q), el('dd', '', val))));
        const lista = el('div', 'dias');
        DIAS.forEach((d, k) => { const b = boton('', () => semana(k), 'dia'); b.append(el('strong', '', d.corto), el('span', '', partida.dias[k] ? `ánimo ${Math.round(partida.dias[k].animo)}` : d.t), el('em', '', estrellasTxt(partida.estrellas[k] || 0) + (partida.retos[k] ? ' ◆' : ''))); lista.append(b); });
        const sig = RANGOS[RANGOS.indexOf(rango) - 1];
        modal(el('p', 'zona', 'Domingo 6 de diciembre · 22:00 · cierra el Metro'), el('h2', 'grande', rango.n), el('p', 'estrellas', `★ ${n}`),
            el('p', 'texto', rango.d), el('p', 'texto', 'Terminó la semana de Fiestas de Quito. Los últimos trenes entran a la cochera de Quitumbe, en las estaciones barren el confeti, y mañana a las 05:30 todo empieza de nuevo.'),
            el('p', 'consejo', 'Y empieza de verdad: en el turno sin fin los días salen al azar, cada uno con más gente y más imprevistos que el anterior, hasta que la línea no dé más. Ahí la tienda ofrece trenes nuevos.'),
            dl, lista, el('p', 'nota', sig ? `Con ${sig.de} estrellas subes a «${sig.n}». Toca un día para repetirlo.` : 'No hay rango más alto. Queda repetir los días por gusto.'),
            el('p', 'nota', 'Jefe de línea está hecho sobre el mapa real de Quito (© colaboradores de OpenStreetMap). La tarifa, la flota, los horarios y la granizada del viernes salen de la operación real del Metro; los costos y las decisiones son inventados.'),
            acciones(boton('Turno sin fin →', () => semana(DIAS.length), 'on'), boton('La semana', () => semana(DIAS.length - 1)), boton('Menú principal', titulo), boton('Volver al mapa', salir)));
    };

    const ayuda = (volver) => {
        const seccion = (t, ...p) => [el('h3', '', t), ...p.map((x) => el('p', 'texto', x))];
        modal(el('p', 'zona', 'Jefe de línea'), el('h2', '', 'Cómo se juega'),
            ...seccion('Lo que tienes que lograr', 'La gente califica tres cosas: la fila para pagar, la espera en el andén y qué tan apretada viaja. De ahí sale el ánimo, de 0 a 100. Cada día tiene una meta: llegar a ella da dos estrellas; pasarla por diez puntos sin cerrar la caja del día en rojo, tres. Con una estrella se abre el día siguiente.'),
            ...seccion('La línea de abajo', 'Es el Metro estirado, con sus 15 estaciones de sur a norte. El color de cada cuadro es el ánimo ahí. Las barras claras son la gente que espera (hacia arriba, al norte; hacia abajo, al sur) y la barrita amarilla es la fila de la boletería. Toca una estación o un tren para abrir su ficha.'),
            ...seccion('Horario', 'Para cada franja del día decides cada cuántos minutos sale un tren. Menos intervalo es menos espera y trenes menos llenos, pero más gasto. El pronóstico de viajes de cada franja te dice dónde hace falta y dónde sobra. Sábados, domingos y feriados tienen otras franjas (no hay picos de oficina) y su propio horario, que se guarda aparte; desde el sábado, «Sugerir horario» arma uno con el pronóstico.'),
            ...seccion('Boleterías', 'Quien tiene tarjeta pasa directo. El resto paga en ventanilla (efectivo) o en máquina (efectivo justo o tarjeta bancaria). Si la fila pasa de cinco minutos, la gente se va. Las ventanillas cuestan por hora; las máquinas se compran una vez.'),
            ...seccion('Trenes', 'Tienes 18, de 1.230 pasajeros cada uno. «Tren extra» manda uno vacío desde una cabecera cuando un andén no da más. En «Trenes» ves toda la flota, y cada tren y cada estación se pueden mirar por dentro.'),
            ...seccion('Imprevistos', 'Aguaceros, averías, eventos y estaciones que se cierran por el agua. A veces el Puesto Central te pide una decisión: el reloj se detiene y cada opción tiene su costo.'),
            ...seccion('La semana y lo que viene después', 'Cada día entrega algo nuevo: el lunes solo decides el horario; el martes llegan las boleterías; el miércoles, los trenes de refuerzo; el jueves, las decisiones; el viernes, los cierres por lluvia; el sábado, el fin de semana; y el domingo va todo junto. La tienda también se va abriendo. Al terminar la semana empieza el turno sin fin: días al azar, cada vez más cargados, hasta que un día el ánimo no alcance.'),
            ...seccion('Misiones', 'Desde el martes, en el tablero se ofrecen encargos de varios días: tres días seguidos con poca espera, el sur contento, cuentas claras… Puedes llevar dos a la vez. Tienen plazo en días jugados y pagan un premio.'),
            ...seccion('Lo que queda para mañana', 'Algunas decisiones no terminan ese día: un video sin respuesta, unos vendedores a los que se dejó quedarse, una escalera que se arregla «en la noche». El tablero del día siguiente dice qué dejó el anterior.'),
            ...seccion('El informe', 'Al final de cada día, «Por qué salió así» reparte lo que le faltó al ánimo para llegar a 100 entre sus causas, y explica las tres que más pesaron: dónde, a qué hora y qué se podría haber hecho.'),
            ...seccion('La caja', 'Lo que sobra de cada día va a la caja, y de ahí sale la tienda. Si a mitad de semana la caja está en rojo, el directorio te dice dónde recortar. Si la semana termina en rojo, pierdes el cargo y la partida. En el turno sin fin, un día que deja la caja en rojo también lo termina.'),
            ...seccion('Guardado', 'Todo se guarda solo: los días terminados, las compras y también el turno en curso. Si cierras la página a medias, al volver sigues donde estabas. El botón Salir, en cambio, descarta lo avanzado de hoy (las máquinas compradas se conservan y se cobran).'),
            ...seccion('Teclas', 'Espacio: pausa · 1, 2, 3: velocidad · H: horario · B: boleterías · T: trenes · I: ver por dentro · Esc: cerrar. En el teléfono, todo se hace tocando; el mapa se mueve con un dedo y se acerca con dos.'),
            acciones(boton('Entendido', volver, 'on')));
    };

    // ───────────────────────── Lo que el mapa le pide al juego ─────────────────────────
    const colorCarga = (t) => { const l = t.total / JEFE.CAPACIDAD; return l > 0.95 ? '#E0314F' : l > 0.7 ? '#FF8A3D' : l > 0.35 ? '#FFE9A8' : '#E6F4FF'; };
    const colorAnimo = (a) => (a >= 75 ? '#3DDC84' : a >= 55 ? '#F2C200' : '#E0314F');
    const colorTren = (t) => (t.estado === 'averiado' ? (Math.floor(S.time * 4) % 2 ? '#E0314F' : '#2A2A2E') : colorCarga(t));
    /** Cómo se reparte la tira de abajo según el tamaño del dibujo. En pantallas angostas las estaciones van parejas, como en un plano de Metro. */
    const tira = (W, H) => {
        const alto = H < 250 ? 52 : 66, y0 = H - alto, mx = W < 300 ? 10 : W < 480 ? 18 : 30, x0 = mx, x1 = W - mx;
        const dos = W < 300, bajo = alto === 52, yc = y0 + (bajo ? 21 : dos ? 24 : 28), hb = bajo ? 11 : dos ? 13 : 18, f = clamp((480 - W) / 180, 0, 1);
        const xe = sim.est.map((e, i) => Math.round(x0 + (x1 - x0) * ((1 - f) * e.pos / sim.L + f * i / (N - 1))));
        const px = (pos) => { let i = 0; while (i < N - 2 && sim.est[i + 1].pos < pos) i++; const a = sim.est[i], b = sim.est[i + 1]; return Math.round(xe[i] + (xe[i + 1] - xe[i]) * clamp((pos - a.pos) / (b.pos - a.pos), 0, 1)); };
        return { alto, y0, x0, x1, yc, hb, dos, bajo, xe, px, porPx: bajo || dos ? 90 : 60 };
    };

    const extra = {
        get alto() { return Q.H < 250 ? 52 : 66; },
        paso(dt) {
            if (!sim) return;
            if (sim.terminado) { terminar(); return; }
            if (vel && !decision) { sim.avanzar(dt * VEL[vel]); partida.segundos += dt; if ((ahorro += dt) > 5) { ahorro = 0; guardarTurno(); } }
            S.hour = (sim.t / 60) % 24;
            if (sim.lluvia !== llueve) { llueve = sim.lluvia; M.setWeather(llueve ? 'rain' : 'clear'); }
            const deFiesta = !!D.fiestas && sim.t / 60 >= D.fiestas;
            if (deFiesta !== fiesta) { fiesta = deFiesta; S.fiestas = fiesta; M.syncButtons(); }
            while (sim.avisos.length) avisar(sim.avisos.shift());
            if (sim.decisiones.length && !decision) mostrarDecision(sim.decisiones[0]);
            if ((refresco += dt) > 0.25) { refresco = 0; refrescar(); }
            if (sim.terminado) terminar();
        },
        /** Si se está viendo una estación o un tren por dentro, lo pinta entero (con la tira de abajo) y el mapa no se dibuja. */
        dentro(v, W, H) {
            if (!sim || !vista) return false;
            const HH = H - this.alto;
            try {
                if (vista === 'est') Q.dentro(v, W, HH, sim, sel, zonas, (d) => etaEn(sel, d));
                else {
                    const t = sim.trenes.find((q) => q.id === selTren);
                    if (!t) return false;
                    Q.dentroTren(v, W, HH, sim, t, { proxima: sim.est[t.sig].n, en: sim.est[t.sig].n, destino: sim.est[sim.tramo[t.dir ? 0 : 1]].n, eta: etaTren(t) });
                }
            } catch (e) {
                // Si el dibujo del interior falla, el día no se detiene: se vuelve al mapa y se deja constancia.
                console.error('Jefe de línea: no se pudo dibujar el interior', e);
                verDentro(''); return false;
            }
            this.dibujar(v, W, H);
            return true;
        },
        /** Los trenes sobre la línea de verdad, y cómo va cada estación. */
        mundo(v, X, Y, m, metro, enCamino) {
            if (!sim) return;
            const s0 = largos[0], n = m <= 2 ? 6 : m === 8 ? 3 : 1, sep = m <= 2 ? 18 : 40, r = m === 1 ? 3 : m === 2 ? 2 : 1;
            enMapa.length = 0;
            for (const t of sim.trenes) {
                if (!activo(t)) continue;
                const col = colorTren(t);
                for (let k = 0; k < n; k++) {
                    const q = enCamino(metro.p, metro.a, clamp(s0 + sim.ver(t) + (t.dir === 0 ? -1 : 1) * k * sep, 0, metro.largo)), x = X(q[0]), y = Y(q[0], q[1]);
                    if (x < -6 || y < -6 || x > Q.W + 6 || y > Q.H + 6) continue;
                    if (k === 0) { enMapa.push({ t, x, y }); if (t.id === selTren) [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([dx, dy]) => R(v, x + dx * (r > 1 ? 1 : 0.75), y + dy * (r > 1 ? 1 : 0.75), 1, 1, '#FFE500')); }
                    R(v, x - r, y - r, r * 2 + 1, r * 2 + 1, '#1F4FA3'); if (r > 1) R(v, x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, col); else R(v, x, y, 1, 1, col);
                }
            }
            // Lo que pasa en la ciudad (la gente que sale del estadio, el tramo inundado) lo dibuja js/metro-ciudad.js, si está.
            if (Q.ciudad && !sinCiudad) { try { Q.ciudad(v, X, Y, m, metro, enCamino); } catch (e) { sinCiudad = true; console.error('Jefe de línea: la capa de ciudad falló y se apagó', e); } }
            if (!reales || m > 8) return;
            sim.est.forEach((e, i) => {
                const p = metro.est[i], x = X(p.x), y = Y(p.x, p.y); if (x < -10 || y < -10 || x > Q.W + 10 || y > Q.H + 10) return;
                if (sim.cerrada(i)) { R(v, x - 4, y - 4, 9, 9, '#0B1020'); for (let k = -3; k <= 3; k++) { R(v, x + k, y + k, 1, 1, '#E0314F'); R(v, x + k, y - k, 1, 1, '#E0314F'); } }
                else {
                    const gente = e.anden[0].total + e.anden[1].total + e.colaTotal, h = Math.min(14, Math.ceil(gente / 120));
                    R(v, x + 5, y - 3, 3, 7, '#0B1020'); R(v, x + 6, y - 2, 1, 5, colorAnimo(e.animo));
                    if (h) { R(v, x - 7, y + 3 - h, 3, h + 1, '#0B1020'); R(v, x - 6, y + 4 - h, 1, h, gente > 1500 ? '#E0314F' : '#FFE9A8'); }
                }
                if (i === sel) [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([dx, dy]) => R(v, x + dx, y + dy, 1, 1, '#FFE500'));
            });
        },
        /** La tira de abajo: la línea estirada, con sus andenes y sus trenes. */
        dibujar(v, W, H) {
            if (!sim) return;
            if (Q.ciudad && Q.ciudad.encima && !sinCiudad && !vista) { try { Q.ciudad.encima(v); } catch (e) { sinCiudad = true; console.error('Jefe de línea: la capa de ciudad falló y se apagó', e); } }
            const T = tira(W, H), { y0, yc, xe, hb } = T, alto = T.alto;
            v.globalAlpha = 0.93; R(v, 0, y0, W, alto, '#0B1020'); v.globalAlpha = 1; R(v, 0, y0, W, 1, '#2C3A66');
            // Las dos vías. Donde el servicio está cortado, apagadas.
            const xa = xe[sim.tramo[0]], xb = xe[sim.tramo[1]];
            for (const dy of [-3, 3]) { R(v, T.x0, yc + dy, T.x1 - T.x0 + 1, 1, '#27304F'); R(v, xa, yc + dy, xb - xa + 1, 1, '#5E72A8'); }
            Q.text(v, 'S', 2, yc - 2, '#8FA3D9'); Q.text(v, 'N', W - 5, yc - 2, '#8FA3D9');
            sim.est.forEach((e, i) => {
                const x = xe[i], a = e.anden, cerrada = sim.cerrada(i);
                // La gente que espera: al norte hacia arriba, al sur hacia abajo.
                const barra = (an, sube) => {
                    if (an.total < 15) return;
                    const h = Math.min(hb, Math.ceil(an.total / T.porPx)), col = an.total > JEFE.CAPACIDAD ? '#E0314F' : an.edad / an.total > 6 ? '#FF8A3D' : '#C8D4F0';
                    R(v, x - 1, sube ? yc - 6 - h : yc + 7, 3, h, col);
                    if (an.total > JEFE.CAPACIDAD && Math.floor(S.time * 3) % 2) R(v, x - 1, sube ? yc - 7 - h : yc + 7 + h, 3, 1, '#FFFFFF');
                };
                if (i < N - 1) barra(a[0], true); if (i > 0) barra(a[1], false);
                // La fila de la boletería, a un lado, en amarillo; en rojo si ya pasa de cuatro minutos.
                if (e.colaTotal > 10) { const h = Math.min(T.bajo ? 8 : 12, Math.ceil(e.colaTotal / 25)); R(v, x + 4, yc - 1 - h, 2, h, e.esperaB > 4 ? '#E0314F' : '#F2C200'); }
                R(v, x - 3, yc - 3, 7, 7, i === sel ? '#FFE500' : cerrada ? '#5A6070' : '#FFFFFF');
                if (cerrada) { R(v, x - 2, yc - 2, 5, 5, '#1B2030'); for (let k = -2; k <= 2; k++) { R(v, x + k, yc + k, 1, 1, '#E0314F'); R(v, x + k, yc - k, 1, 1, '#E0314F'); } }
                else R(v, x - 2, yc - 2, 5, 5, colorAnimo(e.animo));
                const w = Q.textW(e.c);
                Q.text(v, e.c, clamp(x - Math.floor(w / 2), 1, W - w - 1), y0 + alto - (T.dos && i % 2 === 0 ? 15 : 8), i === sel ? '#FFE500' : cerrada ? '#E0314F' : '#C8D4F0');
            });
            for (const t of sim.trenes) {
                if (!activo(t)) continue;
                const x = T.px(sim.ver(t)), norte = t.dir === 0, y = norte ? yc - 2 : yc + 2, ww = T.dos ? 7 : 9, m = ww >> 1;
                if (t.id === selTren) R(v, x - m - 1, y - 2, ww + 2, 5, '#FFE500');
                R(v, x - m, y - 1, ww, 3, '#1F4FA3'); R(v, x - m + 1, y, ww - 2, 1, colorTren(t)); R(v, norte ? x + m : x - m, y, 1, 1, '#FFFFFF');
            }
            // Los trenes guardados en cada cabecera.
            for (let cab = 0; cab < 2; cab++) {
                const n = sim.trenes.filter((t) => (t.estado === 'cochera' || t.estado === 'listo') && t.cab === cab).length, txt = String(n), w = Q.textW(txt);
                R(v, cab ? W - 8 : 2, y0 + 4, 6, 3, n ? '#5E72A8' : '#27304F'); Q.text(v, txt, cab ? W - 10 - w : 10, y0 + 3, n ? '#8FA3D9' : '#4A5680');
            }
            // La guía señala dónde mirar.
            if (tut.on && !decision) {
                const p = PASOS[tut.k], sube = Math.floor(S.time * 3) % 2;
                if (p.tira && sube) { R(v, 0, y0, W, 1, '#FFE500'); R(v, 0, H - 1, W, 1, '#FFE500'); R(v, 0, y0, 1, alto, '#FFE500'); R(v, W - 1, y0, 1, alto, '#FFE500'); }
                if (p.est !== undefined && !vista) { const x = xe[p.est], y = yc - hb - 13 + sube * 2; R(v, x - 1, y - 6, 3, 7, '#FFE500'); R(v, x - 3, y + 1, 7, 1, '#FFE500'); R(v, x - 2, y + 2, 5, 1, '#FFE500'); R(v, x - 1, y + 3, 3, 1, '#FFE500'); R(v, x, y + 4, 1, 1, '#FFE500'); }
            }
        },
        clic(x, y, s) {
            if (!sim) return false;
            if (decision) return true;
            if (y >= Q.H - this.alto) {
                const T = tira(Q.W, Q.H); let ie = -1, de = 1e9, tr = null, dt = 6;
                T.xe.forEach((xx, i) => { const d = Math.abs(x - xx); if (d < de) { de = d; ie = i; } });
                for (const t of sim.trenes) { if (!activo(t)) continue; const d = Math.abs(x - T.px(t.s)), ty = t.dir === 0 ? T.yc - 2 : T.yc + 2; if (d < dt && Math.abs(y - ty) <= 3) { dt = d; tr = t; } }
                // Un tren se elige tocándolo entre dos estaciones; encima de una estación, gana la estación.
                if (tr && de > 4) elegirTren(tr.id, true);
                else if (ie >= 0 && de < 16) elegir(ie, true);
                return true;
            }
            if (vista === 'est') {     // dentro de la estación: las ventanillas se abren y se cierran tocándolas, y la casilla vacía compra una máquina
                const z = zonas.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h), e = sim.est[sel];
                if (!puede('boleterias')) return true;
                if (z && z.tipo === 'ventanilla') { orden('ventanillas', sel, z.abierta ? z.k : z.k + 1); partida.ventanillas = sim.est.map((q) => q.ventanillas); son('click'); refrescar(); }
                else if (z && z.tipo === 'maquina' && disponible() >= JEFE.COSTO.maquina) { orden('maquina', sel); son('purchase'); refrescar(); }
                return true;
            }
            if (vista) return true;
            let tr = null, dt = 8;
            for (const q of enMapa) { const d = Math.hypot(q.x - x, q.y - y); if (d < dt) { dt = d; tr = q.t; } }
            if (s && s.est && reales) elegir(M.metro.est.indexOf(s), false);
            else if (tr) elegirTren(tr.id, false);
            return true;      // durante el juego, el mapa no abre fichas de lugares ni suelta cometas
        },
        tecla(k, e) {
            if (!sim) return false;
            if (decision || !fin.hidden) { e.preventDefault(); return true; }
            if (k === ' ') { e.preventDefault(); vel = vel ? 0 : 1; if (!vel) guardarTurno(); son('click'); refrescar(); return true; }
            if (k === '1' || k === '2' || k === '3') { vel = +k; son('click'); refrescar(); return true; }
            if (k === 'i' && (sel >= 0 || selTren > 0)) { verDentro(vista ? '' : sel >= 0 ? 'est' : 'tren'); return true; }
            if (k === 'h') { abrirPanel('horario'); return true; }
            if (k === 'b') { if (puede('boleterias')) abrirPanel('boleterias'); return true; }
            if (k === 't') { if (puede('trenes')) abrirPanel('trenes'); return true; }
            if (k === 'escape') { if (vista) verDentro(''); else if (!ficha.hidden) cerrarFicha(); else cerrarPanel(); return true; }
            if (vista && (k === 'v' || k === '+' || k === '-' || k === '=' || k === '_' || k === 'm')) return true;
            return k === 'n' || k === 'r' || k === 'f';      // la hora y el clima los pone el día, no el teclado
        },
    };

    // ───────────────────────── Botones ─────────────────────────
    [...ui.vel.children].forEach((b, i) => b.addEventListener('click', () => { if (decision) return; vel = i || (vel ? 0 : 1); if (!vel) guardarTurno(); refrescar(); }));      // al pausar, el turno queda guardado en ese instante
    ui.bhor.addEventListener('click', () => abrirPanel('horario'));
    ui.bbol.addEventListener('click', () => abrirPanel('boleterias'));
    ui.btre.addEventListener('click', () => abrirPanel('trenes'));
    const refuerzo = (cab) => { if (sim && orden('refuerzo', cab)) avisar({ tipo: 'bien', sonido: 'tren', texto: `Sale un tren vacío de ${sim.est[sim.tramo[cab]].n} hacia el ${cab ? 'sur' : 'norte'}.`, i: -1 }); refrescar(); };
    ui.sur.addEventListener('click', () => refuerzo(0));
    ui.nor.addEventListener('click', () => refuerzo(1));
    ui.ayuda.addEventListener('click', () => {
        // La ayuda se abre encima del día, que queda en pausa y sigue donde estaba.
        const antes = vel; vel = 0; refrescar();
        const seccion = (t, x) => [el('h3', '', t), el('p', 'texto', x)];
        fin.hidden = false; fin.textContent = '';
        fin.append(con(el('div', 'caja'), el('p', 'zona', `${D.n} · en pausa`), el('h2', '', 'Cómo se juega'),
            ...seccion('La meta', D.meta ? `Hoy hace falta un ánimo de ${D.meta} para dos estrellas, y de ${D.meta + 10} sin cerrar la caja en rojo para tres.` : 'Hoy no se califica.'),
            ...seccion('La línea de abajo', 'Cuadros: estaciones, con el color de su ánimo. Barras claras: gente esperando (arriba, al norte; abajo, al sur). Barrita amarilla: la fila de la boletería. Una equis roja: estación cerrada.'),
            ...seccion('Lo que decides', 'Horario: cada cuánto sale un tren en cada franja.' + (puede('boleterias') ? ' Boleterías: ventanillas y máquinas.' : ' De las boleterías, hoy se encarga el Puesto Central.') + (puede('trenes') ? ' Tren extra: un tren vacío, ya.' : '') + (dia >= 3 ? ' Y las decisiones que te pida el Puesto Central.' : '')),
            ...seccion('Teclas', 'Espacio: pausa · 1, 2, 3: velocidad · H: horario · B: boleterías · T: trenes · I: ver por dentro · Esc: cerrar.'),
            acciones(boton('Seguir', () => { fin.hidden = true; vel = antes; refrescar(); }, 'on'))));
    });
    ui.salir.addEventListener('click', () => { if (!sim) return; if (sim.t < sim.abre + 20 || confirm('¿Dejar el día y empezarlo de nuevo otra vez? Se descarta lo avanzado de hoy; si solo quieres parar, cierra la página: el turno queda guardado.')) { const era = dia; dejar(); semana(era >= DIAS.length ? DIAS.length : Math.max(0, era)); } });
    addEventListener('resize', () => { if (sim) refrescar(); });
    const jugar = $('#jugar');
    let entrando = false;
    const entrada = el('div'); entrada.id = 'jentrada'; entrada.hidden = true;
    const velo = el('div', 'velo'), rotulo = el('p', 'rotulo'), saltar = boton('Saltar animación', () => M.terminarEntrada());
    rotulo.setAttribute('role', 'status'); con(entrada, velo, rotulo, saltar); $('#stage').append(entrada);
    addEventListener('keydown', (e) => {
        if (!entrando) return;
        if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); M.terminarEntrada(); }
    });
    if (jugar) jugar.addEventListener('click', async () => {
        if (entrando || sim) return;
        entrando = true; jugar.disabled = true;
        const estacion = M.estacionCercana(), reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const fondo = [...$('#stage').children].filter((e) => e !== entrada), inertes = fondo.map((e) => e.inert);
        try {
            if (!almacen.partidas[almacen.actual]) { partida = nueva(); guardar(); }
            if (!reducir) {
                if (Q.ficha) Q.ficha.cerrar();
                document.body.classList.add('entrando'); fondo.forEach((e) => { e.inert = true; });
                entrada.hidden = false; entrada.dataset.estacion = String(estacion);
                rotulo.textContent = `Entrando a ${M.metro.est[estacion].nombre}`;
                velo.style.opacity = '0'; saltar.focus();
                await M.acercarEstacion(estacion, (p) => { velo.style.opacity = String(clamp((p - 0.78) / 0.22)); });
            }
            if (partida.perdida) { titulo(); return; }
            // Si quedó un turno a medias, se vuelve a él; si no, empieza el día que toca.
            if (!(partida.turno && reanudar(estacion))) empezar(partida.dia >= DIAS.length ? sinFin().n - 1 : partida.dia, estacion);
            if (!reducir) {
                rotulo.textContent = `Bienvenido a ${M.metro.est[estacion].nombre}`;
                await velo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished;
            }
        } finally {
            M.terminarEntrada(); entrada.hidden = true; velo.getAnimations().forEach((a) => a.cancel());
            document.body.classList.remove('entrando'); fondo.forEach((e, i) => { e.inert = inertes[i]; });
            entrando = false; jugar.disabled = false;
            if (sim) ui.vel.children[0].focus({ preventScroll: true });
        }
    });
    const partidas = $('#partidas'); if (partidas) partidas.addEventListener('click', titulo);

    // Para las capas que se enganchan desde fuera (música, ciudad): el día en curso y su simulación, o null en los menús.
    Q.juego = { titulo, semana, empezar, reanudar, salir, trayectoria, get sim() { return sim; }, get dia() { return sim ? D : null; }, get partida() { return partida; }, get logros() { return almacen.logros; } };
    addEventListener('visibilitychange', () => { if (document.hidden) guardarTurno(); });
    addEventListener('pagehide', () => guardarTurno());

    // Para probar sin jugar: arranca un día, lo adelanta y lo deja a la vista.
    if (params.get('juego') === '1') {
        const k = params.has('jdia') ? +params.get('jdia') : 0, menu = params.get('jmenu');
        if (params.has('jcaja')) partida.caja = +params.get('jcaja');
        if (params.has('jsemilla')) partida.sinfin = { n: Math.max(DIAS.length + 1, k + 1), semilla: +params.get('jsemilla'), mejor: +params.get('jmejor') || 0 };
        if (params.has('jhecho')) { const n = +params.get('jhecho'); partida.dia = n; for (let i = 0; i < n; i++) { partida.estrellas[i] = 2 + (i % 2); partida.retos[i] = i % 2 === 0; partida.dias[i] = { estrellas: partida.estrellas[i], animo: 80 + i, operativo: 3000, saldo: 3000, viajes: 205000, km: 6800, idos: 900, premio: 0 }; } }
        if (menu === 'titulo') { if (params.has('jhecho')) almacen.partidas[0] = partida; titulo(); M.repintar(); return; }
        if (menu === 'semana' || menu === '1') { semana(k); M.repintar(); return; }
        if (menu === 'final') { final(); M.repintar(); return; }
        if (menu === 'ayuda') { ayuda(titulo); M.repintar(); return; }
        if (params.get('jplan') === 'real') partida.horario = [8, 5, 8, 8, 8, 5, 8];
        empezar(k); avisos.textContent = '';
        const hasta = params.get('jfin') === '1' ? 1e9 : +params.get('jt') || 450, deja = params.get('jdec') === '1';
        if (params.has('jguia') && GUIAS[k]) { PASOS = GUIAS[k]; tutIr(+params.get('jguia')); }
        while (!sim.terminado && sim.t < hasta) { sim.avanzar(Math.min(5, hasta - sim.t)); if (sim.decisiones.length) { if (deja && sim.t >= hasta - 6) break; sim.decidir(sim.decisiones[0], 0); } }
        sim.avisos.splice(0, Math.max(0, sim.avisos.length - 2));
        S.hour = (sim.t / 60) % 24; extra.paso(0);
        if (sim && !sim.terminado) {
            if (params.has('jpanel')) { cerrarPanel(); abrirPanel(params.get('jpanel')); } else if (params.get('jhor') !== '1') cerrarPanel();
            if (params.has('jsel')) elegir(+params.get('jsel'), true);
            if (params.has('jtren')) elegirTren(+params.get('jtren'), true);
            if (params.get('jdentro') === '1') verDentro(sel >= 0 ? 'est' : 'tren');
            refrescar();
        }
        M.repintar();
    } else if (location.hash === '#juego') titulo();
})();
