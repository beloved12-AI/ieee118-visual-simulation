(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const BUS_COUNT = 118;
  const BRANCH_COUNT = 186;
  const TRANSFORMER_COUNT = 9;
  const xs = [72, 154, 236, 318, 400, 548, 630, 712, 794, 876];
  const ys = [78, 122, 166, 210, 280, 324, 368, 412, 482, 526, 570, 614];
  const svg = document.querySelector("#network");
  const profile = document.querySelector("#voltage-profile");
  const $ = (selector) => document.querySelector(selector);
  const seeded = (initial) => {
    let state = initial >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };
  const random = seeded(11818654);

  function makeNodes() {
    const generatorBuses = new Set(Array.from({ length: 54 }, (_, i) => ((i * 37) % BUS_COUNT) + 1));
    const loadBuses = new Set(Array.from({ length: 91 }, (_, i) => ((i * 29) % BUS_COUNT) + 1));
    const nodes = Array.from({ length: BUS_COUNT }, (_, i) => {
      const id = i + 1;
      const row = Math.floor(i / 10);
      const col = i % 10;
      let voltage = 0.956 + random() * 0.088;
      if (id === 76) voltage = 0.943;
      return {
        id,
        x: xs[col],
        y: ys[row],
        voltage: Number(voltage.toFixed(3)),
        angle: id === 76 ? -4.28 : Number((-8 + random() * 16).toFixed(2)),
        generator: generatorBuses.has(id),
        load: loadBuses.has(id),
        row,
        col
      };
    });

    // Synthetic allocations are scaled to the supplied aggregate totals. They are for
    // the interactive inspector only; they are not IEEE-118 solved bus results.
    const genEntries = nodes.filter((node) => node.generator);
    distributeRounded(genEntries, 4374, () => 38 + random() * 90, "pGen");
    const loadEntries = nodes.filter((node) => node.load);
    distributeRounded(loadEntries, 4242, () => 15 + random() * 75, "pLoad");
    nodes.forEach((node) => {
      node.qGen = node.generator ? Number((node.pGen * (0.12 + random() * 0.22)).toFixed(1)) : 0;
      node.qLoad = node.load ? Number((node.pLoad * (0.22 + random() * 0.18)).toFixed(1)) : 0;
      node.type = node.id === 69 ? "Reference*" : node.generator ? "PV*" : "PQ*";
    });
    return nodes;
  }

  function distributeRounded(entries, total, weightFactory, property) {
    const weights = entries.map(weightFactory);
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    const values = weights.map((weight) => Math.round((weight / weightSum) * total));
    let delta = total - values.reduce((sum, value) => sum + value, 0);
    for (let i = 0; delta !== 0; i = (i + 1) % values.length) {
      const change = delta > 0 ? 1 : -1;
      values[i] += change;
      delta -= change;
    }
    entries.forEach((entry, i) => { entry[property] = values[i]; });
  }

  const nodes = makeNodes();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function makeBranches() {
    const branches = [];
    const used = new Set();
    const transformerKeys = new Set();
    const edgeKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
    const add = (a, b, type, transformer = false) => {
      const key = edgeKey(a, b);
      if (used.has(key) || a === b) return false;
      used.add(key);
      branches.push({ a, b, type, transformer, activePower: Math.round(8 + random() * 188) });
      return true;
    };

    // Horizontal row ties plus a vertical backbone form a connected 118-bus sketch.
    for (let row = 0; row < ys.length; row++) {
      const busesInRow = Math.min(10, BUS_COUNT - row * 10);
      for (let col = 0; col < busesInRow - 1; col++) add(row * 10 + col + 1, row * 10 + col + 2, "line");
    }
    for (let row = 0; row < ys.length - 1; row++) add(row * 10 + 5, (row + 1) * 10 + 5, "line");

    const allVertical = [];
    for (let row = 0; row < ys.length - 1; row++) {
      const busesInNextRow = Math.min(10, BUS_COUNT - (row + 1) * 10);
      for (let col = 0; col < busesInNextRow; col++) {
        const a = row * 10 + col + 1;
        const b = (row + 1) * 10 + col + 1;
        if (!used.has(edgeKey(a, b))) allVertical.push({ a, b, row, col });
      }
    }
    const boundaryCandidates = allVertical.filter((edge) => edge.row === 3 || edge.row === 7);
    const selectedTransformers = [0, 1, 2, 3, 5, 6, 7, 8, 9].map((index) => boundaryCandidates[index]);
    selectedTransformers.forEach(({ a, b }) => transformerKeys.add(edgeKey(a, b)));
    const otherCandidates = allVertical.filter(({ a, b }) => !transformerKeys.has(edgeKey(a, b)));
    for (let i = otherCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [otherCandidates[i], otherCandidates[j]] = [otherCandidates[j], otherCandidates[i]];
    }
    const additional = [...selectedTransformers, ...otherCandidates.slice(0, 59)];
    additional.forEach(({ a, b }) => {
      add(a, b, "line", transformerKeys.has(edgeKey(a, b)));
    });

    // Add one synthetic diagonal tie to reach the requested branch count exactly.
    const diagonalCandidates = [];
    for (let row = 0; row < ys.length - 1; row++) {
      const busesInNextRow = Math.min(10, BUS_COUNT - (row + 1) * 10);
      for (let col = 0; col < busesInNextRow - 1; col++) {
        diagonalCandidates.push([row * 10 + col + 1, (row + 1) * 10 + col + 2]);
      }
    }
    for (let i = diagonalCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [diagonalCandidates[i], diagonalCandidates[j]] = [diagonalCandidates[j], diagonalCandidates[i]];
    }
    for (const [a, b] of diagonalCandidates) {
      if (add(a, b, "line")) break;
    }

    return branches.map((branch, index) => ({ ...branch, id: index + 1, transformer: transformerKeys.has(edgeKey(branch.a, branch.b)) }));
  }

  const branches = makeBranches();

  function el(tag, attributes = {}, parent = svg) {
    const element = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.appendChild(element);
    return element;
  }

  function addDefs() {
    const defs = el("defs");
    const marker = el("marker", { id: "flow-arrow", viewBox: "0 0 8 8", refX: 6.8, refY: 4, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse", markerUnits: "strokeWidth" }, defs);
    el("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "#50d8bc", opacity: ".72" }, marker);
    const transformerMarker = el("marker", { id: "transformer-arrow", viewBox: "0 0 8 8", refX: 6.8, refY: 4, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse", markerUnits: "strokeWidth" }, defs);
    el("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "#bd9aff", opacity: ".8" }, transformerMarker);
  }

  function renderZones() {
    const zones = [
      { x: 42, y: 42, w: 391, h: 186, label: "NORTH · WEST" },
      { x: 515, y: 42, w: 391, h: 186, label: "NORTH · EAST" },
      { x: 42, y: 244, w: 391, h: 186, label: "CENTRAL · WEST" },
      { x: 515, y: 244, w: 391, h: 186, label: "CENTRAL · EAST" },
      { x: 42, y: 446, w: 391, h: 186, label: "SOUTH · WEST" },
      { x: 515, y: 446, w: 391, h: 186, label: "SOUTH · EAST" }
    ];
    zones.forEach((zone) => {
      el("rect", { x: zone.x, y: zone.y, width: zone.w, height: zone.h, rx: 9, class: "zone-fill" });
      const text = el("text", { x: zone.x + 10, y: zone.y + 14, class: "zone-label" });
      text.textContent = zone.label;
    });
  }

  function makePath(branch) {
    const a = nodeById.get(branch.a);
    const b = nodeById.get(branch.b);
    const forward = random() > 0.44;
    const start = forward ? a : b;
    const end = forward ? b : a;
    return { d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, start, end };
  }

  const branchElements = new Map();
  function renderBranches() {
    const group = el("g", { class: "branch-group", "aria-label": "Illustrative transmission branches" });
    branches.forEach((branch) => {
      const path = makePath(branch);
      const typeClass = branch.transformer ? "transformer" : "line";
      const branchGroup = el("g", { class: `branch-item ${typeClass}` }, group);
      const title = el("title", {}, branchGroup);
      title.textContent = `Branch ${branch.id}: Bus ${branch.a} to Bus ${branch.b} · ${branch.transformer ? "Illustrative transformer" : "Illustrative transmission line"} · ${branch.activePower} MW illustrative flow`;
      const marker = branch.transformer ? "url(#transformer-arrow)" : "url(#flow-arrow)";
      el("path", { d: path.d, class: `branch ${typeClass}`, "marker-end": marker }, branchGroup);
      el("path", { d: path.d, class: `branch flow-path ${typeClass}` }, branchGroup);
      if (branch.transformer) {
        const midX = (path.start.x + path.end.x) / 2;
        const midY = (path.start.y + path.end.y) / 2;
        el("rect", { x: midX - 3.1, y: midY - 3.1, width: 6.2, height: 6.2, transform: `rotate(45 ${midX} ${midY})`, class: "transformer-core" }, branchGroup);
      }
      branchElements.set(branch.id, branchGroup);
    });
    return group;
  }

  const nodeElements = new Map();
  function renderNodes() {
    const group = el("g", { class: "nodes-group", "aria-label": "118 selectable buses" });
    nodes.forEach((node) => {
      const nodeGroup = el("g", {
        class: `bus-node ${node.voltage < 0.97 ? "voltage-watch" : "voltage-good"}`,
        transform: `translate(${node.x} ${node.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": `Bus ${node.id}, voltage ${node.voltage.toFixed(3)} per unit${node.generator ? ", generator" : ""}${node.load ? ", load" : ""}`,
        "data-bus": node.id
      }, group);
      const title = el("title", {}, nodeGroup);
      title.textContent = `Bus ${node.id} · ${node.voltage.toFixed(3)} pu · ${node.generator ? "Generator" : "No generator"} · ${node.load ? "Load" : "No load"}`;
      el("circle", { r: 13.1, class: "bus-halo" }, nodeGroup);
      el("circle", { r: 9.9, class: "bus-core" }, nodeGroup);
      const label = el("text", { class: "bus-label" }, nodeGroup);
      label.textContent = node.id;
      const gen = el("g", { class: "generator-marker" }, nodeGroup);
      if (node.generator) {
        el("rect", { x: 7, y: -17, width: 11, height: 11, rx: 3, class: "gen-mark" }, gen);
        const letter = el("text", { x: 12.5, y: -11.4, class: "gen-letter" }, gen);
        letter.textContent = "G";
      }
      const load = el("g", { class: "load-marker" }, nodeGroup);
      if (node.load) {
        el("path", { d: "M 12 7 L 18 13 L 12 19 L 6 13 Z", class: "load-mark" }, load);
        const letter = el("text", { x: 12, y: 13.5, class: "load-letter" }, load);
        letter.textContent = "L";
      }
      nodeGroup.addEventListener("click", () => selectBus(node.id));
      nodeGroup.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectBus(node.id);
        }
      });
      nodeElements.set(node.id, nodeGroup);
    });
  }

  function voltageClass(node, threshold) {
    if (node.voltage < threshold) return "threshold-low";
    return node.voltage < 0.97 ? "voltage-watch" : "voltage-good";
  }

  function renderProfile() {
    while (profile.firstChild) profile.removeChild(profile.firstChild);
    const width = 760;
    const height = 138;
    const top = 10;
    const bottom = 123;
    const min = 0.935;
    const max = 1.055;
    const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
    [0.95, 1.0, 1.05].forEach((value) => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", "0"); line.setAttribute("x2", String(width));
      line.setAttribute("y1", String(y(value))); line.setAttribute("y2", String(y(value)));
      line.setAttribute("class", "profile-gridline"); profile.appendChild(line);
    });
    const thresholdY = document.createElementNS(NS, "line");
    thresholdY.setAttribute("x1", "0"); thresholdY.setAttribute("x2", String(width));
    thresholdY.setAttribute("y1", String(y(Number($("#threshold").value)))); thresholdY.setAttribute("y2", String(y(Number($("#threshold").value))));
    thresholdY.setAttribute("class", "profile-threshold"); profile.appendChild(thresholdY);

    const step = width / nodes.length;
    nodes.forEach((node) => {
      const bar = document.createElementNS(NS, "rect");
      const barY = y(node.voltage);
      bar.setAttribute("x", String(node.id * step - step * 0.67));
      bar.setAttribute("y", String(barY));
      bar.setAttribute("width", String(Math.max(2.15, step * 0.58)));
      bar.setAttribute("height", String(Math.max(1.5, bottom - barY)));
      const state = node.voltage < Number($("#threshold").value) ? "low" : node.voltage < 0.97 ? "watch" : "";
      bar.setAttribute("class", `profile-bar ${state}${node.id === selectedBus ? " selected" : ""}`);
      bar.setAttribute("role", "button");
      bar.setAttribute("tabindex", "0");
      bar.setAttribute("aria-label", `Bus ${node.id}, ${node.voltage.toFixed(3)} per unit`);
      const title = document.createElementNS(NS, "title"); title.textContent = `Bus ${node.id}: ${node.voltage.toFixed(3)} pu`;
      bar.appendChild(title);
      bar.addEventListener("click", () => selectBus(node.id));
      bar.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectBus(node.id); }
      });
      profile.appendChild(bar);
    });
  }

  let selectedBus = 76;
  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1900);
  }

  function selectBus(id, announce = false) {
    const node = nodeById.get(Number(id));
    if (!node) {
      $("#bus-search").setAttribute("aria-invalid", "true");
      showToast("Enter a bus number from 1 to 118.");
      return false;
    }
    $("#bus-search").removeAttribute("aria-invalid");
    selectedBus = node.id;
    nodeElements.forEach((element, busId) => element.classList.toggle("selected", busId === node.id));
    $("#selected-bus-number").textContent = node.id;
    $("#selected-voltage").innerHTML = `${node.voltage.toFixed(3)} <small>pu</small>`;
    $("#selected-angle").textContent = `${node.angle < 0 ? "−" : "+"}${Math.abs(node.angle).toFixed(2)}°`;
    $("#selected-generation").textContent = node.generator ? `${node.pGen} / ${node.qGen.toFixed(1)} MVAr` : "—";
    $("#selected-demand").textContent = node.load ? `${node.pLoad} / ${node.qLoad.toFixed(1)} MVAr` : "—";
    const connected = branches.filter((branch) => branch.a === node.id || branch.b === node.id).length;
    $("#selected-branches").textContent = `${connected} branches`;
    $("#selected-type-detail").textContent = node.type.replace("*", " · illustrative");
    $("#bus-type").textContent = `${node.type.replace("*", "")} BUS`;
    const isLow = node.voltage < Number($("#threshold").value);
    $("#selected-voltage-badge").textContent = isLow ? "LOW" : "IN RANGE";
    $("#selected-voltage-badge").className = `voltage-badge ${isLow ? "low" : "normal"}`;
    $("#selected-voltage").style.color = isLow ? "#ff999e" : "#62dcb1";
    renderProfile();
    if (announce) showToast(`Selected Bus ${node.id} · ${node.voltage.toFixed(3)} pu`);
    return true;
  }

  function applyThreshold() {
    const value = Number($("#threshold").value);
    $("#threshold-value").value = `${value.toFixed(3)} pu`;
    $("#threshold-value").textContent = `${value.toFixed(3)} pu`;
    nodes.forEach((node) => {
      const element = nodeElements.get(node.id);
      element.classList.remove("threshold-low", "voltage-watch", "voltage-good");
      element.classList.add(voltageClass(node, value));
    });
    selectBus(selectedBus);
  }

  function setRunning(running) {
    svg.classList.toggle("is-running", running);
    const status = $("#flow-status");
    status.classList.toggle("running", running);
    status.classList.toggle("paused", !running);
    status.innerHTML = `<i></i>${running ? "FLOW RUNNING" : "PAUSED"}`;
    $("#flow-icon").textContent = running ? "Ⅱ" : "▶";
    $("#flow-button-label").textContent = running ? "Pause flow" : "Start flow";
    $("#flow-toggle").setAttribute("aria-pressed", String(running));
  }

  function bindControls() {
    $("#flow-toggle").addEventListener("click", () => setRunning(!svg.classList.contains("is-running")));
    $("#flow-reset").addEventListener("click", () => {
      setRunning(false);
      selectBus(76);
      showToast("Flow paused · view reset to Bus 76");
    });
    $("#threshold").addEventListener("input", applyThreshold);
    $("#toggle-lines").addEventListener("change", (event) => {
      document.querySelectorAll(".branch-item.line").forEach((branch) => branch.style.display = event.target.checked ? "" : "none");
    });
    $("#toggle-transformers").addEventListener("change", (event) => {
      document.querySelectorAll(".branch-item.transformer").forEach((branch) => branch.style.display = event.target.checked ? "" : "none");
    });
    $("#toggle-generators").addEventListener("change", (event) => {
      nodeElements.forEach((element, id) => { if (nodeById.get(id).generator) element.classList.toggle("hidden-generator", !event.target.checked); });
    });
    $("#toggle-loads").addEventListener("change", (event) => {
      nodeElements.forEach((element, id) => { if (nodeById.get(id).load) element.classList.toggle("hidden-load", !event.target.checked); });
    });
    $("#bus-search").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const match = event.currentTarget.value.trim().match(/^(?:bus\s*)?(\d{1,3})$/i);
        if (!match || !selectBus(Number(match[1]), true)) showToast("Enter a bus number from 1 to 118.");
      }
      if (event.key === "Escape") { event.currentTarget.value = ""; event.currentTarget.blur(); }
    });
    $("#fit-view").addEventListener("click", () => {
      $("#bus-search").value = "";
      selectBus(76, true);
    });
  }

  function init() {
    addDefs();
    renderZones();
    renderBranches();
    renderNodes();
    bindControls();
    selectBus(76);
    applyThreshold();
    const counts = {
      buses: nodes.length,
      branches: branches.length,
      lines: branches.filter((branch) => !branch.transformer).length,
      transformers: branches.filter((branch) => branch.transformer).length,
      generators: nodes.filter((node) => node.generator).length,
      loads: nodes.filter((node) => node.load).length
    };
    if (counts.buses !== BUS_COUNT || counts.branches !== BRANCH_COUNT || counts.transformers !== TRANSFORMER_COUNT || counts.lines !== 177 || counts.generators !== 54 || counts.loads !== 91) {
      console.error("Illustrative network count check failed", counts);
    }
    window.simulationData = { nodes, branches, counts };
  }

  init();
})();
