import type { Failure, MultiAssertOptions } from "./types";

const red = (s: string) => `\u001b[31m${s}\u001b[39m`;
const dim = (s: string) => `\u001b[2m${s}\u001b[22m`;

export function shouldUseColor(color: MultiAssertOptions["color"]): boolean {
  if (color === true || color === false) return color;
  if (typeof process === "undefined") return false;
  const env = process.env ?? {};
  return Boolean(process.stdout?.isTTY) && !env.NO_COLOR && !env.CI;
}

export function summaryLine(failed: number, total: number, heading?: string): string {
  const noun = total === 1 ? "assertion" : "assertions";
  return `${failed} of ${total} ${noun} failed${heading ? ` (${heading})` : ""}`;
}

const INDENT = "       ";

export interface FormatOptions {
  heading?: string;
  color: boolean;
  stackFrames: number;
  frames: Map<Failure, string[]>;
}

export function formatFailures(failures: Failure[], total: number, options: FormatOptions): string {
  const paint = (fn: (s: string) => string, s: string) => (options.color ? fn(s) : s);
  const blocks = failures.map((failure) => {
    const lines = failure.message.split("\n");
    const title = failure.label ?? lines.shift() ?? "";
    const out = [`  ${paint(red, "✕")} ${failure.index}) ${title}`];
    for (const line of lines) out.push(line ? `${INDENT}${line}` : "");
    const frames = (options.frames.get(failure) ?? []).slice(0, options.stackFrames);
    for (const frame of frames) out.push(paint(dim, `${INDENT}at ${frame}`));
    return out.join("\n");
  });
  return `${summaryLine(failures.length, total, options.heading)}\n\n${blocks.join("\n\n")}`;
}
