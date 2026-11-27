# Zkušební verze pro test plateb Stripe

Větev `claude/stripe-test` slouží jen k tomu, aby existovala stálá zkušební adresa pro test plateb kartou
(Apple Pay, Google Pay, Visa, Mastercard) v testovacím režimu Stripe. **Neslučovat do `main`.**

- Zkušební web: https://claude-stripe-test.atelier-dante-time.pages.dev (SHOP_MODE=test, oddělená databáze)
- Webhook Stripe (testovací režim): `https://claude-stripe-test.atelier-dante-time.pages.dev/api/payments/stripe`
- Klíče: jen testovací (`sk_test_…`, `whsec_…`) v Cloudflare v prostředí **Preview**.
- Po vložení klíčů se zkušební verze musí znovu nasadit (spustí agent).
