---
name: incident-triage
description: Triage payment incidents from logs, deployment history, and tests. Use for payment errors, duplicate captures, provider timeouts, or failed payment CI investigations. Do not use for production deployment.
---

1. Read `docs/architecture.md` and `runbooks/payment-incident.md`.
2. Establish the exact time window and failure signature.
3. Collect only the minimum relevant logs and recent deployment diff.
4. Create a hypothesis table with supporting and contradicting evidence.
5. Reproduce locally using sanitized fixtures.
6. If a code defect is confirmed, implement the smallest reversible fix.
7. Run focused tests and then `./gradlew test`.
8. Write `artifacts/incident-report.md` using the runbook output template.
9. Never perform production writes. Request human approval for rollback or deploy.
