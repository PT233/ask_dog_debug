import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("A2W carries the complete 004 offline topology baseline", async () => {
  const inventory = JSON.parse(
    await readFile(path.join(root, "topologies/a2w/004/inventory.json"), "utf8"),
  );
  const links = JSON.parse(
    await readFile(path.join(root, "topologies/a2w/004/node-links.json"), "utf8"),
  );
  const counts = Object.fromEntries(
    ["nodes", "topics", "services", "actions"].map((kind) => [
      kind,
      inventory.global[kind].length,
    ]),
  );

  assert.deepEqual(counts, { nodes: 60, topics: 293, services: 370, actions: 7 });
  assert.equal(links.links.length, 929);
  await access(path.join(root, "web", "a2w-advanced.html"));
});

test("M20 topology is an explicit NotReady pack with no A2W fallback", async () => {
  const metadata = JSON.parse(
    await readFile(path.join(root, "topologies/m20/metadata.json"), "utf8"),
  );
  const page = await readFile(path.join(root, "web", "m20-advanced.html"), "utf8");

  assert.equal(metadata.status, "not-ready");
  assert.equal(metadata.fallback, null);
  assert.doesNotMatch(page, /004|A2W/i);
  assert.match(page, /NotReady/);
});
