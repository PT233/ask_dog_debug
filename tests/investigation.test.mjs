import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaseCard,
  createInvestigation,
  memoryDisposition,
  transitionInvestigation,
  validateEvidencePacket,
} from "../src/investigation.mjs";

const proof = {
  reproduction: "topic rate falls below 5 Hz during the observed window",
  root_cause: "publisher callback is starved after the NX queue saturates",
  problem_chain: ["/camera", "/perception", "/planner"],
  evidence_refs: ["runs/r1/nx/topic-hz.json", "runs/r1/i7/planner-age.json"],
};

const evidenceRegistry = {
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

function evidenceContext(packet) {
  return {
    run: {
      run_id: packet.run_id,
      robot_id: packet.robot_id,
      platform: packet.platform,
    },
    registry: evidenceRegistry,
  };
}

function proofEvidencePackets(run) {
  return [
    {
      schema_version: "1.0.0",
      run_id: run.run_id,
      robot_id: run.robot_id,
      platform: run.platform,
      scout_role: "ros",
      hypothesis: "publisher callback is starved",
      command: ["ros2", "topic", "echo", "/camera", "--once"],
      observed_at: "2026-08-29T12:01:00Z",
      observations: [
        { summary: "camera message is stale", evidence_ref: proof.evidence_refs[0] },
      ],
      verdict: "supports",
      confidence: 0.9,
      missing_evidence: [],
      next_probe: "correlate planner input age",
    },
    {
      schema_version: "1.0.0",
      run_id: run.run_id,
      robot_id: run.robot_id,
      platform: run.platform,
      scout_role: "runtime",
      hypothesis: "planner receives stale input",
      command: ["journalctl", "-u", "planner.service", "--since", "-5m"],
      observed_at: "2026-08-29T12:02:00Z",
      observations: [
        { summary: "planner input age crosses threshold", evidence_ref: proof.evidence_refs[1] },
      ],
      verdict: "supports",
      confidence: 0.9,
      missing_evidence: [],
      next_probe: "return the evidence chain to the main agent",
    },
  ];
}

test("an investigation reaches Closed only through the evidence gates", () => {
  let run = createInvestigation({
    runId: "20260829T120000Z-004-a1b2c3d4",
    robotId: "004",
    platform: "a2w",
    knowledgeStatus: "ready",
    symptom: "camera chain becomes stale",
    createdAt: "2026-08-29T12:00:00Z",
  });

  run = transitionInvestigation(run, "Running");
  run = transitionInvestigation(run, "ReproductionEstablished", {
    reproduction: proof.reproduction,
  });
  const evidencePackets = proofEvidencePackets(run);
  run = transitionInvestigation(run, "RootCauseProven", proof, {
    evidencePackets,
    registry: evidenceRegistry,
  });
  assert.equal(run.evidence_validation.packet_count, 2);
  run = transitionInvestigation(run, "AwaitingUserConfirmation");
  assert.throws(
    () =>
      transitionInvestigation(run, "Closed", {
        user_confirmation: "no",
        user_confirmation_note: "operator said no",
        user_confirmed: true,
      }),
    /user_confirmation: "affirmed"/i,
  );
  run = transitionInvestigation(run, "Closed", {
    user_confirmation: "affirmed",
    user_confirmation_note: "operator confirmed the chain",
    user_confirmed: true,
  });

  assert.equal(run.state, "Closed");
  assert.equal(memoryDisposition(run), "positive");
  assert.equal(
    buildCaseCard(run, { evidencePackets, registry: evidenceRegistry }).root_cause,
    proof.root_cause,
  );
});

test("skipping the evidence gate is rejected", () => {
  const run = createInvestigation({
    runId: "20260829T120001Z-004-a1b2c3d5",
    robotId: "004",
    platform: "a2w",
    knowledgeStatus: "ready",
    symptom: "process exited",
    createdAt: "2026-08-29T12:00:01Z",
  });

  assert.throws(
    () => transitionInvestigation(run, "Closed", { user_confirmation: "yes" }),
    /illegal investigation transition/i,
  );
});

test("M20 NotReady cannot claim RootCauseProven", () => {
  let run = createInvestigation({
    runId: "20260829T120002Z-m20-lab-001-a1b2c3d6",
    robotId: "m20-lab-001",
    platform: "m20",
    knowledgeStatus: "not-ready",
    symptom: "localization fails",
    createdAt: "2026-08-29T12:00:02Z",
  });
  run = transitionInvestigation(run, "Running");
  run = transitionInvestigation(run, "ReproductionEstablished", {
    reproduction: proof.reproduction,
  });

  assert.throws(
    () => transitionInvestigation(run, "RootCauseProven", proof),
    /platform knowledge is not ready/i,
  );
});

test("RootCauseProven rejects fabricated or unbound evidence references", () => {
  let run = createInvestigation({
    runId: "20260829T120004Z-004-a1b2c3d8",
    robotId: "004",
    platform: "a2w",
    knowledgeStatus: "ready",
    symptom: "camera chain becomes stale",
    createdAt: "2026-08-29T12:00:04Z",
  });
  run = transitionInvestigation(run, "Running");
  run = transitionInvestigation(run, "ReproductionEstablished", {
    reproduction: proof.reproduction,
  });

  assert.throws(
    () => transitionInvestigation(run, "RootCauseProven", proof),
    /validated EvidencePackets and registry/i,
  );
  assert.throws(
    () =>
      transitionInvestigation(
        run,
        "RootCauseProven",
        { ...proof, evidence_refs: ["invented-1", "invented-2"] },
        { evidencePackets: proofEvidencePackets(run), registry: evidenceRegistry },
      ),
    /unvalidated evidence reference/i,
  );
  assert.throws(
    () =>
      transitionInvestigation(run, "RootCauseProven", proof, {
        evidencePackets: proofEvidencePackets(run).map((packet) => ({
          ...packet,
          verdict: "refutes",
        })),
        registry: evidenceRegistry,
      }),
    /supporting EvidencePacket/i,
  );
});

test("a rejected investigation becomes negative memory", () => {
  let run = createInvestigation({
    runId: "20260829T120003Z-004-a1b2c3d7",
    robotId: "004",
    platform: "a2w",
    knowledgeStatus: "ready",
    symptom: "intermittent packet loss",
    createdAt: "2026-08-29T12:00:03Z",
  });
  run = transitionInvestigation(run, "Running");
  run = transitionInvestigation(run, "Rejected", {
    rejection_reason: "operator disproved the proposed path",
  });

  assert.equal(memoryDisposition(run), "negative");
  assert.throws(() => buildCaseCard(run), /closed investigation/i);
});

test("EvidencePacket accepts read-only observations and rejects ROS mutation", () => {
  const packet = {
    schema_version: "1.0.0",
    run_id: "20260829T120000Z-004-a1b2c3d4",
    robot_id: "004",
    platform: "a2w",
    scout_role: "ros",
    hypothesis: "publisher rate is below its baseline",
    command: ["timeout", "15s", "ros2", "topic", "hz", "/camera/image_raw"],
    observed_at: "2026-08-29T12:01:00Z",
    observations: [
      {
        summary: "measured 3.2 Hz",
        evidence_ref: "runs/r1/nx/topic-hz.json",
      },
    ],
    verdict: "supports",
    confidence: 0.9,
    missing_evidence: [],
    next_probe: "return the packet to the main agent",
  };

  assert.equal(validateEvidencePacket(packet, evidenceContext(packet)), packet);
  assert.throws(
    () =>
      validateEvidencePacket({
        ...packet,
        command: ["ros2", "topic", "pub", "/cmd_vel", "geometry_msgs/Twist"],
      }, evidenceContext(packet)),
    /read-only boundary/i,
  );
  assert.throws(
    () => validateEvidencePacket(packet),
    /requires Investigation and registry context/i,
  );
});

test("EvidencePacket enforces its schema and Investigation identity", () => {
  const packet = {
    schema_version: "1.0.0",
    run_id: "r1",
    robot_id: "004",
    platform: "a2w",
    scout_role: "runtime",
    hypothesis: "process was OOM killed",
    command: ["journalctl", "-u", "camera.service", "--since", "-5m"],
    observed_at: "2026-08-29T12:01:00Z",
    observations: [{ summary: "no OOM kill", evidence_ref: "runs/r1/journal.txt" }],
    verdict: "refutes",
    confidence: 0.8,
    missing_evidence: [],
    next_probe: "inspect callback progress",
  };
  const run = { run_id: "r1", robot_id: "004", platform: "a2w" };

  assert.equal(validateEvidencePacket(packet, { run, registry: evidenceRegistry }), packet);
  assert.throws(
    () => validateEvidencePacket(
      { ...packet, schema_version: "0.1.0" },
      { run, registry: evidenceRegistry },
    ),
    /schema_version/i,
  );
  assert.throws(
    () => validateEvidencePacket(
      { ...packet, run_id: "other" },
      { run, registry: evidenceRegistry },
    ),
    /Investigation identity/i,
  );
  const { next_probe: ignored, ...withoutNextProbe } = packet;
  void ignored;
  assert.throws(
    () => validateEvidencePacket(withoutNextProbe, { run, registry: evidenceRegistry }),
    /next_probe/i,
  );
  assert.throws(
    () => validateEvidencePacket(
      { ...packet, unexpected: true },
      { run, registry: evidenceRegistry },
    ),
    /unsupported properties/i,
  );
  assert.throws(
    () => validateEvidencePacket(
      { ...packet, command: [42] },
      { run, registry: evidenceRegistry },
    ),
    /non-empty string array/i,
  );
});
