# Hardware and process-entry evidence contract

Follow the path from device presence to driver/process ownership and ROS output.

Observe stable device path, kernel/udev evidence, permissions as metadata, driver binding, owning process, temperature/throttling, and the first ROS endpoint. Record missing, flapping, stale, or permission-denied evidence without changing device state.

Device presence is necessary but not sufficient: prove the driver opened it and produced timely valid data before declaring the hardware path healthy.

