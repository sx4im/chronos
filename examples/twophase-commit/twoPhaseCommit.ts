import type { SimEnv } from "@sx4im/chronos-core";

export type TransactionState = "INIT" | "PREPARED" | "COMMITTED" | "ABORTED";

export type Message2PC =
  | { type: "PREPARE"; txId: string }
  | { type: "VOTE_COMMIT"; txId: string; from: string }
  | { type: "VOTE_ABORT"; txId: string; from: string }
  | { type: "GLOBAL_COMMIT"; txId: string }
  | { type: "GLOBAL_ABORT"; txId: string };

export class TwoPhaseCoordinator {
  public decision: "NONE" | "COMMIT" | "ABORT" = "NONE";
  private votes = new Map<string, "COMMIT" | "ABORT">();
  private timer: { cancel: () => void } | null = null;

  constructor(
    public readonly env: SimEnv,
    public readonly txId: string,
    private readonly participants: string[],
  ) {
    this.env.net.onReceive((from, msg) => {
      const m = msg as Message2PC;
      if (!m || m.txId !== this.txId) return;

      if (m.type === "VOTE_COMMIT" || m.type === "VOTE_ABORT") {
        this.votes.set(from, m.type === "VOTE_COMMIT" ? "COMMIT" : "ABORT");
        this.checkVotes();
      }
    });
  }

  public start(): void {
    const prepareMsg: Message2PC = { type: "PREPARE", txId: this.txId };
    for (const p of this.participants) {
      this.env.net.send(p, prepareMsg);
    }

    // Prepare timeout guard: if votes don't arrive in 100ms, decide ABORT
    this.timer = this.env.setTimeout(() => {
      if (this.decision === "NONE") {
        this.decide("ABORT");
      }
    }, 100);
  }

  private checkVotes(): void {
    if (this.decision !== "NONE") return;

    let hasAbort = false;
    for (const vote of this.votes.values()) {
      if (vote === "ABORT") hasAbort = true;
    }

    if (hasAbort) {
      this.decide("ABORT");
      return;
    }

    if (this.votes.size === this.participants.length) {
      this.decide("COMMIT");
    }
  }

  private decide(dec: "COMMIT" | "ABORT"): void {
    this.decision = dec;
    if (this.timer) this.timer.cancel();

    const decisionMsg: Message2PC =
      dec === "COMMIT"
        ? { type: "GLOBAL_COMMIT", txId: this.txId }
        : { type: "GLOBAL_ABORT", txId: this.txId };

    for (const p of this.participants) {
      this.env.net.send(p, decisionMsg);
    }

    // Periodic retry of decision to handle packet drops
    const retry = () => {
      if (this.decision !== "NONE") {
        for (const p of this.participants) {
          this.env.net.send(p, decisionMsg);
        }
        this.env.setTimeout(retry, 50);
      }
    };
    this.env.setTimeout(retry, 50);
  }
}

export class TwoPhaseParticipant {
  public state: TransactionState = "INIT";
  public vote: "COMMIT" | "ABORT";

  constructor(
    public readonly env: SimEnv,
    public readonly txId: string,
    public readonly coordinatorId: string,
    willVoteCommit = true,
  ) {
    this.vote = willVoteCommit ? "COMMIT" : "ABORT";

    this.env.net.onReceive((from, msg) => {
      if (from !== this.coordinatorId) return;
      const m = msg as Message2PC;
      if (!m || m.txId !== this.txId) return;

      if (m.type === "PREPARE" && this.state === "INIT") {
        if (this.vote === "COMMIT") {
          this.state = "PREPARED";
          this.env.net.send(this.coordinatorId, {
            type: "VOTE_COMMIT",
            txId: this.txId,
            from: this.env.nodeId,
          });
        } else {
          this.state = "ABORTED";
          this.env.net.send(this.coordinatorId, {
            type: "VOTE_ABORT",
            txId: this.txId,
            from: this.env.nodeId,
          });
        }
      } else if (m.type === "GLOBAL_COMMIT") {
        this.state = "COMMITTED";
      } else if (m.type === "GLOBAL_ABORT") {
        this.state = "ABORTED";
      }
    });
  }
}
