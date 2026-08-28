# Replay and regression methods

Source basis: `robotics-agent-skills` commit `f9bc5467ff9ee3d23f1a1b0b29a649843bb6ad11`, Apache-2.0.

Use event-driven observation with explicit timeout rather than fixed sleep. Offline regression uses fixed recorded inputs, known clock behavior, and an existing accepted baseline. Missing baselines produce `not evaluated`; diagnosis does not generate or overwrite a golden result.

Rosbag replay, node launch, and fault injection change runtime state and therefore require an explicitly authorized offline experiment phase.
