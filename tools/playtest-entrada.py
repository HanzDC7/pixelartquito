"""Zoom de entrada: python tools/playtest-entrada.py --url http://127.0.0.1:8767."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8767')
parser.add_argument('--browser', default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args = parser.parse_args()
out = Path('docs/playtest')
out.mkdir(parents=True, exist_ok=True)
checks, errors = [], []

def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=args.browser)
    context = browser.new_context()
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))

    def load(width=1440, height=900):
        page.goto('about:blank')
        page.set_viewport_size({'width': width, 'height': height})
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        page.wait_for_function('!!Q.juego')

    def ready():
        page.wait_for_function('Q.juego.sim && !document.body.classList.contains("entrando")')

    load()
    target = page.evaluate('Q.mapa.estacionCercana()')
    nivel = page.evaluate('Q.state.nivel')
    page.locator('#jugar').click()
    check('El zoom parte de la escala actual sin un salto previo', page.evaluate('Q.state.nivel') == nivel)
    check('La entrada muestra la estación elegida', int(page.locator('#jentrada').get_attribute('data-estacion')) == target)
    check('La partida espera mientras se acerca la cámara', page.evaluate('Q.juego.sim === null'))
    page.wait_for_function('new DOMMatrix(getComputedStyle(document.querySelector("#view")).transform).a > 1.4')
    page.screenshot(path=str(out / 'entrada-zoom.png'))
    page.keyboard.press('ArrowRight')
    ready()
    check('El zoom abre el interior de la misma estación', page.locator('body.dentro').count() == 1 and int(page.get_by_label('Ver estación', exact=True).input_value()) == target)
    check('El lienzo recupera su escala y los controles responden', page.locator('#view').evaluate('(e) => e.style.transform === ""') and not page.locator('#jefe').evaluate('(e) => e.inert'))
    # En la primera visita, el lunes empieza con la guía del Puesto Central y el reloj detenido; al saltarla, corre.
    check('La primera visita empieza con la guía del día', page.locator('#jtut').is_visible() and page.locator('.jestado').inner_text() == 'En pausa')
    page.get_by_role('button', name='Saltar la guía', exact=True).click()
    before = page.evaluate('Q.juego.sim.t')
    page.wait_for_function('(t) => Q.juego.sim.t > t + 1', arg=before)
    check('El reloj arranca al entrar', 'En marcha' in page.locator('.jestado').inner_text())
    page.get_by_role('button', name='Pausar', exact=True).click()
    check('Pausar funciona después de la transición', page.locator('.jestado').inner_text() == 'En pausa')
    page.screenshot(path=str(out / 'entrada-interior.png'))

    load(390, 844)
    # Otra estación y proyección inclinada: el destino debe coincidir con el interior.
    page.evaluate('''() => { const e=Q.mapa.metro.est[0]; Q.state.x=e.x; Q.state.c=e.y; Q.mapa.inclinar(true); }''')
    page.locator('#jugar').click()
    check('La entrada puede apuntar a otra estación', page.locator('#jentrada').get_attribute('data-estacion') == '0')
    page.wait_for_function('new DOMMatrix(getComputedStyle(document.querySelector("#view")).transform).a > 1.2')
    page.screenshot(path=str(out / 'entrada-movil.png'))
    page.set_viewport_size({'width': 844, 'height': 390})
    page.get_by_role('button', name='Saltar animación', exact=True).click()
    ready()
    check('Saltar y girar la pantalla conserva el destino', page.get_by_label('Ver estación', exact=True).input_value() == '0' and page.locator('body.dentro').count() == 1)

    load()
    page.locator('#jugar').click()
    page.evaluate('document.querySelector("#jugar").click()')
    page.keyboard.press('Escape')
    ready()
    check('Doble pulsación y Escape producen una sola partida', page.evaluate('Q.juego.sim.t < Q.juego.sim.abre + 10') and not page.locator('#jentrada').is_visible())

    page.emulate_media(reduced_motion='reduce')
    load()
    page.locator('#jugar').click()
    check('Movimiento reducido entra sin zoom ni espera', page.evaluate('!!Q.juego.sim && !document.body.classList.contains("entrando")') and not page.locator('#jentrada').is_visible())
    check('Sin errores JavaScript', not errors)
    (out / 'entrada-resultados.json').write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': len(checks), 'errors': errors}, ensure_ascii=False))
    browser.close()
