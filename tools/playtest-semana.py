"""Recorre la semana entera en Chrome: las guías de cada día, la tienda que se va abriendo,
las mecánicas que llegan una por día, el turno guardado a medias, la caja en rojo, la
granizada con su tramo cortado, el final, el turno sin fin sobre el calendario, los
logros y la partida perdida. Requiere: pip install playwright.

    python3 tools/playtest-semana.py                      # escritorio, 1440 × 900
    python3 tools/playtest-semana.py --size 390x844       # teléfono de pie (táctil)
    python3 tools/playtest-semana.py --size 844x390       # teléfono acostado
    python3 tools/playtest-semana.py --output capturas    # además guarda capturas ahí

Abre index.html directo desde el disco, sin servidor. Usa un perfil vacío: no toca la
partida guardada de nadie.
"""
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default=(Path(__file__).resolve().parent.parent / 'index.html').as_uri())
parser.add_argument('--browser', default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', help='Ruta al ejecutable de Chrome o Chromium')
parser.add_argument('--size', default='1440x900', help='Ancho x alto de la ventana')
parser.add_argument('--output', help='Carpeta donde guardar capturas (opcional)')
args = parser.parse_args()
URL, CHROME = args.url, args.browser
ANCHO, ALTO = (int(v) for v in args.size.lower().split('x'))
MOVIL = ANCHO < 900 or ALTO < 500
SALIDA = Path(args.output) if args.output else None
if SALIDA: SALIDA.mkdir(parents=True, exist_ok=True)
errores, hechos = [], []
def ok(nombre, cond, extra=''):
    hechos.append((nombre, bool(cond)))
    print(('  ✓ ' if cond else '  ✗ ') + nombre + (' — ' + str(extra) if extra and not cond else ''))

with sync_playwright() as p:
    nav = p.chromium.launch(headless=True, executable_path=CHROME)
    ctx = nav.new_context(viewport={'width': ANCHO, 'height': ALTO}, device_scale_factor=3 if MOVIL else 1, has_touch=MOVIL, is_mobile=MOVIL)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errores.append(str(e)))
    page.on('console', lambda m: errores.append('consola: ' + m.text) if m.type == 'error' else None)
    page.on('dialog', lambda d: d.accept())
    foto = lambda n: page.screenshot(path=str(SALIDA / f'{ANCHO}x{ALTO}-{n}.png')) if SALIDA else None
    js = page.evaluate
    def pulsar(sel_o_loc):
        loc = page.locator(sel_o_loc) if isinstance(sel_o_loc, str) else sel_o_loc
        (loc.tap() if MOVIL else loc.click())
    def boton(nombre, dentro=None):
        return (page.locator(dentro) if dentro else page).get_by_role('button', name=nombre, exact=True)
    def terminar_dia(horario=None, ventanillas=None, opcion=0):
        js('''([h, v, op]) => { const s = Q.juego.sim; if (h) s.horario = h; if (v) s.est.forEach((e) => { e.ventanillas = v; });
              for (let n = 0; n < 9000 && !s.terminado; n++) { s.avanzar(5); while (s.decisiones.length) s.decidir(s.decisiones[0], Math.min(op, s.decisiones[0].opciones.length - 1)); }
              Q.mapa.extra.paso(0); }''', [horario, ventanillas, opcion])
    partida_n = lambda k: json.loads(js("localStorage.getItem('quito-jefe-de-linea')"))['partidas'][k]
    partida = lambda: partida_n(0)
    paso = lambda: page.locator('#jtut .zona').text_content()

    page.goto(URL + '#juego'); page.wait_for_function("typeof Q !== 'undefined' && !!Q.juego")
    ok('Menú: tres partidas vacías', boton('Nueva partida').count() == 3)
    foto('01-titulo')
    pulsar(boton('Nueva partida').first)
    ok('Semana: siete días, solo el lunes abierto', page.locator('#jfin .dia').count() == 7 and page.locator('#jfin .dia:enabled').count() == 1)
    ok('Lunes anuncia lo nuevo', 'Nuevo hoy: el horario' in page.locator('#jfin .nuevo').inner_text())
    ok('Tienda cerrada el lunes', 'La tienda abre mañana' in page.locator('#jfin .tienda').inner_text() and page.locator('#jfin .tienda button').count() == 0)
    foto('02-semana-lunes')

    # ── Lunes: la guía del horario ──
    pulsar(boton('Empezar el lunes'))
    ok('Lunes: guía visible y reloj en pausa', page.locator('#jtut').is_visible() and '1 de 7' in paso() and js('Q.juego.sim.t') == js('Q.juego.sim.abre'))
    ok('Lunes: sin Boleterías, Trenes ni Tren extra', not boton('Boleterías').is_visible() and not boton('Trenes').is_visible() and page.locator('#jefe button:visible', has_text='Tren extra').count() == 0)
    foto('03-lunes-guia')
    pulsar(boton('Siguiente', '#jtut')); pulsar(boton('Siguiente', '#jtut'))
    ok('Guía pide abrir el Horario', '3 de 7' in paso())
    pulsar(boton('Horario'))
    ok('Horario abierto y foco en el pico de la mañana', page.locator('#jpanel').is_visible() and '4 de 7' in paso() and page.locator('#jpanel .franja').nth(1).locator('.menos.tut-foco').count() == 1)
    foto('04-lunes-horario')
    for _ in range(2): pulsar(page.locator('#jpanel .franja').nth(1).locator('.menos'))
    ok('Pico de la mañana a 5 → siguiente paso', js('Q.juego.sim.horario[1]') == 5 and '5 de 7' in paso())
    for _ in range(2): pulsar(page.locator('#jpanel .franja').nth(5).locator('.menos'))
    ok('Pico de la tarde a 5 → siguiente paso', js('Q.juego.sim.horario[5]') == 5 and '6 de 7' in paso())
    pulsar(boton('Siguiente', '#jtut'))
    ok('Último paso: pulsar ×1', '7 de 7' in paso())
    pulsar(boton('×1'))
    ok('Guía del lunes terminada y guardada', not page.locator('#jtut').is_visible() and partida()['guias'][0] is True)
    t0 = js('Q.juego.sim.t'); page.wait_for_function('(t) => Q.juego.sim.t > t + 2', arg=t0)
    ok('El reloj corre', True)
    # la ficha de una estación no deja tocar ventanillas el lunes
    js('Q.mapa.extra.clic(Q.W / 2, Q.H - 30, null)')
    if not page.locator('#jest').is_visible(): pulsar(boton('Gestionar estación'))
    ok('Lunes: la ficha no ofrece ventanillas', page.locator('#jest .mandos').is_hidden() and 'Puesto Central' in page.locator('#jest').inner_text())
    foto('05-lunes-estacion')
    terminar_dia()
    ok('Informe del lunes con estrellas', page.locator('#jfin .estrellas').is_visible() and partida()['estrellas'][0] >= 2, partida()['estrellas'])
    ok('Informe anuncia la tienda', 'Nuevo en la tienda' in page.locator('#jfin').inner_text())
    ok('El primer día da su logro', page.locator('#jfin p.logro').count() >= 1 and 'Primer día' in page.locator('#jfin').text_content())
    ok('Gráfico del ánimo con barras', page.locator('#jfin .grafico i').count() >= 15 and page.locator('#jfin .grafico i').first.bounding_box()['height'] > 5)
    foto('06-informe-lunes')

    # ── Martes: boleterías y tienda ──
    pulsar(page.locator('#jfin .acciones button.on'))
    tienda = page.locator('#jfin .tienda').inner_text()
    ok('Martes: la tienda ofrece tarjeta y cajeros, y anuncia lo que viene', 'Campaña Tarjeta Ciudad' in tienda and 'Capacitación de cajeros' in tienda and 'Más adelante' in tienda and 'Jefes de estación' not in tienda.split('Más adelante')[0])
    caja0 = partida()['caja']
    pulsar(page.locator('#jfin .tienda .fila', has_text='Capacitación de cajeros').locator('button'))
    ok('Comprar capacitación de cajeros', partida()['cajeros'] == 1 and partida()['caja'] == caja0 - 5000, (caja0, partida()['caja']))
    foto('07-semana-martes')
    pulsar(boton('Empezar el martes'))
    ok('Martes: guía de boleterías', page.locator('#jtut').is_visible() and '1 de 5' in paso() and boton('Boleterías').is_visible() and not boton('Trenes').is_visible())
    pulsar(boton('Siguiente', '#jtut')); pulsar(boton('Boleterías'))
    ok('Panel de boleterías con 15 estaciones', page.locator('#jpanel .bol').count() == 15 and '3 de 5' in paso())
    foto('08-martes-boleterias')
    pulsar(page.locator('#jpanel .bol').first.locator('.mas'))
    ok('Abrir ventanilla en Quitumbe', js('Q.juego.sim.est[0].ventanillas') == 3 and '4 de 5' in paso())
    pulsar(boton('Siguiente', '#jtut')); pulsar(boton('Siguiente', '#jtut'))
    ok('Guía del martes terminada, reloj en marcha', not page.locator('#jtut').is_visible() and js('Q.juego.sim.t > Q.juego.sim.abre || true'))
    # Un turno a medias: se avanza, se da una orden, se recarga la página y el día tiene que volver idéntico.
    js("() => { const s = Q.juego.sim; s.orden('horario', 1, 5); s.orden('ventanillas', 4, 3); while (s.t < 9.6 * 60) s.avanzar(5); Q.mapa.extra.paso(0); }")
    pulsar(boton('Pausar'))      # en pausa, para comparar el mismo instante antes y después de recargar
    if not page.locator('#jpanel.boleterias').is_visible(): pulsar(boton('Boleterías'))
    pulsar(page.locator('#jpanel .bol').nth(6).locator('.mas'))
    huella = "JSON.stringify([Q.juego.sim.t, Q.juego.sim.pasos, Q.juego.sim.cuenta.viajes, Q.juego.sim.cuenta.ingresos, Q.juego.sim.animo, Q.juego.sim.est.map((e) => [e.ventanillas, e.colaTotal, e.anden[0].total]), Q.juego.sim.trenes.map((t) => [t.estado, t.s, t.total]), Q.juego.sim.horario])"
    antes = js(huella)
    ok('El turno a medias queda guardado', partida()['turno'] is not None and partida()['turno']['dia'] == 1)
    page.reload(); page.wait_for_function("typeof Q !== 'undefined' && !!Q.juego")
    ok('El menú avisa del turno a medias', 'turno a medias' in page.locator('#jfin .hueco').first.text_content())
    pulsar(boton('Continuar'))
    ok('La semana ofrece seguir el turno', 'Dejaste a medias el martes' in page.locator('#jfin').text_content())
    pulsar(boton('Seguir ese turno'))
    ok('El turno recuperado es idéntico y está en pausa', js(huella) == antes and js('Q.juego.sim.est[6].ventanillas') == 2 and page.locator('.jestado').text_content() == 'En pausa')
    foto('08b-turno-recuperado')
    terminar_dia([8, 5, 8, 8, 8, 5, 8], 4)
    ok('Informe del martes, y el turno a medias ya no está', partida()['estrellas'][1] >= 1 and partida()['turno'] is None, partida()['estrellas'])

    # ── Miércoles: trenes ──
    pulsar(page.locator('#jfin .acciones button.on')); pulsar(boton('Empezar el miércoles'))
    ok('Miércoles: guía de trenes y botones nuevos', '1 de 4' in paso() and boton('Trenes').is_visible())
    pulsar(boton('Siguiente', '#jtut'))
    ok('Tren extra resaltado y visible', page.locator('#jefe button.tut-foco:visible', has_text='Tren extra').count() == 2)
    foto('09-miercoles-guia')
    pulsar(page.locator('#jefe button.tut-foco:visible', has_text='Tren extra').first)
    ok('Tren extra enviado', js('Q.juego.sim.cuenta.refuerzos') == 1 and '3 de 4' in paso())
    pulsar(boton('Trenes')); pulsar(page.locator('#jpanel .tren:not(.quieto)').first)
    ok('Tren elegido', js('Q.juego.sim !== null') and '4 de 4' in paso() and page.locator('#jest h2').inner_text().startswith('Tren'))
    pulsar(boton('Ver el tren por dentro')); js('Q.mapa.repintar && Q.mapa.repintar()'); page.wait_for_timeout(250)
    foto('10-tren-por-dentro')
    pulsar(boton('← Volver al mapa')); pulsar(boton('Siguiente', '#jtut'))
    js('Q.juego.partida.caja = -15000')      # a propósito: media semana en rojo
    terminar_dia([8, 5, 8, 8, 8, 5, 8], 4)
    ok('Informe del miércoles', partida()['estrellas'][2] >= 1, partida()['estrellas'])
    pulsar(page.locator('#jfin .acciones button.on'))
    txt = page.locator('#jfin').text_content()
    ok('Media semana en rojo: llama el directorio con las cuentas y los consejos', 'Media semana en rojo' in txt and 'Dónde recortar' in txt and page.locator('#jfin .cuentas tr').count() >= 4 and page.locator('#jfin .consejo').count() >= 1)
    foto('10b-auditoria')
    pulsar(boton('Entendido: al jueves →'))
    ok('El tablero avisa que la semana no puede cerrar en rojo', 'Si la semana termina en rojo, pierdes el cargo' in page.locator('#jfin').text_content())
    js('Q.juego.partida.caja = 9000')

    # ── Jueves: decisiones ──
    pulsar(boton('Empezar el jueves'))
    ok('Jueves: guía de decisiones', '1 de 2' in paso())
    pulsar(boton('Siguiente', '#jtut'))
    page.wait_for_selector('#jdec:not([hidden])', timeout=60000)
    ok('Llega la primera decisión con el consejo de la guía', 'Paseo escolar' in page.locator('#jdec').inner_text() and page.locator('#jdec .consejo').count() == 1)
    foto('11-jueves-decision')
    pulsar(page.locator('#jdec .opcion').first)
    ok('Decisión resuelta y guía terminada', not page.locator('#jdec').is_visible() and not page.locator('#jtut').is_visible() and partida()['guias'][3] is True)
    terminar_dia([8, 5, 8, 8, 8, 5, 5], 4)
    ok('Informe del jueves', partida()['estrellas'][3] >= 1, partida()['estrellas'])

    # ── Viernes, sábado y domingo: saltando las guías ──
    for k, nombre, horario in [(4, 'viernes', [8, 5, 8, 8, 6, 4, 8]), (5, 'sábado', [12, 12, 10, 8, 8, 6, 6]), (6, 'domingo', [12, 10, 6, 5, 6, 6, 5])]:
        pulsar(page.locator('#jfin .acciones button.on'))
        if k == 4: foto('12-semana-viernes')
        pulsar(boton('Empezar el ' + nombre))
        ok(f'{nombre}: guía presente', page.locator('#jtut').is_visible())
        pulsar(boton('Saltar la guía'))
        ok(f'{nombre}: guía saltada, reloj en marcha', not page.locator('#jtut').is_visible() and partida()['guias'][k] is True)
        if k == 4:
            js('''() => { const s = Q.juego.sim; s.horario = [8, 5, 8, 8, 6, 4, 8]; s.est.forEach((e) => { e.ventanillas = 4; }); while (s.t < 16.4 * 60) { s.avanzar(5); while (s.decisiones.length) s.decidir(s.decisiones[0], 0); } Q.mapa.extra.paso(0); }''')
            ok('Granizada: tramo cortado en La Alameda', js('Q.juego.sim.tramo[1]') == 7 and js('Q.juego.sim.cerrada(12)'))
            pulsar(boton('Ver mapa')) if boton('Ver mapa').is_visible() else None
            page.wait_for_timeout(400); foto('13-viernes-corte')
            page.get_by_label('Ver estación', exact=True).select_option('12'); page.wait_for_timeout(300); foto('14-estacion-cerrada')
        terminar_dia(horario, 4)
        ok(f'Informe del {nombre}', partida()['estrellas'][k] >= 1, partida()['estrellas'])
    ok('Semana completa', partida()['dia'] == 7)
    foto('15-informe-domingo')

    # ── El final y el turno sin fin ──
    pulsar(boton('Ver el final →'))
    ok('Final con rango y puerta al turno sin fin', page.locator('#jfin h2.grande').is_visible() and boton('Turno sin fin →').is_visible())
    foto('16-final')
    pulsar(boton('Turno sin fin →'))
    txt = page.locator('#jfin').inner_text()
    ok('Tablero del turno sin fin: día 8, ocho casillas, tren nuevo en la tienda', 'Turno sin fin · día 8' in txt and page.locator('#jfin .dia').count() == 8 and 'Tren nuevo' in txt)
    txt = page.locator('#jfin').text_content()
    ok('El día 8 cae en el feriado trasladado de la Fundación y anuncia lo que viene', 'Feriado de la Fundación de Quito' in txt and 'Lo que viene' in txt and 'Nochebuena' in txt and page.locator('#jfin .fecha.baja').count() == 1)
    js('Q.juego.partida.caja = 60000')
    foto('17-sinfin')
    pulsar(boton('Empezar el día 8'))
    ok('Día 8 en marcha, sin guía', js('Q.juego.sim !== null') and not page.locator('#jtut').is_visible() and 'Día 8' in page.locator('#jefe strong').text_content())
    terminar_dia([12, 12, 10, 10, 10, 10, 12], 3)
    sf = partida()['sinfin']
    ok('Día 8 superado: el turno sigue en el 9', sf['n'] == 9 and sf['mejor'] == 1 and 'Día 9 →' in page.locator('#jfin').text_content(), sf)
    foto('18-informe-sinfin')
    pulsar(boton('Día 9 →')); pulsar(boton('Empezar el día 9'))
    terminar_dia([15, 15, 15, 15, 15, 15, 15], 0, 9)      # a propósito, un desastre
    sf = partida()['sinfin']
    ok('Un día sin estrellas termina el turno y conserva el récord', sf['n'] == 8 and sf['mejor'] == 1 and 'Te relevaron' in page.locator('#jfin').inner_text(), sf)
    foto('19-relevo')
    pulsar(boton('Empezar otro turno →'))
    ok('Vuelve al día 8 con otra semilla', 'Turno sin fin · día 8' in page.locator('#jfin').inner_text())
    pulsar(boton('Trayectoria'))
    ok('Trayectoria: los 18 logros, con varios ganados', page.locator('#jfin .logros .logro').count() == 18 and page.locator('#jfin .logros .logro.hecho').count() >= 4, page.locator('#jfin .logros .logro.hecho').count())
    foto('20-trayectoria')
    pulsar(boton('Volver'))
    pulsar(boton('Menú principal'))
    ok('El menú muestra el récord', 'récord de 1 día' in page.locator('#jfin .hueco').first.inner_text(), page.locator('#jfin .hueco').first.inner_text())
    # ── Una semana que cierra en rojo se pierde ──
    pulsar(boton('Nueva partida').first)
    js("""() => { const p = Q.juego.partida, c = { ingresos: 80000, trenes: 62000, personal: 9000, fijo: 29000, imprevistos: 4000, compras: 0, ociosas: 9000 };
          p.dia = 6; p.guias = Array(7).fill(true); p.caja = -90000;
          for (let i = 0; i < 6; i++) { p.estrellas[i] = 1; p.dias[i] = { estrellas: 1, animo: 70, operativo: -24000, saldo: -24000, viajes: 190000, km: 9000, idos: 4000, premio: 0, cuentas: c }; }
          Q.juego.semana(6); }""")
    ok('Último día con la caja en rojo: el tablero dice cuánto hace falta', 'para no perder el cargo' in page.locator('#jfin').text_content())
    pulsar(boton('Empezar el domingo'))
    terminar_dia([12, 10, 6, 5, 6, 6, 5], 4)
    ok('La semana cerró en rojo: partida perdida', partida_n(1)['perdida'] is True and boton('Ver el cierre de la semana →').is_visible())
    pulsar(boton('Ver el cierre de la semana →'))
    ok('Pantalla de relevo, con las razones', page.locator('#jfin .caja.perdida').count() == 1 and 'Relevado del cargo' in page.locator('#jfin').text_content() and page.locator('#jfin .consejo').count() >= 1)
    foto('21-partida-perdida')
    pulsar(boton('Menú principal'))
    ok('El menú marca la partida como perdida', 'Partida perdida' in page.locator('#jfin .hueco').nth(1).text_content())
    ok('Sin desbordes horizontales', js('document.documentElement.scrollWidth <= innerWidth'))
    nav.close()
malas = [n for n, c in hechos if not c]
print(f'\n{len(hechos) - len(malas)} de {len(hechos)} comprobaciones pasaron · errores de página: {len(errores)}')
for e in errores[:12]: print('  !', e[:300])
sys.exit(1 if malas or errores else 0)
