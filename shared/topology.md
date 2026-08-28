# Topology use

Choose the topology pack only after robot identity resolves the platform.

- A2W uses `topologies/a2w/`; its initial complete baseline is the 004 offline snapshot.
- M20 uses `topologies/m20/` and is NotReady. It never falls back to A2W.

An incident manifest is a strict allowlist. Every relation endpoint must appear in `entities`; the renderer must not expand beyond it. Stages are ordered for humans and include board, input, output, checkpoint, evidence, and status.

Only `RootCauseProven` or `Closed` manifests may be rendered. The incident view is the default. The full topology is linked as an advanced view.

In the A2W baseline, `observed_on` describes where a ROS probe saw an entity, not where its process runs. Duplicate node names are aggregated by ROS CLI and must not be converted into fictional per-instance ownership.

