# Revisión inicial: Jefe de línea

Revisión del 8 de octubre de 2026. Proyecto HTML/JavaScript y Canvas, sin cambio de motor.

## Evaluación

La base ya permite un juego de gestión reconocible: ajustar frecuencias y boleterías, asignar refuerzos y resolver incidentes, con consecuencias sobre pasajeros, ánimo y presupuesto. La separación entre simulación (`metro-sim.js`), campaña (`metro-campana.js`) y dibujo es adecuada para seguir ampliándolo. El mapa real y las vistas interiores dan una identidad propia.

La prioridad inmediata es consolidar el recorrido del jugador nuevo y el guardado, antes de sumar contenido. Las pruebas automáticas verifican funcionamiento; para valorar dificultad y diversión hacen falta partidas de personas nuevas.

> **Actualización.** El turno en curso ya se recupera al recargar (bitácora determinista, con versión: un turno de una versión anterior se descarta con aviso). Después de esta revisión se agregaron el horario de fin de semana con sugerencia, el informe «por qué salió así», las misiones, las consecuencias de un día al siguiente, la dificultad y el crecimiento realista del turno sin fin; el balance de la semana se comprueba con `node tools/prueba-simulacion.cjs`. También se corrigió que repetir un día después de cerrada la semana pudiera dar la partida por perdida, y que el contador de gente que ve pasar trenes llenos contara a la misma persona varias veces.

## Hallazgos pendientes

| Prioridad | Hallazgo | Reproducción / consecuencia | Área |
|---|---|---|---|
| Media | Los controles ocupan gran parte del móvil | A 390 px, abrir Horario deja poco mapa visible. El panel ya tiene desplazamiento y cierre utilizables; conviene compactar indicadores y probar una bandeja inferior. | Interfaz |
| Media | Falta validar dificultad con jugadores | Se simularon los siete días con un plan fijo y la primera opción de cada decisión. Esto no demuestra que todas las estrategias estén equilibradas ni que el aprendizaje sea claro. | Diseño de juego |

El archivo de campaña cambió durante la revisión: pasó de una inducción explícita a describir aprendizaje progresivo y generación de días adicionales. Se recuperó un escenario de práctica independiente, compatible con los 22 pasos existentes, sin cambiar los siete días de campaña.

## Correcciones realizadas

- **Arranque y reloj:** Jugar acerca la cámara a la estación más cercana a la vista actual durante 1,8 segundos y abre su interior con un fundido de 260 ms, a velocidad ×1. Se puede saltar y respeta movimiento reducido. Empezar desde la semana conserva Quitumbe como estación inicial. Antes se abrían varios menús y cada turno arrancaba en pausa sin una señal suficientemente clara. El tutorial y las capturas de prueba conservan sus pausas deliberadas.
- **Controles claros:** Pausar/Reanudar, estado del reloj, selector con las 15 estaciones, Ver mapa/Ver interior y Gestionar estación. Cerrar detalles conserva el interior. Partidas mantiene el acceso a guardados, semana e inducción. En móvil, Más agrupa refuerzos, ayuda y salida.
- **Vista inicial despejada:** ni Horario ni la ficha se abren automáticamente. Un aviso breve explica que los trenes salen solos y dónde ajustar la operación.
- **Interiores:** paredes claras o amarillas según la referencia, franjas rojas, acero, barandas de vidrio, luminarias blancas, bancos y bandas táctiles. [Fuentes fotográficas y alcance de la adaptación](referencias-metro.md).
- La página ahora carga la campaña y el interior de los trenes antes de iniciar el juego. Antes, el botón Jugar no inicializaba el juego.
- Horario, boleterías, trenes, tutorial y decisiones tienen capas y estilos definidos sobre el lienzo. Antes, los paneles nuevos podían quedar ocultos detrás del mapa.
- Las decisiones se muestran como ventanas legibles; la ayuda y las decisiones mantienen la pausa aunque se pulse Espacio.
- Las fichas se colocan debajo de la altura real del panel principal. Al entrar en un tren o estación se cierra el panel lateral para evitar superposiciones.
- Opciones permite ajustar el sonido durante una partida, sin modificar hora ni clima de la simulación.
- El modo de pruebas evita escribir partidas y ya no intenta reasignar una constante. Los días terminados mediante avance de prueba muestran su informe.
- La simulación implementa `adelantarReapertura`, que las decisiones del viernes necesitaban. Se comprobó que adelantar la reapertura conserve los cierres residuales de estaciones.
- Se restauró la inducción opcional: horario, boleterías, refuerzos, estaciones y trenes por dentro, y una decisión del Puesto Central. Se completaron sus 22 pasos mediante controles y avance controlado del reloj; terminarla solo marca la práctica como hecha, sin cambiar los recursos de campaña.
- El menú, la ayuda y el README aclaran que el turno en curso no se recupera al recargar.

## Validación y evidencias

Pasaron 56 comprobaciones con Playwright y Chrome 152, sin errores JavaScript en los recorridos probados, incluida la inducción completa y la conservación de los recursos de campaña. Se comprobó el arranque directo desde una primera visita y desde una partida guardada, el avance real del reloj, Pausar/Reanudar, cambiar de estación y volver al mapa. En perfiles aislados también se revisaron: nueva partida, horario, compras, ayuda, interiores, decisiones, informe, recarga del guardado, siete días completos y ventanas de 390×844, 768×1024 y 1440×900. Se usa la primera opción en las decisiones de los recorridos completos. No se probaron exhaustivamente todas las ramas, otros navegadores ni un ejecutable de Steam.

- [Resultados de las comprobaciones](playtest/resultados.json)
- [Acercamiento a la estación](playtest/entrada-zoom.png) y [versión móvil](playtest/entrada-movil.png).
- Transición de entrada: `tools/playtest-entrada.py` verifica destino, reloj, escala, salto, doble pulsación, cambio de orientación y movimiento reducido; [resultados](playtest/entrada-resultados.json).
- [Arranque dentro de Quitumbe](playtest/inicio-quitumbe.png)
- [San Francisco con revestimiento amarillo](playtest/san-francisco.png)
- [Arranque en móvil](playtest/inicio-390.png)
- [Horario en escritorio](playtest/horario-1440.png)
- [Horario en móvil](playtest/horario-390.png)
- [Decisión del Puesto Central](playtest/decision.png)
- [Interior de un tren](playtest/tren.png)
- [Inducción guiada](playtest/tutorial.png)
- [Informe al cerrar el día](playtest/informe.png)
- Script reproducible: `tools/playtest.py` (instrucciones en README).

La comprobación visual adicional confirmó que los avisos no cubren los letreros de los andenes en las tres resoluciones. Al abrir contextos nuevos consecutivos, el servidor de prueba `python -m http.server` produjo errores de conexión al cargar scripts; esa comprobación se repitió correctamente con un servidor local de cola ampliada a 128 conexiones.

## Skills instaladas

Instaladas para el usuario de Codex en `~/.agents/skills/`:

| Skill | Fuente |
|---|---|
| web-game-foundations | openai/plugins · game-studio |
| game-ui-frontend | openai/plugins · game-studio |
| game-playtest | openai/plugins · game-studio |
| sprite-pipeline | openai/plugins · game-studio |
| webapp-testing | anthropics/skills |
| speech | openai/skills |

Las cuatro de Game Studio enlazan a `~/.agents/bundles/game-studio/skills/`, conservando las referencias, scripts y skills auxiliares del paquete. Se verificó la existencia de las referencias relativas. Se aplicaron foundations, UI, playtest y webapp-testing en esta revisión; sprite-pipeline y speech quedan disponibles para cuando se pidan gráficos o voces.
