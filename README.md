# 🐍 OUROBOROS · Serpientes & Escaleras (edición mutante)

Un Serpientes y Escaleras digital donde **el tablero cambia mientras juegas**.
Un solo archivo HTML, sin dependencias ni instalación: abre `index.html` en el navegador y juega.

**Jugar en línea:** https://javierigc07-debug.github.io/ouroboros-serpientes-y-escaleras/

## Qué lo hace diferente

- **Tablero mutante.** Cada 2, 3 o 4 rondas (tú eliges) las serpientes y escaleras se reescriben por completo, con un nuevo *perfil* y un nuevo *terreno*.
- **Dos dados, tú decides.** Lanzas dos y eliges cuál usar; al pasar el cursor ves dónde caerías.
- **Reserva.** El dado que no usas se guarda y puedes gastarlo después en vez de lanzar.
- **Casillas especiales:** 🌀 portales · ⚡ relámpago (turno extra) · 🕸️ telaraña (pierdes la reserva) · 🎁 cofre · 🛡️ escudo (bloquea una serpiente).
- **Eventos de mutación:** 🌪️ tormenta de arena · 💨 viento a favor · 🌫️ niebla · 🎲 lluvia de dados · 🐍 piedad del Ouroboros · 🌘 eclipse · 🌋 temblor.
- **CPU con tres niveles:** Novato, Normal y Astuta (esta mira un turno al futuro y sabe cuándo gastar la reserva).
- **De 2 a 4 jugadores**, humanos o CPU, y un modo demo donde la CPU juega sola.
- **Aviso de turno:** banner, sonido, flecha sobre tu ficha y la tarjeta de dados que late, para que nunca dudes cuándo te toca.
- **Escaleras equilibradas:** cada perfil limita cuánto puede subir una escalera y cuánto bajar una serpiente.
- **Códigos secretos** 🔑: activan modos especiales para la próxima partida (uno de ellos desbloquea una CPU de dificultad extrema, difícil pero ganable). Descubre cuáles.
- **Casilla de mutación** 🧬: por defecto el tablero ya no cambia por rondas, sino cuando alguien pisa una casilla 🧬 (también puedes elegir que mute cada 3 rondas, o ambas).
- **Modo educativo** 🎓 (por defecto): casillas ❓ con preguntas de **combinatoria** (permutaciones, combinaciones, con repetición, circulares, «al menos uno») y de cultura general. Acertar da un **dado dorado** (eliges el número); fallar cuesta una de tus 3 vidas. Al terminar ganas **monedas** 🪙 y **estrellas** ⭐ para comprar skins. El código `libre` lo desactiva.
- **Multijugador online** 🌐: crea una sala, comparte el código de 6 caracteres (o el enlace) y juega con amigos desde otros dispositivos. Sin cuentas ni servidor propio.
- **Instalable (PWA)** 📲: funciona sin conexión y se instala en el móvil desde el navegador (Chrome → «Instalar aplicación»).
- **Modo ligero** ⚡: se activa solo en equipos modestos (o con el botón del panel): menos efectos, 30 fps y resolución reducida.
- **Skins** ✎: personaliza tu ficha con 12 colores (o uno libre) y 12 personajes: peón, gema, tejedor, noche, calavera, robot, fantasma, ninja, astronauta, gato y y dos fichas distintas: un **vaso de Nestea** (sabor durazno) y la **bolsa de tostones** Tom. También puedes usar **un emoji** como cabeza. Dos jugadores no pueden compartir color.
- **Landing page** con una partida real corriendo de fondo, tableros de muestra generados en vivo y música por terreno.

### Perfiles de tablero
Equilibrio · Nido de víboras · Escalera al cielo · La Gran Serpiente · Caos total · Espejo (simétrico)

### Terrenos
Templo de jade · Volcán · Glaciar · Selva · Abismo (cada uno con su propia música ambiental generativa)

## Extras

- 🎵 Música ambiental generada en vivo con WebAudio que cambia con el terreno, y efectos de sonido sintetizados (sin archivos de audio).
- ▶ **Repetición** de la partida: el juego usa un generador con semilla, así que la misma semilla más tus decisiones reproduce la partida idéntica a 3× u 8×.
- 🏆 Historial de victorias guardado en el navegador.
- ◐ Modo daltónico (paleta Okabe-Ito + símbolos distintos por jugador).
- Responsive: funciona en móvil, tablet y escritorio.

## Controles

| Tecla | Acción |
|---|---|
| `Espacio` / `Enter` | Lanzar los dados |
| `1` / `2` | Elegir dado |
| `R` | Usar la reserva |
| `M` / `N` | Silenciar efectos / música |

## Cómo funciona por dentro

### Multijugador online
- Las salas usan un relé **MQTT público** (EMQX, HiveMQ o Mosquitto) por WebSocket seguro, así que funciona detrás de cualquier router sin abrir puertos. El código de sala decide cuál relé se usa y el tema del relé no lleva el código en claro.
- **Lockstep determinista:** todos ejecutan la misma partida con la misma semilla y solo viajan las *decisiones* (lanzar, elegir dado, reserva, dado dorado, respuesta). El anfitrión las ordena en un registro numerado y cada cliente lo aplica en ese orden. Es el mismo mecanismo de las repeticiones.
- `net.js` añade fiabilidad sobre MQTT (que puede perder mensajes): reintentos con orden estricto por jugador, detección de huecos con reenvío, latidos, reconexión automática, y baja por inactividad. Un resumen de la partida se compara en cada turno para detectar desincronizaciones (botón «Resincronizar»).
- Si alguien sale o se cae, **la CPU toma su lugar**; quien tarda más del tiempo elegido pierde esa jugada (sale una automática). Si se va el anfitrión, la sala se cierra. Se puede volver a una partida tras recargar la página.
- La versión del juego debe ser la misma en todos los jugadores (`NET_VER` en `index.html`; hay que subirla cuando cambie algo que afecte a la simulación).
- Cualquiera con el código puede entrar a la sala: compártelo solo con quien quieras que juegue.

- Todo el dibujo es **canvas 2D**: serpientes que ondulan (curvas muestreadas con estampado de escamas), escaleras con brillo, fichas, partículas y ondas de choque.
- El generador de tableros rechaza cruces y líneas pegadas, y cada perfil tiene sus propios rangos de cantidad y largo. Se probó que cada perfil genera un tablero válido en ~2 ms.
- Todo el azar *de juego* sale de un PRNG con semilla (`mulberry32`); el azar cosmético (partículas, confeti) usa `Math.random`. Por eso las repeticiones son exactas.

## Licencia

Proyecto personal / académico.
