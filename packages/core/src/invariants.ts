// Invariants / property checking (§3.10).
//
// Safety invariants are checked after every scheduler step; liveness invariants
// at end-of-run. A check signals a violation by returning `false` or by throwing;
// the Simulator records an `invariant-violation` trace event and stops.

export interface WorldView {
  /** Current virtual time. */
  readonly time: number;
  /** All node ids in the simulation. */
  readonly nodeIds: readonly string[];
  /** Node ids currently crashed (their pending events are canceled). */
  readonly crashedNodes: readonly string[];
}

export interface Invariant {
  readonly name: string;
  readonly kind?: "safety" | "liveness"; // default "safety"
  /** Return false (or throw) to signal a violation. */
  check(world: WorldView): boolean | void;
}

/** Thrown internally to abort the scheduler loop on a violation. */
export class InvariantViolated extends Error {
  constructor(
    public readonly invariant: string,
    public readonly detail: string,
    public readonly violator?: string,
  ) {
    const where = violator !== undefined ? ` (node ${violator})` : "";
    super(`invariant "${invariant}" violated at t=${detail}${where}`);
    this.name = "InvariantViolated";
  }
}

/** Run a single invariant against a world view; throw InvariantViolated on failure. */
export function checkInvariant(inv: Invariant, world: WorldView): void {
  let ok: boolean | void;
  try {
    ok = inv.check(world);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new InvariantViolated(inv.name, `threw: ${detail}`);
  }
  if (ok === false) {
    throw new InvariantViolated(inv.name, "check() returned false");
  }
}
