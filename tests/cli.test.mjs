import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "ask-dog.mjs");

test("route CLI emits a platform-isolated dispatch plan", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "route", "--robot", "004", "--symptom", "跨板 topic 丢帧", "--offline"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const route = JSON.parse(result.stdout);
  assert.equal(route.platform, "a2w");
  assert.equal(route.identityStatus, "registry-only");
  assert.ok(route.scouts.every((skill) => skill.startsWith("neowa-a2w-")));
});

test("search-cases CLI reads the Git-native indexes", () => {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "search-cases",
      "--robot",
      "004",
      "--platform",
      "a2w",
      "--symptom",
      "camera stale",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { cases: [], negative_routes: [] });
});

test("validate-evidence CLI binds a packet to its Investigation", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ask-dog-evidence-cli-"));
  try {
    const investigation = path.join(temp, "investigation.json");
    const packet = path.join(temp, "packet.json");
    await writeFile(
      investigation,
      JSON.stringify({ run_id: "run-cli", robot_id: "004", platform: "a2w" }),
      "utf8",
    );
    await writeFile(
      packet,
      JSON.stringify({
        schema_version: "1.0.0",
        run_id: "run-cli",
        robot_id: "004",
        platform: "a2w",
        scout_role: "ros",
        hypothesis: "publisher stalls",
        command: ["ros2", "topic", "echo", "/scan", "--once"],
        observed_at: "2026-08-29T00:00:00.000Z",
        observations: [
          { summary: "one message arrived", evidence_ref: "evidence/scan.txt" },
        ],
        verdict: "inconclusive",
        confidence: 0.5,
        missing_evidence: ["rate window"],
        next_probe: "measure topic rate",
      }),
      "utf8",
    );
    const result = spawnSync(
      process.execPath,
      [cli, "validate-evidence", "--input", packet, "--investigation", investigation],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { valid: true, run_id: "run-cli" });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("render-incident CLI writes a self-contained HTML page", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ask-dog-cli-"));
  try {
    const input = path.join(temp, "incident-view.json");
    const output = path.join(temp, "incident-view.html");
    await writeFile(
      input,
      JSON.stringify({
        schema_version: "1.0.0",
        run_id: "r1",
        robot_id: "004",
        platform: "a2w",
        platform_knowledge_status: "ready",
        investigation_state: "RootCauseProven",
        symptom: "planner receives stale input",
        root_cause: "publisher stalls",
        root_entity_id: "node:/source",
        impact_entity_id: "node:/sink",
        entities: [
          { id: "node:/source", kind: "node", label: "/source", board: "004-nx", chain_ids: ["c1"] },
          { id: "node:/sink", kind: "node", label: "/sink", board: "004-i7", chain_ids: ["c1"] }
        ],
        relations: [
          { id: "r1", from: "node:/source", to: "node:/sink", kind: "feeds", chain_ids: ["c1"] }
        ],
        stages: [
          { id: "s1", name: "Source", board: "004-nx", input: "device", output: "message", checkpoint: "rate", status: "root-cause", entity_ids: ["node:/source"], chain_ids: ["c1"], evidence_refs: ["e1"] },
          { id: "s2", name: "Sink", board: "004-i7", input: "message", output: "decision", checkpoint: "age", status: "impacted", entity_ids: ["node:/sink"], chain_ids: ["c1"], evidence_refs: ["e2"] }
        ],
        chains: [{ id: "c1", label: "Source to sink", stage_ids: ["s1", "s2"] }],
        evidence_refs: ["e1", "e2"]
      }),
      "utf8",
    );
    const result = spawnSync(
      process.execPath,
      [cli, "render-incident", "--input", input, "--output", output],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const html = await readFile(output, "utf8");
    assert.match(html, /planner receives stale input/);
    assert.match(html, /Content-Security-Policy/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
