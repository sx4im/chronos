// Simulator — ties the deterministic core together (§4.2).
//
// Owns the clock, RNG, scheduler, network, and nodes. Exposes a per-node SimEnv
// for dependency injection into user code, runs the scheduler while checking
// safety invariants after every step, and returns a Trace.

import { VirtualClock } from "./clock.js";
import { Rng } from "./random.js";
import { Scheduler, type SimEvent } from "./scheduler.js";
import { createEnv, type SimEnv, type SimNet } from "./env.js";
import {
  BasicNetwork,
  PartitionManager,
  DEFAULT_NETWORK,
  type NetworkConfig,
  type NetworkFactory,
  type SimNetworkLike,
  type NetworkContext,
  type DeliverFn,
} from "./network.js";
import { TraceLogger, type Trace } from "./trace.js";
import {
  type Invariant,
  type WorldView,
  checkInvariant,
  InvariantViolated,
} from "./invariants.js";
import { evaluateStepChaos } from "./chaos.js";

export interface ChaosConfig {
  partitionProb?: number; // chance per step to start a partition
  crashProb?: number; // chance per step to crash a live node
  restartProb?: number; // chance per step to restart a crashed node
  maxPartitionMs?: number;
  /** Never have more than this fraction of nodes crashed at once (0..1), so the
   * system keeps churning and restart has something to bring back. */
  maxCrashFraction?: number;
}

export interface SimulatorOptions {
  seed: bigint | number;
  nodes: number | string[];
  /**
   * Latency config for the core BasicNetwork default. Ignored when a
   * `netFactory` is provided (the factory owns its own network config).
   */
  network?: Partial<NetworkConfig>;
  /**
   * Inject a custom network (e.g. @sx4im/chronos-net's fault-injecting SimNetwork).
   * Without it the Simulator uses core's dependency-free BasicNetwork. This is
   * the one-way seam that keeps core free of any runtime dep on @sx4im/chronos-net.
   */
  netFactory?: NetworkFactory;
  chaos?: ChaosConfig;
  maxSteps?: number;
}

export interface SimNode {
  id: string;
  env: SimEnv;
}

export interface RunOptions {
  maxSteps?: number;
}

export type RunResult =
  | { status: "ok"; trace: Trace }
  | { status: "violation"; trace: Trace; invariant: string; detail: string };

export class Simulator {
  readonly clock: VirtualClock;
  readonly rng: Rng;
  readonly scheduler: Scheduler;
  readonly net: SimNetworkLike;
  readonly partitions: PartitionManager;
  readonly trace: TraceLogger;
  readonly nodes: SimNode[];
  readonly networkConfig: NetworkConfig;
  readonly chaosConfig: Required<ChaosConfig>;
  readonly seed: bigint;
  readonly maxSteps: number;

  private invariants: Invariant[] = [];
  private receivers = new Map<string, (from: string, payload: unknown) => void>();
  private crashed = new Set<string>();

  constructor(opts: SimulatorOptions) {
    this.seed = BigInt(opts.seed);
    this.clock = new VirtualClock();
    this.rng = new Rng(this.seed);
    this.scheduler = new Scheduler(this.clock, this.rng);
    this.trace = new TraceLogger();
    this.partitions = new PartitionManager();
    this.networkConfig = { ...DEFAULT_NETWORK, ...opts.network };
    this.chaosConfig = {
      partitionProb: opts.chaos?.partitionProb ?? 0,
      crashProb: opts.chaos?.crashProb ?? 0,
      restartProb: opts.chaos?.restartProb ?? 0,
      maxPartitionMs: opts.chaos?.maxPartitionMs ?? 200,
      maxCrashFraction: opts.chaos?.maxCrashFraction ?? 0.5,
    };
    this.maxSteps = opts.maxSteps ?? 100_000;

    const ids = Array.isArray(opts.nodes) ? opts.nodes : makeIds(opts.nodes);
    this.nodes = ids.map((id) => {
      const net: SimNet = {
        send: (to, payload) => this.net.send(id, to, payload),
        onReceive: (handler) => this.receivers.set(id, handler),
      };
      return {
        id,
        env: createEnv({
          scheduler: this.scheduler,
          clock: this.clock,
          rng: this.rng,
          nodeId: id,
          net,
        }),
      };
    });

    // Wire the network. The default BasicNetwork is dependency-free (deterministic
    // latency, no faults); a `netFactory` injects @sx4im/chronos-net's fault network
    // without core taking a runtime dependency on it (this seam breaks the
    // net→core←net cycle).
    const deliver: DeliverFn = (m) => this.receivers.get(m.to)?.(m.from, m.payload);
    const isDown = (nodeId: string) => this.crashed.has(nodeId);
    const ctx: NetworkContext = {
      scheduler: this.scheduler,
      clock: this.clock,
      rng: this.rng,
      partitions: this.partitions,
      trace: this.trace,
      deliver,
      isDown,
    };
    this.net = opts.netFactory
      ? opts.netFactory(ctx)
      : new BasicNetwork({ ...ctx, config: this.networkConfig });
  }

  addInvariant(inv: Invariant): this {
    this.invariants.push(inv);
    return this;
  }

  /** The world view passed to invariant checks. */
  private world(): WorldView {
    return {
      time: this.clock.now(),
      nodeIds: this.nodes.map((n) => n.id),
      crashedNodes: [...this.crashed],
    };
  }

  /** Manual chaos controls (deterministic, for targeted tests). */
  crash(nodeId: string): void {
    if (this.crashed.has(nodeId)) return;
    this.crashed.add(nodeId);
    this.scheduler.cancelNode(nodeId);
    this.trace.append(this.clock.now(), { kind: "crash", nodeId });
  }

  restart(nodeId: string): void {
    if (!this.crashed.has(nodeId)) return;
    this.crashed.delete(nodeId);
    this.trace.append(this.clock.now(), { kind: "restart", nodeId });
  }

  partition(groups: string[][], durationMs?: number): void {
    const start = this.clock.now();
    const end = start + (durationMs ?? this.chaosConfig.maxPartitionMs);
    this.partitions.partition(groups, start, end);
    this.trace.append(start, { kind: "partition", groups, healAt: end });
  }

  heal(): void {
    this.partitions.clear();
  }

  /** Run until the queue drains, an invariant breaks, or maxSteps is hit. */
  async run(opts: RunOptions = {}): Promise<RunResult> {
    const cap = opts.maxSteps ?? this.maxSteps;
    let steps = 0;

    const world = () => this.world();

    try {
      await this.scheduler.run({
        maxSteps: cap,
        onStep: (ev) => this.onStep(ev, steps++),
        onStepEnd: () => {
          // Safety invariants hold after every step.
          for (const inv of this.invariants) {
            if (inv.kind === "liveness") continue;
            checkInvariant(inv, world());
          }
        },
      });
      // Liveness invariants checked at end-of-run.
      for (const inv of this.invariants) {
        if (inv.kind === "liveness") checkInvariant(inv, world());
      }
      return this.okResult();
    } catch (e) {
      if (e instanceof InvariantViolated) {
        this.trace.append(this.clock.now(), {
          kind: "invariant-violation",
          name: e.invariant,
          detail: e.detail,
        });
        return {
          status: "violation",
          trace: this.trace.toTrace(String(this.seed), this.configSnapshot(), this.ids(), "violation"),
          invariant: e.invariant,
          detail: e.detail,
        };
      }
      throw e;
    }
  }

  /** Run until the queue is empty (no step cap). Used inside sim bodies. */
  async settle(): Promise<void> {
    await this.scheduler.run({ maxSteps: this.maxSteps });
  }

  // ------------------------------------------------------------------
  private onStep(ev: SimEvent, _steps: number): void {
    // Garbage-collect expired partitions occasionally.
    this.partitions.gc(this.clock.now());
    // Probabilistic chaos: a partition or node crash may start this step.
    this.maybeChaos();
    // (the run loop's onStepEnd handles safety checks)
    void ev;
  }

  private maybeChaos(): void {
    evaluateStepChaos({
      rng: this.rng,
      chaosConfig: this.chaosConfig,
      nodeIds: this.ids(),
      crashedNodes: this.crashed,
      partition: (groups) => this.partition(groups),
      crash: (nodeId) => this.crash(nodeId),
      restart: (nodeId) => this.restart(nodeId),
    });
  }

  private ids(): string[] {
    return this.nodes.map((n) => n.id);
  }

  private configSnapshot(): { network: NetworkConfig; chaos: ChaosConfig } {
    return { network: this.networkConfig, chaos: this.chaosConfig };
  }

  private okResult(): RunResult {
    const trace = this.trace.toTrace(
      String(this.seed),
      this.configSnapshot(),
      this.ids(),
      "ok",
    );
    return { status: "ok", trace };
  }
}

function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `node-${i}`);
}
