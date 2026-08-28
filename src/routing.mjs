const ROLE_ORDER = ["ros", "network", "runtime", "drift", "hardware"];

const ROLE_TERMS = {
  ros: [
    "ros",
    "topic",
    "qos",
    "tf",
    "odom",
    "service",
    "action",
    "消息",
    "频率",
    "帧",
    "里程",
    "定位",
    "建图",
  ],
  network: [
    "跨板",
    "网络",
    "丢包",
    "dds",
    "discovery",
    "domain",
    "wireguard",
    "multicast",
    "通信",
  ],
  runtime: [
    "崩溃",
    "进程",
    "被杀",
    "超时",
    "oom",
    "segfault",
    "cpu",
    "memory",
    "内存",
    "资源",
    "日志",
    "历史",
  ],
  drift: [
    "版本",
    "源码",
    "配置",
    "部署",
    "launch",
    "release",
    "dev",
    "漂移",
    "镜像",
  ],
  hardware: [
    "硬件",
    "设备",
    "雷达",
    "相机",
    "lidar",
    "camera",
    "usb",
    "serial",
    "温度",
    "节流",
    "驱动",
  ],
};

function scoreRoles(symptom) {
  const text = String(symptom ?? "").toLowerCase();
  return ROLE_ORDER.map((role, order) => ({
    role,
    order,
    score: ROLE_TERMS[role].reduce(
      (score, term) => score + (text.includes(term) ? 1 : 0),
      0,
    ),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, 3)
    .map(({ role }) => role);
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
}

function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value ?? {}).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${label} has unsupported properties: ${unknown.join(", ")}`);
  }
}

export function validateRobotRegistry(registry) {
  rejectUnknownKeys(
    registry,
    new Set(["schema_version", "identity_source", "robots", "platform_templates"]),
    "RobotRegistry",
  );
  if (registry?.schema_version !== "1.0.0") {
    throw new Error("RobotRegistry schema_version must be 1.0.0");
  }
  if (registry.identity_source !== "/etc/dsh-agent/robot-id") {
    throw new Error("RobotRegistry identity_source is invalid");
  }
  if (!Array.isArray(registry.robots)) {
    throw new Error("RobotRegistry robots must be an array");
  }
  if (
    !registry.platform_templates ||
    typeof registry.platform_templates !== "object" ||
    Array.isArray(registry.platform_templates)
  ) {
    throw new Error("RobotRegistry platform_templates must be an object");
  }

  const robotIds = new Set();
  const boardIds = new Set();
  for (const robot of registry.robots) {
    rejectUnknownKeys(
      robot,
      new Set(["robot_id", "platform", "knowledge_status", "boards"]),
      "RobotRegistry robot",
    );
    requireText(robot?.robot_id, "RobotRegistry robot_id");
    if (!/^[a-zA-Z0-9._-]+$/.test(robot.robot_id)) {
      throw new Error(`RobotRegistry robot_id is invalid: ${robot.robot_id}`);
    }
    if (robotIds.has(robot.robot_id)) {
      throw new Error(`duplicate RobotRegistry robot_id: ${robot.robot_id}`);
    }
    robotIds.add(robot.robot_id);
    if (!["a2w", "m20"].includes(robot.platform)) {
      throw new Error(`unsupported platform for robot ${robot.robot_id}`);
    }
    if (!["ready", "not-ready"].includes(robot.knowledge_status)) {
      throw new Error(`invalid knowledge_status for robot ${robot.robot_id}`);
    }
    if (!Array.isArray(robot.boards)) {
      throw new Error(`robot ${robot.robot_id} has no board registry`);
    }
    for (const board of robot.boards) {
      rejectUnknownKeys(
        board,
        new Set(["board_id", "role", "ssh", "agent_root"]),
        `RobotRegistry board for ${robot.robot_id}`,
      );
      requireText(board?.board_id, `robot ${robot.robot_id} board_id`);
      requireText(board?.role, `board ${board.board_id} role`);
      requireText(board?.agent_root, `board ${board.board_id} agent_root`);
      if (!board.board_id.startsWith(`${robot.robot_id}-`)) {
        throw new Error(`identity conflict in registry for ${robot.robot_id}`);
      }
      if (boardIds.has(board.board_id)) {
        throw new Error(`duplicate RobotRegistry board_id: ${board.board_id}`);
      }
      boardIds.add(board.board_id);
      rejectUnknownKeys(board.ssh, new Set(["user", "host"]), `board ${board.board_id} ssh`);
      requireText(board.ssh?.user, `board ${board.board_id} ssh.user`);
      requireText(board.ssh?.host, `board ${board.board_id} ssh.host`);
    }
  }
}

function verifyRegistryRobot(robot) {
  if (!robot || !["a2w", "m20"].includes(robot.platform)) {
    throw new Error("robot registry entry has an unsupported platform");
  }
  if (!Array.isArray(robot.boards)) {
    throw new Error(`robot ${robot.robot_id} has no board registry`);
  }
  for (const board of robot.boards) {
    if (!board.board_id?.startsWith(`${robot.robot_id}-`)) {
      throw new Error(`identity conflict in registry for ${robot.robot_id}`);
    }
  }
}

export function routeInvestigation({
  registry,
  robotId,
  symptom,
  observedBoardIds = [],
  offline = false,
}) {
  validateRobotRegistry(registry);
  const normalizedRobotId = String(robotId ?? "").trim();
  const robot = registry?.robots?.find(
    (candidate) => candidate.robot_id === normalizedRobotId,
  );
  if (!robot) {
    throw new Error(`unregistered robot-id: ${normalizedRobotId || "<empty>"}`);
  }

  verifyRegistryRobot(robot);
  if (
    !Array.isArray(observedBoardIds) ||
    observedBoardIds.some((boardId) => typeof boardId !== "string" || boardId.trim() === "")
  ) {
    throw new Error("observed board identities must be a string array");
  }
  if (new Set(observedBoardIds).size !== observedBoardIds.length) {
    throw new Error("duplicate observed board identity evidence");
  }
  if (offline && observedBoardIds.length > 0) {
    throw new Error("offline routing cannot claim observed board identity evidence");
  }
  const expectedBoardIds = new Set(robot.boards.map((board) => board.board_id));
  let identityStatus;
  if (observedBoardIds.length === 0) {
    if (!offline) {
      throw new Error(`board identity evidence required for robot ${normalizedRobotId}`);
    }
    identityStatus = "registry-only";
  } else {
    if (observedBoardIds.some((boardId) => !expectedBoardIds.has(String(boardId)))) {
      throw new Error(`identity conflict for robot ${normalizedRobotId}`);
    }
    identityStatus =
      new Set(observedBoardIds).size === expectedBoardIds.size
        ? "verified"
        : "verified-partial";
  }

  const roles = scoreRoles(symptom);
  if (roles.length === 0) roles.push("runtime");

  return {
    robotId: normalizedRobotId,
    platform: robot.platform,
    knowledgeStatus: robot.knowledge_status,
    identityStatus,
    roles,
    scouts: roles.map((role) => `neowa-${robot.platform}-${role}`),
    boards: robot.boards.map(({ board_id, role }) => ({ board_id, role })),
    observedBoardIds: [...observedBoardIds],
  };
}

export const routingRoles = Object.freeze([...ROLE_ORDER]);
