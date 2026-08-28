# ROS and data-quality evidence contract

Test graph connectivity and message behavior across the smallest symptom-related chain.

Observe endpoint counts and QoS with `ros2 topic info -v`; rate or bandwidth with a bounded argv such as `timeout 15s ros2 topic hz <topic>` or `timeout 15s ros2 topic bw <topic>`; bounded content with `ros2 topic echo --once`; node relations with `ros2 node info`; and service/action existence with list/type/info commands. For recorded incidents, use `ros2 bag info` before any offline replay workflow.

Record publisher/subscriber compatibility, rate, jitter, age, empty/repeated frames, sequence gaps, endpoint visibility by board, and timestamp basis. Treat a topic name existing as weaker evidence than an active, compatible endpoint carrying valid data.
