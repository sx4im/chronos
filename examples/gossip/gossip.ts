import type { SimEnv } from "@sx4im/chronos-core";

export type GossipMessage = {
  type: "GOSSIP";
  key: string;
  value: string;
  version: number;
  origin: string;
};

export class GossipNode {
  public readonly store = new Map<string, { value: string; version: number; origin: string }>();
  private heartbeat: { cancel: () => void } | null = null;

  constructor(
    public readonly env: SimEnv,
    private readonly peers: string[],
    private readonly fanout: number,
    private readonly intervalMs: number,
  ) {
    this.env.net.onReceive((_from, msg) => {
      const m = msg as GossipMessage;
      if (m && m.type === "GOSSIP") {
        this.merge(m.key, m.value, m.version, m.origin);
      }
    });
  }

  public set(key: string, value: string): void {
    const existing = this.store.get(key);
    const version = existing ? existing.version + 1 : 1;
    this.store.set(key, { value, version, origin: this.env.nodeId });
  }

  public merge(key: string, value: string, version: number, origin: string): boolean {
    const existing = this.store.get(key);
    if (!existing || version > existing.version ||
        (version === existing.version && origin > existing.origin)) {
      this.store.set(key, { value, version, origin });
      return true;
    }
    return false;
  }

  public start(): void {
    const tick = () => {
      this.gossipRound();
      this.heartbeat = this.env.setTimeout(tick, this.intervalMs);
    };
    this.heartbeat = this.env.setTimeout(tick, this.intervalMs);
  }

  private gossipRound(): void {
    const otherPeers = this.peers.filter((p) => p !== this.env.nodeId);
    // Pick `fanout` random peers
    const targets: string[] = [];
    const pool = [...otherPeers];
    const count = Math.min(this.fanout, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(this.env.random() * pool.length);
      targets.push(pool[idx]!);
      pool.splice(idx, 1);
    }

    for (const [key, entry] of this.store) {
      const msg: GossipMessage = {
        type: "GOSSIP",
        key,
        value: entry.value,
        version: entry.version,
        origin: entry.origin,
      };
      for (const target of targets) {
        this.env.net.send(target, msg);
      }
    }
  }
}
