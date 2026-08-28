import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function detached(program, args) {
  const child = spawn(program, args, { detached: true, stdio: "ignore" });
  child.unref();
}

export function openInEdge(filePath, platform = process.platform) {
  const url = pathToFileURL(filePath).href;
  if (platform === "linux") {
    for (const candidate of ["microsoft-edge", "microsoft-edge-stable"]) {
      if (spawnSync("which", [candidate], { stdio: "ignore" }).status === 0) {
        detached(candidate, [url]);
        return { program: candidate, url };
      }
    }
    throw new Error(`Microsoft Edge was not found; open this page manually: ${url}`);
  }
  if (platform === "darwin") {
    detached("/usr/bin/open", ["-a", "Microsoft Edge", url]);
    return { program: "/usr/bin/open", url };
  }
  if (platform === "win32") {
    detached("cmd.exe", ["/c", "start", "", "msedge", url]);
    return { program: "msedge", url };
  }
  throw new Error(`unsupported desktop platform; open this page manually: ${url}`);
}
