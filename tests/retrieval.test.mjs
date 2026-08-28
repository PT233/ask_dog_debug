import assert from "node:assert/strict";
import test from "node:test";

import { retrieveMemory } from "../src/retrieval.mjs";

const cases = {
  entries: [
    {
      case_id: "same-robot",
      robot_id: "004",
      platform: "a2w",
      applicability: "machine",
      symptom: "camera topic becomes stale",
      root_cause: "callback queue saturation",
      problem_chain: ["/camera", "/perception", "/planner"],
      tags: ["camera", "stale-frame"],
      fingerprints: {},
      record: "robots/004/cases/same-robot.json"
    },
    {
      case_id: "other-robot",
      robot_id: "003",
      platform: "a2w",
      applicability: "machine",
      symptom: "camera topic becomes stale",
      root_cause: "network queue saturation",
      problem_chain: ["/camera", "/planner"],
      tags: ["camera"],
      fingerprints: {},
      record: "robots/003/cases/other-robot.json"
    },
    {
      case_id: "platform-case",
      robot_id: "003",
      platform: "a2w",
      applicability: "platform",
      symptom: "camera topic becomes stale",
      root_cause: "QoS mismatch",
      problem_chain: ["/camera"],
      tags: ["qos"],
      fingerprints: { interface: "ros-v7", deployment: "release-42" },
      record: "platforms/a2w/cases/platform-case.json"
    }
  ]
};

const negatives = {
  entries: [
    {
      route_id: "bad-qos-path",
      robot_id: "004",
      platform: "a2w",
      symptom: "camera topic becomes stale",
      record: "negative-routes/a2w/004/bad-qos-path.json"
    }
  ]
};

test("machine cases stay robot-specific", () => {
  const result = retrieveMemory({
    cases,
    negativeRoutes: negatives,
    robotId: "004",
    platform: "a2w",
    symptom: "camera topic stale",
    entities: ["/camera", "/planner"],
  });

  assert.equal(result.cases[0].case_id, "same-robot");
  assert.ok(!result.cases.some((entry) => entry.case_id === "other-robot"));
  assert.equal(result.negative_routes[0].route_id, "bad-qos-path");
});

test("platform cases require exact interface and deployment fingerprints", () => {
  const missing = retrieveMemory({
    cases,
    negativeRoutes: { entries: [] },
    robotId: "004",
    platform: "a2w",
    symptom: "camera topic stale",
  });
  assert.ok(!missing.cases.some((entry) => entry.case_id === "platform-case"));

  const matching = retrieveMemory({
    cases,
    negativeRoutes: { entries: [] },
    robotId: "004",
    platform: "a2w",
    symptom: "camera topic stale",
    fingerprints: { interface: "ros-v7", deployment: "release-42" },
  });
  assert.ok(matching.cases.some((entry) => entry.case_id === "platform-case"));
});

test("memory from another platform is excluded", () => {
  const result = retrieveMemory({
    cases: {
      entries: [
        ...cases.entries,
        { ...cases.entries[0], case_id: "m20-case", platform: "m20" },
      ],
    },
    negativeRoutes: { entries: [] },
    robotId: "004",
    platform: "a2w",
    symptom: "camera topic stale",
  });
  assert.ok(!result.cases.some((entry) => entry.case_id === "m20-case"));
});
