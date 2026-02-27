import type { AppEvent } from '../types';

type Unsubscribe = () => void;

type Handler<T extends AppEvent['type']> = (event: Extract<AppEvent, { type: T }>) => void;

class EventBusImpl {
  private handlers: Map<string, Set<(event: AppEvent) => void>> = new Map();

  subscribe<T extends AppEvent['type']>(eventType: T, handler: Handler<T>): Unsubscribe {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const set = this.handlers.get(eventType)!;
    const fn = handler as (event: AppEvent) => void;
    set.add(fn);
    return () => set.delete(fn);
  }

  emit(event: AppEvent): void {
    const set = this.handlers.get(event.type);
    if (set) {
      set.forEach((handler) => handler(event));
    }
  }
}

export const eventBus = new EventBusImpl();
