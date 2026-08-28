import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { persistMemoryRecord } from "../src/wiki.mjs";

const closedRun = {
  schema_version: "1.0.0",
  run_id: "20260829T120000Z-004-a1b2c3d4",
  robot_id: "004",
  platform: "a2w",
  knowledge_status: "ready",
  state: "Closed",
  symptom: "camera chain becomes stale",
  reproduction: "topic rate falls below 5 Hz",
  root_cause: "NX callback queue saturation",
  problem_chain: ["/camera", "/perception", "/planner"],
  evidence_refs: ["runs/r1/topic-hz.json", "runs/r1/planner-age.json"],
  evidence_validation: {
    packet_count: 2,
    supporting_packet_count: 1,
    validated_at: "2026-08-29T12:09:00Z",
    validated_refs: ["runs/r1/planner-age.json", "runs/r1/topic-hz.json"],
  },
  user_confirmed: true,
  user_confirmation: "affirmed",
  user_confirmation_note: "operator confirmed the chain",
  updated_at: "2026-08-29T12:10:00Z",
  applicability: "machine",
};

const registry = {
  schema_version: "1.0.0",
  identity_source: "/etc/dsh-agent/robot-id",
  robots: [
    {
      robot_id: "004",
      platform: "a2w",
      knowledge_status: "ready",
      boards: [],
    },
  ],
  platform_templates: {},
};

const evidencePackets = [
  {
    schema_version: "1.0.0",
    run_id: closedRun.run_id,
    robot_id: closedRun.robot_id,
    platform: closedRun.platform,
    scout_role: "ros",
    hypothesis: "camera rate is low",
    command: ["ros2", "topic", "echo", "/camera", "--once"],
    observed_at: "2026-08-29T12:01:00Z",
    observations: [
      { summary: "camera sample is stale", evidence_ref: closedRun.evidence_refs[0] },
    ],
    verdict: "supports",
    confidence: 0.9,
    missing_evidence: [],
    next_probe: "inspect planner age",
  },
  {
    schema_version: "1.0.0",
    run_id: closedRun.run_id,
    robot_id: closedRun.robot_id,
    platform: closedRun.platform,
    scout_role: "runtime",
    hypothesis: "planner receives stale input",
    command: ["journalctl", "-u", "planner.service", "--since", "-5m"],
    observed_at: "2026-08-29T12:02:00Z",
    observations: [
      { summary: "planner age is high", evidence_ref: closedRun.evidence_refs[1] },
    ],
    verdict: "refutes",
    confidence: 0.8,
    missing_evidence: [],
    next_probe: "return evidence to the main agent",
  },
];

const positiveContext = { evidencePackets, registry };

test("a Closed investigation creates a readable case and deterministic index", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    const result = await persistMemoryRecord({
      wikiRoot: root,
      run: closedRun,
      ...positiveContext,
    });
    const json = JSON.parse(await readFile(result.jsonPath, "utf8"));
    const markdown = await readFile(result.markdownPath, "utf8");
    const index = JSON.parse(
      await readFile(path.join(root, "indexes", "cases.json"), "utf8"),
    );

    assert.equal(json.root_cause, "NX callback queue saturation");
    assert.match(markdown, /# camera chain becomes stale/);
    assert.match(markdown, /NX callback queue saturation/);
    assert.deepEqual(index.entries.map((entry) => entry.case_id), [closedRun.run_id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unfinished investigation cannot enter positive memory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    await assert.rejects(
      persistMemoryRecord({
        wikiRoot: root,
        run: { ...closedRun, state: "RootCauseProven" },
      }),
      /not eligible for memory/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a fabricated Closed state without evidence provenance cannot enter memory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    const { evidence_validation: ignored, ...fabricated } = closedRun;
    void ignored;
    await assert.rejects(
      persistMemoryRecord({ wikiRoot: root, run: fabricated, ...positiveContext }),
      /validated EvidencePacket provenance/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform promotion requires interface and deployment fingerprints", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    await assert.rejects(
      persistMemoryRecord({
        wikiRoot: root,
        run: { ...closedRun, applicability: "platform", fingerprints: {} },
        ...positiveContext,
      }),
      /fingerprints/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("self-reported Closed provenance is revalidated from EvidencePackets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    await assert.rejects(
      persistMemoryRecord({ wikiRoot: root, run: closedRun }),
      /EvidencePackets and registry context/i,
    );
    await assert.rejects(
      persistMemoryRecord({
        wikiRoot: root,
        run: {
          ...closedRun,
          evidence_validation: {
            ...closedRun.evidence_validation,
            packet_count: 99,
          },
        },
        ...positiveContext,
      }),
      /provenance does not match/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a Rejected investigation is stored only as a negative route", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ask-dog-wiki-"));
  try {
    const result = await persistMemoryRecord({
      wikiRoot: root,
      run: {
        ...closedRun,
        state: "Rejected",
        rejection_reason: "QoS hypothesis disproved by compatible endpoints",
      },
    });
    const record = JSON.parse(await readFile(result.jsonPath, "utf8"));

    assert.equal(result.disposition, "negative");
    assert.equal(record.rejection_reason, "QoS hypothesis disproved by compatible endpoints");
    await assert.rejects(
      readFile(path.join(root, "indexes", "cases.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
