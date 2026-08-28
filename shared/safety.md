# Read-only diagnosis boundary

Use argv arrays and the allowlist implemented by `src/safety.mjs`. Commands that stream or sample continuously must use the allowlisted `timeout` wrapper (maximum 300 seconds); other observations must terminate on their own.

Permitted categories include ROS list/info/rate/bandwidth/single-message inspection, system/service status, logs, process/resource state, device presence, network state, checksums, and container inspection.

State-changing ROS operations, service/action invocation, parameter changes, lifecycle transitions, daemon/service/container restarts, file replacement, permission changes, package installation, device configuration, reboot/shutdown, fault injection, rosbag replay, and motion control belong to a separately authorized repair or experiment phase.

Agent-owned writes are limited to run artifacts, rendered incident pages, and local `llm-wiki` updates. A successful command is evidence collection, not proof by itself.
