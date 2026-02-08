import { Middleware, Request, Context, Response } from "@aptx/api-core";

export interface RetryOptions {
  retries: number;
  delayMs?: number | ((attempt: number, error: Error, req: Request, ctx: Context) => number);
  retryOn?: (error: Error, req: Request, ctx: Context) => boolean;
}

export type RetryMetaOverride =
  | {
      disable?: boolean;
      retries?: number;
      delayMs?: RetryOptions["delayMs"];
      retryOn?: RetryOptions["retryOn"];
    }
  | undefined;

const RETRY_META_KEY = "__aptxRetry";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOverride(req: Request): RetryMetaOverride {
  const meta = req.meta as Record<string, unknown>;
  const v = meta?.[RETRY_META_KEY];
  if (!v || typeof v !== "object") return undefined;
  return v as RetryMetaOverride;
}

export function createRetryMiddleware(options: RetryOptions): Middleware {
  return {
    async handle(req: Request, ctx: Context, next: (req: Request, ctx: Context) => Promise<Response>) {
      const override = getOverride(req);
      const disabled = override?.disable === true;
      const retries = disabled ? 0 : Math.max(0, override?.retries ?? options.retries);
      const delayMs = disabled ? undefined : (override?.delayMs ?? options.delayMs);
      const retryOn = disabled ? undefined : (override?.retryOn ?? options.retryOn);

      for (let attempt = 0; ; attempt++) {
        ctx.attempt = attempt;
        try {
          return await next(req, ctx);
        } catch (err) {
          const error = err as Error;
          if (attempt >= retries) throw error;
          if (retryOn && !retryOn(error, req, ctx)) throw error;

          const delay =
            typeof delayMs === "function" ? delayMs(attempt + 1, error, req, ctx) : delayMs;
          if (delay && delay > 0) await sleep(delay);
        }
      }
    },
  };
}
