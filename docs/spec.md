# Ask Dog Debug skill fleet specification

## Problem Statement

The predecessor combines ROS diagnosis, deployment operations, topology browsing, SSH identity setup, and repair approval in one large skill. Full ROS graphs are too dense for incident work, platform facts can be confused, and past investigations do not form a compact reusable memory.

## Solution

Provide one evidence-first main skill that strictly routes by robot identity, dispatches only relevant platform scouts, proves a root cause from structured evidence, and opens a PC incident page containing only the problem data chain. Keep complete topology as an advanced view and retain confirmed lessons in a Git-backed LLM wiki.

## User Stories

1. As an operator, I want one `ask-dog-debug` entry so that I do not choose among specialist skills.
2. As an operator, I want platform selection to follow verified robot identity so that A2W and M20 facts cannot mix.
3. As an operator, I want unknown or conflicting identity to stop diagnosis so that the wrong robot is never inspected.
4. As an operator, I want only one to three relevant scouts to run so that diagnosis is faster and less noisy.
5. As an investigator, I want every scout to return the same EvidencePacket so that observations can be compared and audited.
6. As an investigator, I want the main agent to own one Investigation so that state and root-cause decisions remain coherent.
7. As an operator, I want diagnosis to be read-only so that observation cannot alter the failure.
8. As an operator, I want missing evidence reported explicitly so that inference is not presented as fact.
9. As an operator, I want the incident page only after RootCauseProven so that visualization communicates a defensible chain.
10. As an operator, I want clicks to highlight the selected chain and dim unrelated elements so that I can trace impact quickly.
11. As an operator, I want a right-side chain block so that inputs, outputs, board, checkpoints, and evidence are visible together.
12. As an expert, I want a separate advanced full topology so that uncommon relations remain inspectable.
13. As an operator, I want A2W and M20 to have separate topology packs so that one model never fills gaps in the other.
14. As an M20 operator, I want unfinished knowledge labeled NotReady so that placeholders cannot produce false confidence.
15. As an operator, I want Closed cases recorded so that repeated incidents start with better probe ordering.
16. As an operator, I want rejected routes retained as negative memory so that the agent avoids repeating failed investigations.
17. As an engineer, I want cases to be human-readable and machine-indexed so that Git review and automated retrieval agree.
18. As an engineer, I want generic ROS 2 diagnostic methods sourced and versioned so that imported guidance is auditable.
19. As an operator, I want historical cases to guide but not decide so that live evidence remains authoritative.
20. As a maintainer, I want a single root commit in the replacement repository so that the former agent history does not constrain the new skill fleet.

## Implementation Decisions

- Package the repository as a Codex plugin with eleven skills: one main entry and ten internal platform scouts.
- Model five scout roles: ROS/data quality, runtime/history, network/cross-board, source/deployment drift, and hardware/process evidence.
- Keep scout adapters thin; shared role contracts are single sources of truth.
- Maintain an explicit robot registry. Unknown, unregistered, or conflicting identity fails closed.
- Treat M20 adapters and topology as NotReady until real-machine evidence is curated.
- Define schemas for EvidencePacket, Investigation, incident manifest, platform registry, and case card.
- Store raw evidence under a run directory outside Git; store compact learning artifacts in `llm-wiki`.
- Import selected read-only methods from `robotics-agent-skills` at a pinned commit with attribution. Do not import its mutating examples as diagnostic actions.
- Render incident manifests into self-contained HTML and open Microsoft Edge only after RootCauseProven.
- Keep a separate A2W advanced graph generated from the 004 offline snapshot. Label `observed_on` as visibility, not process ownership.
- Remove the predecessor entry name and SSH banner deployment feature.

## Testing Decisions

- Test at three public seams: routing output, lifecycle/case promotion behavior, and rendered incident output.
- Routing tests verify strict identity, platform isolation, and the one-to-three scout limit.
- Lifecycle tests verify legal transitions, RootCauseProven rendering gate, Closed-only positive promotion, and rejected negative memory.
- Rendering tests verify that only allowlisted entities and relations enter incident HTML, selection interaction exists, and M20 does not fall back to A2W.
- Safety tests verify that diagnostic command catalogs contain only read-only forms and reject mutating ROS/system commands.
- Validate every skill and the plugin manifest with the Codex bundled validators.

## Out of Scope

- Building M20 platform knowledge before real-machine access.
- Applying repairs, restarting services, publishing ROS messages, invoking services/actions, changing parameters, or controlling motion.
- Replacing raw rosbag, journal, nmon, or graph evidence with Git case cards.
- Running a vector database or external knowledge service.
- Preserving the old DSH harness CLI and SSH banner deployment.

## Further Notes

The initial A2W topology is an offline 004 baseline. It accelerates chain selection but never proves the current state of 003, 004, or another A2W robot without live evidence.

