# Pokédex

Explorador de las ~1025 especies Pokémon (Generaciones I–IX) construido sobre la [PokéAPI](https://pokeapi.co), **con combate multijugador 3v3 en tiempo real**. Búsqueda instantánea, filtros por tipo y generación, ficha de detalle con estadísticas animadas y cadena evolutiva, interfaz bilingüe (ES/EN), estado de la lista sincronizado con la URL, y un modo de combate por turnos con estética retro entre dos jugadores conectados por un enlace.

![Captura de la Pokédex mostrando la cuadrícula de tarjetas con la barra de filtros](docs/screenshot.png)

**Demo (explorador):** https://pokemon-eight-blush.vercel.app

> El combate multijugador requiere el servidor de Socket.IO, por lo que se juega en local/Docker (ver más abajo). El explorador funciona en la demo de Vercel.

> La versión en inglés está más abajo, en [English](#english).

## Ejecución

Requiere Node 20+ y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`pnpm dev` levanta un servidor propio (`server.ts`) que corre Next **y** Socket.IO en el mismo puerto, necesario para el combate en tiempo real.

Producción:

```bash
pnpm build
pnpm start
```

Con Docker (imagen multi-stage, salida `standalone`):

```bash
docker compose up --build   # sirve en http://localhost:3000
```

### Jugar un combate

1. Abre `http://localhost:3000/battle` y pulsa **Crear combate**.
2. Comparte el enlace de la sala (`/battle/<id>`) con la otra persona.
3. Cada jugador elige nombre y avatar; al estar ambos listos se reparten 3 Pokémon aleatorios.
4. Cada uno elige su líder y comienza el combate por turnos.

## Funcionalidades

### Explorador

- **Listado completo** de las ~1025 especies de las Generaciones I–IX, con su número, tipos y sprite.
- **Filtros** por tipo y por generación (con íconos y color de energía por tipo), combinables entre sí.
- **Búsqueda en tiempo real** por nombre; también encuentra un Pokémon buscando cualquier miembro de su cadena evolutiva (p. ej. buscar «Charmander» muestra también Charmeleon y Charizard).
- **Ficha de detalle** estilo *scanner* con estadísticas base animadas y la cadena evolutiva completa, resaltando el Pokémon actual.
- **Interfaz bilingüe ES/EN** con conmutador de idioma (persistido en cookie).
- **Estado en la URL:** la búsqueda y los filtros viven en `?q=&types=&gens=`, así que recargar, volver atrás o compartir un enlace conserva exactamente la vista. El filtrado ocurre en el cliente sin recargar (History API).
- **Renderizado progresivo:** las tarjetas se cargan en páginas de 60 mediante `IntersectionObserver`.

### Combate multijugador 3v3

- **Salas por enlace:** dos personas se conectan a la misma URL de sala.
- **Lobby** con nombre de entrenador y avatar (♂/♀).
- **Equipos aleatorios** de 3 Pokémon de cualquier generación, generados desde PokéAPI (stats a nivel 50, 4 movimientos reales por Pokémon).
- **Combate por turnos fiel:** fórmula de daño real, tabla de efectividad de los 18 tipos, STAB, críticos, precisión, PP, prioridad, velocidad, estados (parálisis, quemadura, envenenamiento, sueño) y cambios de Pokémon (incluido cambio forzado al debilitarse).
- **Estética retro** tipo GBA (campo, cajas de HP, caja de texto que narra el turno).
- **Tiempo real** vía Socket.IO con servidor autoritativo, reconexión por token (sobrevive a recargas/blips) y rendición explícita.

## Decisiones técnicas

**Agregación en el servidor + caché, en lugar de llamadas directas desde el cliente.**
Los datos siempre se originan en la PokéAPI en tiempo de ejecución (no hay ningún dataset commiteado en el repositorio). En el primer arranque en frío, el servidor construye un índice a partir de ~580 peticiones agrupadas en lotes, y lo cachea con `unstable_cache` (revalidación cada 24 h) además de la caché de `fetch` de Next.

**La URL como única fuente de verdad del estado de la lista.**
Los filtros y la búsqueda se codifican en la query string y se sincronizan con la History API, de modo que el filtrado no dispara navegación al servidor y la vista es restaurable y compartible.

**Motor de combate puro y agnóstico al transporte.**
Toda la lógica de combate (daño, tipos, estados, orden de turno, cambios, condición de victoria) vive en `lib/battle` como funciones puras y deterministas (RNG inyectado), sin dependencias de red ni de framework. El servidor es autoritativo: valida cada acción y resuelve los turnos; Socket.IO es solo el transporte, desacoplado tras una interfaz para poder sustituirlo por un servicio gestionado.

**Tipado estricto en la frontera con la PokéAPI.**
Las respuestas se tipan explícitamente en `lib/pokeapi` y se transforman en modelos de dominio limpios.

**Sprites vía CDN.**
Los sprites se sirven a través de jsDelivr (espejo del repositorio de PokéAPI) para evitar el rate-limiting de `raw.githubusercontent`, con un placeholder local como respaldo.

## Arquitectura

```
src/
├── app/                 Páginas RSC (listado, /pokemon/[id]) + /battle
├── components/
│   ├── pokedex/         Presentación del explorador (tarjetas, filtros, stats…)
│   └── battle/          UI de combate (lobby, escena, menú, log, resultado)
├── hooks/               Hooks de cliente (filtros en URL, socket de combate)
└── lib/
    ├── pokeapi/         Cliente HTTP tipado + loaders cacheados
    ├── battle/          Motor puro + sala + protocolo + servidor de combate
    ├── domain/          Lógica pura del explorador
    └── i18n/            Locale por cookie, diccionarios ES/EN, provider
server.ts                Servidor custom: Next + Socket.IO en un puerto
```

## Calidad

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript en modo strict)
pnpm test         # Vitest (132 tests: dominio + motor de combate + sala)
pnpm format       # Prettier
```

Los tests cubren la lógica de dominio del explorador y todo el motor de combate (daño, tabla de tipos, estados, sincronización de turnos y sala), de forma determinista.

### Limitaciones conocidas

- Una ruta `/pokemon/<id>` inexistente muestra la interfaz de «no encontrado» correctamente localizada, pero responde con **HTTP 200** en lugar de 404 (Next 15 transmite por streaming y el layout raíz lee la cookie de idioma, lo que hace la ruta dinámica).
- El **combate multijugador** necesita el servidor de Socket.IO (`server.ts`), por lo que corre en **local/Docker**, no en Vercel serverless. El transporte está desacoplado para poder enchufar un servicio gestionado si se quisiera desplegar el combate.

---

# English

Explorer for the ~1025 Pokémon species (Generations I–IX) built on top of the [PokéAPI](https://pokeapi.co), **with real-time 3v3 multiplayer battles**. Instant search, filters by type and generation, a detail page with animated stats and evolution chain, a bilingual UI (ES/EN), list state synced to the URL, and a turn-based battle mode with a retro look between two players connected by a link.

![Screenshot of the Pokédex showing the card grid with the filter bar](docs/screenshot.png)

**Demo (explorer):** https://pokemon-eight-blush.vercel.app

> The multiplayer battle requires the Socket.IO server, so it runs locally/Docker (see below). The explorer works on the Vercel demo.

## Running it

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`pnpm dev` starts a custom server (`server.ts`) running Next **and** Socket.IO on the same port, required for real-time battles.

Production:

```bash
pnpm build
pnpm start
```

With Docker (multi-stage image, `standalone` output):

```bash
docker compose up --build   # served on http://localhost:3000
```

### Playing a battle

1. Open `http://localhost:3000/battle` and click **Create battle**.
2. Share the room link (`/battle/<id>`) with the other person.
3. Each player picks a name and avatar; once both are ready, 3 random Pokémon are dealt.
4. Each picks their lead and the turn-based battle begins.

## Features

### Explorer

- **Full listing** of the ~1025 species across Generations I–IX, with number, types, and sprite.
- **Filters** by type and by generation (with per-type icons and energy color), combinable.
- **Real-time search** by name; it also finds a Pokémon by matching any member of its evolution chain.
- **Detail page** in a "scanner" style with animated base stats and the full evolution chain.
- **Bilingual ES/EN UI** with a language toggle (persisted in a cookie).
- **State in the URL:** search and filters live in `?q=&types=&gens=` and sync via the History API, so filtering never triggers a server navigation and the view is restorable and shareable.
- **Progressive rendering:** cards load in pages of 60 via `IntersectionObserver`.

### 3v3 multiplayer battle

- **Link-based rooms:** two people connect to the same room URL.
- **Lobby** with trainer name and avatar (♂/♀).
- **Random teams** of 3 Pokémon from any generation, built from PokéAPI (level-50 stats, 4 real moves each).
- **Faithful turn-based combat:** real damage formula, full 18-type effectiveness chart, STAB, crits, accuracy, PP, priority, speed, status conditions (paralysis, burn, poison, sleep), and switching (including a forced switch on faint).
- **Retro GBA-style** scene (field, HP boxes, a text box narrating the turn).
- **Real-time** over Socket.IO with an authoritative server, token-based reconnection (survives reloads/blips), and explicit forfeit.

## Technical decisions

**Server-side aggregation + caching instead of direct client calls.**
Data always originates from the PokéAPI at runtime (no dataset is committed). On the first cold start the server builds an index from ~580 batched requests and caches it with `unstable_cache` (24h revalidation) on top of Next's `fetch` cache.

**The URL as the single source of truth for list state.**
Filters and search are encoded in the query string and synced via the History API, so filtering never triggers a server navigation and the view is restorable and shareable.

**Pure, transport-agnostic battle engine.**
All battle logic (damage, types, statuses, turn order, switching, win condition) lives in `lib/battle` as pure, deterministic functions (injected RNG), with no network or framework dependencies. The server is authoritative: it validates every action and resolves turns; Socket.IO is only the transport, decoupled behind an interface so it can be swapped for a managed service.

**Strict typing at the PokéAPI boundary.**
Responses are explicitly typed in `lib/pokeapi` and mapped into clean domain models.

**Sprites via CDN.**
Sprites are served through jsDelivr (a mirror of the PokéAPI sprites repo) to avoid `raw.githubusercontent` rate-limiting, with a local placeholder fallback.

## Architecture

```
src/
├── app/                 RSC pages (listing, /pokemon/[id]) + /battle
├── components/
│   ├── pokedex/         Explorer presentation (cards, filters, stats…)
│   └── battle/          Battle UI (lobby, scene, menu, log, result)
├── hooks/               Client hooks (URL-backed filters, battle socket)
└── lib/
    ├── pokeapi/         Typed HTTP client + cached loaders
    ├── battle/          Pure engine + room + protocol + battle server
    ├── domain/          Pure explorer logic
    └── i18n/            Cookie-based locale, ES/EN dictionaries, provider
server.ts                Custom server: Next + Socket.IO on one port
```

## Quality

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript in strict mode)
pnpm test         # Vitest (132 tests: domain + battle engine + room)
pnpm format       # Prettier
```

Tests cover the explorer's domain logic and the entire battle engine (damage, type chart, statuses, turn synchronisation, and room) deterministically.

### Known limitations

- A non-existent `/pokemon/<id>` route renders the correctly localized "not found" UI but responds with **HTTP 200** instead of 404 (Next 15 streams the response and the root layout reads the language cookie, making the route dynamic).
- The **multiplayer battle** needs the Socket.IO server (`server.ts`), so it runs locally/Docker, not on Vercel serverless. The transport is decoupled so a managed service could be plugged in to deploy the battle.
