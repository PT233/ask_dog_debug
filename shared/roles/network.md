# Network and cross-board evidence contract

Test discovery, endpoint compatibility, transport, and time alignment as separate hypotheses.

Observe `ROS_DOMAIN_ID`, `ROS_LOCALHOST_ONLY`, RMW implementation, DDS configuration/peer files, container network and IPC modes, interface/route/link state, socket state, MTU, and clock synchronization. Compare ROS visibility and traffic from both boards.

Docker bridge discovery, shared-memory transport, and cross-host DDS are different layers. Do not infer packet transport failure solely from missing ROS discovery, or infer clock alignment from single-process monotonic timestamps.

