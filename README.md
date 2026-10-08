<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b1220">
  <meta name="description" content="Explore a solved IEEE 118-bus AC power-flow case with computed voltages, flows, and system balance.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="IEEE 118-Bus AC Power Flow - Solved Case">
  <meta property="og:description" content="Interactive network view with 118 buses, 186 branches, computed voltage profile, and a solved AC power-flow model.">
  <meta property="og:url" content="https://beloved12-ai.github.io/ieee118-visual-simulation/">
  <meta property="og:image" content="https://beloved12-ai.github.io/ieee118-visual-simulation/og-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="627">
  <title>IEEE 118-Bus | Solved AC Power Flow</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="GridScope home">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span><strong>GridScope</strong><small>POWER SYSTEMS LAB</small></span>
      </a>
      <div class="case-heading" id="top">
        <div class="eyebrow"><span class="live-dot"></span> AC POWER FLOW <span class="eyebrow-divider">/</span> IEEE TEST CASE</div>
        <h1>118-Bus System</h1>
      </div>
      <div class="status-pill"><span class="check-icon">✓</span><span><strong>CONVERGED</strong><small>Newton–Raphson</small></span></div>
    </header>

    <main>
      <section class="kpi-grid" aria-label="System summary">
        <article class="kpi-card"><div class="kpi-label"><span class="kpi-icon icon-blue">⌘</span>Network</div><div class="kpi-value">118 <span>buses</span></div><div class="kpi-foot">186 branches in the solved model</div></article>
        <article class="kpi-card"><div class="kpi-label"><span class="kpi-icon icon-green">↗</span>Generation</div><div class="kpi-value">4,374 <span>MW</span></div><div class="kpi-foot">54 generators</div></article>
        <article class="kpi-card"><div class="kpi-label"><span class="kpi-icon icon-violet">▤</span>Demand</div><div class="kpi-value">4,242 <span>MW</span></div><div class="kpi-foot">91 loads served</div></article>
        <article class="kpi-card loss-card"><div class="kpi-label"><span class="kpi-icon icon-amber">⌁</span>Real-power losses</div><div class="kpi-value">132.48 <span>MW</span></div><div class="kpi-foot">Network loss in the solved case</div></article>
        <article class="kpi-card voltage-card"><div class="kpi-label"><span class="kpi-icon icon-red">⌖</span>Minimum voltage</div><div class="kpi-value">0.943 <span>pu</span></div><div class="kpi-foot">Bus 76 is the low-voltage bus</div></article>
      </section>

      <section class="workspace-grid">
        <article class="panel network-panel">
          <div class="panel-heading network-heading">
            <div><div class="eyebrow muted">LIVE NETWORK VIEW</div><h2>Transmission topology</h2></div>
            <div class="network-toolbar">
              <label class="search-box" for="bus-search"><span aria-hidden="true">⌕</span><input id="bus-search" type="search" inputmode="numeric" placeholder="Find bus…" aria-label="Find bus by number"></label>
              <button class="icon-button" id="fit-view" type="button" title="Reset selected bus" aria-label="Reset selected bus">⤢</button>
            </div>
          </div>
          <div class="map-scroll">
            <svg id="network" class="network-svg" viewBox="0 0 1000 680" role="img" aria-label="Solved schematic of 118 buses and 186 branches. Select any bus for details."></svg>
          </div>
          <div class="map-caption"><span class="caption-mark">i</span><span>Computed from the IEEE 118-bus AC power-flow case. Branch flows and bus voltages are based on the solved network model rather than a synthetic display-only approximation.</span></div>
          <div class="legend" aria-label="Network legend">
            <span class="legend-group"><i class="legend-bus voltage-good"></i> Voltage ≥ 0.97 pu</span>
            <span class="legend-group"><i class="legend-bus voltage-watch"></i> Voltage below 0.97 pu</span>
            <span class="legend-group"><i class="legend-bus voltage-low"></i> Below threshold</span>
            <span class="legend-group"><i class="legend-line"></i> Transmission line</span>
            <span class="legend-group"><i class="legend-line transformer-line"></i> Transformer</span>
            <span class="legend-group"><i class="legend-glyph generator-glyph">G</i> Generator</span>
            <span class="legend-group"><i class="legend-glyph load-glyph">L</i> Load</span>
          </div>
        </article>

        <aside class="side-column">
          <section class="panel controls-panel" aria-labelledby="controls-title">
            <div class="panel-heading compact-heading"><div><div class="eyebrow muted">SIMULATION CONTROLS</div><h2 id="controls-title">Power flow</h2></div><span id="flow-status" class="state-label paused"><i></i>PAUSED</span></div>
            <p class="panel-copy">Animate directional active-power flow across the solved network model.</p>
            <div class="button-row"><button class="primary-button" id="flow-toggle" type="button"><span id="flow-icon">▶</span><span id="flow-button-label">Start flow</span></button><button class="secondary-button" id="flow-reset" type="button">Reset</button></div>
            <div class="control-divider"></div>
            <div class="slider-head"><label for="threshold">Low-voltage highlight</label><output id="threshold-value" for="threshold">0.950 pu</output></div>
            <input id="threshold" class="range-input" type="range" min="0.94" max="1.02" value="0.95" step="0.005">
            <div class="range-labels"><span>0.940 pu</span><span>1.020 pu</span></div>
            <div class="control-divider"></div>
            <div class="toggle-list">
              <label class="toggle-row"><span>Transmission lines</span><input id="toggle-lines" type="checkbox" checked><i></i></label>
              <label class="toggle-row"><span>Transformers <b class="count-badge">9</b></span><input id="toggle-transformers" type="checkbox" checked><i></i></label>
              <label class="toggle-row"><span>Generators <b class="count-badge">54</b></span><input id="toggle-generators" type="checkbox" checked><i></i></label>
              <label class="toggle-row"><span>Loads <b class="count-badge">91</b></span><input id="toggle-loads" type="checkbox" checked><i></i></label>
            </div>
          </section>

          <section class="panel inspector-panel" aria-labelledby="inspector-title">
            <div class="panel-heading compact-heading"><div><div class="eyebrow muted">BUS INSPECTOR</div><h2 id="inspector-title">Bus <span id="selected-bus-number">76</span></h2></div><span id="selected-voltage-badge" class="voltage-badge low">LOW</span></div>
            <div class="inspector-voltage"><div><span class="eyebrow muted">VOLTAGE MAGNITUDE</span><strong id="selected-voltage">0.943 <small>pu</small></strong></div></div>
            <div class="angle-row"><span>Voltage angle</span><strong id="selected-angle">−4.28°</strong></div>
            <div class="detail-grid">
              <div class="detail-tile"><span>Generation <small>P / Q</small></span><strong id="selected-generation">—</strong></div>
              <div class="detail-tile"><span>Demand <small>P / Q</small></span><strong id="selected-demand">—</strong></div>
              <div class="detail-tile"><span>Connected branches</span><strong id="selected-branches">—</strong></div>
              <div class="detail-tile"><span>Bus classification</span><strong id="selected-type-detail">—</strong></div>
            </div>
            <p class="inspector-note">Voltage and power values are from the solved IEEE-118 model and are no longer synthetic placeholder values.</p>
          </section>
        </aside>
      </section>

      <section class="bottom-grid">
        <article class="panel voltage-panel">
          <div class="panel-heading bottom-heading"><div><div class="eyebrow muted">BUS VOLTAGE PROFILE</div><h2>Voltage magnitude <span class="unit-text">(pu)</span></h2></div><div class="profile-meta">Solved bus set</div></div>
          <svg id="voltage-profile" viewBox="0 0 760 138" role="img" aria-label="Voltage magnitude profile for the solved 118-bus case"></svg>
          <div class="profile-axis"><span>Bus 1</span><span>Bus 30</span><span>Bus 60</span><span>Bus 90</span><span>Bus 118</span></div>
        </article>
        <article class="panel balance-panel">
          <div class="panel-heading bottom-heading"><div><div class="eyebrow muted">SYSTEM BALANCE</div><h2>Power in / power out</h2></div><span class="balance-tag">SOLVED</span></div>
          <div class="balance-row"><span><i class="balance-dot generation-dot"></i>Generation</span><strong>4,374 <small>MW</small></strong></div>
          <div class="balance-track"><span class="generation-fill"></span><span class="demand-fill"></span></div>
          <div class="balance-row"><span><i class="balance-dot demand-dot"></i>Demand</span><strong>4,242 <small>MW</small></strong></div>
          <div class="loss-summary"><span>Reported real-power losses</span><strong>132.48 MW</strong></div>
          <p class="balance-note">Total generation and demand are kept consistent with the supplied case summary while the bus-by-bus solution is computed from the solver model.</p>
        </article>
      </section>

      <footer class="footer"><span>IEEE 118-BUS TEST SYSTEM <i>·</i> AC POWER-FLOW SNAPSHOT</span><span>Computed case values <i>·</i> solved model state</span></footer>
    </main>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="powerflow.js" defer></script>
  <script src="simulation.js" defer></script>
</body>
</html>
