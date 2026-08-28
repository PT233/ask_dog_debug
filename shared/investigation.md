# Investigation lifecycle

```text
New → Running → ReproductionEstablished → RootCauseProven
                                   ↘       ↓
                                    Rejected
RootCauseProven → AwaitingUserConfirmation → Closed
       ↘                    ↘
        Running              Running
```

`Rejected` and `Closed` are terminal records. Returning to `Running` means the previous cause or proof was not accepted and new evidence is required.

## Proof gate

`RootCauseProven` requires platform knowledge `ready`, a reproducible symptom, a causal problem chain, two or more durable evidence references, and treatment of plausible alternatives. Every proof reference must come from an observation in an EvidencePacket validated against the current Investigation and robot registry, and at least one packet must support the causal hypothesis. M20 remains below this gate while its platform pack is NotReady.

## Storage

Raw evidence belongs under `<agent_root>/runs/<run_id>/` and remains outside Git. Store investigation JSON, EvidencePackets, command outputs, timing, and graph snapshots there. The Git wiki stores compact cards and evidence references, not raw logs.

Positive memory revalidates the original EvidencePackets against the Investigation and registry. Closing requires the machine state `user_confirmation: "affirmed"`, explicit `user_confirmed: true`, and a non-empty `user_confirmation_note` preserving the operator response; arbitrary non-empty text is not confirmation.
