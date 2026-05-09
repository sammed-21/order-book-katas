export type Status =
  | "connecting"
  | "open"
  | "closed"
  | "reconnecting"
  | "error";

type Listeners = {
  status: (s: Status) => void;
  message: (data: unknown) => void;
  attempt: (attempt: number, nextDelayMs: number) => void;
};

type SocketOptions = {
  maxDelayMs?: number;
  baseDelayMs?: number;
};

class ReconnectingSocket {
  public socket: WebSocket | null = null;
  public url: string;
  public status: Status = "closed";
  public intentionallyClosed = false;
  public attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: unknown[] = [];

  private listeners: {
    status: Set<Listeners["status"]>;
    message: Set<Listeners["message"]>;
    attempt: Set<Listeners["attempt"]>;
  } = {
    status: new Set(),
    message: new Set(),
    attempt: new Set(),
  };

  private readonly maxDelayMs: number;
  private readonly baseDelayMs: number;

  constructor(url: string, opts?: SocketOptions) {
    this.url = url;
    this.maxDelayMs = opts?.maxDelayMs ?? 30_000;
    this.baseDelayMs = opts?.baseDelayMs ?? 500;
  }

  connect(): void {
    if (this.socket) return;
    this.intentionallyClosed = false;
    this.setStatus("connecting");
    this.openSocket();
  }

  send(payload: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  subscribe(payload: unknown): void {
    this.subscriptions.push(payload);
    if (this.status === "open") this.send(payload);
  }

  close(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setStatus("closed");
  }

  simulateDrop(): void {
    this.socket?.close();
  }

  on<E extends keyof Listeners>(event: E, listener: Listeners[E]): () => void {
    (this.listeners[event] as Set<Listeners[E]>).add(listener);
    return () => {
      (this.listeners[event] as Set<Listeners[E]>).delete(listener);
    };
  }

  getStatus(): Status {
    return this.status;
  }

  private openSocket(): void {
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus("open");
      for (const sub of this.subscriptions) this.send(sub);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit("message", data);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onerror = () => {
      this.setStatus("error");
    };

    ws.onclose = () => {
      this.socket = null;
      if (this.intentionallyClosed) {
        this.setStatus("closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.setStatus("reconnecting");

    const delay =
      Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** this.attempt) +
      Math.random() * this.baseDelayMs;

    this.attempt += 1;
    this.emit("attempt", this.attempt, delay);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private setStatus(next: Status): void {
    if (this.status === next) return;
    this.status = next;
    this.emit("status", next);
  }

  private emit<E extends keyof Listeners>(
    event: E,
    ...args: Parameters<Listeners[E]>
  ): void {
    this.listeners[event].forEach((cb) => {
      (cb as (...a: unknown[]) => void)(...args);
    });
  }
}

export { ReconnectingSocket };
