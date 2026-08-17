# VARUNA Security Console

VARUNA is an evidence-first cybersecurity analysis console for graph-guided code reasoning, timing side-channel testing, protocol fuzzing, patch review, and security re-verification.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/varuna-console` — React/Vite operator console with the persistent dashboard shell and workflow routes.
- `artifacts/api-server/src/routes/varuna.ts` — prototype VARUNA API surface with clearly bounded demo data and queueable workflow mutations.
- `lib/api-spec/openapi.yaml` — source of truth for the typed overview, targets, runs, findings, timing, protocol, patch, verification, and report contracts.
- `attached_assets/image_1786939138391.png` — visual direction reference for the console shell and hierarchy.

## Architecture decisions

- The first prototype uses a typed server contract and modular adapters so real Joern, GraphSAGE, TVLA, AFL++, llama.cpp, ASan, and UBSan services can be connected without rewriting the UI.
- Analysis mutations return queued/running states rather than claiming completed security results; demo evidence is visibly labeled in the console.
- The API prototype keeps target and analysis state in an in-memory service boundary until persistent storage and isolated execution workers are connected.

## Product

The console lets operators register targets, start analysis runs, inspect pipeline progress, review evidence-backed findings, run timing and protocol test campaigns, review patch diffs, request security re-verification, and generate reports.

## User preferences

Use the uploaded reference image as the visual source of truth: a rounded, green-led operator dashboard with a persistent shell, clear hierarchy, and compact evidence surfaces.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI changes before importing new generated hooks or schemas.
- The Vite production build requires the managed workflow's `PORT` and `BASE_PATH`; use the workflow for normal verification or provide both values when building manually.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
