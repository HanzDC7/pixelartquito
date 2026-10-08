#!/usr/bin/env python3
"""
Convierte los datos crudos (ver descargar.py) en los archivos que lee el mapa:

    js/datos/base.js      relieve, vías principales, áreas grandes, metro, cerros…
    js/datos/b_X_Y.js     un archivo por bloque de 2 km: calles, edificios y áreas

Todo queda en metros, en un sistema girado para que la cuadrícula del Centro
Histórico quede derecha: el eje X sigue la calle García Moreno hacia el norte
(a la derecha) y el eje Y baja hacia el oriente. El origen es la Plaza Grande.

    python3 tools/generar.py
"""
import base64, collections, glob, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

CACHE = sys.argv[1] if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'datos')
SOLO = 'base' if 'base' in sys.argv[1:] else ''   # «base» para no reescribir los bloques

TESELA = 512          # metros; a 2 m por píxel son 256 px
BLOQUE = 4            # teselas por lado en cada archivo
MARGEN = 24           # lo que una tesela mira más allá de su borde (sombras, anchos de calle)
CELDA_DEM = 50
CELDA_DENS = 32

# ───────────────────────── Lectura ─────────────────────────
def cargar(patron):
    vistos, salida = set(), []
    for ruta in sorted(glob.glob(os.path.join(CACHE, patron))):
        for e in json.load(open(ruta))['elements']:
            clave = (e['type'], e['id'])
            if clave not in vistos:
                vistos.add(clave); salida.append(e)
    return salida


# ───────────────────────── Sistema de coordenadas ─────────────────────────
class Marco:
    def __init__(self, lat0, lon0, theta):
        self.lat0, self.lon0, self.theta = lat0, lon0, theta
        self.klat, self.klon = 110574.0, 111320.0 * math.cos(math.radians(lat0))
        self.c, self.s = math.cos(theta), math.sin(theta)

    def xy(self, lat, lon):
        n, e = (lat - self.lat0) * self.klat, (lon - self.lon0) * self.klon
        return n * self.c + e * self.s, -n * self.s + e * self.c

    def latlon(self, x, y):
        n, e = x * self.c - y * self.s, x * self.s + y * self.c
        return self.lat0 + n / self.klat, self.lon0 + e / self.klon

    def puntos(self, geom):
        return [self.xy(p['lat'], p['lon']) for p in geom]


def hallar_marco(calles):
    """Origen en la Plaza Grande; el giro sale de la dirección real de la calle García Moreno."""
    lat0, lon0 = -0.220117, -78.512093
    provisional = Marco(lat0, lon0, 0)
    pts = []
    for e in calles:
        if 'García Moreno' in e['tags'].get('name', '') and 'geometry' in e:
            for p in e['geometry']:
                n, ea = (p['lat'] - lat0) * provisional.klat, (p['lon'] - lon0) * provisional.klon
                if math.hypot(n, ea) < 700:
                    pts.append((ea, n))
    a = np.array(pts); a = a - a.mean(axis=0)
    _, _, vt = np.linalg.svd(a, full_matrices=False)
    este, norte = vt[0]
    if norte < 0: este, norte = -este, -norte
    return Marco(lat0, lon0, math.atan2(este, norte))


# ───────────────────────── Geometría ─────────────────────────
def simplificar(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        peor, ip = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0: d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > peor: peor, ip = d, i
        if peor > tol: keep[ip] = True; pila += [(a, ip), (ip, b)]
    return [p for p, k in zip(pts, keep) if k]


def area(pts):
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))


def centro(pts):
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def caja(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def recortar(pts, x0, y0, x1, y1):
    """Sutherland-Hodgman: recorta un anillo contra un rectángulo."""
    def corte(pts, dentro, cruce):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            da, db = dentro(a), dentro(b)
            if db:
                if not da: out.append(cruce(a, b))
                out.append(b)
            elif da: out.append(cruce(a, b))
        return out
    def cx(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))
    def cy(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)
    for dentro, cruce in ((lambda p: p[0] >= x0, cx(x0)), (lambda p: p[0] <= x1, cx(x1)), (lambda p: p[1] >= y0, cy(y0)), (lambda p: p[1] <= y1, cy(y1))):
        pts = corte(pts, dentro, cruce)
        if len(pts) < 3: return []
    return pts


def anillos(e, marco):
    """Anillos (exterior primero, luego huecos) de una vía cerrada o de un multipolígono."""
    if e['type'] == 'way':
        g = e.get('geometry')
        return [marco.puntos(g)] if g and len(g) >= 4 else []
    if e['type'] != 'relation': return []
    def coser(trozos):
        hechos, trozos = [], [list(t) for t in trozos if len(t) >= 2]
        while trozos:
            r = trozos.pop()
            cambio = True
            while cambio and r[0] != r[-1]:
                cambio = False
                for i, t in enumerate(trozos):
                    if t[0] == r[-1]: r += t[1:]
                    elif t[-1] == r[-1]: r += t[-2::-1]
                    elif t[-1] == r[0]: r = t[:-1] + r
                    elif t[0] == r[0]: r = t[:0:-1] + r
                    else: continue
                    trozos.pop(i); cambio = True; break
            if len(r) >= 4: hechos.append(r)
        return hechos
    fuera, dentro = [], []
    for m in e.get('members', []):
        if m.get('type') == 'way' and m.get('geometry'):
            (dentro if m.get('role') == 'inner' else fuera).append([(p['lat'], p['lon']) for p in m['geometry']])
    return [[marco.xy(*p) for p in r] for r in coser(fuera) + coser(dentro)]


def unir(vias):
    """Une los tramos consecutivos de una misma vía, para que una avenida sea una sola línea."""
    grupos = collections.defaultdict(list)
    for v in vias: grupos[(v[0], v[1])].append(list(v[3]))
    salida = []
    for (k, nombre), tramos in grupos.items():
        if not nombre: salida += [(k, nombre, '', t) for t in tramos]; continue
        llave = lambda p: (round(p[0] / 2), round(p[1] / 2))
        libres = tramos[:]
        while libres:
            linea = libres.pop()
            cambio = True
            while cambio:
                cambio = False
                for i, t in enumerate(libres):
                    if llave(t[0]) == llave(linea[-1]): linea = linea + t[1:]
                    elif llave(t[-1]) == llave(linea[0]): linea = t[:-1] + linea
                    elif not (k & 64) and llave(t[-1]) == llave(linea[-1]): linea = linea + t[-2::-1]
                    elif not (k & 64) and llave(t[0]) == llave(linea[0]): linea = t[:0:-1] + linea
                    else: continue
                    libres.pop(i); cambio = True; break
            salida.append((k, nombre, '', linea))
    return salida


# ───────────────────────── Escritura binaria ─────────────────────────
class Bytes:
    def __init__(self): self.b = bytearray()
    def u(self, v):
        v = int(v)
        while v >= 0x80: self.b.append((v & 0x7F) | 0x80); v >>= 7
        self.b.append(v)
    def z(self, v):
        v = int(v); self.u((v << 1) ^ (v >> 63))
    def linea(self, pts, ox=0, oy=0, esc=1.0):
        """Puntos enteros: el primero absoluto, los demás como diferencias."""
        q = []
        for x, y in pts:
            p = (round((x - ox) / esc), round((y - oy) / esc))
            if not q or p != q[-1]: q.append(p)
        self.u(len(q)); px = py = 0
        for x, y in q: self.z(x - px); self.z(y - py); px, py = x, y
    def b64(self): return base64.b64encode(bytes(self.b)).decode()


def js(nombre, llamada):
    open(os.path.join(SALIDA, nombre), 'w').write(llamada + '\n')


# ───────────────────────── Clasificación ─────────────────────────
VIA = {'motorway': 0, 'trunk': 1, 'primary': 2, 'secondary': 3, 'tertiary': 4, 'residential': 5, 'unclassified': 5,
       'living_street': 5, 'road': 5, 'service': 6, 'pedestrian': 7, 'footway': 8, 'path': 8, 'cycleway': 8,
       'bridleway': 8, 'steps': 9, 'track': 10, 'busway': 11, 'motorway_link': 4, 'trunk_link': 4,
       'primary_link': 4, 'secondary_link': 5, 'tertiary_link': 5}
RIO, QUEBRADA = 12, 13
PARQUE, CANCHA, ESTADIO, DEPORTE, PASTO, BOSQUE, MATORRAL, CULTIVO, CEMENTERIO, PLAZA, AGUA, ROCA, INDUSTRIA, COMERCIO, MILITAR, CAMPUS, HOSPITAL, MERCADO, TERMINAL, PISTA = range(1, 21)
ORDEN_AREA = [CULTIVO, BOSQUE, MATORRAL, PASTO, INDUSTRIA, COMERCIO, MILITAR, CAMPUS, HOSPITAL, TERMINAL, CEMENTERIO, PARQUE, DEPORTE, ESTADIO, PISTA, MERCADO, PLAZA, CANCHA, AGUA, ROCA]


def clase_area(t):
    l, u, n, a = t.get('leisure'), t.get('landuse'), t.get('natural'), t.get('amenity')
    if n == 'water': return AGUA
    if l in ('pitch', 'track'): return CANCHA
    if l == 'stadium': return ESTADIO
    if l in ('park', 'garden', 'playground') or u in ('recreation_ground', 'village_green'): return PARQUE
    if l == 'sports_centre': return DEPORTE
    if t.get('place') == 'square' or (t.get('highway') == 'pedestrian'): return PLAZA
    if u == 'cemetery': return CEMENTERIO
    if u == 'forest' or n == 'wood': return BOSQUE
    if n == 'scrub': return MATORRAL
    if u in ('grass', 'meadow') or n in ('grassland', 'wetland') or l == 'golf_course': return PASTO
    if u in ('farmland', 'orchard'): return CULTIVO
    if n in ('bare_rock', 'scree') or u == 'quarry': return ROCA
    if u == 'industrial': return INDUSTRIA
    if u in ('retail', 'commercial'): return COMERCIO
    if u == 'military': return MILITAR
    if a in ('university', 'college'): return CAMPUS
    if a == 'hospital': return HOSPITAL
    if a == 'marketplace': return MERCADO
    if a == 'bus_station': return TERMINAL
    if t.get('aeroway') in ('runway', 'taxiway', 'apron'): return PISTA
    return 0


DEPORTES = {'soccer': 1, 'football': 1, 'basketball': 2, 'tennis': 3, 'volleyball': 4, 'multi': 2, 'athletics': 5, 'running': 5, 'swimming': 6, 'skateboard': 7, 'equestrian': 8, 'bullfighting': 8}


def tipo_edificio(t):
    b, a = t.get('building', ''), t.get('amenity', '')
    if a == 'place_of_worship' or b in ('church', 'cathedral', 'chapel', 'basilica', 'monastery', 'convent', 'religious'): return 1
    if b in ('public', 'government', 'civic') or a in ('townhall', 'courthouse', 'embassy') or t.get('office') == 'government': return 2
    if b in ('retail', 'commercial', 'supermarket', 'mall', 'kiosk') or t.get('shop'): return 3
    if b in ('industrial', 'warehouse', 'manufacture', 'hangar'): return 4
    if b in ('roof', 'carport', 'shed', 'greenhouse', 'garage', 'garages'): return 5
    if b in ('school', 'university', 'college', 'kindergarten') or a in ('school', 'university', 'college'): return 6
    if b == 'hospital' or a in ('hospital', 'clinic'): return 7
    if b in ('stadium', 'grandstand', 'sports_hall') or t.get('leisure') in ('stadium', 'sports_centre'): return 8
    if b in ('hotel', 'office', 'apartments'): return 9
    return 0


def pisos(t):
    for k, div in (('building:levels', 1), ('height', 3.2)):
        try: return max(1, min(60, round(float(str(t[k]).split()[0].replace(',', '.').replace('m', '')) / div)))
        except Exception: pass
    return 0


# ───────────────────────── Programa ─────────────────────────
def main():
    os.makedirs(SALIDA, exist_ok=True)
    print('Leyendo…')
    calles = [e for e in cargar('calles_*.json') if e.get('geometry')]
    M = hallar_marco(calles)
    print(f'  giro {math.degrees(M.theta):.2f}° · {len(calles)} vías')

    # El mundo: de Cutuglagua al cráter del Pululahua, y del Guagua Pichincha a los
    # valles de Tumbaco y Los Chillos. En múltiplos de un bloque.
    X0, X1, Y0, Y1 = -18432, 26624, -20480, 12288
    print(f'  mundo x {X0}..{X1} · y {Y0}..{Y1}  ({(X1 - X0) / 1000:.1f} × {(Y1 - Y0) / 1000:.1f} km)')
    dentro = lambda x, y: X0 <= x <= X1 and Y0 <= y <= Y1

    teselas = collections.defaultdict(lambda: {'v': [], 'e': [], 'a': []})
    def cada_tesela(x0, y0, x1, y1, m=MARGEN):
        for tx in range(int((x0 - m - X0) // TESELA), int((x1 + m - X0) // TESELA) + 1):
            for ty in range(int((y0 - m - Y0) // TESELA), int((y1 + m - Y0) // TESELA) + 1):
                if 0 <= tx < (X1 - X0) // TESELA and 0 <= ty < (Y1 - Y0) // TESELA:
                    yield tx, ty

    # ── Calles ──
    nombres, mayores, dens_calle = {}, [], None
    W32, H32 = (X1 - X0) // CELDA_DENS, (Y1 - Y0) // CELDA_DENS
    img_calle = Image.new('L', (W32 * 4, H32 * 4), 0); dib_calle = ImageDraw.Draw(img_calle)   # a 8 m, luego se promedia
    img_edif = Image.new('L', (W32 * 4, H32 * 4), 0); dib_edif = ImageDraw.Draw(img_edif)
    a8 = lambda pts: [((x - X0) / 8, (y - Y0) / 8) for x, y in pts]
    n_vias = 0
    for e in calles:
        t = e['tags']; h = t.get('highway')
        if h not in VIA: continue
        if h == 'service' and t.get('service') in ('parking_aisle', 'driveway', 'drive-through'): continue
        if h == 'footway' and t.get('footway') in ('sidewalk', 'crossing', 'traffic_island'): continue
        if t.get('area') == 'yes': continue
        if t.get('access') == 'private' and h in ('service', 'footway', 'path'): continue
        pts = M.puntos(e['geometry'])
        if not any(dentro(*p) for p in pts): continue
        k = VIA[h]
        tunel = t.get('tunnel') in ('yes', 'building_passage') or t.get('covered') == 'yes'
        puente = t.get('bridge') not in (None, 'no')
        nombre = t.get('name', '').strip()
        pts = simplificar(pts, 0.6)
        if k <= 6 or k == 11: dib_calle.line(a8(pts), fill=255, width=2 if k <= 3 else 1)
        if (k <= 4 or k == 11) and not tunel:
            unico = t.get('oneway') in ('yes', '1', 'true') or t.get('junction') == 'roundabout'
            mayores.append((k | (64 if unico else 0), nombre, t.get('ref', ''), simplificar(pts, 4)))
        # En trozos cortos, para que cada tesela guarde solo lo suyo.
        for i in range(0, len(pts) - 1, 6):
            trozo = pts[i:i + 7]
            x0, y0, x1, y1 = caja(trozo)
            for tx, ty in cada_tesela(x0, y0, x1, y1):
                teselas[(tx, ty)]['v'].append((k | (16 if tunel else 0) | (32 if puente else 0), nombre, trozo))
            n_vias += 1
    print(f'  {n_vias} trozos de vía · {len(mayores)} vías principales')

    # ── Áreas y cursos de agua ──
    grandes, n_areas = [], 0
    for e in cargar('areas_*.json'):
        t = e.get('tags', {})
        if t.get('waterway'):
            if e['type'] != 'way' or not e.get('geometry') or t['waterway'] not in ('river', 'stream', 'canal', 'drain', 'ditch'): continue
            if t.get('tunnel') in ('yes', 'culvert'): continue
            pts = simplificar(M.puntos(e['geometry']), 1.0)
            if not any(dentro(*p) for p in pts): continue
            k = RIO if t['waterway'] == 'river' else QUEBRADA
            mayores.append((k, t.get('name', ''), '', simplificar(pts, 6)))
            for i in range(0, len(pts) - 1, 6):
                trozo = pts[i:i + 7]
                for tx, ty in cada_tesela(*caja(trozo)): teselas[(tx, ty)]['v'].append((k, '', trozo))
            continue
        k = clase_area(t)
        if not k: continue
        rs = [simplificar(r, 0.8) for r in anillos(e, M)]
        rs = [r for r in rs if len(r) >= 4]
        if not rs or not any(dentro(*p) for p in rs[0]): continue
        sub = DEPORTES.get(t.get('sport', '').split(';')[0], 0) if k in (CANCHA, DEPORTE, ESTADIO) else 0
        ar = abs(area(rs[0]))
        if ar < 30: continue
        if ar > 12000 and k not in (INDUSTRIA, COMERCIO, MILITAR, HOSPITAL, MERCADO, TERMINAL):
            grandes.append((k, sub, t.get('name', ''), [simplificar(r, 10) for r in rs], ar))
        x0, y0, x1, y1 = caja(rs[0])
        for tx, ty in cada_tesela(x0, y0, x1, y1, MARGEN - 2):
            bx0, by0 = X0 + tx * TESELA - MARGEN, Y0 + ty * TESELA - MARGEN
            rec = [recortar(r, bx0, by0, bx0 + TESELA + 2 * MARGEN, by0 + TESELA + 2 * MARGEN) for r in rs]
            rec = [r for r in rec if len(r) >= 3]
            if rec and abs(area(rec[0])) > 6: teselas[(tx, ty)]['a'].append((k, sub, rec)); n_areas += 1
    print(f'  {n_areas} áreas · {len(grandes)} grandes')

    # ── Edificios ──
    n_ed, altos = 0, []
    for e in cargar('edificios_*.json') + cargar('altos.json'):
        t = e.get('tags', {})
        if 'building' not in t or t.get('building') == 'no' or t.get('location') == 'underground': continue
        rs = [simplificar(r, 0.4) for r in anillos(e, M)]
        rs = [r for r in rs if len(r) >= 4]
        if not rs: continue
        cx, cy = centro(rs[0])
        if not dentro(cx, cy): continue
        ar = abs(area(rs[0]))
        if ar < 8: continue
        p, tipo = pisos(t), tipo_edificio(t)
        dib_edif.polygon(a8(rs[0]), fill=255)
        if p >= 8: altos.append((round(cx), round(cy), p, round(math.sqrt(ar)), t.get('name', '')))
        x0, y0, x1, y1 = caja(rs[0])
        for tx, ty in cada_tesela(x0, y0, x1, y1, MARGEN + min(60, p * 2)):
            teselas[(tx, ty)]['e'].append((p, tipo, rs))
        n_ed += 1
    print(f'  {n_ed} edificios · {len(altos)} de 8 pisos o más')

    # ── Bloques ──
    if SOLO != 'base':
        for f in glob.glob(os.path.join(SALIDA, 'b_*.js')): os.remove(f)
    bloques, total = collections.defaultdict(list), 0
    for (tx, ty) in teselas: bloques[(tx // BLOQUE, ty // BLOQUE)].append((tx, ty))
    for (bx, by), lista in sorted(bloques.items()):
        B, tabla = Bytes(), {}
        def nom(n):
            if not n: return 0
            if n not in tabla: tabla[n] = len(tabla) + 1
            return tabla[n]
        B.u(len(lista))
        for tx, ty in sorted(lista):
            T = teselas[(tx, ty)]; ox, oy = X0 + tx * TESELA, Y0 + ty * TESELA
            B.u(tx % BLOQUE); B.u(ty % BLOQUE)
            B.u(len(T['v']))
            for k, nombre, pts in T['v']: B.u(k); B.u(nom(nombre)); B.linea(pts, ox, oy)
            B.u(len(T['e']))
            for p, tipo, rs in T['e']:
                B.u(p); B.u(tipo); B.u(len(rs))
                for r in rs: B.linea(r[:-1] if r[0] == r[-1] else r, ox, oy)
            T['a'].sort(key=lambda a: ORDEN_AREA.index(a[0]))
            B.u(len(T['a']))
            for k, sub, rs in T['a']:
                B.u(k); B.u(sub); B.u(len(rs))
                for r in rs: B.linea(r[:-1] if r[0] == r[-1] else r, ox, oy)
        lista_nombres = [n for n, _ in sorted(tabla.items(), key=lambda kv: kv[1])]
        if SOLO != 'base':
            js(f'b_{bx}_{by}.js', f'Q.datos.llega({bx},{by},"{B.b64()}",{json.dumps(lista_nombres, ensure_ascii=False, separators=(",", ":"))});')
        total += len(B.b)
    print(f'  {len(bloques)} bloques · {total / 1e6:.1f} MB')

    # ── Relieve ──
    print('Relieve…')
    z = 12; n = 2 ** z
    piezas = {}
    for ruta in glob.glob(os.path.join(CACHE, f'dem_{z}_*.png')):
        _, _, tx, ty = os.path.basename(ruta)[:-4].split('_')
        a = np.asarray(Image.open(ruta).convert('RGB'), dtype=np.float64)
        piezas[(int(tx), int(ty))] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    tx0, tx1 = min(k[0] for k in piezas), max(k[0] for k in piezas)
    ty0, ty1 = min(k[1] for k in piezas), max(k[1] for k in piezas)
    mosaico = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
    for (tx, ty), a in piezas.items(): mosaico[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = a
    DX0, DY0 = X0 - 1500, Y0 - 1500
    dw, dh = (X1 - X0 + 3000) // CELDA_DEM + 1, (Y1 - Y0 + 3000) // CELDA_DEM + 1
    gx, gy = np.meshgrid(DX0 + np.arange(dw) * CELDA_DEM, DY0 + np.arange(dh) * CELDA_DEM)
    nn, ee = gx * M.c - gy * M.s, gx * M.s + gy * M.c
    lat, lon = M.lat0 + nn / M.klat, M.lon0 + ee / M.klon
    px = (lon + 180) / 360 * n * 256 - tx0 * 256 - 0.5
    py = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n * 256 - ty0 * 256 - 0.5
    ix, iy = np.clip(np.floor(px).astype(int), 0, mosaico.shape[1] - 2), np.clip(np.floor(py).astype(int), 0, mosaico.shape[0] - 2)
    fx, fy = np.clip(px - ix, 0, 1), np.clip(py - iy, 0, 1)
    alt = (mosaico[iy, ix] * (1 - fx) + mosaico[iy, ix + 1] * fx) * (1 - fy) + (mosaico[iy + 1, ix] * (1 - fx) + mosaico[iy + 1, ix + 1] * fx) * fy
    from scipy.ndimage import gaussian_filter
    alt = gaussian_filter(alt, 0.7)   # quita el escalonado del SRTM
    ZMIN = 1200
    q = np.clip(np.round(alt - ZMIN), 0, 4095).astype(np.uint16).ravel()
    A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    tabla = np.array(list(A))
    dem64 = ''.join((tabla[q >> 6].astype(object) + tabla[q & 63].astype(object)).tolist())
    def altura(x, y):
        return float(alt[int(round((y - DY0) / CELDA_DEM)), int(round((x - DX0) / CELDA_DEM))])
    print(f'  {dw}×{dh} · {alt.min():.0f}–{alt.max():.0f} m · Plaza Grande {altura(0, 0):.0f} m')

    # ── Densidad urbana (para la vista de toda la región) ──
    def promediar(img):
        a = np.asarray(img, dtype=np.float32).reshape(H32, 4, W32, 4).mean(axis=(1, 3)) / 255
        return a
    dc, de = promediar(img_calle), promediar(img_edif)
    dens = (np.clip(np.round(dc * 3 / 0.45), 0, 3).astype(np.uint8) << 2) | np.clip(np.ceil(de * 3 / 0.5), 0, 3).astype(np.uint8)
    D, plano, i = Bytes(), dens.ravel(), 0
    while i < len(plano):     # por tramos: valor y repeticiones
        j = i
        while j < len(plano) and plano[j] == plano[i] and j - i < 4000: j += 1
        D.u(int(plano[i]) | ((j - i) << 4)); i = j
    print(f'  densidad {W32}×{H32} · {len(D.b) / 1e3:.0f} KB')

    # ── Transporte ──
    metro_vias, estaciones, cables, est_cable = [], {}, [], []
    for e in cargar('transporte.json'):
        t = e.get('tags', {})
        if e['type'] == 'way' and t.get('railway') == 'subway' and e.get('geometry'):
            if t.get('service') in ('yard', 'siding', 'spur', 'crossover'): continue
            metro_vias.append(simplificar(M.puntos(e['geometry']), 3))
        elif e['type'] == 'way' and t.get('railway') in ('rail', 'narrow_gauge', 'light_rail') and e.get('geometry'):
            mayores.append((14, t.get('name', ''), '', simplificar(M.puntos(e['geometry']), 4)))
        elif e['type'] == 'way' and t.get('aerialway') in ('gondola', 'cable_car', 'chair_lift') and e.get('geometry'):
            cables.append((t.get('name', ''), M.puntos(e['geometry'])))
        elif e['type'] == 'node' and t.get('aerialway') == 'station':
            est_cable.append((t.get('name', ''), *M.xy(e['lat'], e['lon'])))
        elif (t.get('station') == 'subway' or (t.get('railway') == 'station' and t.get('subway') == 'yes')) and t.get('name'):
            if e['type'] == 'node': p = M.xy(e['lat'], e['lon'])
            elif e.get('geometry'): p = centro(M.puntos(e['geometry']))
            else: continue
            limpio = t['name']
            for sobra in ('Estación ', 'Metro de Quito', 'del ', 'Metro '): limpio = limpio.replace(sobra, '')
            limpio = {'Pradera': 'La Pradera', 'Labrador': 'El Labrador'}.get(limpio.strip(), limpio.strip())
            estaciones.setdefault(limpio, []).append(p)

    # ── Vías principales y áreas grandes, simplificadas ──
    V = Bytes(); tabla_v = {}
    def nomv(nm):
        if not nm: return 0
        if nm not in tabla_v: tabla_v[nm] = len(tabla_v) + 1
        return tabla_v[nm]
    mayores = unir([m for m in mayores if len(m[3]) >= 2])
    V.u(len(mayores))
    for k, nombre, ref, pts in mayores: V.u(k); V.u(nomv(nombre)); V.linea(pts, X0, Y0, 2)
    G = Bytes(); grandes.sort(key=lambda a: ORDEN_AREA.index(a[0])); tabla_g = {}
    def nomg(nm):
        if not nm: return 0
        if nm not in tabla_g: tabla_g[nm] = len(tabla_g) + 1
        return tabla_g[nm]
    G.u(len(grandes))
    for k, sub, nombre, rs, ar in grandes:
        G.u(k); G.u(nomg(nombre) if ar > 30000 else 0); G.u(len(rs))
        for r in rs: G.linea(r[:-1] if r[0] == r[-1] else r, X0, Y0, 2)

    # ── Lugares con nombre ──
    cerros, barrios, templos, sitios = [], [], [], []
    for e in cargar('lugares.json'):
        t = e.get('tags', {}); nombre = t.get('name')
        if e['type'] == 'node': lat, lon = e['lat'], e['lon']
        elif 'center' in e: lat, lon = e['center']['lat'], e['center']['lon']
        elif 'bounds' in e: lat, lon = (e['bounds']['minlat'] + e['bounds']['maxlat']) / 2, (e['bounds']['minlon'] + e['bounds']['maxlon']) / 2
        else: continue
        x, y = M.xy(lat, lon)
        if t.get('natural') in ('peak', 'volcano') and nombre:
            try: ele = round(float(str(t.get('ele', '0')).replace(',', '.').split()[0]))
            except Exception: ele = 0
            cerros.append([nombre, round(x), round(y), ele])
        elif t.get('place') and nombre and dentro(x, y):
            barrios.append([nombre, round(x), round(y), {'city': 0, 'town': 1, 'suburb': 2, 'village': 2, 'quarter': 3, 'neighbourhood': 3}.get(t['place'], 3)])
        elif nombre and dentro(x, y):
            clase = 'templo' if t.get('amenity') == 'place_of_worship' else t.get('tourism') or t.get('historic') or t.get('amenity') or t.get('man_made') or t.get('shop') or 'otro'
            geom = None
            if e['type'] == 'way' and e.get('geometry'):
                pts = M.puntos(e['geometry']); x0, y0, x1, y1 = caja(pts); geom = [round(x1 - x0), round(y1 - y0)]
            sitios.append([nombre, round(x), round(y), clase, e['type'][0] + str(e['id']), geom])
    json.dump({'areas': [[n, round(centro(rs[0])[0]), round(centro(rs[0])[1]), k, round(ar), [round(v) for v in caja(rs[0])]] for k, sub, n, rs, ar in grandes if n], 'sitios': sitios, 'altos': altos, 'cables': cables, 'est_cable': est_cable, 'estaciones': estaciones,
               'metro': metro_vias, 'cerros': cerros, 'marco': [M.lat0, M.lon0, M.theta], 'mundo': [X0, Y0, X1, Y1]},
              open(os.path.join(CACHE, 'indice.json'), 'w'), ensure_ascii=False)

    base = {
        'origen': [M.lat0, M.lon0], 'giro': M.theta, 'mundo': [X0, Y0, X1, Y1], 'tesela': TESELA, 'bloque': BLOQUE,
        'bloques': sorted(f'{bx}_{by}' for bx, by in bloques),
        'dem': {'x0': DX0, 'y0': DY0, 'celda': CELDA_DEM, 'w': int(dw), 'h': int(dh), 'zmin': ZMIN, 'datos': dem64},
        'dens': {'celda': CELDA_DENS, 'w': int(W32), 'h': int(H32), 'datos': D.b64()},
        'vias': {'datos': V.b64(), 'nombres': [n for n, _ in sorted(tabla_v.items(), key=lambda kv: kv[1])]},
        'areas': {'datos': G.b64(), 'nombres': [n for n, _ in sorted(tabla_g.items(), key=lambda kv: kv[1])]},
        'metro': [[[round(x), round(y)] for x, y in v] for v in metro_vias],
        'estaciones': [[n, round(sum(p[0] for p in ps) / len(ps)), round(sum(p[1] for p in ps) / len(ps))] for n, ps in estaciones.items()],
        'cables': [[n, [[round(x), round(y)] for x, y in pts]] for n, pts in cables],
        'cerros': cerros, 'barrios': barrios,
        'altos': [a[:4] for a in altos],
    }
    js('base.js', 'Q.BASE=' + json.dumps(base, ensure_ascii=False, separators=(',', ':')) + ';')
    print(f'  base.js {os.path.getsize(os.path.join(SALIDA, "base.js")) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
