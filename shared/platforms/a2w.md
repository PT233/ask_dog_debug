# A2W platform knowledge

Status: `ready` for registered robots 003 and 004.

## Identity and boards

- Architecture: i7 plus Jetson Orin NX.
- Board identity: `/etc/dsh-agent/robot-id`, expected `<robot-id>-i7` and `<robot-id>-nx`.
- Registry SSH aliases are authoritative connection locators; addresses are not identity.
- Agent-owned roots come from `config/robots.json`.

## Evidence boundaries

- The 004 topology is an architecture baseline, not live state for 003 or 004.
- i7-specific resource evidence can include Intel CPU/GPU and system logs.
- NX-specific resource evidence can include Jetson temperature, throttling, GPU, CUDA/TensorRT, and system logs.
- Compare clocks before correlating cross-board timestamps.
- Prefer board-local graph and message observations; a management host may have different DDS visibility.

## Known domains

The baseline covers sensing/perception, localization/mapping, navigation/safety, arm/MoveIt, interaction/business gateways, infrastructure/monitoring, and DDS-only endpoints. Resolve exact entities from the topology dataset instead of embedding lists here.

