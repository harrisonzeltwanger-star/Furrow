type Listener = () => void;

class SimpleEventEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
    };
  }

  emit(event: string) {
    this.listeners[event]?.forEach((l) => l());
  }
}

export const EventEmitter = new SimpleEventEmitter();
