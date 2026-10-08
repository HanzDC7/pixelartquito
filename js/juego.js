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
 *   jdia=-1 es la inducción; de 0 a 6, la semana; 7 o más, el turno sin fin (con jsemilla=123 para fijar el azar)
 *   jtren=3 elige un tren · jdentro=1 lo muestra por dentro · jguia=0 deja a la vista ese paso de la guía del día
 *   jfin=1 corre el día entero · jmenu=titulo|semana|final|ayuda (con jhecho=7 para dar la semana por terminada)
 *   jdec=1 deja a la vista la decisión pendiente
 * Los recorridos completos, con un navegador de verdad, están en tools/playtest*.py.
 */
(() => {
    const { R, clamp } = Q, S = Q.state, M = Q.mapa, $ = (s) => document.querySelector(s);
    if (!M || !M.metro || typeof JEFE === 'undefined' || typeof CAMPANA === 'undefined') return;
    const N = JEFE.N, params = new URLSearchParams(location.hash.slice(1));
    const { TUTORIAL, DIAS, MEJORAS, RANGOS } = CAMPANA;
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
        tarjeta: 0, cajeros: 0, anden: 0, pantallas: 0, mantenimiento: 0, taller: 0, jefes: 0, bombas: 0, trenes: 0,
        horario: [8, 8, 8, 8, 8, 8, 8], ventanillas: null, notas: {}, tutorial: false, fin: false, segundos: 0, fecha: 0,
        guias: [],          // qué días ya se jugaron con su guía
        sinfin: null,       // el turno sin fin: { n: día por jugar, semilla, mejor: récord de días }
    });
    let almacen = { v: 2, actual: 0, partidas: Array(HUECOS).fill(null) }, partida = nueva();
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
        if (g && g.v === 2 && Array.isArray(g.partidas)) almacen = g;
        else if (g && Array.isArray(g.maquinas) && g.maquinas.length === N) {
            // Una partida de la primera versión, de cinco días: se conservan la caja, las mejoras y los cuatro primeros días, que son los mismos.
            const p = Object.assign(nueva(), g); p.estrellas = (g.estrellas || []).slice(0, 4); p.dia = Math.min(g.dia || 0, 4); p.tutorial = p.estrellas.length > 0; p.dias = []; p.retos = [];
            almacen.partidas[0] = p;
        }
    } catch (e) { /* sin almacenamiento, la partida dura lo que dure la visita */ }
    const cargar = (k) => { almacen.actual = k; partida = Object.assign(nueva(), almacen.partidas[k] || {}); };
    if (almacen.partidas[almacen.actual]) cargar(almacen.actual);
    const guardar = () => { if (prueba) return; partida.fecha = Date.now(); almacen.partidas[almacen.actual] = partida; try { localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* idem */ } };
    const totalEstrellas = (p) => (p.estrellas || []).reduce((a, b) => a + (b || 0), 0);
    const rangoDe = (n) => RANGOS.find((r) => n >= r.de);

    // ───────────────────────── Estado del día ─────────────────────────
    const VEL = [0, 2.5, 5, 10];          // minutos de juego por segundo real: pausa, ×1, ×2, ×4. A ×1, un día dura unos siete minutos
    let sim = null, dia = 0, D = null, vel = 0, sel = -1, selTren = 0, llueve = 0, fiesta = false, refresco = 0;
    let vista = '';                        // '' el mapa · 'est' la estación elegida por dentro · 'tren' el tren elegido por dentro
    let panel = '', panelAct = null, fichaAct = null, decision = null, velAntes = 1;
    const zonas = [], enMapa = [];         // lo que responde al clic dentro de una estación, y dónde quedó cada tren en el mapa
    const activo = (t) => t.estado !== 'cochera' && t.estado !== 'taller' && t.estado !== 'listo';
    const estrellasDe = (animo, saldo, meta) => (animo >= meta + 10 && saldo >= 0 ? 3 : animo >= meta ? 2 : animo >= meta - 10 ? 1 : 0);
    const disponible = () => (dia < 0 ? 99999 : partida.caja - sim.cuenta.compras);     // lo que hay en caja para comprar ahora
    /** Cada día de la semana entrega algo nuevo: las boleterías llegan el martes y los trenes de refuerzo, el miércoles. */
    const DESDE = { boleterias: 1, trenes: 2 };
    const puede = (que) => dia < 0 || dia >= DESDE[que];

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
        ui.barra = el('i'); ui.meta = el('em'); ui.reto = el('p', 'jreto');
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
            ui.reto,
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
        const d = boton(a.texto, () => { if (a.i >= 0 && sim) elegir(a.i, true); d.remove(); }, 'aviso ' + (a.tipo || 'info'));
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
            pan.append(cabecera('Horario'), nota);
            const filas = JEFE.FRANJAS.map((f, i) => {
                const k = () => JEFE.INTERVALOS.indexOf(sim.horario[i]);
                const poner = (j) => { sim.horario[i] = JEFE.INTERVALOS[clamp(j, 0, JEFE.INTERVALOS.length - 1)]; if (dia >= 0) partida.horario = sim.horario.slice(); pintar(); tutRevisar(); };
                const menos = boton('−', () => poner(k() - 1), 'menos', 'Más seguido'), mas = boton('+', () => poner(k() + 1), 'mas', 'Más espaciado');
                const cada = el('span', 'cada'), barra = el('i'), cuanto = el('span', 'pro');
                const fila = con(el('div', 'franja'), el('span', 'nombre', f.n), con(el('span', 'horas'), `${hhmm(f.de * 60)}–${hhmm(f.a * 60)} · `, cuanto), con(el('span', 'prob'), barra), menos, cada, mas);
                pan.append(fila);
                return { fila, menos, mas, cada, barra, cuanto, f, i, k };
            });
            const pintar = () => {
                const ahora = JEFE.franjaDe(sim.t / 60), abierto = sim.t < sim.cierra, p = sim.pronostico(), corto = sim.tramo[0] > 0 || sim.tramo[1] < N - 1;
                nota.textContent = `Cada cuántos minutos sale un tren de cada cabecera. Tienes ${sim.flota} trenes: menos intervalo es menos espera, pero más trenes rodando y más gasto.` + (corto ? ` Ahora los trenes circulan solo entre ${sim.est[sim.tramo[0]].n} y ${sim.est[sim.tramo[1]].n}.` : '');
                for (const q of filas) {
                    const fuera = q.f.a * 60 <= sim.abre || (q.f.de * 60 >= sim.cierra), pasada = q.f.a * 60 <= sim.t && q.i < JEFE.FRANJAS.length - 1 || !abierto;
                    const cada = sim.horario[q.i], hacen = sim.trenesPara(cada), k = q.k();
                    q.fila.className = 'franja' + (q.i === ahora && abierto && !fuera ? ' ahora' : '') + (fuera ? ' fuera' : pasada && q.i !== ahora ? ' pasada' : '');
                    q.cada.className = 'cada' + (hacen > sim.flota ? ' falta' : '');
                    q.cada.textContent = fuera ? 'cerrado' : `cada ${cada} min · ${hacen} trenes`;
                    q.cada.title = hacen > sim.flota ? 'No hay tantos trenes: saldrán cuando haya uno libre' : '';
                    q.menos.disabled = fuera || k <= 0; q.mas.disabled = fuera || k >= JEFE.INTERVALOS.length - 1;
                    q.cuanto.textContent = fuera ? '—' : `≈ ${miles(p[q.i] / 1000)} mil viajes`;
                    q.barra.style.width = Math.round(p[q.i] / Math.max(tope, ...p) * 100) + '%';
                }
            };
            return pintar;
        },
        // Las boleterías de las 15 estaciones, de un vistazo.
        boleterias() {
            const nota = el('p', 'nota');
            pan.append(cabecera('Boleterías'), nota);
            const filas = sim.est.map((e) => {
                const poner = (n) => { e.ventanillas = clamp(n, 0, 5); if (dia >= 0) partida.ventanillas = sim.est.map((q) => q.ventanillas); pintar(); tutRevisar(); };
                const nombre = boton(e.n, () => elegir(e.i, true), 'nombre'), cola = el('span', 'cola'), v = el('b'), maq = el('span', 'maq');
                const menos = boton('−', () => poner(e.ventanillas - 1), 'menos', 'Cerrar una ventanilla'), mas = boton('+', () => poner(e.ventanillas + 1), 'mas', 'Abrir una ventanilla');
                const comprar = boton('+', () => { if (disponible() < JEFE.COSTO.maquina) return; sim.comprarMaquina(e.i); son('purchase'); pintar(); }, 'compra', `Comprar una máquina de boletos: ${plata(JEFE.COSTO.maquina)}`);
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
        const poner = (n) => { e.ventanillas = clamp(n, 0, 5); if (dia >= 0) partida.ventanillas = sim.est.map((q) => q.ventanillas); pintar(); tutRevisar(); };
        const vm = boton('−', () => poner(e.ventanillas - 1), 'vmenos', 'Cerrar una ventanilla'), vp = boton('+', () => poner(e.ventanillas + 1), 'vmas', 'Abrir una ventanilla'), vb = el('b'), mb = el('b');
        const comprar = boton(`Comprar otra · ${plata(JEFE.COSTO.maquina)}`, () => { if (disponible() < JEFE.COSTO.maquina) return; sim.comprarMaquina(e.i); son('purchase'); pintar(); });
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
            if ((e.pos - cab) * (dir === 0 ? 1 : -1) >= 0) mejor = Math.max(0, sim.horario[JEFE.franjaDe(sim.t / 60)] - (sim.t - sim.ultimo[dir])) + Math.abs(e.pos - cab) / velocidad() + entre(cab, e.pos) * 0.5;
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
        if (tut.on && PASOS[tut.k] && PASOS[tut.k].decision) caja.append(el('p', 'consejo', PASOS[tut.k].t));
        ev.opciones.forEach((op, k) => {
            const b = boton('', () => { dec.hidden = true; decision = null; sim.decidir(ev, k); vel = velAntes; son('select'); refrescar(); }, 'opcion');
            con(b, el('strong', '', op.t), el('span', '', op.d));
            caja.append(b);
        });
        dec.append(caja); son('notify', 'info');
        if (reales && ev.est !== undefined && !vista) { const e = M.metro.est[ev.est]; M.irA(e.x, e.y); }
        refrescar();
    };

    // ───── El tutorial ─────
    // Hay dos: la inducción (una mañana de práctica con todo a la vez) y las guías de la semana,
    // que presentan en pocos pasos lo que cada día trae de nuevo.
    const correr = () => { if (!vel && !decision) vel = 1; };
    const franja = (i, que) => { const f = pan.querySelectorAll('.franja')[i]; return f && f.querySelector(que); };
    const INDUCCION = [
        { t: 'Aquí Puesto Central. Hoy no se califica: es una mañana corta para que conozcas la línea antes de recibirla. Son 22 kilómetros y 15 estaciones, de Quitumbe, en el sur, a El Labrador, en el norte.', sig: true, pausa: true },
        { t: 'Abajo está la línea entera, estirada. Cada cuadro es una estación y su color es el ánimo de la gente ahí: verde, bien; amarillo, regular; rojo, mal. Los trenes son las barras que se mueven: por arriba van al norte y por abajo, al sur.', sig: true, pausa: true, tira: true },
        { t: 'El reloj está detenido. Pulsa ×1 para que el día empiece a correr. Puedes pausar cuando quieras: las órdenes también se dan en pausa.', foco: () => [ui.vel.children[1]], espera: () => vel > 0, pausa: true },
        { t: 'Son las 05:30 y abre el Metro. Las barras claras que crecen junto a cada estación son la gente que espera: hacia arriba, quienes van al norte; hacia abajo, quienes van al sur. Cada tren que pasa se las lleva.', hasta: 6.25, tira: true },
        { t: 'Viene el pico de la mañana: medio sur sale a trabajar al norte, y con un tren cada 8 minutos no va a alcanzar. Abre el Horario.', foco: () => [ui.bhor], espera: () => panel === 'horario', pausa: true },
        { t: 'Cada franja del día tiene su intervalo. Con el botón −, baja el «Pico de la mañana» a un tren cada 5 minutos. Al lado ves cuántos trenes pide ese ritmo: tienes 18.', foco: () => [pan.querySelectorAll('.franja')[1] && pan.querySelectorAll('.franja')[1].querySelector('.menos')], espera: () => sim.horario[1] <= 5, pausa: true, alEntrar: () => { if (panel !== 'horario') abrirPanel('horario'); } },
        { t: 'Esa es la decisión de fondo. Con menos intervalo la gente espera menos y viaja más cómoda, pero cada tren cuesta por kilómetro. La barra de cada franja es el pronóstico de viajes: en las horas flojas conviene espaciar los trenes.', sig: true, pausa: true },
        { t: 'Deja correr el reloj y mira cómo empiezan a salir más trenes de las dos cabeceras.', hasta: 7.1, alEntrar: () => { if (angosta()) cerrarPanel(); correr(); } },
        { t: 'Ahora, las boleterías. La barrita amarilla junto a una estación es la fila para pagar. Toca Quitumbe, la primera estación de la izquierda, en la línea de abajo.', est: 0, espera: () => sel === 0, pausa: true },
        { t: 'Quien tiene tarjeta pasa directo. El resto paga los 45 centavos en una ventanilla, en efectivo, o en una máquina, con efectivo justo o tarjeta bancaria. Abre una ventanilla más en Quitumbe con el botón +.', foco: () => [ficha.querySelector('.vmas')], espera: () => sim.est[0].ventanillas >= 3, pausa: true, alEntrar: () => { if (sel !== 0) elegir(0, true); } },
        { t: 'Puedes bajar a mirar. Pulsa «Ver la estación por dentro».', foco: () => [ficha.querySelector('.dentro')], espera: () => vista === 'est', pausa: true, alEntrar: () => { if (sel !== 0) elegir(0, true); } },
        { t: 'Esto es Quitumbe ahora mismo: arriba, la calle; en medio, el vestíbulo con la fila, las ventanillas, las máquinas y los torniquetes; abajo, los dos andenes. Aquí también puedes tocar una ventanilla para abrirla o cerrarla.', sig: true, alEntrar: correr },
        { t: 'Vuelve al mapa con el mismo botón.', foco: () => [ficha.querySelector('.dentro')], espera: () => vista === '' },
        { t: 'Arriba está el ánimo: la nota que pone la gente, de 0 a 100. Baja con las filas, con las esperas largas y con los trenes apretados. En los días de verdad, una raya blanca marca la meta.', foco: () => [ui.barra.parentNode], sig: true, pausa: true },
        { t: 'Cuando un andén no da más, puedes mandar un tren vacío sin esperar al horario. Pulsa uno de los dos botones de «Tren extra».', foco: () => [ui.sur, ui.nor], espera: () => sim.cuenta.refuerzos > 0 || (!sim.disponibles(0) && !sim.disponibles(1)), pausa: true },
        { t: 'En «Trenes» está toda la flota: dónde va cada tren y qué tan lleno. Ábrelo y toca cualquiera que esté en marcha.', foco: () => (panel === 'trenes' ? [...pan.querySelectorAll('.tren:not(.quieto)')].slice(0, 1) : [ui.btre]), espera: () => selTren > 0, pausa: true },
        { t: 'Los trenes también se ven por dentro. Pulsa «Ver el tren por dentro».', foco: () => [ficha.querySelector('.dentro')], espera: () => vista === 'tren', pausa: true, alEntrar: () => { if (!selTren) { const t = sim.trenes.find(activo); if (t) elegirTren(t.id, false); } } },
        { t: 'Los asientos se llenan primero y después el pasillo. Cuando un tren va apretado, a esa hora hace falta otro. Vuelve al mapa.', foco: () => [ficha.querySelector('.dentro')], espera: () => vista === '', alEntrar: correr },
        { t: 'De vez en cuando, Central te va a pedir una decisión. Sigue con el reloj corriendo: ya viene una.', hasta: 8.3, alEntrar: () => { cerrarFicha(); cerrarPanel(); correr(); } },
        { t: 'El reloj se detiene hasta que elijas. No hay respuesta perfecta: cada opción cuesta algo.', decision: true, espera: () => sim.elegidas.musico !== undefined && !decision },
        { t: '«Hoy» es la caja del día: los pasajes menos lo que cuestan los trenes, las boleterías y las estaciones. Con lo que sobre al final compras mejoras. Para las tres estrellas hace falta mucho ánimo y no cerrar en rojo.', foco: () => [ui.caja.parentNode], sig: true, pausa: true },
        { t: 'Ya pasó lo peor del pico: buen momento para cerrar las ventanillas que sobran. La inducción termina a las 09:30; con ×4 llegas en un momento.', hasta: 9.6, alEntrar: correr },
    ];
    const GUIAS = [
        [   // Lunes: lo básico y el horario
            { t: 'Aquí Puesto Central. Hoy recibes la Línea 1: 22 kilómetros y 15 estaciones, de Quitumbe a El Labrador. Te la voy entregando de a poco: hoy solo decides el horario. De las boleterías me encargo yo.', sig: true, pausa: true },
            { t: 'Abajo está la línea entera, estirada. Cada cuadro es una estación y su color es el ánimo de la gente ahí. Las barras claras son quienes esperan (hacia arriba, al norte; hacia abajo, al sur) y los trenes son las barras que se mueven.', sig: true, pausa: true, tira: true },
            { t: 'Los trenes salen cada 8 minutos todo el día, y en el pico de la mañana no va a alcanzar. Abre el Horario.', foco: () => [ui.bhor], espera: () => panel === 'horario', pausa: true },
            { t: 'Con el botón −, baja el «Pico de la mañana» a un tren cada 5 minutos. Al lado ves cuántos trenes pide ese ritmo: tienes 18.', foco: () => [franja(1, '.menos')], espera: () => sim.horario[1] <= 5, pausa: true, alEntrar: () => { if (panel !== 'horario') abrirPanel('horario'); } },
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
        [   // Sábado: el fin de semana
            { t: 'Sábado: el Metro abre a las 07:00, no hay picos de oficina y entra menos plata. El horario de entre semana hoy pierde dinero. Abre el Horario.', foco: () => [ui.bhor], espera: () => panel === 'horario', pausa: true },
            { t: 'La barra verde de cada franja es la gente que se espera: poca en la mañana, mucha en la noche. Ajusta los intervalos a eso. El reto de hoy es cerrar la caja a favor.', sig: true, pausa: true },
        ],
        [   // Domingo: todo junto
            { t: 'Día de Quito: feriado, desfile, aguacero, concierto y un tren menos. Hoy no hay nada nuevo que aprender; ya tienes todas las herramientas. Suerte.', sig: true, pausa: true },
        ],
    ];
    let PASOS = INDUCCION;
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
        if (dia < 0) pie.append(boton('Saltar la inducción', () => { if (confirm('¿Terminar la inducción ahora?')) { partida.tutorial = true; guardar(); semana(); } }, 'chico'));
        else pie.append(boton('Saltar la guía', guiaHecha, 'chico'));
        tutBox.append(el('p', 'zona', `Puesto Central · ${tut.k + 1} de ${PASOS.length}`), el('p', 'texto', p.t), pie);
        tutBox.hidden = !!(p.decision && decision); medirGuia();
    };
    /** Empieza la guía del día `k` de la semana. */
    const guiar = (k) => { PASOS = GUIAS[k]; tutIr(0); };
    /** La guía del día terminó (o se saltó): no vuelve a salir sola, y el reloj sigue. */
    function guiaHecha() {
        tutFin();
        if (dia >= 0 && dia < DIAS.length && !partida.guias[dia]) { partida.guias[dia] = true; guardar(); }
        correr(); refrescar();
    }
    function tutIr(k) {
        tutLimpiar();
        if (sim && dia >= 0 && k >= PASOS.length) { guiaHecha(); return; }
        if (!sim || k >= PASOS.length) { tut.on = false; tutBox.hidden = true; return; }
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
    /** El escenario del día `i`: −1 es la inducción, de 0 a 6 la semana, y de ahí en adelante el turno sin fin. */
    const diaDe = (i) => (i < 0 ? TUTORIAL : i >= DIAS.length ? CAMPANA.generar(i + 1, sinFin().semilla) : Object.assign({}, DIAS[i], (DIAS[i].ajuste && DIAS[i].ajuste(partida.notas)) || null));
    const empezar = (i, estacionInicial = 0) => {
        dia = i; D = diaDe(i);
        const plan = i < 0 ? { maquinas: nueva().maquinas, horario: [8, 8, 8, 8, 8, 8, 8], ventanillas: null }
            : { maquinas: partida.maquinas, tarjeta: partida.tarjeta, cajeros: partida.cajeros, anden: partida.anden, pantallas: partida.pantallas, mantenimiento: partida.mantenimiento, taller: partida.taller, bombas: partida.bombas, trenes: partida.trenes,
                jefes: partida.jefes || (D.autoBoleteria ? 1 : 0),      // el primer día, las boleterías las lleva el Puesto Central
                horario: partida.horario, ventanillas: partida.ventanillas };
        sim = JEFE.crear(largos, plan, D);
        vel = i < 0 || prueba ? 0 : 1; llueve = 0; fiesta = false; decision = null; avisos.textContent = '';
        cerrarFicha(); cerrarPanel(); tutFin();
        document.body.classList.add('jugando'); hud.hidden = false; fin.hidden = true; dec.hidden = true;
        hud.classList.remove('mas-controles'); ui.mas.textContent = 'Más'; ui.mas.setAttribute('aria-expanded', 'false');
        if (Q.ficha) Q.ficha.cerrar();
        // El nombre del día va aparte de su título: en el teléfono solo cabe el nombre.
        ui.dia.textContent = ''; ui.dia.append(el('span', '', D.sinfin ? `Día ${D.numero}` : D.n), el('span', 'jtit', (D.sinfin ? ` · ${D.n}` : '') + ` · ${D.t}`));
        ui.bbol.hidden = !puede('boleterias'); ui.btre.hidden = ui.sur.hidden = ui.nor.hidden = !puede('trenes');
        S.playing = false; S.tour = false; S.metro = true; S.fiestas = false; S.hour = sim.t / 60; M.setWeather('clear'); M.syncButtons();
        M.extra = extra; M.ajustar(); M.limitar();
        if (reales && S.nivel < 2) M.zoom(2 - S.nivel);
        if (reales) { const c = M.metro.est[i < 0 ? 2 : 7]; M.irA(c.x, c.y); }
        if (i < 0) { PASOS = INDUCCION; tutIr(0); }
        else {
            elegir(estacionInicial, true); verDentro('est'); ficha.hidden = true;
            // La primera vez que se juega un día de la semana, el Puesto Central presenta lo que trae de nuevo.
            if (GUIAS[i] && !partida.guias[i] && !prueba) guiar(i);
            else avisar({ tipo: 'info', texto: puede('boleterias') ? '¡En marcha! Los trenes salen solos. Usa Horario para ajustar su frecuencia y Gestionar estación para atender las filas.' : '¡En marcha! Los trenes salen solos. Usa Horario para ajustar cada cuánto salen.', i: -1 });
        }
        refrescar(); son('start');
    };
    /** Sale del día sin terminarlo. Lo comprado, comprado está. */
    const dejar = () => { if (sim && dia >= 0 && sim.cuenta.compras) { partida.caja -= sim.cuenta.compras; guardar(); } };
    const apagar = () => {
        tutFin(); verDentro(''); cerrarFicha(); cerrarPanel(); sim = null; decision = null; M.extra = null;
        hud.hidden = true; dec.hidden = true; avisos.textContent = '';
        S.playing = true; S.fiestas = false; M.setWeather('clear'); M.syncButtons(); M.ajustar(); M.limitar();
    };
    const salir = () => { apagar(); fin.hidden = true; document.body.classList.remove('jugando'); M.ajustar(); M.limitar(); };

    const terminar = () => {
        const c = sim.cuenta, animo = sim.animoDia(), saldo = sim.balance(), s = sim;
        vel = 0; tutFin(); if (vista) verDentro(''); dec.hidden = true;
        if (dia < 0) { partida.tutorial = true; guardar(); son('result', 3); informeTutorial(s); return; }
        if (dia >= DIAS.length) {
            // El turno sin fin no se repite: cada día cuenta una sola vez, y con cero estrellas se acaba.
            const f = sinFin(), est = estrellasDe(animo, saldo, D.meta), reto = !!D.reto.ok(s), premio = reto ? D.reto.premio : 0;
            const aguantados = f.n - DIAS.length - 1 + (est > 0 ? 1 : 0), record = aguantados > (f.mejor || 0);
            partida.caja += saldo + premio;      // el saldo ya trae descontadas las compras
            f.mejor = Math.max(f.mejor || 0, aguantados);
            if (est > 0) f.n++; else { f.n = DIAS.length + 1; f.semilla = Math.floor(Math.random() * 1e9); }
            guardar(); son('result', est);
            informe(s, { est, animo, saldo, reto, premio, supera: true, sinfin: true, aguantados, record, mejor: f.mejor });
            return;
        }
        const est = estrellasDe(animo, saldo, D.meta), reto = !!D.reto.ok(s), antes = partida.dias[dia];
        const operativo = saldo + c.compras, premio = reto ? D.reto.premio : 0;
        // La caja de un día cuenta una sola vez: al repetirlo, vale el mejor resultado. Las compras se pagan siempre.
        const supera = !antes || est > antes.estrellas || (est === antes.estrellas && animo > antes.animo);
        partida.caja -= c.compras;
        if (supera) {
            partida.caja += operativo - (antes ? antes.operativo : 0);
            partida.dias[dia] = { estrellas: est, animo, operativo, saldo, viajes: c.viajes, km: c.km, idos: c.idos, premio: antes ? antes.premio : 0 };
            Object.assign(partida.notas, s.notas);
        }
        if (reto && !partida.retos[dia]) { partida.retos[dia] = true; partida.caja += premio; partida.dias[dia].premio = premio; }
        partida.estrellas[dia] = Math.max(partida.estrellas[dia] || 0, est);
        if (est > 0 && partida.dia === dia) partida.dia = Math.min(DIAS.length, dia + 1);
        guardar();
        son('result', est);
        informe(s, { est, animo, saldo, reto, premio, supera, antes });
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
                    el('span', '', hecho ? `Semana completa · ${rangoDe(n).n}` + (p.sinfin && p.sinfin.mejor ? ` · sin fin: récord de ${p.sinfin.mejor} ${p.sinfin.mejor === 1 ? 'día' : 'días'}` : '') : p.estrellas.length ? `Va por el ${DIAS[p.dia].n.toLowerCase()}` : p.tutorial ? 'Inducción hecha' : 'Recién empezada'),
                    el('em', '', `★ ${n} de ${DIAS.length * 3} · caja ${plata(p.caja)}`),
                    acciones(boton('Continuar', () => { cargar(k); semana(); }, 'on'), boton('Borrar', () => { if (confirm(`¿Borrar la partida ${k + 1}? Se pierden sus estrellas, su caja y sus mejoras.`)) { almacen.partidas[k] = null; if (almacen.actual === k) partida = nueva(); try { if (!prueba) localStorage.setItem(CLAVE, JSON.stringify(almacen)); } catch (e) { /* idem */ } titulo(); } })));
            } else h.append(el('strong', '', `Partida ${k + 1}`), el('span', '', 'Vacía'), acciones(boton('Nueva partida', () => { almacen.actual = k; partida = nueva(); guardar(); semana(); }, 'on')));
            lista.append(h);
        });
        const sonido = boton(S.sound ? 'Sonido: activado' : 'Sonido: apagado', () => { if (Q.sfx && Q.sfx.enable) Q.sfx.enable(!S.sound); setTimeout(() => { sonido.textContent = S.sound ? 'Sonido: activado' : 'Sonido: apagado'; }, 250); });
        modal(el('p', 'zona', 'Metro de Quito · Línea 1'), el('h2', 'grande', 'Jefe de línea'),
            el('p', 'texto', 'Diriges los 22 kilómetros y las 15 estaciones del Metro durante la semana de Fiestas de Quito: siete días, del lunes 30 de noviembre al domingo 6 de diciembre. Una partida completa dura alrededor de una hora. El progreso se guarda al terminar cada día; si cierras o recargas durante un turno, tendrás que empezarlo de nuevo.'),
            lista, acciones(boton('Cómo se juega', () => ayuda(titulo)), sonido, boton('Volver al mapa', salir)));
    };

    /** El tablero de la semana: los días, el parte del día elegido y la tienda. Con `i` igual al número de días muestra el turno sin fin. */
    const semana = (i) => {
        const completa = partida.dia >= DIAS.length;
        if (i === undefined || i < 0) i = completa && partida.sinfin ? DIAS.length : Math.min(partida.dia, DIAS.length - 1);
        if (i >= DIAS.length && !completa) i = DIAS.length - 1;
        const sf = i >= DIAS.length, f = sf ? sinFin() : null, k = sf ? f.n - 1 : i, Dd = diaDe(k), n = totalEstrellas(partida);
        const dias = (q) => `${q} ${q === 1 ? 'día' : 'días'}`, minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);
        const caja = modal(el('p', 'zona', `Partida ${almacen.actual + 1} · ${sf ? 'después de las fiestas' : 'semana de Fiestas de Quito'}`), el('h2', '', sf ? `Turno sin fin · día ${Dd.numero}` : `La semana · ★ ${n} de ${DIAS.length * 3}`));
        if (sf) caja.append(el('p', 'consejo', 'Días al azar, cada uno con más gente y más cosas pasando a la vez. El turno dura hasta que un día termine sin estrellas.' + (f.mejor ? ` Tu récord: ${dias(f.mejor)}.` : '')));
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
        const cumplido = !sf && partida.retos[i];
        caja.append(parte,
            el('p', 'reto' + (cumplido ? ' hecho' : ''), `${cumplido ? '◆ Reto cumplido' : '◇ Reto'}: ${minuscula(Dd.reto.t)}` + (Dd.reto.premio ? ` (premio de ${plata(Dd.reto.premio)}).` : ' (por el honor).')),
            el('p', 'nota', sf ? `Con un ánimo de ${Dd.meta - 10} o más sigues al día siguiente; por debajo, termina el turno. Las estrellas son las de siempre: ${Dd.meta} para dos y ${Dd.meta + 10} sin cerrar en rojo para tres.`
                : `Ánimo de ${Dd.meta - 10} para una estrella, de ${Dd.meta} para dos y de ${Dd.meta + 10} sin cerrar la caja del día en rojo para tres. Con una estrella se abre el día siguiente.`));
        // La tienda se va abriendo con los días: cada mejora se ofrece desde el suyo.
        const tienda = el('div', 'tienda'), hoy = partida.dia;
        tienda.append(el('h3', '', `Tienda · en caja ${plata(partida.caja)}`));
        const abiertas = MEJORAS.filter((mj) => (mj.desde || 0) <= hoy), despues = MEJORAS.filter((mj) => (mj.desde || 0) > hoy);
        if (!abiertas.length) tienda.append(el('p', 'nota', 'La tienda abre mañana. Hoy, todo lo que puedes mejorar está en el Horario.'));
        abiertas.forEach((mj) => {
            const nivel = partida[mj.id] || 0, estreno = mj.desde === hoy && !nivel, precio = mj.precio + (mj.sube || 0) * nivel;
            const b = boton(nivel >= mj.max ? (mj.max > 1 ? 'Completa' : 'Comprada') : plata(precio), () => { if (partida.caja < precio) return; partida.caja -= precio; partida[mj.id] = nivel + 1; guardar(); son('purchase'); semana(i); });
            b.disabled = nivel >= mj.max || partida.caja < precio;
            tienda.append(con(el('div', 'fila' + (nivel >= mj.max ? ' hecha' : '') + (estreno ? ' estreno' : '')), el('span', 'nombre', (estreno ? 'Nuevo · ' : '') + mj.n + (mj.max > 1 ? ` (${nivel}/${mj.max})` : '')), el('span', 'nota', mj.d), b));
        });
        if (despues.length) tienda.append(el('p', 'nota', 'Más adelante: ' + despues.map((mj) => `${minuscula(mj.n)} (${mj.desde < DIAS.length ? 'desde el ' + DIAS[mj.desde].n.toLowerCase() : 'en el turno sin fin'})`).join(', ') + '.'));
        if (hoy >= DESDE.boleterias) tienda.append(el('p', 'nota', `Las máquinas de boletos (${plata(JEFE.COSTO.maquina)}) se compran durante el turno, en Boleterías o dentro de cada estación.`));
        caja.append(tienda);
        const pie = acciones(boton(sf ? `Empezar el día ${Dd.numero}` : `Empezar el ${Dd.n.toLowerCase()}`, () => empezar(k), 'on'));
        if (!sf && GUIAS[i] && partida.guias[i]) pie.append(boton('Repetir con la guía', () => { partida.guias[i] = false; empezar(i); }, '', 'Vuelve a mostrar la explicación de lo nuevo de este día'));
        if (completa) pie.append(boton('Ver el final', final));
        pie.append(boton('Inducción', () => empezar(-1), '', 'Una mañana de práctica con todas las herramientas a la vez, sin calificación'), boton('Cómo se juega', () => ayuda(() => semana(i))), boton('Menú principal', titulo));
        caja.append(pie);
    };

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

    /** El resumen del día. */
    const informe = (s, r) => {
        const c = s.cuenta, Dd = D, k = dia;
        // Qué salió mal, para saber qué cambiar la próxima vez.
        const consejos = [];
        if (c.idosFila > 2500) consejos.push(`${miles(c.idosFila)} personas se cansaron de la fila de la boletería. Abre más ventanillas en hora pico o compra máquinas; la campaña de tarjeta ayuda en toda la línea.`);
        if (c.idosAnden > 2500) consejos.push(`${miles(c.idosAnden)} personas esperaron demasiado en el andén y se fueron. Faltaron trenes en alguna franja.`);
        if (c.dejados > 5000) consejos.push(`${miles(c.dejados)} veces alguien vio pasar un tren lleno sin poder subir. En esas horas hace falta un intervalo más corto o un tren extra.`);
        if (c.idosCierre > 3000) consejos.push(`${miles(c.idosCierre)} personas encontraron su estación cerrada. Eso no lo decides tú, pero sí cuánto dura: mira las decisiones del día.`);
        if (r.saldo < 0) consejos.push('El día cerró en rojo. Los trenes cuestan por cada kilómetro: en las horas flojas puedes espaciarlos sin que nadie sufra. Mira el pronóstico de cada franja en el Horario.');
        if (!consejos.length) consejos.push(r.est >= 3 ? 'Un día redondo: la gente llegó a tiempo y las cuentas cuadran.' : r.est === 2 ? 'Vas bien. Para la tercera estrella hace falta más ánimo sin dejar la caja del día en rojo.' : 'Estuvo cerca. Revisa el horario de las horas pico y las filas de las estaciones grandes.');
        const peor = s.est.slice().sort((p, q) => p.animo - q.animo)[0];
        const dl = el('dl', 'datos');
        [['Ánimo de la gente', `${Math.round(r.animo)} de 100 (meta ${Dd.meta})`], ['Viajes', `${miles(c.viajes)} de ${miles(c.demanda)}`], ['Espera en el andén', coma(s.esperaMedia()) + ' min'], ['Se fueron sin viajar', miles(c.idos)], ['Kilómetros de tren', miles(c.km)], ['Estación más descontenta', `${peor.n} (${Math.round(peor.animo)})`]]
            .forEach(([q, val]) => dl.append(con(el('div'), el('dt', '', q), el('dd', '', val))));
        const caja = modal(el('p', 'zona', (r.sinfin ? `Turno sin fin · día ${Dd.numero} · ` : '') + `${Dd.n} ${Dd.fecha} · ${Dd.t}`),
            el('h2', '', r.sinfin && r.est === 0 ? 'Te relevaron del cargo' : r.est >= 3 ? 'Un día redondo' : r.est === 2 ? 'Buen día de servicio' : r.est === 1 ? 'Día salvado, por poco' : 'Un día para olvidar'),
            el('p', 'estrellas', estrellasTxt(r.est)),
            el('p', 'reto' + (r.reto ? ' hecho' : ''), `${r.reto ? '◆ Reto cumplido' : '◇ Reto pendiente'}: ${Dd.reto.t.charAt(0).toLowerCase() + Dd.reto.t.slice(1)} · ${Dd.reto.valor(s)}` + (r.reto && r.premio ? ` · premio de ${plata(r.premio)}` : '')),
            dl, grafico(s, Dd.meta), cuentas(c, r.saldo));
        const dias = (q) => `${q} ${q === 1 ? 'día' : 'días'}`;
        if (r.sinfin) caja.append(el('p', 'consejo', (r.est === 0 ? `Hacía falta un ánimo de ${Dd.meta - 10} para seguir. Aguantaste ${dias(r.aguantados)} en el turno sin fin` : `Día ${Dd.numero} superado: llevas ${dias(r.aguantados)} en el turno sin fin`) + (r.record ? ', y es tu récord.' : `. Tu récord es de ${dias(r.mejor)}.`) + (r.est === 0 ? ' Conservas la caja y las mejoras para el próximo intento.' : '')));
        else if (r.est === 0) caja.append(el('p', 'consejo', `Hacía falta un ánimo de ${Dd.meta - 10} para pasar al día siguiente. Hay que repetir el ${Dd.n.toLowerCase()}.`));
        else if (!r.supera) caja.append(el('p', 'nota', `No superaste tu mejor resultado de este día (${estrellasTxt(r.antes.estrellas)}, ánimo ${Math.round(r.antes.animo)}): la caja se queda como estaba.`));
        consejos.forEach((t) => caja.append(el('p', 'consejo', t)));
        const estrenos = r.sinfin || r.est === 0 ? [] : MEJORAS.filter((mj) => mj.desde === k + 1);
        caja.append(el('p', 'nota', `En caja: ${plata(partida.caja)}.` + (estrenos.length ? ` Nuevo en la tienda: ${estrenos.map((mj) => mj.n).join(', ')}.` : '')));
        const pie = acciones();
        if (r.sinfin) pie.append(boton(r.est > 0 ? `Día ${Dd.numero + 1} →` : 'Empezar otro turno →', () => semana(DIAS.length), 'on'), boton('La semana', () => semana(DIAS.length - 1)));
        else {
            if (r.est > 0 && k + 1 < DIAS.length) pie.append(boton(`${DIAS[k + 1].n}: ${DIAS[k + 1].t} →`, () => semana(k + 1), 'on'));
            else if (r.est > 0) pie.append(boton('Ver el final →', final, 'on'));
            pie.append(boton('Repetir el día', () => empezar(k), r.est === 0 ? 'on' : ''), boton('La semana', () => semana(k)));
        }
        caja.append(pie);
    };
    const informeTutorial = (s) => {
        modal(el('p', 'zona', 'Inducción completa'), el('h2', '', 'La línea es tuya'),
            el('p', 'texto', `En esta mañana de práctica se movieron ${miles(s.cuenta.viajes)} personas y el ánimo terminó en ${Math.round(s.animoDia())}. Desde mañana cuenta.`),
            con(el('ul', 'parte'), el('li', '', 'Horario: el intervalo de cada franja, según el pronóstico.'), el('li', '', 'Boleterías: ventanillas y máquinas, donde haya fila.'), el('li', '', 'Tren extra: para el andén que ya no da más.'), el('li', '', 'Decisiones: cada opción cuesta algo.'), el('li', '', 'Tres estrellas: mucho ánimo y la caja del día sin rojo.')),
            acciones(boton('Empezar el lunes →', () => semana(0), 'on'), boton('Repetir la inducción', () => empezar(-1)), boton('Menú principal', titulo)));
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
            ...seccion('Horario', 'Para cada franja del día decides cada cuántos minutos sale un tren. Menos intervalo es menos espera y trenes menos llenos, pero más gasto. El pronóstico de viajes de cada franja te dice dónde hace falta y dónde sobra.'),
            ...seccion('Boleterías', 'Quien tiene tarjeta pasa directo. El resto paga en ventanilla (efectivo) o en máquina (efectivo justo o tarjeta bancaria). Si la fila pasa de cinco minutos, la gente se va. Las ventanillas cuestan por hora; las máquinas se compran una vez.'),
            ...seccion('Trenes', 'Tienes 18, de 1.230 pasajeros cada uno. «Tren extra» manda uno vacío desde una cabecera cuando un andén no da más. En «Trenes» ves toda la flota, y cada tren y cada estación se pueden mirar por dentro.'),
            ...seccion('Imprevistos', 'Aguaceros, averías, eventos y estaciones que se cierran por el agua. A veces el Puesto Central te pide una decisión: el reloj se detiene y cada opción tiene su costo.'),
            ...seccion('La semana y lo que viene después', 'Cada día entrega algo nuevo: el lunes solo decides el horario; el martes llegan las boleterías; el miércoles, los trenes de refuerzo; el jueves, las decisiones; el viernes, los cierres por lluvia; el sábado, el fin de semana; y el domingo va todo junto. La tienda también se va abriendo. Al terminar la semana empieza el turno sin fin: días al azar, cada vez más cargados, hasta que un día el ánimo no alcance.'),
            ...seccion('Guardado', 'Se conservan los días terminados y las mejoras compradas entre turnos. El turno en curso no se guarda al cerrar o recargar. Si sales con el botón Salir, las máquinas compradas durante ese turno se conservan y se descuentan de tu caja.'),
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
            if (vel && !decision) { sim.avanzar(dt * VEL[vel]); if (dia >= 0) partida.segundos += dt; }
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
                    const q = enCamino(metro.p, metro.a, clamp(s0 + t.s + (t.dir === 0 ? -1 : 1) * k * sep, 0, metro.largo)), x = X(q[0]), y = Y(q[0], q[1]);
                    if (x < -6 || y < -6 || x > Q.W + 6 || y > Q.H + 6) continue;
                    if (k === 0) { enMapa.push({ t, x, y }); if (t.id === selTren) [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([dx, dy]) => R(v, x + dx * (r > 1 ? 1 : 0.75), y + dy * (r > 1 ? 1 : 0.75), 1, 1, '#FFE500')); }
                    R(v, x - r, y - r, r * 2 + 1, r * 2 + 1, '#1F4FA3'); if (r > 1) R(v, x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1, col); else R(v, x, y, 1, 1, col);
                }
            }
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
                const x = T.px(t.s), norte = t.dir === 0, y = norte ? yc - 2 : yc + 2, ww = T.dos ? 7 : 9, m = ww >> 1;
                if (t.id === selTren) R(v, x - m - 1, y - 2, ww + 2, 5, '#FFE500');
                R(v, x - m, y - 1, ww, 3, '#1F4FA3'); R(v, x - m + 1, y, ww - 2, 1, colorTren(t)); R(v, norte ? x + m : x - m, y, 1, 1, '#FFFFFF');
            }
            // Los trenes guardados en cada cabecera.
            for (let cab = 0; cab < 2; cab++) {
                const n = sim.trenes.filter((t) => (t.estado === 'cochera' || t.estado === 'listo') && t.cab === cab).length, txt = String(n), w = Q.textW(txt);
                R(v, cab ? W - 8 : 2, y0 + 4, 6, 3, n ? '#5E72A8' : '#27304F'); Q.text(v, txt, cab ? W - 10 - w : 10, y0 + 3, n ? '#8FA3D9' : '#4A5680');
            }
            // El tutorial señala dónde mirar.
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
                if (z && z.tipo === 'ventanilla') { e.ventanillas = z.abierta ? z.k : z.k + 1; if (dia >= 0) partida.ventanillas = sim.est.map((q) => q.ventanillas); son('click'); refrescar(); }
                else if (z && z.tipo === 'maquina' && disponible() >= JEFE.COSTO.maquina) { sim.comprarMaquina(sel); son('purchase'); refrescar(); }
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
            if (k === ' ') { e.preventDefault(); vel = vel ? 0 : 1; son('click'); refrescar(); return true; }
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
    [...ui.vel.children].forEach((b, i) => b.addEventListener('click', () => { if (decision) return; vel = i || (vel ? 0 : 1); refrescar(); }));
    ui.bhor.addEventListener('click', () => abrirPanel('horario'));
    ui.bbol.addEventListener('click', () => abrirPanel('boleterias'));
    ui.btre.addEventListener('click', () => abrirPanel('trenes'));
    const refuerzo = (cab) => { if (sim && sim.refuerzo(cab)) avisar({ tipo: 'bien', sonido: 'tren', texto: `Sale un tren vacío de ${sim.est[sim.tramo[cab]].n} hacia el ${cab ? 'sur' : 'norte'}.`, i: -1 }); refrescar(); };
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
            ...seccion('Lo que decides', 'Horario: cada cuánto sale un tren en cada franja.' + (puede('boleterias') ? ' Boleterías: ventanillas y máquinas.' : ' De las boleterías, hoy se encarga el Puesto Central.') + (puede('trenes') ? ' Tren extra: un tren vacío, ya.' : '') + (dia < 0 || dia >= 3 ? ' Y las decisiones que te pida el Puesto Central.' : '')),
            ...seccion('Teclas', 'Espacio: pausa · 1, 2, 3: velocidad · H: horario · B: boleterías · T: trenes · I: ver por dentro · Esc: cerrar.'),
            acciones(boton('Seguir', () => { fin.hidden = true; vel = antes; refrescar(); }, 'on'))));
    });
    ui.salir.addEventListener('click', () => { if (!sim) return; if (sim.t < sim.abre + 20 || confirm(dia < 0 ? '¿Dejar la inducción?' : '¿Dejar el día a medias? No se guarda lo avanzado de hoy.')) { const era = dia; dejar(); semana(era >= DIAS.length ? DIAS.length : Math.max(0, era)); } });
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
            empezar(partida.dia >= DIAS.length ? sinFin().n - 1 : partida.dia, estacion);
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

    Q.juego = { titulo, semana, empezar, salir, get sim() { return sim; }, get partida() { return partida; } };

    // Para probar sin jugar: arranca un día, lo adelanta y lo deja a la vista.
    if (params.get('juego') === '1') {
        const k = params.has('jdia') ? +params.get('jdia') : 0, menu = params.get('jmenu');
        if (params.has('jcaja')) partida.caja = +params.get('jcaja');
        if (params.has('jsemilla')) partida.sinfin = { n: Math.max(DIAS.length + 1, k + 1), semilla: +params.get('jsemilla'), mejor: +params.get('jmejor') || 0 };
        if (params.has('jhecho')) { const n = +params.get('jhecho'); partida.dia = n; partida.tutorial = true; for (let i = 0; i < n; i++) { partida.estrellas[i] = 2 + (i % 2); partida.retos[i] = i % 2 === 0; partida.dias[i] = { estrellas: partida.estrellas[i], animo: 80 + i, operativo: 3000, saldo: 3000, viajes: 205000, km: 6800, idos: 900, premio: 0 }; } }
        if (menu === 'titulo') { if (params.has('jhecho')) almacen.partidas[0] = partida; titulo(); M.repintar(); return; }
        if (menu === 'semana' || menu === '1') { semana(k); M.repintar(); return; }
        if (menu === 'final') { final(); M.repintar(); return; }
        if (menu === 'ayuda') { ayuda(titulo); M.repintar(); return; }
        if (params.get('jplan') === 'real') partida.horario = [8, 5, 8, 8, 8, 5, 8];
        empezar(k); avisos.textContent = '';
        const hasta = params.get('jfin') === '1' ? 1e9 : +params.get('jt') || 450, deja = params.get('jdec') === '1';
        if (k < 0) { tutFin(); if (params.has('jtut')) tutIr(+params.get('jtut')); }
        else if (params.has('jguia') && GUIAS[k]) { PASOS = GUIAS[k]; tutIr(+params.get('jguia')); }
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
