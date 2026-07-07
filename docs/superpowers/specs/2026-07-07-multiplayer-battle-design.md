# Diseño: Combate multijugador Pokémon (3v3 por turnos)

**Fecha:** 2026-07-07
**Estado:** Aprobado (pendiente de plan de implementación)

## Objetivo

Dos personas entran por un link compartido, cada una elige nickname y sexo
(avatar ♂/♀), recibe 3 Pokémon aleatorios (cualquier generación/tipo), elige con
cuál empieza y combaten por turnos con reglas fieles a Pokémon, en una pantalla
con estética retro tipo Pokémon Esmeralda.

Es la Fase 2 del proyecto. La Fase 1 (rediseño visual "dispositivo Pokédex") ya
está hecha.

## Principios de diseño

1. **Motor de combate puro y determinista**, sin I/O, testeable con vitest —
   igual que la cultura de tests del dominio existente (`src/lib/domain/*`).
2. **Transporte desacoplado.** El motor y el room manager no conocen Socket.IO.
   Socket.IO es el transporte primario (local/Docker); una interfaz `Transport`
   permite enchufar un servicio gestionado (PartyKit/Pusher) para Vercel después,
   sin tocar la lógica de combate.
3. **Servidor autoritativo.** Toda la resolución de turnos ocurre en el servidor
   con RNG sembrado; el cliente solo envía intenciones y renderiza estado.

## Arquitectura (3 capas)

```
┌─ Motor de combate (PURO, sin I/O) ───────────────┐
│  estado + acciones de ambos → resuelve turno →     │
│  nuevo estado + log de eventos. RNG con semilla.   │
└────────────────────────────────────────────────────┘
                ▲ usa
┌─ Room manager (servidor, agnóstico al transporte) ─┐
│  máquina de estados de la sala, empareja 2          │
│  jugadores, recoge acciones, llama al motor,        │
│  difunde estado. Depende de la interfaz `Transport`.│
└──────────────────────────────────────────────────────┘
      ▲ implementa                 ▲ (futuro)
┌─ Socket.IO (local/Docker) ─┐  ┌─ Adapter gestionado → Vercel ─┐
└────────────────────────────┘  └───────────────────────────────┘
```

**Runtime:** un `server.ts` custom que corre **Next + Socket.IO en el mismo
puerto** (una sola URL, para que el link funcione). Funciona en `pnpm dev` y en
Docker (`output: standalone`). En Vercel el build de Next sigue igual; el combate
usaría el adapter gestionado (interfaz preparada, no implementado en esta fase).

## Flujo de juego (pantallas)

1. **Entrada** (`/battle`): "Crear combate" genera una sala y muestra el link
   `/battle/<roomId>` para compartir. La 2ª persona abre el mismo link.
2. **Lobby** (caja de diálogo retro): nickname + sexo ♂/♀ con preview de avatar.
   Botón "Listo". Estado "Esperando al rival…" hasta que ambos estén listos.
3. **Reparto de equipo:** al estar ambos listos, el servidor sortea 3 Pokémon
   aleatorios por jugador y arma cada uno con stats, tipos y 4 movimientos.
4. **Elegir líder:** cada quien ve sus 3 (sprites pixel de PokeAPI) y elige con
   cuál empieza; los otros 2 entran por cambio.
5. **Combate** (pantalla clásica): rival arriba-derecha (sprite frontal) + barra
   HP arriba-izq; jugador abajo-izq (sprite trasero) + HP abajo-der; menú
   **LUCHA / POKÉMON / — / HUIR**; caja de texto narrando eventos. Turnos con
   animaciones de HP, sacudida al golpe y debilitamiento.
6. **Resultado:** ganador/perdedor + opción de revancha.

## Reglas de combate (3v3 fiel, con estados clave)

- **Nivel 50** todos, IV 31 / EV 0 / naturaleza neutra. Stats con fórmula real:
  - HP = `floor((2*base + IV + floor(EV/4)) * level / 100) + level + 10`
  - Otros = `floor((2*base + IV + floor(EV/4)) * level / 100) + 5` (naturaleza ×1.0)
- **Daño** (fórmula Gen III+):
  `dmg = floor(floor(floor((2*level/5 + 2) * power * A/D) / 50) + 2) * mods`
  - `A/D` = Atk/Def (físico) o SpA/SpD (especial).
  - **mods**: STAB ×1.5 · efectividad de tipos (producto sobre los tipos del
    defensor) · crítico ×1.5 (prob. 1/16) · aleatorio 0.85–1.0 · quemadura ×0.5
    al daño físico.
- **Tabla de tipos:** matriz completa de los 18 tipos (×2 / ×0.5 / ×0).
- **Movimientos:** 4 por Pokémon desde su learnset (físico/especial/estado),
  garantizando ≥1 movimiento de daño. Cada uno con tipo, categoría, potencia,
  precisión, **PP** y **prioridad**.
- **Orden del turno:** cambios primero → prioridad de movimiento → **Velocidad**
  (parálisis ×0.5) → empate por RNG sembrado.
- **Estados:**
  - **Parálisis:** Velocidad ×0.5; 25% de perder el turno.
  - **Quemadura:** daño físico ×0.5; pierde 1/16 del HP máx al final del turno.
  - **Envenenamiento:** pierde 1/8 del HP máx al final del turno.
  - **Sueño:** no actúa durante 1–3 turnos (aleatorio).
- **Cambio de Pokémon** = una acción de turno; al debilitarse uno → cambio
  forzado (sub-fase). Gana quien deja al rival sin Pokémon disponibles.
- **HUIR** en multijugador = abandono → derrota (con confirmación).

### Fuera de alcance (para mantenerlo sólido)

Objetos, habilidades, clima, cambios de stats (danza espada, etc.), efectos
secundarios de movimientos más allá de los 4 estados, movimientos multi-golpe,
naturalezas/EVs configurables.

## Estructura de la sala (máquina de estados)

`waiting` (falta jugador 2) → `lobby` (nickname/sexo) → `teaming` (reparto +
elegir líder) → `battle` (bucle de turnos, con sub-fase de cambio forzado) →
`finished`.

- **Estado en memoria** por sala (Map en el proceso del servidor). TTL de limpieza.
- **Desconexión** en combate → el rival gana por abandono; se ofrece revancha.
- **2 jugadores** por sala; sin espectadores.
- **Autoridad:** el servidor guarda el estado completo; a cada cliente se le envía
  una vista (oculta PP/estado interno del rival solo si aplica; para esta fase se
  puede enviar estado casi completo, es un duelo amistoso).

## Componentes y archivos

### Motor y dominio de combate — `src/lib/battle/`
- `types.ts` — `BattlePokemon`, `Move`, `BattleState`, `TurnAction`, `BattleEvent`, `StatusCondition`.
- `type-chart.ts` — efectividad 18×18 + `effectiveness(moveType, defenderTypes)`.
- `stats.ts` — cálculo de stats a nivel.
- `damage.ts` — fórmula de daño + modificadores.
- `rng.ts` — PRNG sembrado (determinista para tests y servidor).
- `engine.ts` — `resolveTurn(state, actionA, actionB, rng) → { state, events }`;
  maneja orden, daño, estados, debilitamiento, cambio forzado, victoria. **Puro.**
- `team-builder.ts` — sortea 3 Pokémon aleatorios y selecciona 4 movimientos
  (usa el cliente PokeAPI). Garantiza ≥1 movimiento de daño.
- `room.ts` — máquina de estados de sala, agnóstica al transporte.
- `protocol.ts` — tipos de mensajes cliente↔servidor.

### Transporte y servidor
- `server.ts` — servidor custom Next + Socket.IO en el mismo puerto.
- Adaptador Socket.IO que implementa la interfaz `Transport` de `room.ts`.
- `src/hooks/use-battle-socket.ts` — hook cliente (conexión, envío de acciones,
  suscripción a estado).

### Rutas y UI — `src/app/battle/` y `src/components/battle/`
- `src/app/battle/page.tsx` — landing / crear combate.
- `src/app/battle/[roomId]/page.tsx` — sala (cliente); renderiza lobby / selección
  de equipo / escena de combate / resultado según la fase.
- Componentes: `LobbyForm`, `TrainerAvatar` (SVG pixel ♂/♀ propios, sin assets con
  copyright), `TeamSelect`, `BattleScene`, `HpBar`, `MoveMenu`, `BattleLog`,
  `ResultScreen`.
- Estilo retro: caja de texto, tipografía de píxeles (ya tenemos Press Start 2P),
  sprites pixel de PokeAPI (front/back), animaciones simples.

### PokeAPI
- Añadir `getMove(idOrName)` al cliente; tipos de la respuesta de move.
- Reutilizar `getPokemon` / índice existente para el sorteo.

### Dependencias nuevas
- `socket.io`, `socket.io-client`.

## Testing

- **Motor** (`engine.test.ts`, `damage.test.ts`, `type-chart.test.ts`,
  `stats.test.ts`): deterministas por semilla — orden de turno, daño, efectividad,
  crítico, cada estado, debilitamiento + cambio forzado, condición de victoria.
- **Team builder**: garantiza equipo de 3 y ≥1 movimiento de daño por Pokémon.
- El room manager se puede probar con un `Transport` fake en memoria (sin sockets).

## Orden de construcción (cada fase verificable de forma aislada)

1. **Motor puro + tests** (offline, sin red).
2. **Team builder** (PokeAPI random + selección de movimientos) + tests.
3. **Room manager + Transport + Socket.IO** (2 jugadores, lobby, reparto, turnos)
   — verificable con dos pestañas.
4. **UI retro** (lobby/avatar → selección de líder → escena de combate → resultado).

## Decisiones asumidas (vetables)

- "Elige con cuál" = elegir el **líder** del equipo de 3.
- Avatares = **SVG pixel propios** ♂/♀ (sin copyright).
- Nivel fijo 50; IV 31 / EV 0 / naturaleza neutra.
- Desconexión = derrota por abandono + revancha.
- La demo corre el servidor Socket.IO **local/Docker**; Vercel usaría el adapter
  gestionado (interfaz preparada, fuera de alcance de esta fase).
