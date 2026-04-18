# ZoliGPT Omega Admin Core

Ultra Enterprise Strategic Intelligence System többdoménes működésre: **Finance, Security, Health, Energy** modulokkal és egy központi döntési aggyal.

## Mi van ebben a repóban most?

Ez a repository már egy futtatható **Core v2** alapot ad:

- Központi pontozási + döntési motor (`src/core`)
- Új, újrahasznosítható rule engine
- Omega Brain globális prioritás és parancsréteg
- Beépített webes dashboard + HTTP API (Node.js)
- Kezdő Supabase/PostgreSQL séma (`supabase/schema.sql`)
- Részletes architektúra dokumentáció (`docs/omega-admin-core.md`)

## Gyors indulás

```bash
npm install
npm test
npm start
```

Dashboard: `http://localhost:3000`

API alapértelmezett címe: `http://localhost:3000`

## API endpointok

- `GET /health`
- `GET /links` (gyors dashboard/API linkek JSON-ben)
- `GET /decisions?limit=10` (AI decision log lista)
- `POST /events/:module` (`finance|security|health|energy`)
- `POST /omega/evaluate` (több modul közös értékelése)

## Példa kérés

```bash
curl -X POST http://localhost:3000/events/finance \
  -H 'content-type: application/json' \
  -d '{"signals":{"amountAnomaly":true,"newDevice":true}}'
```

## Fókusz (Phase 1 -> Phase 2 átmenet)

1. Finance + Security automatizmusok mélyítése
2. Egységes Command Layer (review, alert, freeze, block)
3. Audit log és incidens nyomkövetés
4. Dashboard integrációra kész API-kimenetek
5. Health + Energy signal minőség javítása
