import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { routeInvestigation } from "../src/routing.mjs";

const registry = JSON.parse(
  await readFile(new URL("../config/robots.json", import.meta.url), "utf8"),
);

test("004 routes a cross-board topic symptom to one to three A2W scouts", () => {
  const route = routeInvestigation({
    registry,
    robotId: "004",
    symptom: "跨板 topic 频率下降并且有丢帧",
    observedBoardIds: ["004-i7", "004-nx"],
  });

  assert.equal(route.platform, "a2w");
  assert.equal(route.knowledgeStatus, "ready");
  assert.equal(route.identityStatus, "verified");
  assert.ok(route.scouts.length >= 1 && route.scouts.length <= 3);
  assert.ok(route.scouts.every((name) => name.startsWith("neowa-a2w-")));
  assert.deepEqual(route.roles.slice(0, 2), ["ros", "network"]);
});

test("an unregistered robot identity fails closed", () => {
  assert.throws(
    () =>
      routeInvestigation({
        registry,
        robotId: "m20-unknown",
        symptom: "定位异常",
      }),
    /unregistered robot-id/i,
  );
});

test("a registered M20 identity never routes to A2W scouts", () => {
  const m20Registry = {
    ...registry,
    robots: [
      ...registry.robots,
      {
        robot_id: "m20-lab-001",
        platform: "m20",
        knowledge_status: "not-ready",
        boards: [],
      },
    ],
  };

  const route = routeInvestigation({
    registry: m20Registry,
    robotId: "m20-lab-001",
    symptom: "进程崩溃",
    offline: true,
  });

  assert.equal(route.platform, "m20");
  assert.equal(route.knowledgeStatus, "not-ready");
  assert.equal(route.identityStatus, "registry-only");
  assert.ok(route.scouts.every((name) => name.startsWith("neowa-m20-")));
});

test("conflicting board identity evidence fails closed", () => {
  assert.throws(
    () =>
      routeInvestigation({
        registry,
        robotId: "004",
        symptom: "里程计异常",
        observedBoardIds: ["004-i7", "004-evil"],
      }),
    /identity conflict/i,
  );
});

test("live routing requires board identity evidence", () => {
  assert.throws(
    () =>
      routeInvestigation({
        registry,
        robotId: "004",
        symptom: "里程计异常",
      }),
    /board identity evidence required/i,
  );
});

test("offline routing is explicit and never claims live identity verification", () => {
  const route = routeInvestigation({
    registry,
    robotId: "004",
    symptom: "离线 rosbag 分析",
    offline: true,
  });
  assert.equal(route.identityStatus, "registry-only");
});

test("the registry contract is enforced before routing", () => {
  const malformed = structuredClone(registry);
  malformed.robots[0].knowledge_status = "bogus";
  delete malformed.robots[0].boards[0].ssh;
  assert.throws(
    () =>
      routeInvestigation({
        registry: malformed,
        robotId: "004",
        symptom: "topic 异常",
        offline: true,
      }),
    /knowledge_status|ssh/i,
  );

  const unknownField = structuredClone(registry);
  unknownField.robots[0].boards[0].unexpected = true;
  assert.throws(
    () =>
      routeInvestigation({
        registry: unknownField,
        robotId: "004",
        symptom: "topic 异常",
        offline: true,
      }),
    /unsupported properties/i,
  );
});

test("duplicate or contradictory board observations fail closed", () => {
  assert.throws(
    () =>
      routeInvestigation({
        registry,
        robotId: "004",
        symptom: "topic 异常",
        observedBoardIds: ["004-i7", "004-i7"],
      }),
    /duplicate observed board/i,
  );
  assert.throws(
    () =>
      routeInvestigation({
        registry,
        robotId: "004",
        symptom: "topic 异常",
        observedBoardIds: ["004-i7"],
        offline: true,
      }),
    /offline routing cannot claim/i,
  );
});
