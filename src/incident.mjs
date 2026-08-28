const ENTITY_KINDS = new Set(["node", "topic", "service", "action"]);

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

function requireStringArray(value, label, minimum = 0) {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${label} must be a string array with at least ${minimum} items`);
  }
}

function requireUniqueIds(items, label) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const ids = new Set();
  for (const item of items) {
    requireText(item?.id, `${label}.id`);
    if (ids.has(item.id)) throw new Error(`duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function assertChainRefs(item, chainIds, label) {
  if (!Array.isArray(item.chain_ids) || item.chain_ids.length === 0) {
    throw new Error(`${label} requires chain_ids`);
  }
  for (const chainId of item.chain_ids) {
    if (!chainIds.has(chainId)) {
      throw new Error(`${label} references unknown chain ${chainId}`);
    }
  }
}

function rootImpactPathMembers(manifest, chainId) {
  const outgoing = new Map();
  const incoming = new Map();
  for (const relation of manifest.relations.filter((item) => item.chain_ids.includes(chainId))) {
    const targets = outgoing.get(relation.from) ?? [];
    targets.push(relation.to);
    outgoing.set(relation.from, targets);
    const sources = incoming.get(relation.to) ?? [];
    sources.push(relation.from);
    incoming.set(relation.to, sources);
  }
  function traverse(start, graph) {
    const queue = [start];
    const seen = new Set(queue);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const target of graph.get(current) ?? []) {
        if (!seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    return seen;
  }
  const fromRoot = traverse(manifest.root_entity_id, outgoing);
  const toImpact = traverse(manifest.impact_entity_id, incoming);
  return {
    reachesImpact: fromRoot.has(manifest.impact_entity_id),
    members: new Set([...fromRoot].filter((entityId) => toImpact.has(entityId))),
  };
}

function requireUniqueStrings(items, label) {
  requireStringArray(items, label, 1);
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) throw new Error(`${label} contains duplicate ${item}`);
    seen.add(item);
  }
}

function assertOrderedAcyclicChain(manifest, chain, stagesById) {
  const relations = manifest.relations.filter((item) => item.chain_ids.includes(chain.id));
  const stageRank = new Map();
  chain.stage_ids.forEach((stageId, index) => {
    for (const entityId of stagesById.get(stageId).entity_ids) {
      if (!stageRank.has(entityId)) stageRank.set(entityId, index);
    }
  });
  for (const entity of manifest.entities.filter((item) => item.chain_ids.includes(chain.id))) {
    if (!stageRank.has(entity.id)) {
      throw new Error(`entity ${entity.id} is not assigned to a stage in chain ${chain.id}`);
    }
  }
  for (const relation of relations) {
    if (stageRank.get(relation.from) > stageRank.get(relation.to)) {
      throw new Error(`relation ${relation.id} moves backward in chain ${chain.id}`);
    }
  }

  const outgoing = new Map();
  for (const relation of relations) {
    const targets = outgoing.get(relation.from) ?? [];
    targets.push(relation.to);
    outgoing.set(relation.from, targets);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(entityId) {
    if (visiting.has(entityId)) throw new Error(`chain ${chain.id} contains a relation cycle`);
    if (visited.has(entityId)) return;
    visiting.add(entityId);
    for (const target of outgoing.get(entityId) ?? []) visit(target);
    visiting.delete(entityId);
    visited.add(entityId);
  }
  for (const entity of manifest.entities) visit(entity.id);
}

function assertFocusedChains(manifest, entitiesById, stagesById) {
  for (const chain of manifest.chains) {
    const root = entitiesById.get(manifest.root_entity_id);
    const impact = entitiesById.get(manifest.impact_entity_id);
    if (!root.chain_ids.includes(chain.id) || !impact.chain_ids.includes(chain.id)) {
      throw new Error(`chain ${chain.id} must contain root and impact entities`);
    }
    const { reachesImpact, members } = rootImpactPathMembers(manifest, chain.id);
    if (!reachesImpact) {
      throw new Error(`chain ${chain.id} does not connect root to impact`);
    }
    for (const entity of manifest.entities.filter((item) => item.chain_ids.includes(chain.id))) {
      if (!members.has(entity.id)) {
        throw new Error(`entity ${entity.id} is outside root-to-impact chain ${chain.id}`);
      }
    }
    for (const stageId of chain.stage_ids) {
      if (!stagesById.get(stageId).chain_ids.includes(chain.id)) {
        throw new Error(`chain ${chain.id} and stage ${stageId} are not reciprocal`);
      }
    }
    assertOrderedAcyclicChain(manifest, chain, stagesById);
  }
  for (const stage of manifest.stages) {
    for (const chainId of stage.chain_ids) {
      const chain = manifest.chains.find((item) => item.id === chainId);
      if (!chain.stage_ids.includes(stage.id)) {
        throw new Error(`stage ${stage.id} and chain ${chainId} are not reciprocal`);
      }
    }
  }
}

function assertRelationsOnFocusedChains(manifest, entitiesById) {
  for (const relation of manifest.relations) {
    for (const chainId of relation.chain_ids) {
      if (
        !entitiesById.get(relation.from).chain_ids.includes(chainId) ||
        !entitiesById.get(relation.to).chain_ids.includes(chainId)
      ) {
        throw new Error(`relation ${relation.id} escapes chain ${chainId}`);
      }
    }
  }
}

function requireKnownKeys() {
  return {
    manifest: new Set([
      "schema_version", "run_id", "robot_id", "platform",
      "platform_knowledge_status", "investigation_state", "symptom",
      "root_cause", "root_entity_id", "impact_entity_id", "entities",
      "relations", "stages", "chains", "evidence_refs",
    ]),
    entity: new Set(["id", "kind", "label", "board", "chain_ids"]),
    relation: new Set(["id", "from", "to", "kind", "chain_ids"]),
    stage: new Set([
      "id", "name", "board", "input", "output", "checkpoint", "status",
      "entity_ids", "chain_ids", "evidence_refs",
    ]),
    chain: new Set(["id", "label", "stage_ids"]),
  };
}

function orderStagesForDisplay(manifest) {
  const byId = new Map(manifest.stages.map((stage) => [stage.id, stage]));
  const originalIndex = new Map(manifest.stages.map((stage, index) => [stage.id, index]));
  const outgoing = new Map(manifest.stages.map((stage) => [stage.id, new Set()]));
  const indegree = new Map(manifest.stages.map((stage) => [stage.id, 0]));
  for (const chain of manifest.chains) {
    for (let index = 1; index < chain.stage_ids.length; index += 1) {
      const from = chain.stage_ids[index - 1];
      const to = chain.stage_ids[index];
      if (!outgoing.get(from).has(to)) {
        outgoing.get(from).add(to);
        indegree.set(to, indegree.get(to) + 1);
      }
    }
  }
  const ready = [...indegree]
    .filter(([, count]) => count === 0)
    .map(([stageId]) => stageId)
    .sort((left, right) => originalIndex.get(left) - originalIndex.get(right));
  const ordered = [];
  while (ready.length > 0) {
    const stageId = ready.shift();
    ordered.push(byId.get(stageId));
    for (const target of outgoing.get(stageId)) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) {
        ready.push(target);
        ready.sort((left, right) => originalIndex.get(left) - originalIndex.get(right));
      }
    }
  }
  if (ordered.length !== manifest.stages.length) {
    throw new Error("incident chains contain conflicting stage order");
  }
  return ordered;
}

export function validateIncidentManifest(manifest) {
  const known = requireKnownKeys();
  rejectUnknownKeys(manifest, known.manifest, "IncidentManifest");
  if (manifest?.schema_version !== "1.0.0") {
    throw new Error("IncidentManifest schema_version must be 1.0.0");
  }
  for (const field of [
    "run_id",
    "robot_id",
    "platform",
    "platform_knowledge_status",
    "investigation_state",
    "symptom",
    "root_cause",
    "root_entity_id",
    "impact_entity_id",
  ]) {
    requireText(manifest?.[field], field);
  }
  if (!new Set(["RootCauseProven", "Closed"]).has(manifest.investigation_state)) {
    throw new Error("incident rendering requires RootCauseProven or Closed");
  }
  if (manifest.platform_knowledge_status !== "ready") {
    throw new Error("platform knowledge is not ready for incident rendering");
  }
  if (!["a2w", "m20"].includes(manifest.platform)) {
    throw new Error(`unsupported incident platform: ${manifest.platform}`);
  }

  const entityIds = requireUniqueIds(manifest.entities, "entities");
  if (manifest.entities.length < 2) throw new Error("entities requires at least two items");
  const relationIds = requireUniqueIds(manifest.relations, "relations");
  const stageIds = requireUniqueIds(manifest.stages, "stages");
  const chainIds = requireUniqueIds(manifest.chains, "chains");
  void relationIds;

  if (!entityIds.has(manifest.root_entity_id) || !entityIds.has(manifest.impact_entity_id)) {
    throw new Error("root and impact entities must be inside the allowlist");
  }
  for (const entity of manifest.entities) {
    rejectUnknownKeys(entity, known.entity, `entity ${entity.id}`);
    if (!ENTITY_KINDS.has(entity.kind)) {
      throw new Error(`unsupported entity kind: ${entity.kind}`);
    }
    requireText(entity.label, `entity ${entity.id}.label`);
    requireText(entity.board, `entity ${entity.id}.board`);
    assertChainRefs(entity, chainIds, `entity ${entity.id}`);
  }
  for (const relation of manifest.relations) {
    rejectUnknownKeys(relation, known.relation, `relation ${relation.id}`);
    if (!entityIds.has(relation.from) || !entityIds.has(relation.to)) {
      throw new Error(`relation ${relation.id} points outside the allowlist`);
    }
    requireText(relation.kind, `relation ${relation.id}.kind`);
    assertChainRefs(relation, chainIds, `relation ${relation.id}`);
  }
  for (const stage of manifest.stages) {
    rejectUnknownKeys(stage, known.stage, `stage ${stage.id}`);
    for (const field of ["name", "board", "input", "output", "checkpoint", "status"]) {
      requireText(stage[field], `stage ${stage.id}.${field}`);
    }
    if (!Array.isArray(stage.entity_ids) || stage.entity_ids.length === 0) {
      throw new Error(`stage ${stage.id} requires entity_ids`);
    }
    for (const entityId of stage.entity_ids) {
      if (!entityIds.has(entityId)) {
        throw new Error(`stage ${stage.id} references entity outside the allowlist`);
      }
    }
    assertChainRefs(stage, chainIds, `stage ${stage.id}`);
    requireStringArray(stage.evidence_refs, `stage ${stage.id}.evidence_refs`);
    for (const chainId of stage.chain_ids) {
      for (const entityId of stage.entity_ids) {
        const entity = manifest.entities.find((item) => item.id === entityId);
        if (!entity.chain_ids.includes(chainId)) {
          throw new Error(`stage ${stage.id} references entity outside chain ${chainId}`);
        }
      }
    }
  }
  for (const chain of manifest.chains) {
    rejectUnknownKeys(chain, known.chain, `chain ${chain.id}`);
    requireText(chain.label, `chain ${chain.id}.label`);
    requireUniqueStrings(chain.stage_ids, `chain ${chain.id}.stage_ids`);
    for (const stageId of chain.stage_ids) {
      if (!stageIds.has(stageId)) {
        throw new Error(`chain ${chain.id} references unknown stage ${stageId}`);
      }
    }
  }
  requireStringArray(manifest.evidence_refs, "incident manifest evidence_refs", 2);
  for (const stage of manifest.stages) {
    for (const evidenceRef of stage.evidence_refs) {
      if (!manifest.evidence_refs.includes(evidenceRef)) {
        throw new Error(`stage ${stage.id} references evidence outside the manifest`);
      }
    }
  }
  const entitiesById = new Map(manifest.entities.map((item) => [item.id, item]));
  const stagesById = new Map(manifest.stages.map((item) => [item.id, item]));
  assertRelationsOnFocusedChains(manifest, entitiesById);
  assertFocusedChains(manifest, entitiesById, stagesById);
  orderStagesForDisplay(manifest);
  return manifest;
}

function safeJsonForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderIncidentHtml(manifest, { advancedHref = "#" } = {}) {
  validateIncidentManifest(manifest);
  const renderManifest = { ...manifest, stages: orderStagesForDisplay(manifest) };
  const data = safeJsonForScript(renderManifest);
  const advanced = escapeAttribute(advancedHref);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
  <title>Ask Dog Debug · Incident Chain</title>
  <style>
    :root{color-scheme:dark;--bg:#07111f;--panel:#0d1b2d;--line:#29435f;--text:#e8f1fb;--muted:#8ba1b7;--accent:#41d6b3;--warn:#ffbd5a;--cause:#ff6b78;--impact:#7aa7ff}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#132b43 0,var(--bg) 44%);color:var(--text);font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;min-height:100vh}
    header{position:sticky;top:0;z-index:5;padding:18px 24px;background:rgba(7,17,31,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}
    h1{font-size:20px;margin:0 0 5px}.subtitle{color:var(--muted)}.pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.pill{border:1px solid var(--line);border-radius:99px;padding:3px 9px;color:var(--muted)}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;padding:20px;max-width:1720px;margin:auto}.panel{background:rgba(13,27,45,.9);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
    .main{padding:18px;min-width:0}.toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.toolbar a,.toolbar button{color:var(--text);background:#132a42;border:1px solid var(--line);padding:7px 10px;border-radius:8px;text-decoration:none;cursor:pointer}
    .chain{display:flex;align-items:stretch;gap:10px;overflow:auto;padding:8px 2px 20px}.stage{min-width:230px;max-width:280px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#0a1727;cursor:pointer;transition:.2s}.stage:hover,.is-focused{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
    .arrow{align-self:center;color:var(--accent);font-size:22px}.stage h2{font-size:15px;margin:0 0 8px}.meta{display:grid;grid-template-columns:74px 1fr;gap:4px;color:var(--muted)}.meta b{color:#b9cbe0}.status-root-cause{color:var(--cause)}.status-impacted{color:var(--impact)}
    .entities{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.entity{border:1px solid var(--line);border-radius:7px;background:#10253b;color:var(--text);padding:5px 7px;cursor:pointer;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px}.entity[data-kind=topic]{border-color:#806a36}.entity[data-kind=service],.entity[data-kind=action]{border-color:#594d92}
    .relations{border-top:1px solid var(--line);padding-top:14px}.relation{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;width:100%;text-align:left;background:transparent;border:0;color:var(--muted);padding:5px;cursor:pointer}.relation code{overflow:hidden;text-overflow:ellipsis;color:var(--text)}
    .side{position:sticky;top:102px;height:calc(100vh - 122px);overflow:auto;padding:18px}.side h2{font-size:17px;margin:0 0 12px}.side h3{font-size:13px;color:var(--accent);margin:18px 0 7px}.side ol,.side ul{padding-left:20px}.root-cause{padding:11px;border-left:3px solid var(--cause);background:#251523;border-radius:5px}.is-dimmed{opacity:.16;filter:saturate(.2)}
    @media(max-width:980px){.layout{grid-template-columns:1fr}.side{position:static;height:auto}.chain{flex-direction:column}.arrow{transform:rotate(90deg)}}
  </style>
</head>
<body>
  <header><h1 id="title"></h1><div class="subtitle" id="subtitle"></div><div class="pills" id="pills"></div></header>
  <div class="layout">
    <main class="panel main">
      <div class="toolbar"><strong>问题数据链路</strong><div><button id="show-all" type="button">显示全部问题范围</button> <a href="${advanced}">高级全图</a></div></div>
      <section class="chain" id="stage-chain" aria-label="incident stages"></section>
      <section class="relations"><h2>精确 ROS 关系</h2><div id="relations"></div></section>
    </main>
    <aside class="panel side" id="chain-detail" aria-live="polite"></aside>
  </div>
  <script id="incident-data" type="application/json">${data}</script>
  <script>
    const manifest=JSON.parse(document.getElementById('incident-data').textContent);
    const byId=(items)=>new Map(items.map(item=>[item.id,item]));
    const entities=byId(manifest.entities), stages=byId(manifest.stages), chains=byId(manifest.chains);
    const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
    const chainAttr=(item)=>item.chain_ids.join(' ');
    document.getElementById('title').textContent=manifest.symptom;
    document.getElementById('subtitle').textContent='Run '+manifest.run_id+' · '+manifest.robot_id.toUpperCase()+' / '+manifest.platform.toUpperCase();
    for(const text of [manifest.investigation_state,'Root → '+entities.get(manifest.root_entity_id).label,'Impact → '+entities.get(manifest.impact_entity_id).label])document.getElementById('pills').append(el('span','pill',text));
    const stageRoot=document.getElementById('stage-chain');
    manifest.stages.forEach((stage,index)=>{
      if(index)stageRoot.append(el('div','arrow','→'));
      const card=el('article','stage');card.tabIndex=0;card.dataset.chainIds=chainAttr(stage);
      card.append(el('h2','',String(index+1).padStart(2,'0')+' · '+stage.name));
      const meta=el('div','meta');
      for(const [key,value] of [['板卡',stage.board],['输入',stage.input],['输出',stage.output],['检查点',stage.checkpoint],['证据状态',stage.status]]){meta.append(el('b','',key),el('span',key==='证据状态'?'status-'+value:'',value))}card.append(meta);
      const entityRoot=el('div','entities');for(const id of stage.entity_ids){const entity=entities.get(id),button=el('button','entity',entity.label);button.type='button';button.dataset.kind=entity.kind;button.dataset.chainIds=chainAttr(entity);button.addEventListener('click',event=>{event.stopPropagation();selectChain(entity.chain_ids[0])});entityRoot.append(button)}card.append(entityRoot);
      card.addEventListener('click',()=>selectChain(stage.chain_ids[0]));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectChain(stage.chain_ids[0])}});stageRoot.append(card);
    });
    const relationRoot=document.getElementById('relations');for(const relation of manifest.relations){const row=el('button','relation');row.type='button';row.dataset.chainIds=chainAttr(relation);row.append(el('code','',entities.get(relation.from).label),el('span','',relation.kind+' →'),el('code','',entities.get(relation.to).label));row.addEventListener('click',()=>selectChain(relation.chain_ids[0]));relationRoot.append(row)}
    function showDetail(chainId){const root=document.getElementById('chain-detail');root.replaceChildren();const chain=chains.get(chainId);root.append(el('h2','',chain?.label||'全部问题范围'));root.append(el('div','root-cause',manifest.root_cause));if(chain){root.append(el('h3','','有序阶段'));const list=el('ol');for(const id of chain.stage_ids){const stage=stages.get(id);const item=el('li');item.append(el('strong','',stage.name+' · '),document.createTextNode(stage.board+' · '+stage.checkpoint));list.append(item)}root.append(list)}root.append(el('h3','','证据'));const evidence=el('ul');const refs=chain?[...new Set(chain.stage_ids.flatMap(id=>stages.get(id).evidence_refs))]:manifest.evidence_refs;for(const ref of refs)evidence.append(el('li','',ref));root.append(evidence)}
    function selectChain(chainId){for(const node of document.querySelectorAll('[data-chain-ids]')){const selected=node.dataset.chainIds.split(' ').includes(chainId);node.classList.toggle('is-dimmed',!selected);node.classList.toggle('is-focused',selected)}showDetail(chainId)}
    document.getElementById('show-all').addEventListener('click',()=>{for(const node of document.querySelectorAll('[data-chain-ids]'))node.classList.remove('is-dimmed','is-focused');showDetail(null)});
    selectChain(manifest.chains.find(chain=>chain.stage_ids.length)?.id||manifest.chains[0].id);
  </script>
</body>
</html>`;
}
