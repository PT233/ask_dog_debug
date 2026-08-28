# ROS 2 observation methods

Source basis: `robotics-agent-skills` commit `f9bc5467ff9ee3d23f1a1b0b29a649843bb6ad11`, Apache-2.0. See `llm-wiki/sources/robotics-agent-skills.json`.

- Inspect offered/requested QoS before treating a silent topic as an application bug. In particular, a best-effort publisher cannot satisfy a subscriber that requires reliable delivery.
- Separate entity existence, endpoint compatibility, message arrival, frequency, bandwidth, freshness, and payload validity.
- Use list/info/get operations during diagnosis. Parameter changes, lifecycle transitions, service calls, action goals, publishing, and daemon resets are mutation-phase operations.

