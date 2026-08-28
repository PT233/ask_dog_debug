import assert from "node:assert/strict";
import test from "node:test";

import { assertReadOnlyCommand } from "../src/safety.mjs";

test("representative ROS, runtime, network, drift, and hardware observations are allowed", () => {
  const commands = [
    ["ros2", "topic", "info", "/camera", "-v"],
    ["ros2", "pkg", "prefix", "camera_driver"],
    ["systemctl", "status", "camera.service"],
    ["ip", "route", "show"],
    ["chronyc", "tracking"],
    ["sha256sum", "/opt/robot/app"],
    ["udevadm", "info", "/dev/video0"],
    ["docker", "logs", "--tail", "200", "camera"],
    ["docker", "stats", "--no-stream", "camera"],
    ["top", "-b", "-n", "1"],
    ["timeout", "15s", "ros2", "topic", "hz", "/camera"],
  ];
  for (const command of commands) assert.equal(assertReadOnlyCommand(command).join(" "), command.join(" "));
});

test("state changes and unbounded observations are rejected", () => {
  const commands = [
    ["ros2", "topic", "pub", "/cmd_vel", "geometry_msgs/Twist"],
    ["ros2", "service", "call", "/reset", "std_srvs/srv/Empty"],
    ["ros2", "action", "send_goal", "/move", "example/action/Move"],
    ["ros2", "topic", "echo", "/camera"],
    ["ros2", "topic", "hz", "/camera"],
    ["systemctl", "restart", "camera.service"],
    ["docker", "exec", "robot", "sh"],
    ["ip", "link", "set", "eth0", "down"],
    ["sed", "-i", "s/a/b/", "/etc/robot.conf"],
    ["journalctl", "-f"],
    ["docker", "logs", "camera"],
    ["docker", "stats", "camera"],
    ["top"],
    ["tail", "-f", "/var/log/syslog"],
    ["dmesg", "--follow"],
    ["env", "sh", "-c", "touch /tmp/unsafe"],
    ["sed", "e", "/tmp/unsafe"],
    ["rg", "--pre", "touch /tmp/unsafe", "needle", "."],
    ["journalctl", "--rotate"],
    ["dmesg", "--clear"],
    ["sensors", "--set"],
    ["turbostat", "--", "touch", "/tmp/unsafe"],
    ["timeout", "301s", "ros2", "topic", "hz", "/camera"],
    ["rm", "-rf", "/tmp/example"],
  ];
  for (const command of commands) {
    assert.throws(() => assertReadOnlyCommand(command), /read-only boundary/i);
  }
});
