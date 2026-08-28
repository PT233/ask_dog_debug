# ADR 0001: One main agent and ten evidence scouts

## Status

Accepted — 2026-08-29

## Decision

Expose `ask-dog-debug` as the only normal user entry. It verifies robot identity, owns the Investigation, selects one to three scouts, evaluates EvidencePackets, and decides RootCauseProven.

Register five thin A2W scouts and five matching M20 scouts. The ten adapters share five role contracts but use separate platform knowledge packs. M20 adapters remain NotReady until real-machine evidence exists.

## Consequences

The skill fleet stays small at each invocation, platform facts cannot leak through duplicated prose, and subagents cannot race to competing final causes.

