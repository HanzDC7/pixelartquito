# Quito · Atlas vivo

Una experiencia interactiva de Quito con panorama, mapa, relatos en viñetas, tres minijuegos y un pasaporte de exploración. Dibujada píxel por píxel con código: no necesita imágenes externas, librerías en producción ni paso de compilación. Se mira hacia el oeste, con el sur a la izquierda, el norte a la derecha y el Pichincha detrás de la ciudad.

## Cómo abrirlo

Doble clic en uno de los dos archivos. Funcionan directo desde el disco, en cualquier navegador moderno, y cada uno tiene un botón para pasar al otro.

| Archivo | Vista |
|---|---|
| `index.html` | **De lado:** el panorama con el Pichincha detrás y el Metro bajo la calle |
| `arriba.html` | **Desde arriba:** un mapa vivo con manzanas, avenidas, parques y sombras |

En la vista desde arriba el norte queda a la derecha. La ciudad no está a escala (Quito mide unos 40 km de largo y 5 de ancho), pero los lugares guardan su orden y su posición relativa. Se suman el Parque Bicentenario, la línea del Metro con sus estaciones, los nombres de avenidas (botón **Nombres** o tecla `T`) y la opción de ocultar el Metro (botón **Metro** o tecla `M`). Se recorre en las dos direcciones.

## La expedición

La nueva navegación reúne cuatro espacios:

- **Explorar:** cinco pistas para encontrar El Panecillo, San Francisco, Plaza Grande, la Basílica y La Carolina. Tocar los lugares o abrir sus fichas añade sus sellos al pasaporte.
- **Historias:** tres relatos de cuatro viñetas. La cámara viaja y la luz cambia con cada escena. Incluye la leyenda de Cantuña, un paseo por el patrimonio y un cuento sobre un colibrí. Los relatos distinguen ficción, tradición oral y datos documentados, con enlaces a las fuentes cuando corresponde.
- **Arcade:** partidas completas con instrucciones, pausa, puntuación, victoria, derrota y reintento.
- **Pasaporte:** lugares descubiertos, historias terminadas, insignias y mejores puntuaciones. Cada lugar de la expedición suma 100 puntos; cada historia, 150. Los juegos aportan la mejor puntuación obtenida en una victoria.

| Minijuego | Objetivo | Controles |
|---|---|---|
| Las piedras de Cantuña | Encontrar seis parejas en 60 segundos | Clic, toque o Tab y Enter |
| El vuelo del colibrí | Recoger ocho flores en 45 segundos, con tres vidas | Flechas, toque o arrastrar |
| Próxima estación | Frenar dentro de la zona verde en cinco paradas, con tres oportunidades | Espacio o botón Frenar |

**Guardar postal** permite previsualizar y descargar la vista actual como PNG de 1200 × 790. En la vista aérea, **Mapa general** muestra toda la ciudad y permite viajar tocando un punto o usando los botones de lugares.

El progreso se guarda en `localStorage`. El enlace entre las dos vistas también transporta el pasaporte para los navegadores que separan el almacenamiento de los archivos `file://`. No hay cuentas ni servidor. Las partidas se pausan cuando la pestaña está oculta y liberan sus controles al cerrarse.

Las historias usan estas referencias: [UNESCO — Ciudad de Quito](https://whc.unesco.org/en/list/2/) y [Quito Informa — leyendas quiteñas](https://quitoinforma.quito.gob.ec/2026/09/29/paredes-que-cuentan-historias-leyendas-quitenas-son-plasmadas-en-los-pasos-deprimidos-de-las-av-tarqui-y-10-de-agosto/). El circuito del minijuego del Metro es una simplificación lúdica.

## Qué se puede hacer

| Acción | Cómo |
|---|---|
| Recorrer la ciudad | Arrastrar, rueda del ratón o flechas ← → |
| Saltar a un lugar | Botones de abajo, o clic en el minimapa de arriba |
| Conocer un lugar | Clic sobre él: abre una ficha con datos |
| Cambiar la hora | Deslizador **Hora**; `N` alterna día y noche; `Espacio` pausa el tiempo |
| Cambiar el clima | **Despejado**, **Aguacero**, **Neblina**; tecla `R` |
| Fiestas de Quito | Botón o tecla `F`: fuegos artificiales y chiva |
| Paseo automático | Botón **Paseo** |
| Cielo | Clic en el cielo: cometas de día, fuegos artificiales de noche |
| Colibrí | Sigue al cursor; si nadie lo llama, vuelve a sus flores en El Ejido |
| Sonido | Botón **Sonido** (apagado al inicio): campanas, bocina del trole, lluvia, truenos |

## Qué hay en la escena

De sur a norte: el Cotopaxi a lo lejos, El Panecillo con la Virgen, San Francisco, la Compañía, la Catedral, la Plaza Grande, Carondelet, la Basílica del Voto Nacional, El Ejido, las torres de La Carolina, el Estadio Atahualpa y la Mitad del Mundo. Detrás, el Itchimbía y el Pichincha con el TelefériQo; bajo la calle, el Metro con tres estaciones.

Se mueven: el tráfico (trolebús, buses azules, taxis amarillos), la gente, las palomas, el metro, las cabinas del teleférico, un cóndor, las nubes, la fumarola del Cotopaxi, la pila y la bandera de la Plaza Grande, la pantalla del centro comercial y los relojes de la Basílica, que marcan la hora de la escena.

El paisaje incorpora laderas con textura continua y perspectiva atmosférica, nubes con volumen, fachadas de piedra y estuco, tejas de distintos tonos, balcones, toldos y vegetación con luces y sombras. La calle tiene adoquines, alcantarillas, bancas, jardineras, marquesinas y semáforos animados. Las sombras de los faroles cambian con la hora; con lluvia aparecen charcos y reflejos de ventanas y faroles.

Desde arriba se distinguen cubiertas con y sin patio, terrazas con tanques y paneles, pasos peatonales, paradas de bus y senderos con bancas y parterres. En pantallas pequeñas los controles quedan debajo del lienzo para dejar visible la ciudad.

Los datos de las fichas son generales y están redactados para divulgación; conviene verificarlos antes de usarlos en un material oficial.

## Cómo está armado

| Archivo | Contenido |
|---|---|
| `experience.css` | Interfaz del atlas, paneles, historias y arcade adaptables a móvil |
| `js/chapters.js` | Relatos, viñetas, referencias y pistas de la expedición |
| `js/experience.js` | Pasaporte, navegación, cámara narrativa, mapa general y exportación de postales |
| `js/games.js` | Los tres minijuegos y el ciclo de vida de cada partida |
| `js/core.js` | Tamaño del lienzo, utilidades de dibujo, fuente de píxeles y estado |
| `js/world.js` | Vista lateral: el escenario fijo, en cinco capas con paralaje |
| `js/actors.js` | Vista lateral: todo lo que se mueve, el cielo, el clima y las luces |
| `js/main.js` | Vista lateral: bucle de dibujo, cámara, entrada y controles |
| `js/top.js` | Vista desde arriba completa: terreno, manzanas, lugares, tráfico y controles |
| `js/info.js` | Las fichas de los lugares, compartidas por las dos vistas |
| `js/sfx.js` | El sonido, generado con WebAudio |

El lienzo mide 384 × 216 píxeles y se amplía sin suavizado. Cada capa se dibuja una sola vez en su propio lienzo; de noche las ventanas encendidas salen de un lienzo aparte por capa, de modo que un edificio tapa las luces de lo que tiene detrás.

Para ver un cuadro fijo mientras se retoca algo, se agregan parámetros a la URL:

```
index.html#shot&x=700&h=20&w=rain&f=1&t=8&card=basilica
```

`x` es la posición de la cámara (0 a 1116), `h` la hora, `w` el clima (`clear`, `rain`, `fog`), `f=1` activa las fiestas, `t` los segundos simulados y `card` abre una ficha. En `arriba.html` se suman `y` (0 a 244) y `names=1`.

## Verificación de desarrollo

La aplicación sigue abriéndose directamente con doble clic. Las dependencias de npm se usan **solo para las pruebas**:

```sh
npm install
npm test
```

Las pruebas ejecutan los scripts reales con un DOM y un lienzo, verifican ambas vistas, la conservación del pasaporte, las historias, las postales y los tres juegos. Incluyen victorias, derrotas, pausa y limpieza de escuchas al cerrar. La prueba de precisión lee el andén y el tren dibujados en el lienzo; la del colibrí sigue las flores visibles.

También puedes abrir `#panel=stories`, `#panel=games` o `#panel=passport` para entrar directamente a esos paneles. Los parámetros `#shot` del render siguen disponibles y se pueden combinar con `panel`.
