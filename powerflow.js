/**
 * AC POWER FLOW SOLVER — IEEE 118-Bus System
 * 
 * Implements full Newton-Raphson AC power flow with:
 * - Bus admittance matrix (Y-matrix) construction
 * - Mismatch calculations (real and reactive power)
 * - Jacobian matrix computation
 * - Iterative convergence to 1e-6 tolerance
 * - N-4 contingency analysis (removal of 4 branches)
 * - Voltage stability and VSD resilience metrics
 * 
 * Data structure:
 * - nodes: bus data (voltage, angle, generation, demand, type)
 * - branches: transmission line and transformer data
 */

class ACPowerFlowSolver {
  constructor(nodes, branches) {
    this.nodes = nodes;
    this.branches = branches;
    this.nBus = nodes.length;
    this.tolerance = 1e-6;
    this.maxIterations = 20;
    this.baseMVA = 100;
    
    // Bus type encoding: 1 = PQ, 2 = PV, 3 = Slack/Reference
    this.busTypes = this.initBusTypes();
    this.pvBuses = this.busTypes.map((type, i) => type === 2 ? i : -1).filter(i => i >= 0);
    this.pqBuses = this.busTypes.map((type, i) => type === 1 ? i : -1).filter(i => i >= 0);
    this.slackBus = this.busTypes.map((type, i) => type === 3 ? i : -1).filter(i => i >= 0)[0] || 0;
    
    // Build admittance matrix
    this.yMatrix = this.buildYMatrix();
    this.gMatrix = this.extractRealPart(this.yMatrix);
    this.bMatrix = this.extractImagPart(this.yMatrix);
  }

  initBusTypes() {
    return this.nodes.map(node => {
      if (node.id === 69) return 3; // Slack bus (reference)
      if (node.generator) return 2; // PV bus
      return 1; // PQ bus
    });
  }

  buildYMatrix() {
    // Initialize Y-matrix (admittance matrix)
    const Y = Array(this.nBus).fill(0).map(() => Array(this.nBus).fill({ real: 0, imag: 0 }));
    
    this.branches.forEach(branch => {
      const i = branch.a - 1;
      const j = branch.b - 1;
      
      // Branch impedance (inductive reactance X, assume R ≈ 0.01*X for transmission lines)
      let z = branch.transformer ? 0.08 : 0.05; // per-unit impedance
      let r = z * 0.01; // resistance is small
      let x = z * 0.999;
      
      // Series admittance: y = 1/z = (r - jx) / (r² + x²)
      let denom = r * r + x * x;
      let yReal = r / denom;
      let yImag = -x / denom;
      
      // Shunt admittance (small, typically 0 for lines, ~0.002 for transformers)
      let bsh = branch.transformer ? 0.002 : 0.0;
      
      // Build Y-matrix
      Y[i][i] = this.complexAdd(Y[i][i], { real: yReal, imag: yImag + bsh / 2 });
      Y[j][j] = this.complexAdd(Y[j][j], { real: yReal, imag: yImag + bsh / 2 });
      Y[i][j] = this.complexSubtract(Y[i][j], { real: yReal, imag: yImag });
      Y[j][i] = this.complexSubtract(Y[j][i], { real: yReal, imag: yImag });
    });
    
    return Y;
  }

  extractRealPart(matrix) {
    return matrix.map(row => row.map(val => val.real));
  }

  extractImagPart(matrix) {
    return matrix.map(row => row.map(val => val.imag));
  }

  complexAdd(a, b) {
    return { real: a.real + b.real, imag: a.imag + b.imag };
  }

  complexSubtract(a, b) {
    return { real: a.real - b.real, imag: a.imag - b.imag };
  }

  complexMultiply(a, b) {
    return {
      real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real
    };
  }

  complexMagnitude(a) {
    return Math.sqrt(a.real * a.real + a.imag * a.imag);
  }

  solve() {
    // State variables: [voltage angles for PV+PQ, voltage magnitudes for PQ]
    let state = this.initializeState();
    
    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Calculate power mismatches
      const { deltaP, deltaQ } = this.calculateMismatches(state);
      
      // Check convergence
      const maxMismatch = Math.max(
        ...deltaP.map(Math.abs),
        ...deltaQ.map(Math.abs)
      );
      
      if (maxMismatch < this.tolerance) {
        console.log(`AC Power Flow converged in ${iter} iterations`);
        return { converged: true, state, iterations: iter, maxMismatch };
      }
      
      // Build Jacobian matrix
      const jacobian = this.buildJacobian(state);
      
      // Solve Jacobian: [dθ, dV] = J^-1 * [ΔP, ΔQ]
      const mismatch = [...deltaP, ...deltaQ];
      const correction = this.solveLinear(jacobian, mismatch);
      
      // Update state
      state = this.updateState(state, correction);
    }
    
    console.warn("AC Power Flow did not converge");
    return { converged: false, state, iterations: this.maxIterations };
  }

  initializeState() {
    // Voltage angles and magnitudes
    const angles = this.nodes.map((node, i) => 
      i === this.slackBus ? 0 : node.angle * Math.PI / 180 || 0
    );
    const magnitudes = this.nodes.map(node => node.voltage || 1.0);
    return { angles, magnitudes };
  }

  calculateMismatches(state) {
    const deltaP = [];
    const deltaQ = [];
    
    for (let i = 0; i < this.nBus; i++) {
      let Pi = 0, Qi = 0;
      
      for (let j = 0; j < this.nBus; j++) {
        const vi = state.magnitudes[i];
        const vj = state.magnitudes[j];
        const theta_ij = state.angles[i] - state.angles[j];
        
        const gij = this.gMatrix[i][j];
        const bij = this.bMatrix[i][j];
        
        Pi += vi * vj * (gij * Math.cos(theta_ij) + bij * Math.sin(theta_ij));
        Qi += vi * vj * (gij * Math.sin(theta_ij) - bij * Math.cos(theta_ij));
      }
      
      const pGenI = this.busTypes[i] !== 1 ? this.nodes[i].pGen || 0 : 0;
      const pLoadI = this.nodes[i].pLoad || 0;
      const qGenI = this.busTypes[i] !== 1 ? this.nodes[i].qGen || 0 : 0;
      const qLoadI = this.nodes[i].qLoad || 0;
      
      if (i !== this.slackBus) {
        deltaP.push((pGenI - pLoadI) - Pi);
        if (this.busTypes[i] === 1) {
          deltaQ.push((qGenI - qLoadI) - Qi);
        }
      }
    }
    
    return { deltaP, deltaQ };
  }

  buildJacobian(state) {
    const nState = (this.nBus - 1) + this.pqBuses.length;
    const J = Array(nState).fill(0).map(() => Array(nState).fill(0));
    
    const eps = 1e-6;
    
    for (let k = 0; k < nState; k++) {
      const state_plus = JSON.parse(JSON.stringify(state));
      const state_minus = JSON.parse(JSON.stringify(state));
      
      if (k < this.nBus - 1) {
        // Angle perturbation
        const busIdx = k < this.slackBus ? k + 1 : k;
        state_plus.angles[busIdx] += eps;
        state_minus.angles[busIdx] -= eps;
      } else {
        // Voltage magnitude perturbation
        const pqIdx = k - (this.nBus - 1);
        const busIdx = this.pqBuses[pqIdx];
        state_plus.magnitudes[busIdx] += eps;
        state_minus.magnitudes[busIdx] -= eps;
      }
      
      const { deltaP: deltaP_plus, deltaQ: deltaQ_plus } = this.calculateMismatches(state_plus);
      const { deltaP: deltaP_minus, deltaQ: deltaQ_minus } = this.calculateMismatches(state_minus);
      
      const allMismatch_plus = [...deltaP_plus, ...deltaQ_plus];
      const allMismatch_minus = [...deltaP_minus, ...deltaQ_minus];
      
      for (let i = 0; i < nState; i++) {
        J[i][k] = (allMismatch_plus[i] - allMismatch_minus[i]) / (2 * eps);
      }
    }
    
    return J;
  }

  solveLinear(A, b) {
    // Gaussian elimination with partial pivoting
    const n = A.length;
    const aug = A.map((row, i) => [...row, b[i]]);
    
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
          maxRow = row;
        }
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      
      // Forward elimination
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
    
    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }
    
    return x;
  }

  updateState(state, correction) {
    const newState = {
      angles: [...state.angles],
      magnitudes: [...state.magnitudes]
    };
    
    let corrIdx = 0;
    
    // Update angles for all buses except slack
    for (let i = 0; i < this.nBus; i++) {
      if (i !== this.slackBus) {
        newState.angles[i] += correction[corrIdx++];
      }
    }
    
    // Update magnitudes for PQ buses only
    for (const pqIdx of this.pqBuses) {
      newState.magnitudes[pqIdx] += correction[corrIdx++];
    }
    
    return newState;
  }

  calculateLosses(state) {
    let totalLossesReal = 0;
    
    this.branches.forEach(branch => {
      const i = branch.a - 1;
      const j = branch.b - 1;
      
      const vi = state.magnitudes[i];
      const vj = state.magnitudes[j];
      const theta_ij = state.angles[i] - state.angles[j];
      
      let z = branch.transformer ? 0.08 : 0.05;
      let r = z * 0.01;
      
      // Losses = I² * R
      const iij_real = vi * this.gMatrix[i][j] - vj * this.gMatrix[i][j] * Math.cos(theta_ij) - vj * this.bMatrix[i][j] * Math.sin(theta_ij);
      const iij_imag = vi * this.bMatrix[i][j] - vj * this.gMatrix[i][j] * Math.sin(theta_ij) + vj * this.bMatrix[i][j] * Math.cos(theta_ij);
      const iij_mag_sq = iij_real * iij_real + iij_imag * iij_imag;
      
      totalLossesReal += iij_mag_sq * r;
    });
    
    return totalLossesReal * this.baseMVA;
  }

  analyzeContingency(branchesToRemove = []) {
    // N-k contingency: remove specified branches
    const originalBranches = this.branches;
    const contingentBranches = this.branches.filter(
      b => !branchesToRemove.some(idx => idx === b.id)
    );
    
    this.branches = contingentBranches;
    this.yMatrix = this.buildYMatrix();
    this.gMatrix = this.extractRealPart(this.yMatrix);
    this.bMatrix = this.extractImagPart(this.yMatrix);
    
    const result = this.solve();
    
    // Restore original branches
    this.branches = originalBranches;
    this.yMatrix = this.buildYMatrix();
    this.gMatrix = this.extractRealPart(this.yMatrix);
    this.bMatrix = this.extractImagPart(this.yMatrix);
    
    return result;
  }

  analyzeVSDResilience() {
    // Voltage-Stability Distance: margin from voltage collapse
    const result = this.solve();
    
    if (!result.converged) {
      return { resilience: 0, margin: 0, status: "Unstable" };
    }
    
    const minVoltage = Math.min(...result.state.magnitudes);
    const margin = minVoltage - 0.90; // Assume 0.90 pu is collapse threshold
    const resilience = Math.max(0, Math.min(100, margin * 50)); // Scale to 0-100%
    
    return {
      resilience,
      margin,
      minVoltage,
      status: resilience > 50 ? "Resilient" : resilience > 25 ? "Marginal" : "Vulnerable"
    };
  }

  exportResults(result) {
    return {
      converged: result.converged,
      iterations: result.iterations,
      state: {
        angles: result.state.angles.map((a, i) => ({ bus: i + 1, angle: a * 180 / Math.PI })),
        magnitudes: result.state.magnitudes.map((v, i) => ({ bus: i + 1, voltage: v }))
      },
      losses: this.calculateLosses(result.state),
      vsd: this.analyzeVSDResilience()
    };
  }
}

// Export for use in HTML/simulation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ACPowerFlowSolver;
}
