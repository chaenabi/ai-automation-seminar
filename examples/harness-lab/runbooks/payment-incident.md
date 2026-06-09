# Payment Incident Runbook

1. Define the incident window and affected endpoint.
2. Compare error rate with the latest deployment and configuration changes.
3. Separate provider failures from internal transaction failures.
4. Check whether retries reused the same idempotency key.
5. Reproduce with sanitized fixtures.
6. Rank hypotheses by evidence, not plausibility.
7. Before any production action, present:
   - expected impact
   - rollback plan
   - verification signal
   - required human approver

## Output template

| Rank | Hypothesis | Supporting evidence | Contradicting evidence | Test |
|---|---|---|---|---|

Finish with `Known`, `Inferred`, and `Unknown` sections.
