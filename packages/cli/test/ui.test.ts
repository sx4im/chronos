// Tests for the pure CLI UI primitives (ui.ts): color painting, ANSI stripping,
// banner, and box drawing. All string-in/string-out — no terminal interaction.

import { describe, it, expect } from "vitest";
import {
  C,
  renderTopBanner,
  drawBox,
  stripAnsi,
  selectPrompt,
} from "../src/ui.js";

describe("stripAnsi", () => {
  it("removes SGR color sequences", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
    expect(stripAnsi("\x1b[38;2;99;102;241mindigo\x1b[0m")).toBe("indigo");
    expect(stripAnsi("\x1b[1mbold\x1b[0m text")).toBe("bold text");
  });

  it("removes OSC sequences", () => {
    expect(stripAnsi("\x1b]8;;http://x\x07link\x1b]8;;\x07")).toBe("link");
  });

  it("leaves plain text untouched", () => {
    expect(stripAnsi("plain │ box ╭─╮")).toBe("plain │ box ╭─╮");
  });
});

describe("C palette", () => {
  it("wraps text in SGR sequences when color is on", () => {
    const prevNoColor = process.env.NO_COLOR;
    const prevForce = process.env.FORCE_COLOR;
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";
    try {
      expect(C.bold("hi")).toBe("\x1b[1mhi\x1b[0m");
      expect(C.indigo("x")).toContain("[38;2;99;102;241m");
      // Badges pad with spaces and combine bg + fg + bold.
      expect(C.badgeEmerald(" OK ")).toBe(
        "\x1b[48;2;16;185;129m\x1b[38;2;255;255;255m\x1b[1m  OK  \x1b[0m",
      );
    } finally {
      if (prevNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prevNoColor;
      if (prevForce === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = prevForce;
    }
  });

  it("emits clean text when NO_COLOR is set", () => {
    const prevNoColor = process.env.NO_COLOR;
    const prevForce = process.env.FORCE_COLOR;
    process.env.NO_COLOR = "1";
    delete process.env.FORCE_COLOR;
    try {
      expect(C.rose("err")).toBe("err");
      // Badges still pad (layout), just without ANSI codes.
      expect(C.badgeRose(" FAIL ")).toBe("  FAIL  ");
    } finally {
      if (prevNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prevNoColor;
      if (prevForce !== undefined) process.env.FORCE_COLOR = prevForce;
    }
  });
});

describe("renderTopBanner", () => {
  it("includes the badge, tagline, version, and tip", () => {
    const out = stripAnsi(renderTopBanner("9.9.9"));
    expect(out).toContain("CHRONOS CLI");
    expect(out).toContain("Deterministic Simulation Tooling");
    expect(out).toContain("v9.9.9");
    expect(out).toContain("--help");
  });
});

describe("drawBox", () => {
  it("draws a bordered box with title, body lines, and even padding", () => {
    const out = stripAnsi(drawBox("TITLE", ["alpha", "beta"]));
    const lines = out.split("\n");
    expect(lines).toHaveLength(4); // top + 2 body + bottom
    expect(lines[0]).toMatch(/^╭─ TITLE ─+─╮$/);
    expect(lines[lines.length - 1]).toMatch(/^╰──+─╯$/);
    expect(lines[1]).toContain("│ alpha");
    expect(lines[2]).toContain("│ beta");
    // Every visual line has the same display width (padding compensates).
    const widths = lines.map((l) => l.length);
    expect(new Set(widths).size).toBe(1);
  });

  it("enforces the minimum inner width for short content", () => {
    const out = stripAnsi(drawBox("T", ["a"]));
    const width = out.split("\n")[0]!.length;
    expect(width).toBeGreaterThanOrEqual(48);
  });

  it("survives content wider than the minimum (box grows)", () => {
    const long = "x".repeat(120);
    const out = drawBox("T", [long]);
    expect(stripAnsi(out)).toContain(long);
    const widths = out.split("\n").map((l) => stripAnsi(l).length);
    expect(new Set(widths).size).toBe(1);
  });

  it("handles an empty body", () => {
    const out = stripAnsi(drawBox("ONLY", []));
    expect(out.split("\n")).toHaveLength(2); // top + bottom
  });
});

describe("selectPrompt (non-TTY)", () => {
  it("resolves immediately with the initial option's value", async () => {
    const value = await selectPrompt("pick", [
      { label: "one", value: 1 },
      { label: "two", value: 2 },
    ]);
    expect(value).toBe(1);

    const second = await selectPrompt(
      "pick",
      [
        { label: "one", value: "a" },
        { label: "two", value: "b" },
      ],
      1,
    );
    expect(second).toBe("b");
  });
});

// --- TTY-driven prompt tests -------------------------------------------------
// The interactive branches (selectPrompt's numbered menu, inputPrompt,
// secretPrompt) only run when stdin is a TTY. We fake the TTY, drive the
// prompts through a scripted stdin, and capture stdout to assert on.

import { PassThrough } from "node:stream";
import { inputPrompt, secretPrompt } from "../src/ui.js";

interface TtyHandle {
  stdin: PassThrough;
  out: () => string;
  restore: () => void;
}

/** Swap process.stdin/stdout for a fake TTY pair; returns a scriptable stdin
 *  and a stdout tap. Restoring is mandatory (finally). */
function fakeTty(): TtyHandle {
  const stdin = new PassThrough() as PassThrough & { isTTY: boolean };
  stdin.isTTY = true;
  const chunks: string[] = [];
  const stdout = new PassThrough();
  stdout.on("data", (c: Buffer) => chunks.push(c.toString("utf8")));
  (stdout as unknown as { isTTY: boolean }).isTTY = true;

  const realIn = process.stdin;
  const realOut = process.stdout;
  Object.defineProperty(process, "stdin", { value: stdin, configurable: true });
  Object.defineProperty(process, "stdout", { value: stdout, configurable: true });

  return {
    stdin,
    out: () => chunks.join(""),
    restore: () => {
      Object.defineProperty(process, "stdin", { value: realIn, configurable: true });
      Object.defineProperty(process, "stdout", { value: realOut, configurable: true });
    },
  };
}

describe("selectPrompt (TTY)", () => {
  it("accepts a valid number and confirms the selection", async () => {
    const tty = fakeTty();
    try {
      const p = selectPrompt("pick", [
        { label: "one", value: 1 },
        { label: "two", value: 2 },
      ]);
      // Wait for the menu + question to be written before answering.
      await new Promise<void>((r) => {
        const tick = (): void => {
          if (tty.out().includes("(default 1):")) r();
          else setTimeout(tick, 5);
        };
        tick();
      });
      tty.stdin.write("2\n");
      await expect(p).resolves.toBe(2);
      expect(tty.out()).toContain("✔");
      expect(tty.out()).toContain("two");
    } finally {
      tty.restore();
    }
  }, 5000);

  it("re-asks after an invalid answer, then takes a good one", async () => {
    const tty = fakeTty();
    try {
      const p = selectPrompt("pick", [
        { label: "alpha", value: "a" },
        { label: "beta", value: "b" },
      ]);
      // First answer garbage; readline hands it straight to the handler.
      tty.stdin.write("99\n");
      await new Promise<void>((r) => {
        const tick = (): void => {
          if (tty.out().includes("Invalid selection")) r();
          else setTimeout(tick, 5);
        };
        tick();
      });
      tty.stdin.write("1\n");
      await expect(p).resolves.toBe("a");
      expect(tty.out()).toContain("Invalid selection");
    } finally {
      tty.restore();
    }
  }, 5000);
});

describe("inputPrompt / secretPrompt (TTY)", () => {
  it("inputPrompt echoes the answer and honors an empty default fallback", async () => {
    const tty = fakeTty();
    try {
      const p = inputPrompt("model id", "gpt-default");
      tty.stdin.write("\n"); // empty → default
      await expect(p).resolves.toBe("gpt-default");

      const q = inputPrompt("model id", "gpt-default");
      tty.stdin.write("my-model\n");
      await expect(q).resolves.toBe("my-model");
      expect(tty.out()).toContain("[Entered]");
    } finally {
      tty.restore();
    }
  }, 5000);

  it("secretPrompt masks the echo — typed characters never appear in output", async () => {
    const tty = fakeTty();
    try {
      const p = secretPrompt("API key");
      tty.stdin.write("hunter2secret\n");
      const val = await p;
      expect(val).toBe("hunter2secret");
      const visible = tty.out();
      expect(visible).not.toContain("hunter2secret");
      expect(visible).toContain("***");
      expect(visible).toContain("[13 chars, hidden]");
    } finally {
      tty.restore();
    }
  }, 5000);

  it("secretPrompt reports [Skipped] for an empty answer", async () => {
    const tty = fakeTty();
    try {
      const p = secretPrompt("API key");
      tty.stdin.write("\n");
      await expect(p).resolves.toBe("");
      expect(tty.out()).toContain("[Skipped]");
    } finally {
      tty.restore();
    }
  }, 5000);
});
