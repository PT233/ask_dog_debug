import assert from "node:assert/strict";
import test from "node:test";

import {
  renderIncidentHtml,
  validateIncidentManifest,
} from "../src/incident.mjs";

const manifest = {
  schema_version: "1.0.0",
  run_id: "20260829T120000Z-004-a1b2c3d4",
  robot_id: "004",
  platform: "a2w",
  platform_knowledge_status: "ready",
  investigation_state: "RootCauseProven",
  symptom: "camera chain becomes stale",
  root_cause: "NX callback queue saturation",
  root_entity_id: "node:/camera_driver",
  impact_entity_id: "node:/planner",
  entities: [
    { id: "node:/camera_driver", kind: "node", label: "/camera_driver", board: "004-nx", chain_ids: ["primary"] },
    { id: "topic:/camera", kind: "topic", label: "/camera", board: "cross-board", chain_ids: ["primary"] },
    { id: "node:/perception", kind: "node", label: "/perception", board: "004-nx", chain_ids: ["primary"] },
    { id: "topic:/detections", kind: "topic", label: "/detections", board: "cross-board", chain_ids: ["primary"] },
    { id: "node:/planner", kind: "node", label: "/planner", board: "004-i7", chain_ids: ["primary"] }
  ],
  relations: [
    { id: "r1", from: "node:/camera_driver", to: "topic:/camera", kind: "publishes", chain_ids: ["primary"] },
    { id: "r2", from: "topic:/camera", to: "node:/perception", kind: "subscribes", chain_ids: ["primary"] },
    { id: "r3", from: "node:/perception", to: "topic:/detections", kind: "publishes", chain_ids: ["primary"] },
    { id: "r4", from: "topic:/detections", to: "node:/planner", kind: "subscribes", chain_ids: ["primary"] }
  ],
  stages: [
    {
      id: "capture",
      name: "Capture",
      board: "004-nx",
      input: "camera device",
      output: "/camera",
      checkpoint: "frame age",
      status: "observed",
      entity_ids: ["node:/camera_driver", "topic:/camera"],
      chain_ids: ["primary"],
      evidence_refs: ["runs/r1/camera.json"]
    },
    {
      id: "perception",
      name: "Perception",
      board: "004-nx",
      input: "/camera",
      output: "/detections",
      checkpoint: "callback queue",
      status: "root-cause",
      entity_ids: ["node:/perception", "topic:/detections"],
      chain_ids: ["primary"],
      evidence_refs: ["runs/r1/perception.json"]
    },
    {
      id: "planning",
      name: "Planning impact",
      board: "004-i7",
      input: "/detections",
      output: "planner decision",
      checkpoint: "input age",
      status: "impacted",
      entity_ids: ["node:/planner"],
      chain_ids: ["primary"],
      evidence_refs: ["runs/r1/planner.json"]
    }
  ],
  chains: [
    { id: "primary", label: "Camera to planner failure chain", stage_ids: ["capture", "perception", "planning"] }
  ],
  evidence_refs: ["runs/r1/camera.json", "runs/r1/perception.json", "runs/r1/planner.json"]
};

test("a proven allowlisted incident renders a self-contained focused page", () => {
  assert.equal(validateIncidentManifest(manifest), manifest);
  const html = renderIncidentHtml(manifest, { advancedHref: "a2w-advanced.html" });

  assert.match(html, /Camera to planner failure chain/);
  assert.match(html, /id="chain-detail"/);
  assert.match(html, /data-chain-ids/);
  assert.match(html, /is-dimmed/);
  assert.match(html, /a2w-advanced\.html/);
  assert.doesNotMatch(html, /unrelated-node/);
});

test("pre-proof and M20 NotReady manifests cannot render", () => {
  assert.throws(
    () => validateIncidentManifest({ ...manifest, investigation_state: "Running" }),
    /RootCauseProven or Closed/i,
  );
  assert.throws(
    () =>
      validateIncidentManifest({
        ...manifest,
        platform: "m20",
        platform_knowledge_status: "not-ready",
      }),
    /platform knowledge is not ready/i,
  );
});

test("relations cannot escape the entity allowlist", () => {
  const escaped = {
    ...manifest,
    relations: [
      ...manifest.relations,
      {
        id: "bad",
        from: "node:/planner",
        to: "node:/unrelated-node",
        kind: "publishes",
        chain_ids: ["primary"],
      },
    ],
  };
  assert.throws(() => validateIncidentManifest(escaped), /outside the allowlist/i);
});

test("the root must reach the impact through allowlisted relations", () => {
  assert.throws(
    () => validateIncidentManifest({ ...manifest, relations: manifest.relations.slice(0, 2) }),
    /does not connect root to impact/i,
  );
});

test("runtime validation matches the strict incident schema", () => {
  assert.throws(
    () => validateIncidentManifest({ ...manifest, unexpected: true }),
    /unsupported properties/i,
  );
  assert.throws(
    () => validateIncidentManifest({ ...manifest, schema_version: "0.1.0" }),
    /schema_version/i,
  );
});

test("every displayed entity must be on a root-to-impact problem chain", () => {
  const unrelated = {
    ...manifest,
    entities: [
      ...manifest.entities,
      {
        id: "node:/diagnostics",
        kind: "node",
        label: "/diagnostics",
        board: "004-i7",
        chain_ids: ["primary"],
      },
    ],
    relations: [
      ...manifest.relations,
      {
        id: "r-unrelated",
        from: "node:/camera_driver",
        to: "node:/diagnostics",
        kind: "publishes",
        chain_ids: ["primary"],
      },
    ],
  };
  assert.throws(
    () => validateIncidentManifest(unrelated),
    /outside root-to-impact chain/i,
  );
});

test("relations cannot move backward or create cycles in an ordered chain", () => {
  const cyclic = {
    ...manifest,
    relations: [
      ...manifest.relations,
      {
        id: "r-cycle",
        from: "node:/planner",
        to: "node:/camera_driver",
        kind: "feeds-back",
        chain_ids: ["primary"],
      },
    ],
  };
  assert.throws(
    () => validateIncidentManifest(cyclic),
    /moves backward|relation cycle/i,
  );
});

test("rendering follows chain stage order rather than input array order", () => {
  const shuffled = { ...manifest, stages: [...manifest.stages].reverse() };
  assert.equal(validateIncidentManifest(shuffled), shuffled);
  const html = renderIncidentHtml(shuffled);
  assert.ok(html.indexOf('"name":"Capture"') < html.indexOf('"name":"Perception"'));
  assert.ok(html.indexOf('"name":"Perception"') < html.indexOf('"name":"Planning impact"'));
});
