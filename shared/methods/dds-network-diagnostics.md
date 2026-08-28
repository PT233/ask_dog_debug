# DDS and container network methods

Source basis: `robotics-agent-skills` commit `f9bc5467ff9ee3d23f1a1b0b29a649843bb6ad11`, Apache-2.0.

Inspect domain ID, RMW implementation, discovery configuration, peers, interface/route state, container network mode, IPC mode, and shared-memory size. Docker bridge multicast behavior, explicit DDS peers, host networking, and cross-host routing have different failure modes.

For large image or point-cloud messages, include `/dev/shm` capacity and sharing in the evidence. Treat configuration changes such as host networking or IPC sharing as repair proposals, never diagnostic probes.

