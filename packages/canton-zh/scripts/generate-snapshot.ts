import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSnapshotLines } from "../src/snapshot";

const target = fileURLToPath(new URL("../fixtures/behavior-snapshot.jsonl", import.meta.url));
const lines = buildSnapshotLines();
writeFileSync(target, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${lines.length - 1} cases to fixtures/behavior-snapshot.jsonl`);
