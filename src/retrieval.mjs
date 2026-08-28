function terms(value) {
  const text = String(value ?? "").toLowerCase();
  const result = new Set(text.match(/[a-z0-9_./-]+/g) ?? []);
  for (const sequence of text.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (sequence.length === 1) result.add(sequence);
    for (let index = 0; index < sequence.length - 1; index += 1) {
      result.add(sequence.slice(index, index + 2));
    }
  }
  return result;
}

function overlap(left, right) {
  let score = 0;
  for (const value of left) if (right.has(value)) score += 1;
  return score;
}

function fingerprintMatch(expected, observed) {
  return (
    expected?.interface &&
    expected?.deployment &&
    expected.interface === observed?.interface &&
    expected.deployment === observed?.deployment
  );
}

function scoreCase(entry, queryTerms, entitySet) {
  const searchable = terms(
    [
      entry.symptom,
      entry.root_cause,
      ...(entry.tags ?? []),
      ...(entry.problem_chain ?? []),
    ].join(" "),
  );
  const entityHits = (entry.problem_chain ?? []).filter((entity) =>
    entitySet.has(entity),
  ).length;
  return overlap(searchable, queryTerms) + entityHits * 3 +
    (entry.applicability === "machine" ? 4 : 1);
}

export function retrieveMemory({
  cases,
  negativeRoutes,
  robotId,
  platform,
  symptom,
  entities = [],
  fingerprints = {},
  limit = 5,
}) {
  const queryTerms = terms([symptom, ...entities].join(" "));
  const entitySet = new Set(entities);
  const positive = (cases?.entries ?? [])
    .filter((entry) => entry.platform === platform)
    .filter((entry) => {
      if (entry.applicability === "machine") return entry.robot_id === robotId;
      if (entry.applicability === "platform") {
        return fingerprintMatch(entry.fingerprints, fingerprints);
      }
      return false;
    })
    .map((entry) => ({ ...entry, score: scoreCase(entry, queryTerms, entitySet) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.case_id.localeCompare(right.case_id))
    .slice(0, limit);

  const negative = (negativeRoutes?.entries ?? [])
    .filter((entry) => entry.platform === platform && entry.robot_id === robotId)
    .map((entry) => ({
      ...entry,
      score: overlap(terms(entry.symptom), queryTerms),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.route_id.localeCompare(right.route_id))
    .slice(0, limit);

  return { cases: positive, negative_routes: negative };
}
