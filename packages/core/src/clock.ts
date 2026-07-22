// Virtual Clock — the single source of time in a simulation.
// It never reads real time; it only advances when the scheduler pops a future event.

export class VirtualClock {
  private _now = 0; // simulated ms since start

  now(): number {
    return this._now;
  }

  // Called only by the Scheduler when it pops a future event.
  advanceTo(t: number): void {
    // Reject non-finite time FIRST: `NaN < this._now` is `false`, so a NaN time
    // would silently bypass the backwards guard below and poison the clock (and
    // every downstream heap comparison) to NaN — a silent determinism break.
    if (!Number.isFinite(t)) {
      throw new Error(
        `time must be finite (now=${this._now}, attempted=${t})`,
      );
    }
    if (t < this._now) {
      throw new Error(
        `time cannot go backwards (now=${this._now}, attempted=${t})`,
      );
    }
    this._now = t;
  }
}
