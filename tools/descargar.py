#!/usr/bin/env python3
"""
Descarga los datos crudos de Quito: OpenStreetMap (Overpass) y relieve (SRTM,
en las teselas «terrarium» públicas). Solo hace falta volver a correrlo si se
quiere actualizar el mapa; el resultado se guarda en una carpeta de caché.

    python3 tools/descargar.py            (guarda en tools/cache, unos 200 MB)
"""
import json, os, sys, time, urllib.parse, urllib.request

CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
UA = {'User-Agent': 'quito-pixelart/2.0 (mapa educativo local)', 'Accept': 'application/json'}
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

# Todo el Quito urbano, de Cutuglagua (sur) a San Antonio de Pichincha (norte).
SUR, NORTE, OESTE, ESTE = -0.40, 0.03, -78.62, -78.39
FRANJAS = 9   # la consulta se parte en franjas de latitud para no agotar el servidor


def overpass(nombre, consulta):
    ruta = os.path.join(CACHE, nombre + '.json')
    if os.path.exists(ruta) and os.path.getsize(ruta) > 200:
        return
    cuerpo = urllib.parse.urlencode({'data': consulta}).encode()
    for intento in range(14):
        url = OVERPASS[intento % len(OVERPASS)]
        try:
            with urllib.request.urlopen(urllib.request.Request(url, cuerpo, UA), timeout=200) as r:
                datos = r.read()
            json.loads(datos)
            open(ruta, 'wb').write(datos)
            print(f'  {nombre}: {len(datos) / 1e6:.1f} MB', flush=True)
            time.sleep(8)
            return
        except Exception as e:   # servidor ocupado: esperar y reintentar
            print(f'  {nombre}: {e}; reintento {intento + 1}', flush=True)
            time.sleep(min(150, 20 + intento * 20))
    raise SystemExit(f'No se pudo descargar {nombre}')


def franjas():
    paso = (NORTE - SUR) / FRANJAS
    for i in range(FRANJAS):
        yield i, f'{SUR + i * paso:.5f},{OESTE},{SUR + (i + 1) * paso:.5f},{ESTE}'


def main():
    os.makedirs(CACHE, exist_ok=True)
    todo = f'{SUR},{OESTE},{NORTE},{ESTE}'

    print('Calles')
    for i, bb in franjas():
        overpass(f'calles_{i}', f'[out:json][timeout:240];way["highway"]({bb});out tags geom qt;')

    print('Parques, plazas, agua y usos del suelo')
    for i, bb in franjas():
        overpass(f'areas_{i}', f'''[out:json][timeout:240];(
            nwr["leisure"~"^(park|garden|pitch|stadium|sports_centre|track|playground|nature_reserve|golf_course)$"]({bb});
            nwr["landuse"~"^(grass|forest|cemetery|recreation_ground|meadow|farmland|orchard|quarry|military|industrial|retail|commercial|religious|village_green)$"]({bb});
            nwr["natural"~"^(water|wood|scrub|grassland|bare_rock|scree|wetland)$"]({bb});
            nwr["place"="square"]({bb});
            way["highway"="pedestrian"]["area"="yes"]({bb});
            way["waterway"]({bb});
            nwr["aeroway"]({bb});
            nwr["amenity"~"^(university|college|hospital|marketplace|bus_station)$"]({bb});
        );out tags geom qt;''')

    print('Transporte')
    overpass('transporte', f'''[out:json][timeout:240];(
        way["railway"~"^(subway|rail|light_rail|narrow_gauge)$"]({todo});
        nwr["railway"="station"]({todo});
        nwr["station"="subway"]({todo});
        nwr["public_transport"="station"]({todo});
        way["aerialway"]({todo});
        node["aerialway"="station"]({todo});
        way["highway"="busway"]({todo});
        relation["route"~"^(trolleybus|subway)$"]({todo});
    );out tags geom qt;''')

    print('Lugares')
    overpass('lugares', f'''[out:json][timeout:240];(
        nwr["amenity"="place_of_worship"]({todo});
        nwr["tourism"~"^(attraction|museum|viewpoint|artwork|gallery|theme_park|zoo)$"]({todo});
        nwr["historic"]({todo});
        node["natural"~"^(peak|volcano|saddle)$"]({SUR - 0.5},{OESTE - 0.4},{NORTE + 0.4},{ESTE + 0.5});
        node["place"~"^(suburb|neighbourhood|quarter|town|village|city)$"]({todo});
        nwr["man_made"~"^(tower|mast|obelisk|lighthouse)$"]({todo});
        nwr["amenity"~"^(theatre|townhall|library|arts_centre|cinema|fountain)$"]({todo});
        nwr["shop"="mall"]({todo});
        nwr["office"="government"]({todo});
    );out tags center geom qt;''')

    print('Edificios altos (todo Quito)')
    overpass('altos', f'''[out:json][timeout:240];(
        way["building"]["building:levels"~"^([5-9]|[1-9][0-9])"]({todo});
        way["building"]["height"]({todo});
        relation["building"]["building:levels"~"^([5-9]|[1-9][0-9])"]({todo});
    );out tags geom qt;''')

    print('Edificios')
    for i, bb in franjas():
        overpass(f'edificios_{i}', f'[out:json][timeout:300];(way["building"]({bb});relation["building"]({bb}););out tags geom qt;')

    print('Relieve')
    import math
    z = 12
    def tesela(lat, lon):
        n = 2 ** z
        x = int((lon + 180) / 360 * n)
        y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
        return x, y
    # Con margen: el Pichincha al oeste y los valles al este.
    x0, y0 = tesela(NORTE + 0.12, OESTE - 0.14)
    x1, y1 = tesela(SUR - 0.12, ESTE + 0.16)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            ruta = os.path.join(CACHE, f'dem_{z}_{x}_{y}.png')
            if os.path.exists(ruta):
                continue
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                open(ruta, 'wb').write(r.read())
    print(f'  teselas {x0}-{x1} x {y0}-{y1} (z{z})')


if __name__ == '__main__':
    main()
