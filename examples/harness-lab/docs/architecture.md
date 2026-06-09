# Payment Architecture

## Request path

`checkout-api -> payment-service -> payment-provider`

## Reliability constraints

- `payment-service` retries only idempotent provider requests.
- The idempotency key is `orderId + paymentAttempt`.
- Provider timeouts are 2 seconds, with at most one retry.
- Failed payments enter `payment-retry` only after the transaction is rolled back.
- A payment may be captured once and only once.

## Verification commands

```bash
./gradlew test
./gradlew test --tests '*PaymentServiceTest'
./gradlew test --tests '*IdempotencyTest'
```

## Ownership

- Application changes: Payment Platform
- Schema changes: Data Platform approval required
- Production rollback/deploy: On-call human approval required
