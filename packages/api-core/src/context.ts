import { BagKey } from "./types";

export class Context {
  readonly id: string;
  attempt: number;
  readonly startTime: number;
  readonly signal: AbortSignal;
  readonly bag: Map<BagKey, unknown>;

  constructor(init: {
    id: string;
    attempt?: number;
    startTime?: number;
    signal: AbortSignal;
    bag?: Map<BagKey, unknown>;
  }) {
    this.id = init.id;
    this.attempt = init.attempt ?? 0;
    this.startTime = init.startTime ?? Date.now();
    this.signal = init.signal;
    this.bag = init.bag ?? new Map();
  }

  get bagView(): ReadonlyMap<BagKey, unknown> {
    return new Map(this.bag);
  }
}
