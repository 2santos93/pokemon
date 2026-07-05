# Pokédex

Explorador de las ~1025 especies Pokémon (Generaciones I–IX) construido sobre la [PokéAPI](https://pokeapi.co). Búsqueda en tiempo real, filtros por tipo y generación, ficha de detalle con estadísticas animadas y cadena evolutiva, interfaz bilingüe (ES/EN) y estado de la lista sincronizado con la URL.

![Captura de la Pokédex mostrando la cuadrícula de tarjetas con la barra de filtros](docs/screenshot.png)

**Demo:** TODO-vercel-url

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

Con Docker (imagen multi-stage, salida `standalone`):

```bash
docker compose up --build   # sirve en http://localhost:3000
```

## Funcionalidades

- **Listado completo** de las ~1025 especies de las Generaciones I–IX, con su número, tipos y sprite.
- **Filtros** por tipo y por generación, combinables entre sí.
- **Búsqueda en tiempo real** por nombre; también encuentra un Pokémon buscando cualquier miembro de su cadena evolutiva (p. ej. buscar «Charmander» muestra también Charmeleon y Charizard).
- **Ficha de detalle** con estadísticas base animadas y la cadena evolutiva completa, resaltando el Pokémon actual.
- **Interfaz bilingüe ES/EN** con conmutador de idioma (persistido en cookie).
- **Estado en la URL:** la búsqueda y los filtros viven en `?q=&types=&gens=`, así que recargar, volver atrás o compartir un enlace conserva exactamente la vista.
- **Renderizado progresivo:** las tarjetas se cargan en páginas de 60 mediante `IntersectionObserver`, para mostrar más de mil elementos sin bloquear el hilo principal.

## Decisiones técnicas

**Agregación en el servidor + caché, en lugar de llamadas directas desde el cliente.**
Los datos siempre se originan en la PokéAPI en tiempo de ejecución (no hay ningún dataset commiteado en el repositorio). En el primer arranque en frío, el servidor construye un índice a partir de ~580 peticiones agrupadas en lotes, y lo cachea con `unstable_cache` (revalidación cada 24 h) además de la caché de `fetch` de Next. Esto mantiene la app rápida y es respetuoso con una API pública gratuita, sin renunciar a que el dato sea siempre de origen real. En serverless (Vercel), la primera petición tras el deploy o tras la revalidación construye el índice (~10-15 s); las rutas declaran `maxDuration = 60` para cubrirlo.

**La URL como única fuente de verdad del estado de la lista.**
En vez de guardar filtros y búsqueda en estado de React, se codifican en la query string. Así la navegación hacia atrás, la recarga y los enlaces compartidos restauran la vista sin código adicional, y el estado es depurable a simple vista.

**Búsqueda por evolución mediante los slugs de la cadena en el índice.**
Cada entrada del índice conoce los slugs de toda su cadena evolutiva, de modo que la coincidencia por evolución es una búsqueda en memoria sobre el índice ya cacheado, sin llamadas extra por pulsación.

**Tipado estricto en la frontera con la PokéAPI.**
Las respuestas de la PokéAPI se tipan explícitamente en `lib/pokeapi` y se transforman en modelos de dominio limpios, de forma que el resto de la aplicación nunca toca la forma cruda de la API.

**Lógica de dominio pura y aislada.**
El filtrado, la búsqueda por evolución, el códec de la URL, la construcción del índice y el batching viven en `lib/domain` y `lib/pokeapi` como funciones puras sin dependencias de framework: es la capa que concentra los 33 tests unitarios.

## Arquitectura

Server Components de Next 15 (App Router) que componen datos y UI; la lógica de negocio se mantiene pura y separada del framework.

```
src/
├── app/                 Páginas RSC (listado, /pokemon/[id], layout, estados)
├── components/pokedex/  Componentes de presentación (tarjetas, filtros, stats…)
├── hooks/               Hooks de cliente (filtros en URL, debounce)
└── lib/
    ├── pokeapi/         Cliente HTTP tipado + loaders cacheados
    ├── domain/          Lógica pura sin framework (aquí viven los tests)
    └── i18n/            Locale por cookie, diccionarios ES/EN, provider
```

## Calidad

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript en modo strict)
pnpm test         # Vitest (33 tests sobre la lógica de dominio)
pnpm format       # Prettier
```

Los tests cubren la capa de dominio pura: filtrado, búsqueda por evolución, códec de la URL, construcción del índice y batching.

### Limitación conocida

Una ruta `/pokemon/<id>` inexistente muestra la interfaz de «no encontrado» correctamente localizada, pero responde con **HTTP 200** en lugar de 404. Next 15 transmite la respuesta por streaming y el layout raíz lee la cookie de idioma, lo que hace la ruta dinámica; para cuando `notFound()` se ejecuta, la cabecera ya se ha enviado y no puede reescribir la línea de estado. La experiencia de usuario es correcta; lo documento como el trade-off de una i18n basada en cookie sin prefijo de ruta (`/es`, `/en`).

## Uso de IA

Desarrollado con asistencia de IA (Claude Code). La arquitectura, las decisiones técnicas y la revisión son propias; entiendo y defiendo todo el código del repositorio.

---

# English

Explorer for the ~1025 Pokémon species (Generations I–IX) built on top of the [PokéAPI](https://pokeapi.co). Real-time search, filters by type and generation, a detail page with animated stats and evolution chain, a bilingual UI (ES/EN), and list state synced to the URL.

![Screenshot of the Pokédex showing the card grid with the filter bar](docs/screenshot.png)

**Demo:** TODO-vercel-url

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

With Docker (multi-stage image, `standalone` output):

```bash
docker compose up --build   # served on http://localhost:3000
```

## Features

- **Full listing** of the ~1025 species across Generations I–IX, with number, types, and sprite.
- **Filters** by type and by generation, combinable.
- **Real-time search** by name; it also finds a Pokémon by matching any member of its evolution chain (e.g. searching "Charmander" also surfaces Charmeleon and Charizard).
- **Detail page** with animated base stats and the full evolution chain, highlighting the current Pokémon.
- **Bilingual ES/EN UI** with a language toggle (persisted in a cookie).
- **State in the URL:** search and filters live in `?q=&types=&gens=`, so reloading, going back, or sharing a link preserves the exact view.
- **Progressive rendering:** cards load in pages of 60 via `IntersectionObserver`, showing over a thousand items without blocking the main thread.

## Technical decisions

**Server-side aggregation + caching instead of direct client calls.**
Data always originates from the PokéAPI at runtime (no dataset is committed to the repo). On the first cold start the server builds an index from ~580 batched requests and caches it with `unstable_cache` (24h revalidation) on top of Next's `fetch` cache. This keeps the app fast and is polite to a free public API, without giving up that the data is always sourced live. On serverless (Vercel), the first request after a deploy or after revalidation builds the index (~10-15s); the routes declare `maxDuration = 60` to cover it.

**The URL as the single source of truth for list state.**
Rather than keeping filters and search in React state, they are encoded in the query string. Back-navigation, reload, and shared links restore the view with no extra code, and the state is inspectable at a glance.

**Evolution search via chain slugs stored in the index.**
Every index entry knows the slugs of its whole evolution chain, so an evolution match is an in-memory lookup over the already-cached index — no extra request per keystroke.

**Strict typing at the PokéAPI boundary.**
PokéAPI responses are explicitly typed in `lib/pokeapi` and mapped into clean domain models, so the rest of the app never touches the raw API shape.

**Pure, isolated domain logic.**
Filtering, evolution search, the URL codec, index building, and batching live in `lib/domain` and `lib/pokeapi` as pure, framework-free functions — the layer that holds all 33 unit tests.

## Architecture

Next 15 Server Components (App Router) compose data and UI; business logic stays pure and decoupled from the framework.

```
src/
├── app/                 RSC pages (listing, /pokemon/[id], layout, states)
├── components/pokedex/  Presentation components (cards, filters, stats…)
├── hooks/               Client hooks (URL-backed filters, debounce)
└── lib/
    ├── pokeapi/         Typed HTTP client + cached loaders
    ├── domain/          Pure framework-free logic (tests live here)
    └── i18n/            Cookie-based locale, ES/EN dictionaries, provider
```

## Quality

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (TypeScript in strict mode)
pnpm test         # Vitest (33 tests over the domain logic)
pnpm format       # Prettier
```

Tests cover the pure domain layer: filtering, evolution search, the URL codec, index building, and batching.

### Known limitation

A non-existent `/pokemon/<id>` route renders the correctly localized "not found" UI but responds with **HTTP 200** instead of 404. Next 15 streams the response and the root layout reads the language cookie, making the route dynamic; by the time `notFound()` runs the shell has already been flushed and can't rewrite the status line. The UX is correct; I document it as the trade-off of cookie-based i18n without a route prefix (`/es`, `/en`).

## AI usage

Built with AI assistance (Claude Code). The architecture, technical decisions, and review are my own; I understand and can defend all the code in this repository.
