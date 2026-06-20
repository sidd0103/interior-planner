# Interior Planner

A browser-based tool for decorating a new apartment. Film each room, turn the
footage into a navigable 3D scene, recover the room's true dimensions from
iPhone Measure screenshots, generate 3D furniture from photos, and arrange it
all in a powerful in-browser 3D editor.

## Pipeline

1. **Capture** — upload a room walkthrough video (or photos) → [World Labs
   Marble](https://www.worldlabs.ai) reconstructs it as a navigable Gaussian
   splat. (Or import an existing `.ply`/`.ksplat`/`.splat` directly — no key
   needed.)
2. **Reconcile dimensions** — upload iPhone **Measure** app screenshots; Claude
   vision reads the measurements, you drag endpoint markers onto the matching
   corners in 3D, and a least-squares **similarity solve** recovers the metric
   scale, orientation, and origin so the splat is real-world accurate.
3. **Generate furniture** — upload a furniture photo + real dimensions →
   [Meshy](https://www.meshy.ai) turns it into a GLB asset (shown immediately as
   a correctly-sized box, upgraded to a mesh when ready).
4. **Arrange** — move / rotate / scale furniture with a gizmo, snap to the
   floor, see overlap warnings; assemble all rooms in an apartment-level view.

## Stack

- **Next.js (App Router) + TypeScript** — frontend + API route handlers that
  hold the API keys server-side.
- **React Three Fiber + drei** — the 3D engine (transform gizmos, controls,
  GLTF loading); **@mkkellogg/gaussian-splats-3d** renders splats alongside GLB
  meshes.
- **Local-first persistence** — Dexie (IndexedDB) for metadata, OPFS (with an
  IndexedDB fallback) for large binaries, behind a swappable repository facade
  (`src/lib/storage/repo.ts`).
- **Anthropic Claude** (`claude-opus-4-8`) for vision; **SWR** `refreshInterval`
  polling for the long-running generation jobs.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

`.env.local` keys (all server-side only):

| Key | Used by |
|-----|---------|
| `WORLD_LABS_API_KEY` | room capture (`/api/worldlabs/*`) |
| `MESHY_API_KEY` | furniture generation (`/api/meshy/*`) |
| `ANTHROPIC_API_KEY` | Measure-screenshot reading (`/api/vision/measure`) |

The app runs without keys — capture supports a direct splat-import path, and
furniture exists as boxes until a mesh is generated.

## Scripts

- `npm run dev` / `npm run build` — Next.js dev / production build
- `npm test` — unit tests (`similaritySolve`, `collision`)

## Project layout

```
src/
  app/                     pages + API route handlers
  components/
    scene/                 R3F canvas, splat + furniture, transform gizmo
    capture/               room capture wizard + job watcher
    measure/               dimension-reconciliation modal
    furniture/             photo -> 3D generator + library panel
    apartment/             multi-room assembly view
    room/                  room editor shell
  lib/
    clients/               server-only adapters (worldLabs, meshy, vision)
    storage/               Dexie + OPFS + repository facade
    geometry/              similarity solve, units, collision
    scene/ jobs/ util/     editor state, SWR polling, helpers
```

> Note: the World Labs Marble API is new — `src/lib/clients/worldLabsClient.ts`
> documents the assumed request/response shapes; verify them against the live
> docs when wiring a real key.
