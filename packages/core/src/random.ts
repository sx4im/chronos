// Seeded PRNG: xoshiro256** seeded via SplitMix64.
// The entire system depends on this being perfectly deterministic.

const MASK64 = 0xFFFFFFFFFFFFFFFFn;

function splitmix64(seed: bigint): () => bigint {
  let z = seed & MASK64;
  return () => {
    z = (z + 0x9E3779B97F4A7C15n) & MASK64;
    let r = z;
    r = ((r ^ (r >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    r = ((r ^ (r >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    return (r ^ (r >> 31n)) & MASK64;
  };
}

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

export class Rng {
  private s0: bigint;
  private s1: bigint;
  private s2: bigint;
  private s3: bigint;

  constructor(seed: bigint | number) {
    const sm = splitmix64(BigInt(seed));
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
  }

  /** Raw 64-bit value. */
  nextU64(): bigint {
    const result = (rotl((this.s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (this.s1 << 17n) & MASK64;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 45n);
    return result;
  }

  /** Float in [0, 1) using the top 53 bits (IEEE-754 double precision). */
  nextFloat(): number {
    return Number(this.nextU64() >> 11n) / 9007199254740992; // 2^53
  }

  /** Integer in [min, max). */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.nextFloat() < p;
  }

  /** Pick one element deterministically. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error("cannot pick from an empty array");
    }
    return arr[this.nextInt(0, arr.length)]!;
  }

  /** Snapshot/restore for replay & node-restart determinism. */
  getState(): [bigint, bigint, bigint, bigint] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  setState(s: [bigint, bigint, bigint, bigint]): void {
    [this.s0, this.s1, this.s2, this.s3] = s;
  }
}
