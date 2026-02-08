import { EventBus, EventName, EventPayloadMap } from "../types";

export class SimpleEventBus implements EventBus {
  private listeners = new Map<EventName, Set<Function>>();

  on<E extends EventName>(event: E, handler: (p: EventPayloadMap[E]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler);
    this.listeners.set(event, set);
    return () => set.delete(handler);
  }

  emit<E extends EventName>(event: E, payload: EventPayloadMap[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as any)(payload);
      } catch {
        // swallow observer errors
      }
    }
  }
}
