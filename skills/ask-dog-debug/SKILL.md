---
name: ask-dog-debug
description: Diagnose Neowa A2W or M20 ROS 2 robot-dog incidents with strict robot-id routing, read-only evidence scouts, reusable case memory, and a focused problem-chain topology. Use for live or offline robot faults; not for generic ROS development or unapproved repair execution.
---

# Ask Dog Debug

Own one Investigation from symptom to user confirmation. You are the only root-cause decision maker; scouts collect evidence.

## 1. Identify and route

Read [`../../config/robots.json`](../../config/robots.json). Verify the requested `robot-id` against board identity evidence from `/etc/dsh-agent/robot-id`; network address alone is not identity. Run the route helper when useful:

```bash
node ../../scripts/ask-dog.mjs route --robot 004 --symptom '<symptom>' --observed-boards 004-i7,004-nx
```

Pass only board IDs actually read during the current live session. Use `--offline` instead for static planning; an offline route is registry-only and never proves live identity.

Stop platform-specific diagnosis when the ID is absent, unregistered, or conflicting. Never fill an M20 gap with A2W facts.

## 2. Retrieve memory

Retrieve the Top-K matching entries, filtered by robot, platform, symptom, ROS entity, component, and fingerprints:

```bash
node ../../scripts/ask-dog.mjs search-cases --robot 004 --platform a2w --symptom '<symptom>'
```

Prior cases reorder probes; they do not prove the current cause. Machine cases stay robot-specific. Platform cases require matching interface and deployment fingerprints.

## 3. Establish the investigation

Create a `run_id`, symptom contract, expected/actual observation, trigger, time window, and pass/fail rule. Store raw evidence outside Git under the registered board agent roots. Read the state and proof contract in [`../../shared/investigation.md`](../../shared/investigation.md).

## 4. Dispatch evidence scouts

Use the router roles as a safe seed, then refine the selection from the symptom and retrieved cases while staying within the resolved platform. Select one to three skills. Give each scout the `run_id`, robot identity, one hypothesis, time window, and exact evidence scope. When subagents are available, dispatch the selected scouts independently and wait for every EvidencePacket; otherwise execute their contracts sequentially. Do not start all ten by default.

Each scout must read its named `neowa-<platform>-<role>` skill and return one packet matching [`../../shared/evidence-protocol.md`](../../shared/evidence-protocol.md). Scouts test hypotheses; they do not propose repairs or final causes.

## 5. Close the evidence chain

Classify each claim as observed, topology-confirmed, static inference, or needing live verification. `RootCauseProven` requires:

- a reproducible symptom;
- an ordered causal problem chain;
- at least two reproducible evidence references drawn from EvidencePackets validated against this Investigation and registry;
- at least one supporting EvidencePacket;
- plausible alternatives explicitly supported, refuted, or still missing;
- platform knowledge status `ready`.

When the gate is not met, report the smallest next evidence needed and keep investigating.

## 6. Show the problem chain

At `RootCauseProven`, write `incident-view.json`, then render and open the self-contained PC page:

```bash
node ../../scripts/ask-dog.mjs render-incident --input <incident-view.json> --open
```

The incident page contains only allowlisted Nodes, Topics, Services, Actions, and relations. The full topology remains a separate advanced view. Read [`../../shared/topology.md`](../../shared/topology.md) before producing a manifest.

## 7. Learn after confirmation

Only an affirmative user response can move the Investigation to `Closed`; record `user_confirmation: "affirmed"`, `user_confirmed: true`, and the response text in `user_confirmation_note`. Then update `llm-wiki` with:

```bash
node ../../scripts/ask-dog.mjs promote-case --input <investigation.json> --evidence-packets <EvidencePackets.json>
```

The evidence-packets file is the original JSON array collected for this Investigation; promotion revalidates it against the registry. Rejected conclusions become negative routes. Show the local Git diff; commit or push the wiki only after explicit user confirmation.

## Safety boundary

Read and apply [`../../shared/safety.md`](../../shared/safety.md) before any robot command. Diagnosis observes; a separately authorized repair phase changes state. This fleet does not deploy SSH banners or issue motion commands.
