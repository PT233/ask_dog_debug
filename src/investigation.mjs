import { assertReadOnlyCommand } from "./safety.mjs";
import { validateRobotRegistry } from "./routing.mjs";

const TRANSITIONS = new Map([
  ["New", new Set(["Running", "Rejected"])],
  ["Running", new Set(["ReproductionEstablished", "Rejected"])],
  [
    "ReproductionEstablished",
    new Set(["RootCauseProven", "Running", "Rejected"]),
  ],
  [
    "RootCauseProven",
    new Set(["AwaitingUserConfirmation", "Running", "Rejected"]),
  ],
  ["AwaitingUserConfirmation", new Set(["Closed", "Running", "Rejected"])],
  ["Closed", new Set()],
  ["Rejected", new Set()],
]);

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
}

function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value ?? {}).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} has unsupported properties: ${unknown.join(", ")}`);
  }
}

function assertEvidenceValidation(run) {
  const validation = run?.evidence_validation;
  if (
    !validation ||
    !Number.isInteger(validation.packet_count) ||
    validation.packet_count < 1 ||
    !Number.isInteger(validation.supporting_packet_count) ||
    validation.supporting_packet_count < 1 ||
    validation.supporting_packet_count > validation.packet_count ||
    typeof validation.validated_at !== "string" ||
    Number.isNaN(Date.parse(validation.validated_at)) ||
    !Array.isArray(validation.validated_refs) ||
    new Set(validation.validated_refs).size < 2 ||
    new Set(validation.validated_refs).size !== validation.validated_refs.length ||
    validation.validated_refs.some((ref) => typeof ref !== "string") ||
    !Array.isArray(run.evidence_refs) ||
    run.evidence_refs.some((ref) => !validation.validated_refs.includes(ref))
  ) {
    throw new Error("Investigation lacks validated EvidencePacket provenance");
  }
}

function deriveEvidenceValidation(run, evidencePackets, registry) {
  if (!registry || !Array.isArray(evidencePackets) || evidencePackets.length === 0) {
    throw new Error("validated EvidencePackets and registry context are required");
  }
  const validatedRefs = new Set();
  let supportingPacketCount = 0;
  for (const packet of evidencePackets) {
    validateEvidencePacket(packet, { run, registry });
    if (packet.verdict === "supports") supportingPacketCount += 1;
    for (const observation of packet.observations) {
      validatedRefs.add(observation.evidence_ref);
    }
  }
  if (supportingPacketCount === 0) {
    throw new Error("at least one supporting EvidencePacket is required");
  }
  for (const evidenceRef of run.evidence_refs ?? []) {
    if (!validatedRefs.has(evidenceRef)) {
      throw new Error(`unvalidated evidence reference: ${evidenceRef}`);
    }
  }
  return {
    packet_count: evidencePackets.length,
    supporting_packet_count: supportingPacketCount,
    validated_refs: [...validatedRefs].sort(),
  };
}

function assertRecordedEvidenceMatches(run, derived) {
  assertEvidenceValidation(run);
  const recorded = run.evidence_validation;
  if (
    recorded.packet_count !== derived.packet_count ||
    recorded.supporting_packet_count !== derived.supporting_packet_count ||
    recorded.validated_refs.length !== derived.validated_refs.length ||
    recorded.validated_refs.some((ref, index) => ref !== derived.validated_refs[index])
  ) {
    throw new Error("recorded EvidencePacket provenance does not match supplied packets");
  }
}

export function createInvestigation({
  runId,
  robotId,
  platform,
  knowledgeStatus,
  symptom,
  createdAt = new Date().toISOString(),
}) {
  requireText(runId, "runId");
  requireText(robotId, "robotId");
  requireText(symptom, "symptom");
  if (!["a2w", "m20"].includes(platform)) {
    throw new Error(`unsupported platform: ${platform}`);
  }
  return {
    schema_version: "1.0.0",
    run_id: runId,
    robot_id: robotId,
    platform,
    knowledge_status: knowledgeStatus,
    symptom,
    state: "New",
    created_at: createdAt,
    updated_at: createdAt,
    evidence_refs: [],
  };
}

export function transitionInvestigation(
  run,
  nextState,
  patch = {},
  { evidencePackets, registry } = {},
) {
  if (!TRANSITIONS.get(run.state)?.has(nextState)) {
    throw new Error(`illegal investigation transition: ${run.state} -> ${nextState}`);
  }

  const next = {
    ...structuredClone(run),
    ...structuredClone(patch),
    state: nextState,
    updated_at: patch.at ?? new Date().toISOString(),
  };
  delete next.at;

  if (nextState === "ReproductionEstablished") {
    requireText(next.reproduction, "reproduction");
  }
  if (nextState === "RootCauseProven") {
    if (next.knowledge_status !== "ready") {
      throw new Error("platform knowledge is not ready for RootCauseProven");
    }
    requireText(next.reproduction, "reproduction");
    requireText(next.root_cause, "root_cause");
    if (
      !Array.isArray(next.problem_chain) ||
      next.problem_chain.length < 2 ||
      next.problem_chain.some((stage) => typeof stage !== "string" || stage.trim() === "")
    ) {
      throw new Error("problem_chain requires at least two ordered stages");
    }
    if (
      !Array.isArray(next.evidence_refs) ||
      new Set(next.evidence_refs).size < 2 ||
      next.evidence_refs.some((ref) => typeof ref !== "string" || ref.trim() === "")
    ) {
      throw new Error("RootCauseProven requires at least two evidence references");
    }
    const derived = deriveEvidenceValidation(next, evidencePackets, registry);
    next.evidence_validation = {
      ...derived,
      validated_at: next.updated_at,
    };
  }
  if (nextState === "Closed") {
    if (next.user_confirmation !== "affirmed" || next.user_confirmed !== true) {
      throw new Error(
        'Closed requires user_confirmation: "affirmed" and user_confirmed: true',
      );
    }
    requireText(next.user_confirmation_note, "user_confirmation_note");
    assertEvidenceValidation(next);
  }
  if (nextState === "Rejected") {
    requireText(next.rejection_reason, "rejection_reason");
  }
  return next;
}

export function memoryDisposition(run) {
  if (run.state === "Closed") return "positive";
  if (run.state === "Rejected") return "negative";
  return "pending";
}

export function buildCaseCard(run, { evidencePackets, registry } = {}) {
  if (run.state !== "Closed") {
    throw new Error("a positive CaseCard requires a Closed investigation");
  }
  if (run.user_confirmation !== "affirmed" || run.user_confirmed !== true) {
    throw new Error("a positive CaseCard requires explicit user confirmation");
  }
  requireText(run.user_confirmation_note, "user_confirmation_note");
  requireText(run.root_cause, "root_cause");
  requireText(run.reproduction, "reproduction");
  const derived = deriveEvidenceValidation(run, evidencePackets, registry);
  assertRecordedEvidenceMatches(run, derived);
  return {
    schema_version: "1.0.0",
    case_id: run.run_id,
    robot_id: run.robot_id,
    platform: run.platform,
    symptom: run.symptom,
    root_cause: run.root_cause,
    reproduction: run.reproduction,
    problem_chain: structuredClone(run.problem_chain),
    evidence_refs: structuredClone(run.evidence_refs),
    evidence_validation: structuredClone(run.evidence_validation),
    user_confirmed: true,
    user_confirmation: "affirmed",
    user_confirmation_note: run.user_confirmation_note,
    closed_at: run.updated_at,
    applicability: run.applicability ?? "machine",
    fingerprints: structuredClone(run.fingerprints ?? {}),
    tags: structuredClone(run.tags ?? []),
  };
}

export function validateEvidencePacket(packet, { run, registry } = {}) {
  if (!run || !registry) {
    throw new Error("EvidencePacket validation requires Investigation and registry context");
  }
  rejectUnknownKeys(
    packet,
    new Set([
      "schema_version",
      "run_id",
      "robot_id",
      "platform",
      "scout_role",
      "hypothesis",
      "command",
      "observed_at",
      "observations",
      "verdict",
      "confidence",
      "missing_evidence",
      "next_probe",
    ]),
    "EvidencePacket",
  );
  if (packet?.schema_version !== "1.0.0") {
    throw new Error("EvidencePacket schema_version must be 1.0.0");
  }
  const requiredText = [
    "run_id",
    "robot_id",
    "platform",
    "scout_role",
    "hypothesis",
    "observed_at",
    "verdict",
    "next_probe",
  ];
  for (const field of requiredText) requireText(packet?.[field], field);
  if (!["a2w", "m20"].includes(packet.platform)) {
    throw new Error(`unsupported EvidencePacket platform: ${packet.platform}`);
  }
  if (!new Set(["ros", "runtime", "network", "drift", "hardware"]).has(packet.scout_role)) {
    throw new Error(`unsupported EvidencePacket scout_role: ${packet.scout_role}`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      packet.observed_at,
    ) ||
    Number.isNaN(Date.parse(packet.observed_at))
  ) {
    throw new Error("EvidencePacket observed_at must be an ISO date-time");
  }
  if (!["supports", "refutes", "inconclusive"].includes(packet.verdict)) {
    throw new Error(`unsupported EvidencePacket verdict: ${packet.verdict}`);
  }
  if (
    typeof packet.confidence !== "number" ||
    packet.confidence < 0 ||
    packet.confidence > 1
  ) {
    throw new Error("EvidencePacket confidence must be between 0 and 1");
  }
  if (!Array.isArray(packet.observations) || packet.observations.length === 0) {
    throw new Error("EvidencePacket requires observations");
  }
  for (const observation of packet.observations) {
    rejectUnknownKeys(
      observation,
      new Set(["summary", "evidence_ref"]),
      "EvidencePacket observation",
    );
    requireText(observation.summary, "observation.summary");
    requireText(observation.evidence_ref, "observation.evidence_ref");
  }
  if (
    !Array.isArray(packet.missing_evidence) ||
    packet.missing_evidence.some((item) => typeof item !== "string")
  ) {
    throw new Error("EvidencePacket missing_evidence must be a string array");
  }
  if (
    !Array.isArray(packet.command) ||
    packet.command.length === 0 ||
    packet.command.some((item) => typeof item !== "string")
  ) {
    throw new Error("EvidencePacket command must be a non-empty string array");
  }
  if (
    packet.run_id !== run.run_id ||
    packet.robot_id !== run.robot_id ||
    packet.platform !== run.platform
  ) {
    throw new Error("EvidencePacket does not match the Investigation identity");
  }
  validateRobotRegistry(registry);
  const robot = registry.robots.find((candidate) => candidate.robot_id === packet.robot_id);
  if (!robot || robot.platform !== packet.platform) {
    throw new Error("EvidencePacket does not match the robot registry");
  }
  assertReadOnlyCommand(packet.command);
  return packet;
}

export const investigationStates = Object.freeze([...TRANSITIONS.keys()]);
