#!/usr/bin/env node
/**
 * Raw-color ratchet (UX redesign Phase 5).
 *
 * CLAUDE.md mandates semantic design tokens (bg-primary, text-warning, …) —
 * raw Tailwind palette classes (bg-green-500, text-amber-600) and raw
 * white/black drift the design system and broke dark-mode plans once already.
 *
 * Two zones:
 *  - STRICT (zero tolerance): the app shell — new chrome must be tokenized.
 *  - RATCHET (may only go DOWN): everything else in src/. Lower the baseline
 *    whenever you migrate a file; never raise it.
 *
 * Run: node scripts/check-raw-colors.mjs   (wired into CI as `npm run check:colors`)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

const STRICT_DIRS = [join(SRC, "components", "shell")];

/** Count must not exceed this. Lower it as files get migrated. */
const RATCHET_BASELINE = 1572;

const PALETTE =
  "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)";
const RAW_COLOR_RE = new RegExp(
  `\\b(?:bg|text|border|from|to|via|ring|stroke|fill|divide|outline|decoration)-${PALETTE}-\\d{2,3}(?:\\/\\d{1,3})?\\b` +
    `|\\b(?:bg|text)-(?:white|black)(?:\\/\\d{1,3})?\\b`,
  "g",
);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.(tsx|ts)$/.test(entry)) yield full;
  }
}

let total = 0;
let strictViolations = [];
for (const file of walk(SRC)) {
  const matches = readFileSync(file, "utf8").match(RAW_COLOR_RE);
  if (!matches) continue;
  total += matches.length;
  if (STRICT_DIRS.some((d) => file.startsWith(d))) {
    strictViolations.push(`${relative(ROOT, file)}: ${[...new Set(matches)].join(", ")}`);
  }
}

let failed = false;

if (strictViolations.length > 0) {
  failed = true;
  console.error("✖ Raw palette colors in the app shell (must use semantic tokens):");
  for (const v of strictViolations) console.error(`  ${v}`);
}

if (total > RATCHET_BASELINE) {
  failed = true;
  console.error(
    `✖ Raw color usages in src/ went UP: ${total} > baseline ${RATCHET_BASELINE}.` +
      ` Use semantic tokens (success/warning/info/heat/breeding, stage tones) instead.`,
  );
} else if (total < RATCHET_BASELINE - 25) {
  console.log(
    `ℹ Raw color count is ${total} — nice, lower RATCHET_BASELINE in scripts/check-raw-colors.mjs to lock it in.`,
  );
}

if (!failed) {
  console.log(`✓ check-raw-colors: shell clean, src/ total ${total} ≤ baseline ${RATCHET_BASELINE}`);
}
process.exit(failed ? 1 : 0);
