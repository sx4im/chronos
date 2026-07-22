import type { SimEnv } from "@sx4im/chronos-core";

export interface RegisterState<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly writerId: string;
}

export type CrdtMessage<T> = {
  type: "SYNC";
  state: RegisterState<T>;
};

export class LwwRegister<T> {
  private current: RegisterState<T>;

  constructor(
    public readonly env: SimEnv,
    initialValue: T,
    private readonly peers: string[],
  ) {
    this.current = {
      value: initialValue,
      timestamp: env.now(),
      writerId: env.nodeId,
    };

    this.env.net.onReceive((from, msg) => {
      const crdtMsg = msg as CrdtMessage<T>;
      if (crdtMsg && crdtMsg.type === "SYNC") {
        this.merge(crdtMsg.state);
      }
    });
  }

  public get state(): RegisterState<T> {
    return this.current;
  }

  public get value(): T {
    return this.current.value;
  }

  public write(val: T): void {
    const now = this.env.now();
    const newState: RegisterState<T> = {
      value: val,
      timestamp: now,
      writerId: this.env.nodeId,
    };

    if (this.isSuperior(newState, this.current)) {
      this.current = newState;
      this.broadcast();
    }
  }

  public merge(remote: RegisterState<T>): boolean {
    if (this.isSuperior(remote, this.current)) {
      this.current = remote;
      this.broadcast();
      return true;
    }
    return false;
  }

  public broadcast(): void {
    const msg: CrdtMessage<T> = {
      type: "SYNC",
      state: this.current,
    };
    for (const peer of this.peers) {
      if (peer !== this.env.nodeId) {
        this.env.net.send(peer, msg);
      }
    }
  }

  private isSuperior(a: RegisterState<T>, b: RegisterState<T>): boolean {
    if (a.timestamp > b.timestamp) return true;
    if (a.timestamp < b.timestamp) return false;
    return a.writerId > b.writerId;
  }
}
