# Quito en pixel art · el mapa real

El mapa de Quito a escala, dibujado en pixel art con código: todas sus calles, edificios, parques y quebradas, de Cutuglagua al cráter del Pululahua y del Guagua Pichincha a los valles. Se puede mirar desde arriba, como un plano, o inclinado, con los cerros y los edificios levantados según su altura real.

No usa imágenes, librerías ni paso de compilación. Las formas salen de OpenStreetMap y el relieve, del SRTM.

## Cómo abrirlo

Doble clic en `index.html`. Funciona directo desde el disco, en cualquier navegador moderno, a pantalla completa.

| Archivo | Qué es |
|---|---|
| `index.html` | El mapa real, extendido: 45 × 33 km, con vista desde arriba e inclinada |
| `resumido/index.html` | La versión anterior: un mapa simplificado con solo las atracciones principales |
| `resumido/panorama.html` | El panorama clásico de lado, con el Pichincha detrás y el Metro bajo la calle |

## Qué se puede hacer

| Acción | Cómo |
|---|---|
| Moverse | Arrastrar, o las flechas |
| Acercarse y alejarse | Rueda del ratón, doble clic, botones **+** y **−**, o las teclas `+` y `-` |
| Inclinar la vista | Botón **Ver inclinado** o tecla `V` |
| Leer la historia de un lugar | Clic sobre él, o su botón en la barra de abajo. Cada visita sella el pasaporte |
| Buscar | **Opciones** → escribir un lugar, un barrio, una avenida o una estación del Metro |
| Ver los nombres | **Opciones** → **Nombres**, o tecla `T`: calles, barrios, cerros con su altitud, estaciones |
| Cambiar la hora y el clima | **Opciones**; `N` alterna día y noche, `R` cambia el clima, `Espacio` pausa el tiempo |
| Dejar solo el dibujo | **Opciones** → **Solo el mapa**, o tecla `H` |
| Fiestas de Quito, sonido, paseo | **Opciones**; `F` enciende las fiestas |

Bajo el cursor se leen siempre las coordenadas y la altitud reales de ese punto.

## El juego: Jefe de línea

Al empezar una partida se elige la dificultad: **Tranquilo** (metas de ánimo 6 puntos más bajas y $12.000 en caja), **Normal** ($8.000) o **Exigente** (metas 4 puntos más altas, $5.000 y premios un 25% mayores).

**Jugar** hace un zoom de unos dos segundos hacia la estación más cercana a la vista actual y abre su interior con el reloj en marcha (la primera vez que juegas cada día de la semana, con la guía del Puesto Central y el reloj detenido hasta que termine). Puedes saltarlo con **Saltar animación**, `Esc`, `Enter` o `Espacio`; si tienes movimiento reducido activado, entras directamente. Si dejaste un turno a medias, **Jugar** te devuelve a él. **Partidas** (o `index.html#juego`) abre las tres partidas guardadas, la semana con su tienda y la trayectoria (logros y récords).

Diriges el Metro de Quito durante la semana de Fiestas, del lunes 30 de noviembre al domingo 6 de diciembre. A velocidad normal cada día dura unos siete minutos, y la semana completa, alrededor de una hora. Después empieza el turno sin fin.

### La semana: una mecánica nueva cada día

La primera vez que juegas un día, el Puesto Central te presenta en pocos pasos lo que trae de nuevo (se puede saltar, y repetir desde la semana).

| Día | Qué pasa | Qué recibes |
|---|---|---|
| Lunes · Tu primer día | Un día normal | **El horario.** De las boleterías se encarga el Puesto Central |
| Martes · Aguacero | Lluvia sobre el pico de la tarde | **Las boleterías:** ventanillas y máquinas. Abre la tienda |
| Miércoles · Trenes en el taller | Dos trenes menos y averías | **Los trenes de refuerzo** y la flota, tren por tren |
| Jueves · Noche de partido | Veinte mil personas salen del Atahualpa | **Las decisiones:** el reloj se detiene y eliges |
| Viernes · Granizada | El agua cierra siete estaciones del norte | **Los cierres:** estaciones cerradas y trenes que dan la vuelta antes |
| Sábado · Víspera de fiestas | Abre a las 07:00, poca gente de día y serenata de noche | **El horario de fin de semana:** otras franjas, un horario aparte y la sugerencia del pronóstico. Hay que cuidar la caja |
| Domingo · Día de Quito | Feriado, desfile, aguacero y concierto | Todo junto |

Cada día tiene una meta de ánimo y un reto con premio. Con lo que sobra en caja se compra en la **tienda**, que se va abriendo: campaña de tarjeta y capacitación de cajeros desde el martes; personal de andén, mantenimiento y turno de noche en el taller desde el miércoles; pantallas desde el jueves; bombas de achique desde el viernes; jefes de estación (que manejan solos las ventanillas) desde el sábado.

### Misiones

Desde el martes, el tablero ofrece encargos de varios días que piden quienes viven de la línea: el directorio, el Municipio, la Defensoría del Pueblo, los barrios del sur, los vecinos del Centro Histórico, la Universidad Central, la prensa. Son trece: tres días seguidos con poca espera, dos días con el sur contento, 600.000 viajes en tres días, un día sin que nadie se vaya de la fila, dos días redondos, tres días sin escándalos por decisiones… Se llevan dos a la vez, tienen plazo en días jugados y pagan un premio. Arriba, durante el día, se ve cómo va cada una.

### Lo que queda para mañana

Algunas decisiones no terminan ese día. Si no respondes a un video viral, al día siguiente tiene un millón de vistas; si le niegas el bono a los cajeros, amanecen «a reglamento» y hay que negociar; si dejas a los vendedores «por hoy», vuelven el doble; una escalera que se deja «para la noche» se traba en la hora pico siguiente; un tren sin ventilación que sigue rodando se recalienta; un grafiti que se deja salir trae imitadores (y la opción de encargar un mural a artistas del sur). Y si adoptas al perro del andén, Durmiente se queda como mascota de la estación para siempre. El tablero del día siguiente dice qué dejó el anterior.

### El informe: por qué salió así

Al final de cada día, el ánimo se reparte entre lo que le restó puntos: esperar en el andén, la fila de la boletería, ver pasar trenes llenos, viajar apretados, las estaciones cerradas, las decisiones, lo que pasó en la ciudad. Sumadas, las barras dan exactamente lo que faltó para llegar a 100. Debajo, las tres causas que más pesaron, con la estación, las horas y lo que se podría haber hecho («La espera en el andén en El Labrador, entre las 17:00 y las 19:00, te costó 3,2 puntos. Faltaron trenes en el «Pico de la tarde» (ibas cada 8 min)…»). Si una decisión costó ánimo, se dice cuál y qué opción.

### El turno sin fin

Al terminar la semana se abre el turno sin fin, que sigue el calendario de verdad. Empieza el lunes 7 de diciembre de 2026 (feriado: el descanso de la Fundación se traslada porque el 6 cae en domingo) y avanza de fecha en fecha, saltando unos días cada vez pero sin saltarse nunca una fecha señalada: Nochebuena, Navidad, fin de año, Año Nuevo, la víspera y el lunes de carnaval, San Valentín, el Viernes Santo con su procesión, el Día del Trabajo, la Quito 15K, el Primer Grito, el regreso a clases, Difuntos, el viernes negro y, un año después, otra vez las Fiestas de Quito.

Cada fecha trae la gente que de verdad mueve: el tablero dice si ese día sube o baja y cita la cifra del Metro de la que sale (el 25 de diciembre de 2024 hubo 96.365 viajes, menos de la mitad de un día normal; la víspera de carnaval de 2026, 234.082, el máximo del mes). En los días flojos el problema es la caja; en los de alza, los andenes.

La línea crece como crece en la realidad: despacio. Cerca de un 8% el primer año y un 14% al segundo, acercándose a un 22% más (unos 250.000 viajes en un día laborable, cerca del récord de 274.000), cuando en las horas pico ya no cabe mucha más gente. En julio y agosto, con las vacaciones escolares de la Sierra, los días laborables se aflojan; de febrero a mayo y en octubre y noviembre llueve casi todas las tardes, y de junio a septiembre casi nunca. Lo que se pone difícil con los días es todo lo demás: la meta sube, los trenes envejecen y se averían más, los sueldos y la energía suben con los años mientras el pasaje sigue en 45 centavos, y pasan más cosas a la vez (aguaceros, granizadas con estaciones cerradas, eventos, paros de buses, un trole dañado en la Maldonado, cortes de luz programados, plantones en la Universidad Central y decisiones). Una fecha que trae lo suyo, como los años viejos o la procesión, no suma además un concierto al azar.

El turno dura hasta que un día termine sin estrellas o deje la caja en rojo. Queda el récord de días aguantados, y las mejoras se conservan para el siguiente intento. Ahí la tienda vende trenes nuevos, publicidad y paneles solares, cada nivel más caro que el anterior.

### La caja

Lo que sobra de cada día va a la caja, y de ahí sale la tienda. Si el miércoles termina con la caja en rojo, llama el directorio con las cuentas de los tres días y te dice dónde recortar: qué parte se llevaron los trenes, cuánto pagaste por ventanillas abiertas sin fila, cuánto costaron las decisiones. En cualquier momento, **Cuentas** muestra lo mismo. Si la semana termina en rojo, pierdes el cargo y la partida; como al repetir un día cuenta su mejor resultado, antes de cerrar el domingo todavía se puede arreglar.

### Logros

**Trayectoria** reúne 22 logros y los récords, que valen para todas las partidas: el día de más viajes, el mejor ánimo y los días aguantados en el turno sin fin.

### Los controles

| Qué decides | Cómo |
|---|---|
| Cada cuánto sale un tren | **Horario**: un intervalo para cada franja del día. Menos intervalo es menos espera, pero más trenes rodando y más gasto. Sábados, domingos y feriados tienen sus propias franjas («Tarde de paseo», «Vuelta a casa»…) y su propio horario, que se guarda aparte. Desde el sábado, **Sugerir horario** arma uno con el pronóstico del día |
| Las boleterías (desde el martes) | **Boleterías** muestra las 15 estaciones; también en la ficha de cada estación o tocando las ventanillas en el dibujo |
| Refuerzos (desde el miércoles) | **Tren extra** manda un tren vacío desde una cabecera, si hay alguno guardado. **Trenes** muestra la flota; cada tren se puede ver por dentro |
| Lo que te consulte el Puesto Central (desde el jueves) | El reloj se detiene y eliges una opción; cada una cuesta plata, tiempo o ánimo |
| El ritmo | **Pausar / Reanudar** o `Espacio`; `1`, `2`, `3` cambian la velocidad. El indicador distingue marcha, pausa y decisiones pendientes |
| Ver una estación por dentro | Selector de estación; **Ver mapa / Ver interior** cambia la vista. **Gestionar estación** abre los detalles. También puedes usar la ficha o `I`, y tocar las ventanillas en el dibujo |

Los interiores tienen materiales y colores inspirados en [fotografías de Quitumbe y San Francisco](docs/referencias-metro.md), adaptados al corte lateral en pixel art.

La gente califica tres cosas: la fila para pagar, la espera en el andén y qué tan apretada viaja. De ahí sale el **ánimo**, de 0 a 100. Cada día tiene una meta: diez puntos por debajo dan una estrella y abren el día siguiente; llegar a ella da dos; superarla por diez sin dejar la caja en rojo, tres. Al final de la semana, las estrellas dan el rango. Todo se guarda solo en el navegador, también a mitad de un turno: si cierras la página o el teléfono descarta la pestaña, al volver sigues en la misma hora, con los mismos trenes y la misma gente.

La tira de abajo es la línea estirada, con las 15 estaciones a su distancia real (en un teléfono, repartidas parejo): las barras claras son la gente esperando (hacia arriba, al norte; hacia abajo, al sur), la barrita amarilla es la fila de la boletería y el color de cada estación es su ánimo. Una equis roja es una estación cerrada.

En el teléfono se juega de pie o acostado: el panel se compacta, las guías y las hojas se apilan sin taparse y los botones crecen para el dedo.

**De dónde salen los números.** Son reales la tarifa de 45 centavos, las formas de pago (tarjeta, ventanilla en efectivo y máquinas que reciben efectivo justo o tarjeta bancaria), los 18 trenes de 1.230 pasajeros, los 34 minutos de punta a punta, el horario de 05:30 a 23:00 (sábados de 07:00 a 23:00, domingos y feriados de 07:00 a 22:00), la frecuencia de referencia (5 minutos en hora pico y 8 en valle), los cerca de 205.000 viajes de un día laborable y el uso de las estaciones más y menos concurridas (Quitumbe, El Labrador, Iñaquito, San Francisco y El Recreo; La Pradera, Jipijapa y Cardenal de la Torre). Son estimados el uso de las otras siete estaciones, el reparto por horas, cuánta gente paga con tarjeta y todos los costos, que están ajustados para que el juego tenga tensión y no para llevar la contabilidad de verdad. La granizada del viernes está calcada de la del 7 de octubre de 2026, cuando el Metro cerró siete estaciones, circuló solo entre Quitumbe y La Alameda y dejó La Pradera cerrada al reabrir; la inundación de El Labrador del domingo, de la del 4 de octubre; y el cierre a la 01:30 del sábado, del de la víspera del 6 de diciembre de 2025. Las decisiones y los eventos son inventados.

**El calendario.** Los feriados salen de la ley de feriados, con sus traslados (lo que cae en martes pasa al lunes; en miércoles o jueves, al viernes; en sábado, al viernes; en domingo, al lunes), y el carnaval y el Viernes Santo, de la fecha de Pascua. Cuánta gente se mueve cada día sale de los viajes diarios que publica el Metro en su boletín estadístico; cada fecha lleva anotada la cifra, y las que no la tienen dicen que son estimadas. Un feriado decretado a última hora no está. La simulación avanza en pasos fijos y es exacta: el mismo día con las mismas órdenes sale idéntico, y así es como se recupera un turno a medias.

## Las escalas

Un píxel mide lo mismo en toda la pantalla. Hay cuatro niveles:

| Nivel | Un píxel | Qué se ve |
|---|---|---|
| Calle | 1 m | Cada casa, con sus ventanas en la vista inclinada |
| Barrio | 2 m | Cada edificio, calle, cancha y árbol |
| Ciudad | 8 m | La trama de calles y manzanas, las avenidas con nombre |
| Región | 32 m | Todo el valle, con el Pichincha, el Ilaló y los nevados señalados en el borde |

El norte no queda arriba: el mapa está girado 41° para que la cuadrícula del Centro Histórico quede derecha, con el Pichincha arriba y el norte hacia la derecha. La rosa de los vientos marca el norte verdadero.

La vista inclinada es una proyección paralela desde 30° sobre el horizonte, mirando hacia el Pichincha. A lo ancho las medidas son las mismas que en el plano; lo que tiene altura (cerros, edificios, árboles) se levanta en proporción.

## Qué es real y qué no

- **Real:** el trazado de las calles y sus nombres, los contornos de los edificios, los parques, canchas, ríos y quebradas, la línea del Metro con sus 15 estaciones, el cable del TelefériQo, el relieve y las altitudes.
- **Estimado:** la altura de los edificios que no la tienen anotada en los datos (se supone de uno a tres pisos), y los colores de los techos, que siguen la zona: teja en el Centro Histórico, losa en el resto.
- **Relleno:** donde OpenStreetMap tiene las calles pero todavía no las casas —buena parte del sur y de la periferia—, las manzanas se llenan con casas genéricas para que no queden vacías.
- **Hitos:** las torres, cúpulas y monumentos de los lugares principales se añadieron a mano sobre sus contornos reales (ver `Q.HITOS` en `js/sitios.js`). Las alturas de la Basílica, la Virgen de El Panecillo, La Merced y la Mitad del Mundo son las publicadas; las demás son a ojo.
- **Animado, no real:** el tráfico, la gente, las palomas, las nubes. El metro va más rápido que en la vida real para que se lo vea pasar.

Las fichas de los lugares son textos de divulgación. Conviene verificar fechas y medidas antes de usarlas en un material oficial.

## Cómo está armado

| Archivo | Contenido |
|---|---|
| `js/nucleo.js` | Utilidades de dibujo, la fuente de píxeles y el estado |
| `js/geo.js` | El sistema de coordenadas, el relieve y la carga de los datos |
| `js/pinta.js` | El pintor: convierte los datos en teselas de pixel art, planas e inclinadas |
| `js/mapa.js` | La cámara, lo que se mueve, los nombres, la entrada y los controles |
| `js/sitios.js` | Dónde está cada lugar con ficha, y los hitos con su altura |
| `js/fichas.js` | La historia de cada lugar y el pasaporte |
| `js/sonido.js` | El sonido, generado con WebAudio |
| `js/metro-sim.js` | Jefe de línea: la simulación de un día (trenes, pasajeros, caja), sin pantalla |
| `js/metro-calendario.js` | Jefe de línea: el calendario real (feriados con su traslado, carnaval y Semana Santa, fechas de Quito) y cuánta gente se mueve cada día según las cifras del Metro |
| `js/metro-campana.js` | Jefe de línea: los siete días, sus decisiones, la tienda y el generador de días del turno sin fin |
| `js/metro-dentro.js` | Jefe de línea: el dibujo de una estación por dentro |
| `js/metro-tren.js` | Jefe de línea: el dibujo de un tren por dentro |
| `js/juego.js` | Jefe de línea: la pantalla, los controles, las guías, la tienda y las partidas guardadas |
| `js/musica.js` | Jefe de línea: la música, que cambia con la hora y el clima, y los anuncios hablados con la voz del navegador |
| `js/metro-marca.js` | Jefe de línea: la portada y los festejos (estrellas que se encienden, confeti, el relevo en rojo) |
| `js/metro-ciudad.js` | Jefe de línea: lo que pasa en la ciudad, dibujado sobre el mapa real (la gente que sale de un evento, el tramo sin servicio, el granizo) |
| `js/datos/base.js` | Relieve, vías principales, áreas grandes, metro, cerros y barrios |
| `js/datos/b_X_Y.js` | Un archivo por cada bloque de 2 km: calles, edificios y áreas. Se cargan al acercarse |

Todo se mide en metros desde la Plaza Grande: el eje X sigue la calle García Moreno hacia el norte y el eje Y baja hacia el oriente.

Para ver un cuadro fijo mientras se retoca algo, se agregan parámetros a la URL:

```
index.html#shot&x=780&y=40&z=0&v=1&h=21&names=1&card=basilica
```

`x`, `y` son metros desde la Plaza Grande (o `en=basilica` para ir a un lugar), `z` el nivel (0 a 3), `v=1` la vista inclinada, `h` la hora, `w` el clima (`clear`, `rain`, `fog`), `f=1` las fiestas, `names=1` los nombres, `card` abre una ficha y `limpio=1` deja solo el mapa.

## Actualizar los datos

Solo hace falta si se quiere traer cambios recientes de OpenStreetMap. Requiere Python 3 con `numpy`, `scipy` y `Pillow`.

```
python3 tools/descargar.py    # baja los datos crudos a tools/cache (unos 200 MB; tarda)
python3 tools/generar.py      # reescribe js/datos
```

La carpeta `tools/cache` se puede borrar cuando ya no se necesite.

## Créditos de los datos

- Calles, edificios, parques y lugares: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), bajo licencia ODbL.
- Relieve: SRTM (NASA), en las teselas «Terrain Tiles» de Mapzen alojadas en AWS.

## Otras carpetas

- `archivo-atlas-vivo/`: la interfaz «Atlas vivo» (historias en viñetas, minijuegos) que se retiró. Está completa por si se quiere rescatar algo; se puede borrar.

## Sonidos

En **Opciones → Sonido** se activan los efectos; el control **Volumen** recuerda tu nivel preferido. El audio empieza apagado y se silencia al cambiar de pestaña. Todo se sintetiza con WebAudio, sin archivos externos: botones, estaciones, compras, salida de trenes, avisos, inicio y resultado del día, sellos del pasaporte, campanas, lluvia, truenos y fuegos artificiales. En el mapa también se oyen aves de día y grillos de noche. Las alertas tienen un límite de frecuencia para evitar que se amontonen al acelerar la simulación.

## Revisión del juego y pruebas

La revisión inicial con las skills de desarrollo está en [docs/revision-juego.md](docs/revision-juego.md), con capturas y hallazgos pendientes.

Para repetir las pruebas en un entorno Python con `playwright` instalado, inicia un servidor local y ejecuta:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

En otra terminal:

```sh
python3 tools/playtest.py --browser "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

También puedes omitir `--browser` si instalaste Chromium con `python3 -m playwright install chromium`. Las pruebas usan un perfil de navegador aislado y guardan evidencias en `docs/playtest/`.

La simulación y la campaña tienen además sus pruebas sin navegador, que corren en unos segundos con Node: que un turno rehecho con su bitácora salga idéntico, que el «por qué» del informe sume lo que faltó, que las consecuencias de un día lleguen bien al siguiente, las misiones, el horario sugerido, el crecimiento del turno sin fin, y el balance de la semana con tres jugadores de mentira (uno que solo hace lo que pide la guía, uno normal y uno experto):

```sh
node tools/prueba-simulacion.cjs
```

`tools/playtest.py` prueba todas las herramientas a la vez, así que arranca en el miércoles con las guías ya vistas. El recorrido de la semana entera (las guías de cada día, la tienda que se abre, el turno guardado a medias, la caja en rojo, la granizada, el final, el turno sin fin, los logros y la partida perdida) está aparte y no necesita servidor:

```sh
python3 tools/playtest-semana.py                  # escritorio
python3 tools/playtest-semana.py --size 390x844   # teléfono de pie, táctil
python3 tools/playtest-semana.py --size 844x390   # teléfono acostado
```

La revisión de `docs/revision-juego.md` es anterior a la semana progresiva y al turno sin fin: describe el juego cuando todas las herramientas estaban disponibles desde el lunes.
