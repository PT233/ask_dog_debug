# EvidencePacket protocol

Every scout returns one JSON object conforming to `schemas/evidence-packet.schema.json`.

Required content:

- investigation identity: `run_id`, `robot_id`, `platform`, `scout_role`;
- one testable `hypothesis`;
- one argv-array `command` that passes the read-only allowlist;
- `observed_at` with timezone;
- observations containing a concise summary and durable `evidence_ref`;
- verdict `supports`, `refutes`, or `inconclusive`;
- confidence from 0 to 1, missing evidence, and the smallest useful next probe.

Report raw observation separately from interpretation. A topology baseline can establish that an edge is expected; only live or recorded evidence establishes that it behaved that way during the incident.

