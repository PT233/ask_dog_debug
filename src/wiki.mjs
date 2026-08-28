import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCaseCard,
  memoryDisposition,
} from "./investigation.mjs";

function safeSegment(value, label) {
  const text = String(value ?? "");
  if (!/^[a-zA-Z0-9._-]+$/.test(text)) {
    throw new Error(`${label} is not a safe path segment`);
  }
  return text;
}

async function writeAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, filePath);
}

async function readIndex(filePath, kind) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return { schema_version: "1.0.0", kind, entries: [] };
    }
    throw error;
  }
}

async function updateIndex(filePath, kind, entry, identityField) {
  const index = await readIndex(filePath, kind);
  index.entries = index.entries.filter(
    (candidate) => candidate[identityField] !== entry[identityField],
  );
  index.entries.push(entry);
  index.entries.sort((left, right) =>
    String(left[identityField]).localeCompare(String(right[identityField])),
  );
  await writeAtomic(filePath, `${JSON.stringify(index, null, 2)}\n`);
}

function positiveMarkdown(card) {
  const chain = card.problem_chain.map((stage, index) => `${index + 1}. ${stage}`).join("\n");
  const evidence = card.evidence_refs.map((ref) => `- ${ref}`).join("\n");
  return `# ${card.symptom}\n\n` +
    `- Case: \`${card.case_id}\`\n` +
    `- Robot: \`${card.robot_id}\`\n` +
    `- Platform: \`${card.platform}\`\n` +
    `- Applicability: \`${card.applicability}\`\n` +
    `- Closed: ${card.closed_at}\n\n` +
    `## Root cause\n\n${card.root_cause}\n\n` +
    `## Reproduction\n\n${card.reproduction}\n\n` +
    `## Problem chain\n\n${chain}\n\n` +
    `## Evidence\n\n${evidence}\n`;
}

function negativeRecord(run) {
  return {
    schema_version: "1.0.0",
    route_id: run.run_id,
    robot_id: run.robot_id,
    platform: run.platform,
    symptom: run.symptom,
    rejection_reason: run.rejection_reason,
    rejected_at: run.updated_at,
    attempted_chain: structuredClone(run.problem_chain ?? []),
    evidence_refs: structuredClone(run.evidence_refs ?? []),
  };
}

function negativeMarkdown(record) {
  return `# Rejected route: ${record.symptom}\n\n` +
    `- Route: \`${record.route_id}\`\n` +
    `- Robot: \`${record.robot_id}\`\n` +
    `- Platform: \`${record.platform}\`\n\n` +
    `## Why it was rejected\n\n${record.rejection_reason}\n`;
}

export async function persistMemoryRecord({ wikiRoot, run, evidencePackets, registry }) {
  const disposition = memoryDisposition(run);
  if (disposition === "pending") {
    throw new Error(`investigation state ${run.state} is not eligible for memory`);
  }

  const robotId = safeSegment(run.robot_id, "robot_id");
  const platform = safeSegment(run.platform, "platform");
  const runId = safeSegment(run.run_id, "run_id");

  if (disposition === "positive") {
    const card = buildCaseCard(run, { evidencePackets, registry });
    if (card.applicability === "platform") {
      if (!card.fingerprints.interface || !card.fingerprints.deployment) {
        throw new Error(
          "platform promotion requires interface and deployment fingerprints",
        );
      }
    }
    const base =
      card.applicability === "platform"
        ? path.join(wikiRoot, "platforms", platform, "cases", runId)
        : path.join(wikiRoot, "robots", robotId, "cases", runId);
    const jsonPath = `${base}.json`;
    const markdownPath = `${base}.md`;
    await writeAtomic(jsonPath, `${JSON.stringify(card, null, 2)}\n`);
    await writeAtomic(markdownPath, positiveMarkdown(card));

    const relativeJson = path.relative(wikiRoot, jsonPath).split(path.sep).join("/");
    await updateIndex(
      path.join(wikiRoot, "indexes", "cases.json"),
      "cases",
      {
        case_id: card.case_id,
        robot_id: card.robot_id,
        platform: card.platform,
        applicability: card.applicability,
        symptom: card.symptom,
        root_cause: card.root_cause,
        problem_chain: card.problem_chain,
        tags: card.tags,
        fingerprints: card.fingerprints,
        record: relativeJson,
      },
      "case_id",
    );
    return { disposition, jsonPath, markdownPath };
  }

  const record = negativeRecord(run);
  const base = path.join(
    wikiRoot,
    "negative-routes",
    platform,
    robotId,
    runId,
  );
  const jsonPath = `${base}.json`;
  const markdownPath = `${base}.md`;
  await writeAtomic(jsonPath, `${JSON.stringify(record, null, 2)}\n`);
  await writeAtomic(markdownPath, negativeMarkdown(record));
  await updateIndex(
    path.join(wikiRoot, "indexes", "negative-routes.json"),
    "negative-routes",
    {
      route_id: record.route_id,
      robot_id: record.robot_id,
      platform: record.platform,
      symptom: record.symptom,
      record: path.relative(wikiRoot, jsonPath).split(path.sep).join("/"),
    },
    "route_id",
  );
  return { disposition, jsonPath, markdownPath };
}
