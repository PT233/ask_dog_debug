# LLM Wiki

This Git-backed memory keeps compact, reviewable diagnostic knowledge.

- `robots/<robot-id>/cases/`: user-confirmed machine cases.
- `platforms/<platform>/cases/`: explicitly promoted cases with matching interface and deployment fingerprints.
- `negative-routes/`: disproved or rejected investigation paths.
- `indexes/`: deterministic retrieval indexes.
- `sources/`: versioned external method sources; these are not field cases.

Raw command output, logs, bags, and graph snapshots remain in external run directories. `ask-dog-debug` may update this tree after an investigation closes, but it must show the diff and obtain explicit approval before committing or pushing.

