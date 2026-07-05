# Pokédex — Design Spec

**Date:** 2026-07-05
**Context:** Technical test for Full Stack Analyst Programmer position (BinPar / A2R). Deliverable: a public GitHub repo with a Next.js + TypeScript app consuming PokéAPI, deployed on Vercel and runnable via `docker compose up`.

## Goal

A premium, Pokédex-themed web app that lists all Pokémon (Gen I–IX, ~1025), supports filtering by type and generation, real-time name search that includes evolution chains, and a detail page with stats and an evolution chain viewer. List state (filters, search) survives navigation to/from the detail page.

## Functional Requirements (from the test brief)

1. **Pokémon list** — ordered by id by default; shows at least name, generation and types. We also show official artwork and national dex number.
2. **Filters** — by type and by generation, combinable.
3. **Real-time search by name, including evolutions** — typing "pikachu" also surfaces Pichu and Raichu (same evolution chain). Debounced, filters as you type.
4. **Detail page** — name, image, generation, types, evolution chain (with images, current Pokémon clearly highlighted, evolutions navigable) and base stats.
5. **State preservation** — returning from detail to list restores filters, search text and general state. Not required to survive a hard reload (ours partially does, see below).

## Decisions

### Data strategy: server-side aggregation with Next.js fetch cache (ISR)

Rejected alternatives:
- **Client-side only:** hundreds of browser requests to assemble generation/type/evolution data for 1025 Pokémon. Slow and fragile.
- **Static JSON committed to the repo:** fast but contradicts the brief's "real-time information from PokéAPI".

Chosen approach: React Server Components aggregate PokéAPI data using Next.js' native `fetch` cache with `revalidate` (24h). Index construction:
- `GET /generation/{1..9}` — 9 requests → species → generation map.
- `GET /type/{name}` — ~20 requests → pokémon → types map.
- `GET /evolution-chain/{id}` — ~550 requests, parallel and cached → species → evolution chain map.
- `GET /pokemon-species?limit=…` — species list with ids/names (and localized names).

The server builds a **lightweight list index** (id, name, localized names, generation, types, sprite URL, evolutionChainId, evolution chain member names) once; subsequent visits hit the cache. The detail page fetches per-Pokémon data (stats, artwork, full evolution chain) on demand in an RSC, also cached.

Data still comes from PokéAPI at runtime (honest, documented caching) and client-side search/filtering is instant because it operates on the preloaded index.

### List state lives in the URL

`/?type=fire&gen=1&q=pika` — searchParams are the single source of truth for filters and search text. Navigating to a detail page and back (browser back or in-app back link preserving the query string) restores state for free. Bonus: filter state is shareable/bookmarkable and survives reloads, exceeding the brief. No global state library needed.

Search input updates the URL via `router.replace` (shallow, debounced) to avoid history spam; filter clicks use `router.push`-style semantics on the same page.

### Search including evolutions

The index stores, per Pokémon, its `evolutionChainId` and the set of names in its chain. A Pokémon matches query `q` if its own (localized or English) name matches **or** any name in its evolution chain matches. Pure domain function, unit-tested.

### i18n: Spanish + English

- Lightweight dictionary-based i18n (no heavy framework): `lib/i18n` with `es.ts` / `en.ts` dictionaries, a locale cookie, and a header toggle (ES/EN).
- PokéAPI localized names used where available: type names, generation labels, Pokémon genus/flavor text. Pokémon names themselves are effectively universal (PokéAPI `species.names` provides them; most are identical in es/en).
- README is bilingual (Spanish first, English section below).

### Visual design: modern premium Pokédex (dark)

- Dark theme with the classic Pokédex red as accent; animated blue "sensor" light in the header (subtle, CSS only).
- Cards with canonical per-type colors: colored glow/gradient, type badges, hover lift.
- Detail page: hero with large official artwork on a type-colored gradient, animated stat bars (width transition, color by stat value), horizontal evolution chain with arrows and a clear "you are here" ring on the current Pokémon.
- Fully responsive (mobile-first grid 2 → 6 columns).
- Loading states: skeleton cards; error states with retry.

### Rendering 1025 cards without lag

Progressive rendering: show a page of results (e.g. 60) with an intersection-observer "load more" sentinel (infinite scroll) + result counter. Filtering always runs over the full in-memory index; only DOM rendering is chunked. Scroll position and loaded-count are part of general state kept when returning from detail (component state preserved via back navigation + `sessionStorage` fallback for scroll restoration if needed).

## Architecture

```
src/
  lib/
    pokeapi/          # Typed PokéAPI client: raw response types, fetchers, cache config
    domain/           # Our models + pure logic: Pokemon, filters, evolution search
    i18n/             # Dictionaries es/en, locale helpers, useTranslation
  app/
    layout.tsx        # Root layout, fonts, theme, header
    page.tsx          # List page (RSC: loads index → passes to client list)
    pokemon/[id]/
      page.tsx        # Detail page (RSC per Pokémon)
      loading.tsx     # Skeleton
  components/
    pokedex/          # PokedexHeader, PokemonCard, TypeBadge, FilterBar,
                      # SearchBox, StatBar, EvolutionChain, GenerationTabs …
    ui/               # Generic primitives if needed
```

Boundaries:
- `lib/pokeapi` knows HTTP and PokéAPI shapes; exports typed fetchers only.
- `lib/domain` knows nothing about HTTP or React; pure functions + types. This is what the future "random Pokémon battle" feature will reuse.
- `components` know nothing about fetching; receive typed props.
- RSC pages are the only composition point between data and UI.

## Error handling

- PokéAPI fetch failures: retry once, then error boundary UI ("Pokédex offline") with retry button. Detail page: `notFound()` for invalid ids.
- All external data validated at the boundary by narrowing typed responses; no `any`.

## Testing

- **Vitest** unit tests for `lib/domain`: filter combination logic, evolution-chain search matching, index building from fixture data.
- Type safety as first line of defense: `strict: true`, no `any`, exhaustive switch on types.
- Lint/format: ESLint (next config) + Prettier; CI-ready scripts (`lint`, `typecheck`, `test`).

## Delivery

- **Vercel deploy** — URL in README.
- **Docker** — multi-stage Dockerfile (deps → build → standalone runner), `docker-compose.yml`, single command `docker compose up`.
- **README (ES + EN)** — run instructions (pnpm + Docker), architecture overview, justified decisions (caching vs "real time", URL state, search semantics), AI usage note (brief, as requested by the brief).
- No push to GitHub until explicitly approved by Nelson.

## Out of scope (this phase)

- Pokémon battle mode (planned next phase; enabled by the decoupled `lib/domain`).
- Persisting list state across hard reloads beyond what the URL already gives us.
- Accounts, favorites, or any backend beyond Next.js server components.
