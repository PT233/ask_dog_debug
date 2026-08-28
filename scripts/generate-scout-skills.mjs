#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const roles = {
  ros: "ROS graph, endpoint compatibility, message rate, freshness, and data quality",
  runtime: "process state, resource pressure, crashes, logs, and historical timelines",
  network: "DDS discovery, cross-board transport, clock alignment, and packet paths",
  drift: "source, launch, configuration, image, and deployed-runtime drift",
  hardware: "device presence, driver entry, process ownership, temperature, and throttling",
};

const platforms = {
  a2w: {
    label: "A2W",
    status: "ready",
    boundary:
      "Use A2W facts only after robot-id verification. Live evidence overrides the 004 offline baseline.",
  },
  m20: {
    label: "M20",
    status: "not-ready",
    boundary:
      "The M20 pack is NotReady. Collect generic read-only identity/evidence, return inconclusive with missing evidence, and never claim RootCauseProven.",
  },
};

for (const [platform, platformInfo] of Object.entries(platforms)) {
  for (const [role, purpose] of Object.entries(roles)) {
    const name = `neowa-${platform}-${role}`;
    const directory = path.join(root, "skills", name);
    await mkdir(path.join(directory, "agents"), { recursive: true });
    const skill = `---
name: ${name}
description: Internal ${platformInfo.label} evidence scout for ${purpose}. Use only when ask-dog-debug dispatches this role for a verified ${platformInfo.label} robot.
---

# ${platformInfo.label} ${role} evidence scout

This is an internal scout. The main \`ask-dog-debug\` agent owns the Investigation and final cause.

1. Verify that the supplied \`robot_id\`, platform \`${platform}\`, and board evidence agree with the registry.
2. Read [the ${role} role contract](../../shared/roles/${role}.md), [the ${platformInfo.label} platform pack](../../shared/platforms/${platform}.md), [the evidence protocol](../../shared/evidence-protocol.md), and [the safety boundary](../../shared/safety.md).
3. Test only the assigned hypothesis and time window with allowlisted read-only observations. ${platformInfo.boundary}
4. Return exactly one EvidencePacket. Include reproducible commands, observations, evidence paths, verdict, confidence, missing evidence, and the smallest next probe.

Completion means the assigned hypothesis is supported, refuted, or explicitly inconclusive from cited evidence. Do not propose a repair or final root cause.
`;
    const openai = `interface:
  display_name: "Neowa ${platformInfo.label} ${role} scout"
  short_description: "Internal ${platformInfo.label} ${role} evidence scout"
  default_prompt: "Use $${name} only for the hypothesis assigned by $ask-dog-debug."
policy:
  allow_implicit_invocation: false
`;
    await writeFile(path.join(directory, "SKILL.md"), skill, "utf8");
    await writeFile(path.join(directory, "agents", "openai.yaml"), openai, "utf8");
  }
}

console.log("Generated 10 internal evidence scout skills.");
