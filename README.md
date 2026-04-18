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
# production domain példa:
PUBLIC_BASE_URL=https://kvamtom.tech npm start
```

Dashboard: `http://localhost:3000`

API alapértelmezett címe: `http://localhost:3000`

## API endpointok

- `GET /health`
- `GET /links` (gyors dashboard/API linkek JSON-ben)
- `GET /decisions?limit=10` (AI decision log lista, minimum `x-role: analyst`)
- `GET /command-center/overview` (Master Overview, minimum `x-role: analyst`)
- `GET /admin/roles` (role hierarchy + capability map, minimum `x-role: admin`)
- `GET /analytics/:module` (module score/decision aggregate, minimum `x-role: analyst`)
- `GET /predict/:module` (Prediction Engine output, minimum `x-role: analyst`)
- `GET /commands?limit=20` (command queue lista, minimum `x-role: operator`)
- `POST /commands/:id/execute` (command execution, minimum `x-role: operator`)
- `GET /audit-logs?limit=20` (audit trail lista, minimum `x-role: admin`)
- `GET /deploy/public-config` (publikus domain/export config, minimum `x-role: admin`)
- `POST /security/drill/breach` (security breach szimuláció, minimum `x-role: operator`)
- `POST /events/:module` (`finance|security|health|energy`)
- `POST /omega/evaluate` (több modul közös értékelése)
- `POST /decisions/:id/approve` (manual review approval, minimum `x-role: operator`)

## Példa kérés

```bash
curl -X POST http://localhost:3000/events/finance \
  -H 'content-type: application/json' \
  -d '{"signals":{"amountAnomaly":true,"newDevice":true}}'

curl http://localhost:3000/command-center/overview \
  -H 'x-role: analyst'

curl http://localhost:3000/predict/security \
  -H 'x-role: analyst'
```

## Fókusz (Phase 1 -> Phase 2 átmenet)

1. Finance + Security automatizmusok mélyítése
2. Egységes Command Layer (review, alert, freeze, block)
3. Audit log és incidens nyomkövetés
4. Dashboard integrációra kész API-kimenetek
5. Health + Energy signal minőség javítása
