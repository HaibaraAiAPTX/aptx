# @aptx/token-store

Token storage contract package for the aptx ecosystem.

This package only defines abstractions and does not provide any runtime storage implementation.

## Exports

- `TokenMeta`
- `TokenRecord`
- `TokenStore`
- `TokenStoreFactory`

## Design Notes

- Keep `@aptx/api-core` and transport logic independent from token persistence.
- Implement storage adapters in separate packages, for example:
  - `@aptx/token-store-cookie`
  - `@aptx/token-store-local`
  - `@aptx/token-store-weapp`
  - `@aptx/token-store-memory`
