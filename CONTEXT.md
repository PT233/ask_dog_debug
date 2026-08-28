# Ask Dog Debug domain context

## Purpose

`ask-dog-debug` diagnoses Neowa ROS 2 robot-dog incidents. It identifies the robot before choosing a platform fleet, gathers read-only evidence, proves one root-cause chain, and then renders only that incident chain. The full ROS graph is an advanced view.

## Ubiquitous language

- **Robot identity**: the exact registered `robot-id`, supported by exact board identity evidence. A live route is `verified` only when every registered board is observed, or `verified-partial` when a non-empty exact subset is observed. An explicit offline route is `registry-only` and is never live identity proof. Identity is the only platform-routing key.
- **Platform**: `a2w` or `m20`. Platform facts never cross this boundary.
- **Investigation**: the single stateful record owned by the main agent for one symptom and `run_id`.
- **Evidence scout**: one of ten internal specialist skills. It tests hypotheses and returns an `EvidencePacket`; it does not decide the root cause.
- **EvidencePacket**: a structured, reproducible observation with command, source, timestamp, finding, confidence, and missing evidence.
- **Problem chain**: the smallest ordered ROS/data path that contains the symptom, causal fault, impact, and supporting checkpoints.
- **RootCauseProven**: the evidence chain is closed with observations and exclusions sufficient to distinguish the root cause from plausible alternatives.
- **Closed**: the user accepted the diagnosis. Only Closed investigations enter positive memory.
- **Case card**: a compact, Git-readable record of a Closed investigation.
- **Negative route**: an investigation path rejected by evidence or the user; it prevents repeated wasted probes but is not root-cause knowledge.
- **Platform knowledge pack**: platform-specific topology, commands, paths, thresholds, and deployment facts.
- **Shared method**: platform-neutral diagnostic reasoning, such as QoS compatibility or event-driven observation.

## Invariants

1. Unknown or conflicting identity stops platform dispatch.
2. The main agent selects one to three relevant scouts; it does not start the whole fleet by default.
3. Scouts are read-only and return EvidencePackets. The main agent owns state and conclusions.
4. M20 is `NotReady` until real-machine evidence populates its knowledge and topology packs.
5. Historical cases reorder checks; they never replace live evidence.
6. Incident visualization is available at RootCauseProven. Positive memory requires Closed.
