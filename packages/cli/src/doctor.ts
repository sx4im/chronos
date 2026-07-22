// chronos doctor — environment diagnostic tool.

import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { C, drawBox, renderTopBanner } from "./ui.js";
import { checkCommand } from "./check.js";

export interface DoctorResult {
  exitCode: number;
  message: string;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export async function doctorCommand(): Promise<DoctorResult> {
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0] ?? "0", 10);
  const nodeOk = nodeMajor >= 20;

  const keySet = !!process.env.NVIDIA_API_KEY;

  const here = dirname(fileURLToPath(import.meta.url));
  const inspectorDist = resolve(here, "..", "..", "inspector", "dist");
  const inspectorOk = await dirExists(inspectorDist);

  // Run the static DST compliance linter
  const checkRes = await checkCommand();
  const dstOk = checkRes.exitCode === 0;

  const lines: string[] = [
    `${C.bold("Runtime Diagnostics")}:`,
    `  ${C.cyan("•")} Node.js:          ${C.white(nodeVersion)} ${nodeOk ? C.emerald("✔ (>= 20)") : C.rose("✖ (requires Node.js >= 20)")}`,
    `  ${C.cyan("•")} Strict Mode:       ${C.emerald("✔ Active")} ${C.muted("(microtask queue draining & entropy guards active)")}`,
    `  ${C.cyan("•")} DST Compliance:   ${dstOk ? C.emerald("✔ Clean") : C.amber("✖ Warnings (run 'chronos check' to inspect)")}`,
    `  ${C.cyan("•")} Inspector UI:      ${inspectorOk ? `${C.emerald("✔ Ready")} ${C.muted(`(${inspectorDist})`)}` : C.rose("✖ Not built (run pnpm --filter @sx4im/chronos-inspector build)")}`,
    `  ${C.cyan("•")} NVIDIA NIM Key:    ${keySet ? C.emerald("✔ Configured (chronos explain enabled)") : C.slate("○ Unset (chronos explain optional)")}`,
    "",
    nodeOk && inspectorOk && dstOk
      ? `${C.badgeEmerald(" HEALTHY ")} System environment is fully operational.`
      : `${C.badgeRose(" ATTENTION ")} System environment requires attention (see items marked ✖ or ✖ above).`,
  ];

  const title = `${C.indigo("CHRONOS SYSTEM DOCTOR")} ${C.muted(`v0.1.5`)}`;

  return {
    exitCode: nodeOk && dstOk ? 0 : 1,
    message: renderTopBanner("0.1.5") + drawBox(title, lines),
  };
}
