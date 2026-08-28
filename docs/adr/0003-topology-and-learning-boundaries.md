# ADR 0003: Isolated topology and Git-backed learning

## Status

Accepted — 2026-08-29

## Decision

Use one renderer with separate A2W and M20 topology datasets. The normal incident view contains only an explicit entity/relation allowlist; the full graph is an advanced view. M20 cannot fall back to A2W.

Store raw run evidence outside Git. Store compact machine cases, platform cases, negative routes, and indexes under `llm-wiki/`. Updating the wiki produces local Git changes; committing and pushing require explicit user confirmation.

## Consequences

The page remains readable during debugging, knowledge is reviewable and portable, and raw logs or credentials do not silently enter version control.

