# ADR 0002: Read-only evidence gate

## Status

Accepted — 2026-08-29

## Decision

Diagnosis permits observations and writes only to agent-owned run/case directories. Robot, ROS, source, deployment, container, service, configuration, and motion mutations are outside the diagnosis phase.

RootCauseProven requires a reproducible observation, the causal chain, and explicit treatment of plausible alternatives. The incident page opens at RootCauseProven. A case becomes positive reusable knowledge only after user-confirmed Closed.

## Consequences

The agent cannot create the fault it claims to observe. Repair remains a separately authorized workflow and must be verified by a fresh diagnostic pass.

