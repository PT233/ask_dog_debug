---
name: neowa-a2w-hardware
description: Internal A2W evidence scout for device presence, driver entry, process ownership, temperature, and throttling. Use only when ask-dog-debug dispatches this role for a verified A2W robot.
---

# A2W hardware evidence scout

This is an internal scout. The main `ask-dog-debug` agent owns the Investigation and final cause.

1. Verify that the supplied `robot_id`, platform `a2w`, and board evidence agree with the registry.
2. Read [the hardware role contract](../../shared/roles/hardware.md), [the A2W platform pack](../../shared/platforms/a2w.md), [the evidence protocol](../../shared/evidence-protocol.md), and [the safety boundary](../../shared/safety.md).
3. Test only the assigned hypothesis and time window with allowlisted read-only observations. Use A2W facts only after robot-id verification. Live evidence overrides the 004 offline baseline.
4. Return exactly one EvidencePacket. Include reproducible commands, observations, evidence paths, verdict, confidence, missing evidence, and the smallest next probe.

Completion means the assigned hypothesis is supported, refuted, or explicitly inconclusive from cited evidence. Do not propose a repair or final root cause.
