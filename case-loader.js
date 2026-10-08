/**
 * IEEE 118-Bus Case Loader & Solver Pipeline
 * 
 * Loads case118.json (parsed from MATPOWER case118.m), validates structure,
 * and feeds data into the AC power-flow solver for real computation.
 */

class Case118Loader {
  constructor() {
    this.caseData = null;
    this.solver = null;
    this.solverResult = null;
  }

  /**
   * Load and parse case118.json from network or local storage.
   */
  async load(jsonUrl = 'data/case118.json') {
    try {
      console.log(`[Case118Loader] Loading case file from: ${jsonUrl}`);
      const response = await fetch(jsonUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.caseData = await response.json();
      console.log(`[Case118Loader] ✓ Case file loaded successfully`);
      
      return this.validate();
    } catch (error) {
      console.error(`[Case118Loader] ✗ Failed to load case file:`, error);
      throw error;
    }
  }

  /**
   * Validate case file structure and content.
   */
  validate() {
    if (!this.caseData) {
      throw new Error('No case data loaded');
    }

    const { version, baseMVA, bus, gen, branch, metadata } = this.caseData;

    console.log(`[Case118Loader] Validating case structure...`);

    // Check version and baseMVA
    if (!version || !baseMVA) {
      throw new Error('Missing version or baseMVA in case file');
    }

    // Validate bus matrix
    if (!Array.isArray(bus) || bus.length === 0) {
      throw new Error('Invalid or empty bus matrix');
    }

    if (bus.length !== 118) {
      console.warn(
        `[Case118Loader] Warning: Expected 118 buses, got ${bus.length}`
      );
    }

    for (let i = 0; i < bus.length; i++) {
      const b = bus[i];
      if (
        !b.id ||
        !Number.isInteger(b.type) ||
        typeof b.Vm !== 'number' ||
        typeof b.Va !== 'number'
      ) {
        throw new Error(`Bus ${i} has invalid structure: ${JSON.stringify(b)}`);
      }
    }

    // Validate generator matrix
    if (!Array.isArray(gen)) {
      throw new Error('Invalid or missing gen matrix');
    }

    for (let i = 0; i < gen.length; i++) {
      const g = gen[i];
      if (
        !g.bus ||
        typeof g.Pg !== 'number' ||
        typeof g.Qg !== 'number'
      ) {
        throw new Error(`Gen ${i} has invalid structure: ${JSON.stringify(g)}`);
      }
    }

    // Validate branch matrix
    if (!Array.isArray(branch) || branch.length === 0) {
      throw new Error('Invalid or empty branch matrix');
    }

    if (branch.length !== 186) {
      console.warn(
        `[Case118Loader] Warning: Expected 186 branches, got ${branch.length}`
      );
    }

    for (let i = 0; i < branch.length; i++) {
      const br = branch[i];
      if (
        !br.fbus ||
        !br.tbus ||
        typeof br.r !== 'number' ||
        typeof br.x !== 'number'
      ) {
        throw new Error(
          `Branch ${i} has invalid structure: ${JSON.stringify(br)}`
        );
      }
    }

    console.log(`[Case118Loader] ✓ Case validation passed`);
    console.log(
      `[Case118Loader]   Base MVA: ${baseMVA}, Buses: ${bus.length}, Generators: ${gen.length}, Branches: ${branch.length}`
    );

    return { valid: true, metadata };
  }

  /**
   * Convert case118.json structure into nodes and branches
   * suitable for ACPowerFlowSolver.
   */
  buildSolverInput() {
    if (!this.caseData) {
      throw new Error('Case data not loaded. Call load() first.');
    }

    const { bus, gen, branch, baseMVA } = this.caseData;

    // Build bus-to-generator mapping
    const genByBus = {};
    gen.forEach((g) => {
      if (!genByBus[g.bus]) {
        genByBus[g.bus] = [];
      }
      genByBus[g.bus].push(g);
    });

    // Create nodes array (one per bus)
    const nodes = bus.map((b) => {
      const generators = genByBus[b.id] || [];
      const totalPg = generators.reduce((sum, g) => sum + (g.Pg || 0), 0);
      const totalQg = generators.reduce((sum, g) => sum + (g.Qg || 0), 0);

      return {
        id: b.id,
        voltage: b.Vm, // initial voltage magnitude (pu)
        angle: b.Va, // initial voltage angle (degrees)
        Pd: b.Pd || 0, // active power demand (MW)
        Qd: b.Qd || 0, // reactive power demand (MVAr)
        Gs: b.Gs || 0, // shunt conductance
        Bs: b.Bs || 0, // shunt susceptance
        pGen: totalPg, // total generation (MW)
        qGen: totalQg, // total generation (MVAr)
        pLoad: b.Pd || 0,
        qLoad: b.Qd || 0,
        type:
          b.type === 3 ? 'Slack' : b.type === 2 ? 'PV' : 'PQ',
        busType: b.type,
        Vmax: b.Vmax || 1.06,
        Vmin: b.Vmin || 0.94,
        baseKV: b.baseKV || 138,
        generator: generators.length > 0,
        load: (b.Pd || 0) > 0 || (b.Qd || 0) > 0
      };
    });

    // Create branches array
    const branches = branch.map((br) => {
      const r = br.r || 0;
      const x = br.x || 0.001; // avoid zero impedance
      const b_shunt = br.b || 0;

      return {
        id: br.id || branch.indexOf(br) + 1,
        a: br.fbus,
        b: br.tbus,
        r, // resistance
        x, // reactance
        b: b_shunt, // shunt susceptance
        transformer: br.ratio !== 0 && br.ratio !== 1, // is transformer if tap ratio != 1
        tapRatio: br.ratio || 1,
        phaseShift: br.angle || 0,
        status: br.status === 1,
        rateA: br.rateA || 0,
        activePower: 0, // to be computed by solver
        reactivePower: 0 // to be computed by solver
      };
    });

    console.log(
      `[Case118Loader] ✓ Built solver input: ${nodes.length} nodes, ${branches.length} branches`
    );

    return { nodes, branches, baseMVA };
  }

  /**
   * Execute AC power-flow solver on the case.
   */
  async solve() {
    if (!this.caseData) {
      throw new Error('Case data not loaded. Call load() first.');
    }

    try {
      const { nodes, branches, baseMVA } = this.buildSolverInput();

      // Check if solver is available globally
      if (typeof ACPowerFlowSolver === 'undefined') {
        throw new Error('ACPowerFlowSolver not found. Ensure powerflow.js is loaded.');
      }

      console.log(`[Case118Loader] Executing AC power-flow solver...`);
      this.solver = new ACPowerFlowSolver(nodes, branches);
      this.solverResult = this.solver.solve();

      if (this.solverResult.converged) {
        console.log(
          `[Case118Loader] ✓ Solver converged in ${this.solverResult.iterations} iterations`
        );
        console.log(
          `[Case118Loader]   Max mismatch: ${this.solverResult.maxMismatch.toExponential(2)}`
        );

        // Extract results
        const minVoltage = Math.min(...this.solverResult.state.magnitudes);
        const maxVoltage = Math.max(...this.solverResult.state.magnitudes);
        const losses = this.solver.calculateLosses(this.solverResult.state);

        console.log(
          `[Case118Loader]   Voltage range: ${minVoltage.toFixed(3)} - ${maxVoltage.toFixed(3)} pu`
        );
        console.log(
          `[Case118Loader]   Real-power losses: ${losses.toFixed(2)} MW`
        );

        return {
          success: true,
          result: this.solverResult,
          metrics: { minVoltage, maxVoltage, losses }
        };
      } else {
        console.warn(
          `[Case118Loader] ✗ Solver did not converge after ${this.solverResult.iterations} iterations`
        );
        return { success: false, result: this.solverResult };
      }
    } catch (error) {
      console.error(`[Case118Loader] ✗ Solver error:`, error);
      throw error;
    }
  }

  /**
   * Get solved bus voltages and angles.
   */
  getBusSolution() {
    if (!this.solverResult || !this.solverResult.converged) {
      return null;
    }

    const { state } = this.solverResult;
    return this.caseData.bus.map((b, idx) => ({
      id: b.id,
      voltage: state.magnitudes[idx],
      angle: (state.angles[idx] * 180) / Math.PI, // convert to degrees
      type: b.type
    }));
  }

  /**
   * Export full solution summary.
   */
  exportSolution() {
    if (!this.solverResult) {
      throw new Error('Solver has not been executed yet');
    }

    return {
      caseMetadata: this.caseData.metadata,
      convergence: {
        converged: this.solverResult.converged,
        iterations: this.solverResult.iterations,
        maxMismatch: this.solverResult.maxMismatch
      },
      busSolution: this.getBusSolution(),
      systemMetrics: {
        minVoltage: Math.min(...this.solverResult.state.magnitudes),
        maxVoltage: Math.max(...this.solverResult.state.magnitudes),
        losses: this.solver.calculateLosses(this.solverResult.state)
      }
    };
  }
}

// Export for use in HTML
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Case118Loader };
}
