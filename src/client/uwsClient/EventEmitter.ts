import { remove } from '@immutabl3/utils';

export class EventEmitter<T> {
  events: Map<string | number | Symbol, Array<(_e: T) => void>>;

  constructor() {
    this.events = new Map();
  }

  on(event, fn) {
    if (!this.events.has(event)) {
      this.events.set(event, [fn]);
      return;
    }

    this.events.get(event)!.push(fn);
  }

  off(event, fn) {
    if (!this.events.has(event)) return;

    remove(this.events.get(event), fn);
  }

  emit(event, e) {
    if (!this.events.has(event)) return;
    
    for (const fn of this.events.get(event)!) {
      fn(e);
    }
  }
}