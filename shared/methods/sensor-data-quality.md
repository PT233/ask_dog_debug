# Sensor data-quality methods

Source basis: `robotics-agent-skills` commit `f9bc5467ff9ee3d23f1a1b0b29a649843bb6ad11`, Apache-2.0.

Measure capture timestamp, frame age, sequence continuity, repeated/empty frames, drops, queue depth, processing duration, output rate, and end-to-end latency. For multi-sensor paths, compare clock domains before applying a synchronization threshold.

Use platform/task baselines for thresholds. Generic examples such as 33 ms synchronization or 100 ms total perception latency are hypotheses, not universal pass/fail values.

