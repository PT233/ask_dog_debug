const ROS2_READ_ONLY = new Map([
  ["topic", new Set(["list", "info", "hz", "bw", "echo", "type", "find"])],
  ["node", new Set(["list", "info"])],
  ["param", new Set(["list", "get", "describe"])],
  ["service", new Set(["list", "type", "find"])],
  ["action", new Set(["list", "info"])],
  ["lifecycle", new Set(["list", "get"])],
  ["bag", new Set(["info"])],
  ["pkg", new Set(["list", "prefix", "executables"])],
]);

const SYSTEMCTL_READ_ONLY = new Set([
  "status",
  "show",
  "is-active",
  "is-failed",
  "list-units",
  "list-unit-files",
]);

const DOCKER_READ_ONLY = new Set(["inspect", "ps", "stats", "logs", "top"]);
const SIMPLE_READ_ONLY = new Set([
  "cat",
  "df",
  "dmesg",
  "du",
  "free",
  "grep",
  "head",
  "hostname",
  "ipcs",
  "journalctl",
  "ls",
  "lspci",
  "lsusb",
  "nvidia-smi",
  "pgrep",
  "pidstat",
  "printenv",
  "ps",
  "pwd",
  "readlink",
  "rg",
  "sensors",
  "sha256sum",
  "ss",
  "stat",
  "tail",
  "top",
  "turbostat",
  "uname",
  "uptime",
  "vmstat",
  "wc",
  "whoami",
]);

function hasShellControl(value) {
  return /[;&|`<>\n\r]|\$\(/.test(value);
}

export function assertReadOnlyCommand(command) {
  return assertReadOnlyCommandInternal(command, false);
}

function assertReadOnlyCommandInternal(command, boundedByTimeout) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error("read-only boundary requires a non-empty argv array");
  }
  if (command.some((part) => typeof part !== "string")) {
    throw new Error("read-only boundary requires string argv elements");
  }
  const argv = [...command];
  if (argv.some(hasShellControl)) {
    throw new Error("read-only boundary rejects shell control syntax");
  }

  const [program, family, operation] = argv;
  if (program === "timeout") {
    const match = /^(\d+)(s|m)?$/.exec(family ?? "");
    const amount = Number(match?.[1]);
    const seconds = amount * (match?.[2] === "m" ? 60 : 1);
    if (!match || seconds < 1 || seconds > 300 || argv.length < 3) {
      throw new Error("read-only boundary requires timeout between 1s and 300s");
    }
    assertReadOnlyCommandInternal(argv.slice(2), true);
    return argv;
  }
  if (program === "ros2") {
    if (family === "doctor") return argv;
    if (ROS2_READ_ONLY.get(family)?.has(operation)) {
      if (family === "topic" && operation === "echo" && !argv.includes("--once")) {
        throw new Error("read-only boundary requires bounded ros2 topic echo --once");
      }
      if (
        family === "topic" &&
        new Set(["hz", "bw"]).has(operation) &&
        !boundedByTimeout
      ) {
        throw new Error("read-only boundary requires timeout for ros2 topic rate sampling");
      }
      return argv;
    }
    throw new Error(`read-only boundary rejects ros2 ${family ?? ""} ${operation ?? ""}`);
  }
  if (program === "systemctl" && SYSTEMCTL_READ_ONLY.has(family)) return argv;
  if (program === "docker" && DOCKER_READ_ONLY.has(family)) {
    if (family === "logs") {
      const tailIndex = argv.indexOf("--tail");
      if (
        argv.includes("-f") ||
        argv.includes("--follow") ||
        tailIndex < 0 ||
        !/^\d+$/.test(argv[tailIndex + 1] ?? "")
      ) {
        throw new Error("read-only boundary requires bounded docker logs --tail <count>");
      }
    }
    if (family === "stats" && !argv.includes("--no-stream")) {
      throw new Error("read-only boundary requires docker stats --no-stream");
    }
    return argv;
  }
  if (program === "ip") {
    const mutation = new Set(["set", "add", "delete", "del", "replace", "flush"]);
    if (
      new Set(["addr", "address", "link", "route", "neigh"]).has(family) &&
      !argv.some((part) => mutation.has(part))
    ) {
      return argv;
    }
    throw new Error("read-only boundary rejects mutating ip command");
  }
  if (
    program === "chronyc" &&
    new Set(["tracking", "sources", "sourcestats", "activity"]).has(family)
  ) {
    return argv;
  }
  if (program === "udevadm" && family === "info") return argv;
  if (program === "journalctl") {
    const mutation = /^(?:--flush|--rotate|--sync|--relinquish-var|--smart-relinquish-var|--setup-keys|--vacuum-)/;
    if (argv.some((part) => part === "-f" || part === "--follow")) {
      throw new Error("read-only boundary requires bounded journal observation");
    }
    if (argv.some((part) => mutation.test(part))) {
      throw new Error("read-only boundary rejects mutating journalctl options");
    }
  }
  if (program === "tail" && argv.some((part) => part === "-f" || part === "--follow")) {
    throw new Error("read-only boundary requires bounded tail output");
  }
  if (program === "dmesg") {
    if (argv.some((part) => part === "-w" || part === "--follow")) {
      throw new Error("read-only boundary requires bounded dmesg output");
    }
    if (
      argv.some((part) =>
        /^(?:-c|-C|-D|-E|-n|--clear|--console-off|--console-on|--console-level)/.test(part),
      )
    ) {
      throw new Error("read-only boundary rejects mutating dmesg options");
    }
  }
  if (
    program === "top" &&
    !(argv.includes("-b") && argv.includes("-n") && /^\d+$/.test(argv[argv.indexOf("-n") + 1] ?? ""))
  ) {
    throw new Error("read-only boundary requires bounded top -b -n <count>");
  }
  if (program === "rg" && argv.some((part) => part === "--pre" || part.startsWith("--pre="))) {
    throw new Error("read-only boundary rejects ripgrep preprocessors");
  }
  if (program === "hostname" && argv.length > 1) {
    throw new Error("read-only boundary permits hostname output only");
  }
  if (program === "sensors" && argv.some((part) => part === "-s" || part === "--set")) {
    throw new Error("read-only boundary rejects sensors set operations");
  }
  if (program === "turbostat" && argv.includes("--")) {
    throw new Error("read-only boundary rejects turbostat command execution");
  }
  if (
    program === "nvidia-smi" &&
    argv.slice(1).some((part) =>
      /^(?:-pm|-pl|-lgc|-rgc|-rac|--persistence-mode|--power-limit|--reset)/.test(part),
    )
  ) {
    throw new Error("read-only boundary rejects nvidia-smi mutation");
  }
  if (SIMPLE_READ_ONLY.has(program)) return argv;

  throw new Error(`read-only boundary rejects program: ${program}`);
}
