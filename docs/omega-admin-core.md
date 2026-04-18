# ZoliGPT Omega Admin Core — Architecture Blueprint

## 1) Platform cél

A rendszer célja, hogy egyetlen admin command center-ben egyesítse:

- pénzügyi kockázatkezelést,
- biztonsági eseménykezelést,
- egészség/wellness trendfigyelést,
- energiaoptimalizációt.

A központi döntési réteg minden eseményt pontoz, döntési javaslatot ad, és auditálható indoklást generál.

## 2) Modulok és üzleti szerep

### Finance (QFI Pro)

- Fraud scoring (0–100)
- Döntés: `approve | review | block`
- Revenue analytics, churn jelzések
- Audit trail minden auto/manual döntésről

### Security (ShadowLayer)

- Login/session/API anomália figyelés
- Döntés: `allow | step_up_auth | freeze | block`
- Incidens napló, bizonyíték export

### Health (AI Assist)

- Wellness trendkövetés (nem diagnosztika)
- Risk flag (alvás/stressz/terhelés)
- Ajánlásmotor: pihenés, terheléscsökkentés, rutin javítás

### Energy (Optimizer)

- Fogyasztás mintázat elemzés
- Peak idő előrejelzés
- Költségcsökkentő ajánlások

## 3) Omega Brain Decision Flow

1. **Ingestion**: modul esemény fogadása
2. **Normalization**: közös eseménystruktúra
3. **Scoring**: szabályok + súlyok alapján pontszám
4. **Thresholding**: döntési kategória
5. **Actioning**: alert / review queue / auto action
6. **Audit**: döntés, indok, actor, timestamp rögzítés

## 4) Compliance és governance alapelvek

- Egészség modulnál kötelező disclaimer: wellness támogatás, nem orvosi diagnózis.
- Minden automatikus tiltásnál visszanézhető indoklista.
- Role-alapú hozzáférés (User, Analyst, Operator, Admin, Superadmin).
- Founder Root Layer csak kontrollált, naplózott override-dal.

## 5) Multi-tenant SaaS alap

- Tenant izoláció Supabase RLS policyvel
- Tenant szintű scoring policy-k
- Feature flag modulonként (Finance/Security/Health/Energy)
- Csomagolás: Basic / Pro / Enterprise

## 6) Javasolt következő implementációk

> Megjegyzés: a jelenlegi implementáció dependency-free Node HTTP szervert használ; később könnyen átállítható Express/Nest rétegre.

- Express API endpointok:
  - `POST /events/finance`
  - `POST /events/security`
  - `POST /events/health`
  - `POST /events/energy`
  - `GET /decisions/:id`
- Webhook feldolgozók (Stripe, auth, SIEM)
- Queue alapú aszinkron döntési pipeline

## 7) Implemented v2 runtime surface

### Core modules in code

- `src/core/ruleEngine.js`: közös szabályértékelő
- `src/core/decisionEngine.js`: modul-szintű pontozás + döntés + magyarázat
- `src/core/omegaBrain.js`: keresztmodulos globális prioritás és döntés
- `src/core/commandLayer.js`: döntés -> automatizált parancslista

### API

- `GET /health`
- `POST /events/:module`
- `POST /omega/evaluate`

#### `POST /omega/evaluate` példa payload

```json
{
  "events": [
    {"module": "finance", "signals": {"amountAnomaly": true, "newDevice": true}},
    {"module": "security", "signals": {"newIp": true, "missingMfa": true}}
  ]
}
```

## 8) Web dashboard (implemented)

A rendszerhez készült egy egyszerű, interaktív admin weboldal (`public/index.html`), amely:

- mutatja a globális score és döntés állapotot,
- modulonként tud `signals` payloadot küldeni,
- tud cross-module Omega Brain kiértékelést futtatni,
- élőben megjeleníti a JSON választ.

## 9) AI Decisions Log (runtime)

Az API most in-memory decision store-t vezet, amely elérhető a következő végponton:

- `GET /decisions?limit=10`

Minden `POST /events/:module` és `POST /omega/evaluate` hívás naplóz egy decision rekordot és visszaadja a `decisionLogId` mezőt.
