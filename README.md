# Ask Dog Debug

Evidence-first ROS 2 diagnosis for Neowa robot dogs.

`ask-dog-debug` is the only normal user entry. It verifies `robot-id`, retrieves relevant cases, dispatches one to three read-only evidence scouts, proves a causal chain, and opens a focused incident topology in Microsoft Edge. The complete ROS graph remains an advanced view.

## Platform status

| Platform | Skills | Knowledge | Topology |
| --- | ---: | --- | --- |
| A2W | 5 scouts | Ready for registered 003/004 identities | 004 offline baseline included |
| M20 | 5 scouts | NotReady safety skeleton | NotReady; no A2W fallback |

The A2W baseline contains 60 Nodes, 293 Topics, 370 Services, 7 Actions, and 929 node–endpoint relations. It accelerates investigation routing but is not current runtime proof.

## Fleet

- `ask-dog-debug`: identity, investigation state, scout dispatch, root-cause gate, visualization, and memory.
- `neowa-{a2w,m20}-ros`: ROS graph and message quality.
- `neowa-{a2w,m20}-runtime`: process, resource, crash, and history evidence.
- `neowa-{a2w,m20}-network`: DDS and cross-board evidence.
- `neowa-{a2w,m20}-drift`: source/configuration/deployment drift.
- `neowa-{a2w,m20}-hardware`: device, driver, and process-entry evidence.

The ten scout skills are internal and have implicit invocation disabled.

## Diagnostic flow

1. Verify the requested robot against `/etc/dsh-agent/robot-id` and `config/robots.json`.
2. Retrieve matching case cards and negative routes; use them only to order checks.
3. Establish a reproduction contract and external run directory.
4. Dispatch one to three scouts and collect structured EvidencePackets.
5. Reach `RootCauseProven` only after the reproduction, causal chain, evidence, and alternatives close.
6. Render `incident-view.html`; clicking a chain item highlights its chain, dims other context, and updates the right panel.
7. After an affirmative user confirmation, record `user_confirmation: "affirmed"`, `user_confirmed: true`, and the operator response in `user_confirmation_note`; then move to Closed and update `llm-wiki` locally only after revalidating the original EvidencePackets.

## Helper CLI

Requires Node.js 22 or newer. It has no third-party runtime dependencies.

```bash
node scripts/ask-dog.mjs route --robot 004 --symptom '跨板 topic 丢帧' --observed-boards 004-i7,004-nx
# Static planning only; this never claims live identity verification:
node scripts/ask-dog.mjs route --robot 004 --symptom '跨板 topic 丢帧' --offline
node scripts/ask-dog.mjs search-cases --robot 004 --platform a2w --symptom '跨板 topic 丢帧'
node scripts/ask-dog.mjs validate-evidence --input EvidencePacket.json --investigation investigation.json
node scripts/ask-dog.mjs render-incident --input incident-view.json --open
node scripts/ask-dog.mjs promote-case --input investigation.json --evidence-packets EvidencePackets.json
```

`render-incident --open` requires Microsoft Edge on the PC. If Edge is unavailable, rendering still succeeds when `--open` is omitted.

## Safety

Diagnosis is read-only. It can inspect ROS endpoints and messages, service/process/container status, logs, resources, devices, network state, checksums, and existing records. Publishing, service/action invocation, parameter changes, lifecycle transitions, restarts, configuration edits, replay, fault injection, and motion control require a separate explicitly authorized phase.

Raw logs and bags stay outside Git. `llm-wiki` contains compact case cards, negative routes, indexes, and source provenance. The skill updates the wiki locally after Closed; commit and push remain user-approved actions.

## Development

```bash
npm test
npm run check
python3 /home/yuqi/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

The source of truth for behavior is `docs/spec.md`; architectural decisions are in `docs/adr/`.

## License

Apache-2.0. Adapted upstream material and its pinned revision are listed in `THIRD_PARTY_NOTICES.md`.
