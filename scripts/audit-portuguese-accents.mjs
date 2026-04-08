#!/usr/bin/env node

import { formatFindingsReport, scanProject } from "./portuguese-accent-audit-core.mjs";

const args = new Set(process.argv.slice(2));
const fix = args.has("--fix");

const result = scanProject({ fix });

console.log(formatFindingsReport(result));

if (!fix && result.findings.length > 0) {
  process.exitCode = 1;
}
