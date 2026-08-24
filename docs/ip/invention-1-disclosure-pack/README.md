# Technical Disclosure Pack — Invention 1

**Invention title (as filed with the WIPO Inventor Assistance Program):**
*"Integrated Cooperative Agricultural Program with Digital Governance Layer Linking Government Subsidy Compliance to Real-Time Livestock Management Data"*

| | |
|---|---|
| Applicant | Golden Forage Ventures (Doc Aga platform) |
| Prepared for | Prospective pro bono Patent Agent, WIPO Inventor Assistance Program |
| Prepared from | Repository `pat-cmyk/doc-aga`, state as of 2026-08-24 |
| Status | Internal working draft for patent counsel — **CONFIDENTIAL, not for publication** |

> **Confidentiality.** This pack describes unfiled inventive subject matter. Public disclosure before filing can defeat novelty in most jurisdictions. Do not circulate outside the inventor–agent relationship.

---

## What this pack contains

The patent agent asked for technical implementation detail — "how the systems are technically implemented and operated, rather than … their intended program, administrative, or commercial outcomes" — before accepting the IAP assignment. This pack answers the Invention 1 requests from the platform's actual source code. Every factual claim carries a file citation (path, and line numbers where useful) so it can be verified against the repository; migration files are cited by their timestamp prefix (e.g. `20260305100000_*.sql` = `supabase/migrations/20260305100000_gov_dashboard_audit_fixes.sql`).

| Document | Contents | Answers the agent's requests for |
|---|---|---|
| [01-system-overview-and-component-inventory.md](./01-system-overview-and-component-inventory.md) | CAIN↔Doc Aga interaction; architecture diagram; user roles; full component inventory (client modules, 32+ serverless functions, 87-table database, RPC layer, interfaces and communication links); operational data collected and how it is generated; the government oversight dashboard tab-by-tab with metric formulas and thresholds; alerts, reports, and feedback analytics; known inconsistencies | CAIN–Doc Aga interaction · components/roles/databases/interfaces/links · operational data collection · dashboard contents · alerts/reports/metrics/feedback analytics |
| [02-er-diagram.md](./02-er-diagram.md) | Six entity-relationship diagrams derived from the database migrations (tenancy, husbandry records, trigger-maintained derived data, CAIN hub ledger, government/feedback layer, offline sync), the trigger provenance table, and the four-lane row-level-security model | database / entity-relationship diagrams |
| [03-data-flow-trace.md](./03-data-flow-trace.md) | Six-stage trace from a farmer's log entry to the government dashboard (capture → offline layer → database triggers → aggregation jobs → compliance rules → dashboards), with the exact algorithms, formulas, and thresholds; ends with a realistic end-to-end worked example producing a compliance classification and an implemented government action | algorithms/formulas/rules/thresholds · how assets, production, and participation are tracked · the detailed worked example |
| [04-implemented-vs-proposed.md](./04-implemented-vs-proposed.md) | Evidence-cited tables of 19 implemented capabilities vs 9 proposed/spec-only capabilities, plus a dated design-and-implementation timeline from migrations, commits, and the changelog | implemented vs proposed · dated records of the design history |

## The one-paragraph honest picture

The **governance layer is real and running**: an offline-first platform captures per-event livestock data with provenance; triggers and scheduled jobs derive finance, inventory, daily statistics, and composite performance scores; a compliance engine grades farms against fixed recording-completeness thresholds; and a role-gated, PII-stripped, audit-logged government dashboard turns all of it into regional oversight — including grant-effectiveness analytics, a farmer-feedback channel with AI triage and action templates, and a read-only compliance AI analyst. The **CAIN cooperative "Milk-In, Feed-Out" transactional core is also implemented** (immutable hub ledger, price schedules, FIFO milk settlement, feed disbursement into farm inventories, bi-monthly statements of account). What remains **proposed only** is the subsidy coupling named in the title: no code yet tracks or disburses subsidies, gates benefits on compliance scores, scores farmer participation, alerts government on events, or feeds the cooperative ledger into the government dashboard — those appear as schema hooks, a dated design spec, and explicit "Coming Soon" panels. Details and citations: [04-implemented-vs-proposed.md](./04-implemented-vs-proposed.md).

## Items the inventor must supply separately (not derivable from the repository)

1. **Public-disclosure inventory with dates** — pilot demonstrations, DA/NDA meetings, presentations, publications, online posts, or commercial offers involving either invention. The repository records only code history; these events control filing deadlines.
2. **Screenshots** of the live dashboards (government, cooperative, farmer) at representative data volumes — the pack describes them from code; counsel will want images.
3. Any **off-repository design artifacts** (whiteboard photos, pitch decks, meeting minutes) that evidence conception dates earlier than the repository timeline in 04 §3.

*A companion pack for Invention 2 ("Cooperative Bidirectional Logistics System … with In-Kind Loan Deduction") can be prepared on request; the CAIN hub ledger documented here (01 §3, 02 Diagram 4, 04 I-16/P-7/P-8) is the implemented foundation it would build on.*
