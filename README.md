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

- Todo el dibujo es **canvas 2D**: serpientes que ondulan (curvas muestreadas con estampado de escamas), escaleras con brillo, fichas, partículas y ondas de choque.
- El generador de tableros rechaza cruces y líneas pegadas, y cada perfil tiene sus propios rangos de cantidad y largo. Se probó que cada perfil genera un tablero válido en ~2 ms.
- Todo el azar *de juego* sale de un PRNG con semilla (`mulberry32`); el azar cosmético (partículas, confeti) usa `Math.random`. Por eso las repeticiones son exactas.

## Licencia

Proyecto personal / académico.
