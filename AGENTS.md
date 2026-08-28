# Repository instructions

This repository is the `ask-dog-debug` Codex plugin.

## Agent skills

### Issue tracker

Engineering tickets are local Markdown files under `.scratch/<feature>/issues/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical local labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with `CONTEXT.md` and root ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Safety

Diagnosis is read-only. Commands that change robot, container, service, ROS graph, source, configuration, or motion state require a separate user-authorized repair phase. Never use A2W knowledge for M20 or infer a platform when identity evidence conflicts.

