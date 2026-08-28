#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { openInEdge } from "../src/browser.mjs";
import { renderIncidentHtml } from "../src/incident.mjs";
import { validateEvidencePacket } from "../src/investigation.mjs";
import { retrieveMemory } from "../src/retrieval.mjs";
import { routeInvestigation } from "../src/routing.mjs";
import { persistMemoryRecord } from "../src/wiki.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `ask-dog-debug helper

Usage:
  ask-dog.mjs route --robot <id> --symptom <text> (--observed-boards <csv> | --offline) [--registry <file>]
  ask-dog.mjs search-cases --robot <id> --platform <a2w|m20> --symptom <text> [--entities <csv>]
  ask-dog.mjs validate-evidence --input <EvidencePacket.json> --investigation <investigation.json> [--registry <file>]
  ask-dog.mjs render-incident --input <incident-view.json> [--output <html>] [--open]
  ask-dog.mjs promote-case --input <investigation.json> --evidence-packets <packets.json> [--registry <file>] [--wiki <directory>]
`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === "open" || key === "offline") {
      options[key] = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command) {
    process.stdout.write(usage());
    return;
  }

  if (command === "route") {
    const registryPath = path.resolve(
      options.registry ?? path.join(root, "config", "robots.json"),
    );
    const registry = await readJson(registryPath);
    const route = routeInvestigation({
      registry,
      robotId: requireOption(options, "robot"),
      symptom: requireOption(options, "symptom"),
      observedBoardIds: options["observed-boards"]?.split(",").filter(Boolean) ?? [],
      offline: Boolean(options.offline),
    });
    process.stdout.write(`${JSON.stringify(route, null, 2)}\n`);
    return;
  }

  if (command === "validate-evidence") {
    const packet = await readJson(requireOption(options, "input"));
    const run = await readJson(requireOption(options, "investigation"));
    const registry = await readJson(
      path.resolve(options.registry ?? path.join(root, "config", "robots.json")),
    );
    validateEvidencePacket(packet, { run, registry });
    process.stdout.write(`${JSON.stringify({ valid: true, run_id: packet.run_id })}\n`);
    return;
  }

  if (command === "search-cases") {
    const wikiRoot = path.resolve(options.wiki ?? path.join(root, "llm-wiki"));
    const cases = await readJson(path.join(wikiRoot, "indexes", "cases.json"));
    const negativeRoutes = await readJson(
      path.join(wikiRoot, "indexes", "negative-routes.json"),
    );
    const result = retrieveMemory({
      cases,
      negativeRoutes,
      robotId: requireOption(options, "robot"),
      platform: requireOption(options, "platform"),
      symptom: requireOption(options, "symptom"),
      entities: options.entities?.split(",").filter(Boolean) ?? [],
      fingerprints: {
        interface: options["interface-fingerprint"],
        deployment: options["deployment-fingerprint"],
      },
      limit: options.limit ? Number(options.limit) : 5,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "render-incident") {
    const inputPath = path.resolve(requireOption(options, "input"));
    const manifest = await readJson(inputPath);
    const outputPath = path.resolve(
      options.output ?? path.join(path.dirname(inputPath), "incident-view.html"),
    );
    const advancedPath = path.join(root, "web", `${manifest.platform}-advanced.html`);
    const html = renderIncidentHtml(manifest, {
      advancedHref: pathToFileURL(advancedPath).href,
    });
    await writeFile(outputPath, html, "utf8");
    const result = { output: outputPath, opened: false };
    if (options.open) {
      result.browser = openInEdge(outputPath);
      result.opened = true;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (command === "promote-case") {
    const run = await readJson(requireOption(options, "input"));
    const evidencePackets =
      run.state === "Closed"
        ? await readJson(requireOption(options, "evidence-packets"))
        : options["evidence-packets"]
          ? await readJson(options["evidence-packets"])
          : undefined;
    const registry = await readJson(
      path.resolve(options.registry ?? path.join(root, "config", "robots.json")),
    );
    const result = await persistMemoryRecord({
      wikiRoot: path.resolve(options.wiki ?? path.join(root, "llm-wiki")),
      run,
      evidencePackets,
      registry,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`ask-dog-debug: ${error.message}\n`);
  process.exitCode = 1;
});
