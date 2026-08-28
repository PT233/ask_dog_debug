import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, "skills");

test("the plugin exposes one main skill and ten internal scouts", async () => {
  const skills = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.equal(skills.length, 11);
  assert.ok(skills.includes("ask-dog-debug"));
  assert.equal(skills.filter((name) => name.startsWith("neowa-a2w-")).length, 5);
  assert.equal(skills.filter((name) => name.startsWith("neowa-m20-")).length, 5);
});

test("only the main skill allows implicit invocation", async () => {
  const skills = await readdir(skillsRoot, { withFileTypes: true });
  for (const entry of skills.filter((candidate) => candidate.isDirectory())) {
    const yaml = await readFile(
      path.join(skillsRoot, entry.name, "agents", "openai.yaml"),
      "utf8",
    );
    const expected = entry.name === "ask-dog-debug" ? "true" : "false";
    assert.match(yaml, new RegExp(`allow_implicit_invocation: ${expected}`));
  }
});

test("every internal scout points at exactly one platform and one role contract", async () => {
  const roles = ["ros", "runtime", "network", "drift", "hardware"];
  for (const platform of ["a2w", "m20"]) {
    for (const role of roles) {
      const skill = await readFile(
        path.join(skillsRoot, `neowa-${platform}-${role}`, "SKILL.md"),
        "utf8",
      );
      assert.match(skill, new RegExp(`shared/platforms/${platform}\\.md`));
      assert.match(skill, new RegExp(`shared/roles/${role}\\.md`));
      const otherPlatform = platform === "a2w" ? "m20" : "a2w";
      assert.doesNotMatch(
        skill,
        new RegExp(`shared/platforms/${otherPlatform}\\.md`),
      );
    }
  }
});
