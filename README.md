# Pokédex

Explorador en tiempo real de las ~1025 especies Pokémon (Generaciones I–IX) construido sobre la [PokéAPI](https://pokeapi.co) con **TypeScript** y **Next.js 15**. Búsqueda instantánea que contempla la cadena evolutiva, filtros por tipo y generación, ficha de detalle con estadísticas y evoluciones, interfaz bilingüe (ES/EN) y estado de la lista sincronizado con la URL.

![Captura de la Pokédex mostrando la cuadrícula de tarjetas con la barra de filtros](docs/screenshot.png)

**Demo:** https://pokemon-eight-blush.vercel.app

> La versión en inglés está más abajo, en [English](#english).

## Ejecución

Requiere Node 20+ y [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Producción:

```bash
pnpm build
pnpm start
```

Con Docker, en un solo comando:

```bash
docker compose up --build   # sirve en http://localhost:3000
```

## Funcionalidades

- **Listado completo** de las ~1025 especies de las Generaciones I–IX, ordenado por número, mostrando nombre, generación, tipos y sprite.
- **Filtros** por tipo y por generación (con íconos y color de energía por tipo), combinables entre sí.
- **Búsqueda en tiempo real** por nombre que además **contempla la cadena evolutiva**: buscar «Pikachu» muestra también Pichu y Raichu, porque cada especie indexa los nombres de toda su línea evolutiva.
- **Ficha de detalle** estilo *scanner* con nombre, imagen, generación, tipos, estadísticas base animadas y la cadena evolutiva completa (con imágenes), resaltando claramente el Pokémon actual. Al pulsar una evolución se navega a su ficha.
- **Estado restaurable:** la búsqueda y los filtros viven en la URL (`?q=&types=&gens=`); al volver del detalle al listado se conserva exactamente la vista (filtros, texto y posición de scroll). El filtrado ocurre en el cliente sin recargar (History API).
- **Interfaz bilingüe ES/EN** con conmutador de idioma (persistido en cookie).
- **Renderizado progresivo:** las tarjetas se cargan en páginas de 60 mediante `IntersectionObserver`.

## Decisiones técnicas

**Agregación en el servidor + caché, en lugar de llamadas directas desde el cliente.**
Los datos siempre se originan en la PokéAPI en tiempo de ejecución (no hay ningún dataset commiteado). En el primer arranque en frío el servidor construye un índice a partir de ~580 peticiones agrupadas en lotes y lo cachea con `unstable_cache` (revalidación cada 24 h), además de la caché de `fetch` de Next. El resto de peticiones se sirven del índice ya materializado.

**La URL como única fuente de verdad del estado de la lista.**
Los filtros y la búsqueda se codifican en la query string y se sincronizan con la History API (`replaceState`), de modo que filtrar no dispara una navegación al servidor y la vista es restaurable y compartible. Volver del detalle recupera la última URL de lista desde `sessionStorage`.

**Búsqueda que abarca la cadena evolutiva.**
Al construir el índice, cada especie guarda los slugs de todos los miembros de su línea evolutiva, así que una coincidencia por nombre trae a toda la familia sin peticiones adicionales en tiempo de búsqueda.

**Tipado estricto en la frontera con la PokéAPI.**
Las respuestas se tipan explícitamente en `lib/pokeapi` y se transforman en modelos de dominio limpios; la UI nunca ve la forma cruda de la API.

**Sprites a través del optimizador de imágenes de Next.**
Las imágenes se sirven desde el repositorio de sprites de la PokéAPI y pasan por `next/image`, que actúa como caché/proxy en el servidor; ante un *rate-limit* transitorio se reintenta y, como último recurso, se muestra un placeholder local.

## Arquitectura

```
src/
├── app/                 Páginas RSC (listado, /pokemon/[id])
├── components/pokedex/  Presentación del explorador (tarjetas, filtros, stats…)
├── hooks/               Hooks de cliente (filtros en URL)
└── lib/
    ├── pokeapi/         Cliente HTTP tipado + loaders cacheados
    ├── domain/          Lógica pura del explorador (índice, filtro, evolución)
    └── i18n/            Locale por cookie, diccionarios ES/EN, provider
```

## Calidad

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript en modo strict)
pnpm test         # Vitest (148 tests)
pnpm format       # Prettier
```

Los tests cubren de forma determinista la lógica de dominio del explorador: construcción del índice, filtrado combinado, búsqueda por cadena evolutiva, serialización del estado en la URL y los diccionarios de i18n.

## Extra: combate multijugador 3v3 (opcional)

Más allá de lo pedido, el proyecto incluye un **modo de combate por turnos entre dos jugadores en tiempo real** (Socket.IO), con equipos aleatorios de 3 Pokémon, fórmula de daño real, tabla de efectividad de los 18 tipos, estados y una escena con estética retro. Es un añadido para lucir la PokéAPI; no forma parte de los requisitos.

- Se juega en local/Docker en `http://localhost:3000/battle`: pulsa **Crear combate** y comparte el enlace de la sala con la otra persona.
- Versión completa desplegada (incluye el combate): https://pokedex-battle.onrender.com — al estar en un plan gratuito, el primer acceso puede tardar ~30-60 s en «despertar».
- El motor de combate vive en `lib/battle` como funciones puras y deterministas (RNG inyectado), con el servidor como autoridad y Socket.IO desacoplado tras una interfaz.

## Uso de IA

Se emplearon herramientas de asistencia por IA como apoyo durante el desarrollo. Todas las decisiones de arquitectura, el diseño y el código fueron revisados y validados manualmente; comprendo y puedo defender cada parte de la solución.

### Limitaciones conocidas

- Una ruta `/pokemon/<id>` inexistente muestra la interfaz de «no encontrado» localizada, pero responde con **HTTP 200** en lugar de 404 (el layout raíz lee la cookie de idioma, lo que hace la ruta dinámica bajo el *streaming* de Next 15).

---

# English

Real-time explorer for the ~1025 Pokémon species (Generations I–IX) built on the [PokéAPI](https://pokeapi.co) with **TypeScript** and **Next.js 15**. Instant search that accounts for the evolution chain, filters by type and generation, a detail page with stats and evolutions, a bilingual UI (ES/EN), and list state synced to the URL.

![Screenshot of the Pokédex showing the card grid with the filter bar](docs/screenshot.png)

**Demo:** https://pokemon-eight-blush.vercel.app

## Running it

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Production:

```bash
pnpm build
pnpm start
```

With Docker, in a single command:

```bash
docker compose up --build   # served on http://localhost:3000
```

## Features

- **Full listing** of the ~1025 species across Generations I–IX, ordered by number, showing name, generation, types, and sprite.
- **Filters** by type and by generation (per-type icons and energy color), combinable.
- **Real-time search** by name that **also accounts for the evolution chain**: searching "Pikachu" also shows Pichu and Raichu, because each species indexes the names of its whole evolutionary line.
- **Detail page** in a "scanner" style with name, image, generation, types, animated base stats, and the full evolution chain (with images), clearly highlighting the current Pokémon. Clicking an evolution navigates to its page.
- **Restorable state:** search and filters live in the URL (`?q=&types=&gens=`); returning from the detail page to the list restores the exact view (filters, text, scroll position). Filtering happens client-side without a reload (History API).
- **Bilingual ES/EN UI** with a language toggle (persisted in a cookie).
- **Progressive rendering:** cards load in pages of 60 via `IntersectionObserver`.

## Technical decisions

**Server-side aggregation + caching instead of direct client calls.**
Data always originates from the PokéAPI at runtime (no dataset is committed). On the first cold start the server builds an index from ~580 batched requests and caches it with `unstable_cache` (24h revalidation) on top of Next's `fetch` cache; every later request is served from the materialized index.

**The URL as the single source of truth for list state.**
Filters and search are encoded in the query string and synced via the History API (`replaceState`), so filtering never triggers a server navigation and the view is restorable and shareable. Returning from a detail page restores the last list URL from `sessionStorage`.

**Search that spans the evolution chain.**
While building the index, each species stores the slugs of every member of its evolutionary line, so a name match brings up the whole family with no extra requests at search time.

**Strict typing at the PokéAPI boundary.**
Responses are explicitly typed in `lib/pokeapi` and mapped into clean domain models; the UI never sees the raw API shape.

**Sprites through Next's image optimizer.**
Images are served from the PokéAPI sprites repository through `next/image`, which acts as a server-side cache/proxy; on a transient rate-limit it retries, and as a last resort it shows a local placeholder.

## Architecture

```
src/
├── app/                 RSC pages (listing, /pokemon/[id])
├── components/pokedex/  Explorer presentation (cards, filters, stats…)
├── hooks/               Client hooks (URL-backed filters)
└── lib/
    ├── pokeapi/         Typed HTTP client + cached loaders
    ├── domain/          Pure explorer logic (index, filter, evolution)
    └── i18n/            Cookie-based locale, ES/EN dictionaries, provider
```

## Quality

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript in strict mode)
pnpm test         # Vitest (148 tests)
pnpm format       # Prettier
```

Tests deterministically cover the explorer's domain logic: index construction, combined filtering, evolution-chain search, URL state serialization, and the i18n dictionaries.

## Bonus: 3v3 multiplayer battle (optional)

Beyond the requirements, the project includes a **real-time turn-based battle mode between two players** (Socket.IO), with random teams of 3 Pokémon, a real damage formula, the full 18-type effectiveness chart, status conditions, and a retro-styled scene. It's an add-on to show off the PokéAPI; it is not part of the requirements.

- Runs locally/Docker at `http://localhost:3000/battle`: click **Create battle** and share the room link with the other person.
- Full deployed version (battle included): https://pokedex-battle.onrender.com — on a free tier, the first visit can take ~30-60s to "wake up".
- The battle engine lives in `lib/battle` as pure, deterministic functions (injected RNG), with the server as the authority and Socket.IO decoupled behind an interface.

## AI usage

AI assistance tools were used as support during development. All architecture decisions, design, and code were reviewed and validated manually; I understand and can defend every part of the solution.

### Known limitations

- A non-existent `/pokemon/<id>` route renders the localized "not found" UI but responds with **HTTP 200** instead of 404 (the root layout reads the language cookie, which makes the route dynamic under Next 15 streaming).
</content>
</invoke>
