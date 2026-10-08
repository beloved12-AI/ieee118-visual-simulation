#!/usr/bin/env node
/**
 * IEEE 118-Bus Case File Parser
 * Converts MATPOWER case118.m format to JSON for browser-based AC power-flow solver
 * 
 * Usage:
 *   node scripts/parse-case118.js [input.m] [output.json]
 * 
 * Default paths:
 *   Input:  data/case118.m
 *   Output: data/case118.json
 */

const fs = require('fs');
const path = require('path');

class MATCase118Parser {
  constructor() {
    this.baseMVA = 100;
    this.bus = [];
    this.gen = [];
    this.branch = [];
  }

  /**
   * Extract a matrix from MATPOWER case file.
   * Handles MATLAB comments (%), multi-line arrays, and semicolon terminators.
   */
  extractMatrix(source, label) {
    // Match mpc.bus = [...]; or mpc.gen = [...]; etc.
    const pattern = new RegExp(
      `mpc\\.${label}\\s*=\\s*\\[([\\s\\S]*?)\\];`,
      'i'
    );
    const match = source.match(pattern);

    if (!match) {
      throw new Error(`Could not find mpc.${label} matrix in case file`);
    }

    const matrixContent = match[1];

    // Remove inline comments (% to end of line)
    const cleaned = matrixContent
      .split('\n')
      .map((line) => {
        const commentIndex = line.indexOf('%');
        return commentIndex === -1 ? line : line.substring(0, commentIndex);
      })
      .join('\n');

    // Split by semicolons (row terminators) and parse
    const rows = cleaned
      .split(';')
      .map((row) => row.trim())
      .filter((row) => row.length > 0)
      .map((row) => {
        const cells = row
          .split(/[\s,]+/)
          .filter((cell) => cell.length > 0);
        return cells.map((cell) => {
          const num = parseFloat(cell);
          return isNaN(num) ? 0 : num;
        });
      });

    return rows;
  }

  /**
   * Parse baseMVA from case file.
   */
  parseBaseMVA(source) {
    const match = source.match(/mpc\.baseMVA\s*=\s*(\d+(?:\.\d+)?)/);
    if (match) {
      this.baseMVA = parseFloat(match[1]);
    }
  }

  /**
   * Parse and validate bus matrix.
   * Format: bus_i type Pd Qd Gs Bs area Vm Va baseKV zone Vmax Vmin
   * Columns: 0=id, 1=type, 2=Pd, 3=Qd, 4=Gs, 5=Bs, 6=area, 7=Vm, 8=Va, 9=baseKV, 10=zone, 11=Vmax, 12=Vmin
   */
  validateAndProcessBus(busMatrix) {
    if (busMatrix.length !== 118) {
      console.warn(
        `Warning: Expected 118 buses, got ${busMatrix.length}. Proceeding anyway.`
      );
    }

    this.bus = busMatrix.map((row, idx) => {
      if (row.length < 13) {
        throw new Error(
          `Bus row ${idx} has insufficient columns: ${row.length} (expected 13)`
        );
      }

      const busId = Math.round(row[0]);
      const type = Math.round(row[1]); // 1=PQ, 2=PV, 3=Slack/Ref
      const Pd = row[2];
      const Qd = row[3];
      const Gs = row[4];
      const Bs = row[5];
      const area = Math.round(row[6]);
      const Vm = row[7]; // voltage magnitude
      const Va = row[8]; // voltage angle in degrees
      const baseKV = row[9];
      const zone = Math.round(row[10]);
      const Vmax = row[11];
      const Vmin = row[12];

      return {
        id: busId,
        type,
        Pd,
        Qd,
        Gs,
        Bs,
        area,
        Vm,
        Va,
        baseKV,
        zone,
        Vmax,
        Vmin
      };
    });

    console.log(`✓ Parsed ${this.bus.length} buses`);
  }

  /**
   * Parse and validate generator matrix.
   * Format: bus Pg Qg Qmax Qmin Vg mBase status Pmax Pmin Pc1 Pc2 Qc1max Qc1min Qc2max Qc2min ramp_agc ramp_10 ramp_30 ramp_q apf
   * Columns: 0=bus, 1=Pg, 2=Qg, 3=Qmax, 4=Qmin, 5=Vg, 6=mBase, 7=status, 8=Pmax, 9=Pmin, ...
   */
  validateAndProcessGen(genMatrix) {
    console.log(`Processing ${genMatrix.length} generators...`);

    this.gen = genMatrix.map((row, idx) => {
      if (row.length < 21) {
        console.warn(
          `Generator row ${idx} has ${row.length} columns (expected 21). Truncating.`
        );
      }

      const bus = Math.round(row[0]);
      const Pg = row[1];
      const Qg = row[2];
      const Qmax = row[3];
      const Qmin = row[4];
      const Vg = row[5]; // voltage setpoint
      const mBase = row[6];
      const status = Math.round(row[7]);
      const Pmax = row[8];
      const Pmin = row[9];

      return {
        bus,
        Pg,
        Qg,
        Qmax,
        Qmin,
        Vg,
        mBase,
        status,
        Pmax,
        Pmin
      };
    });

    console.log(`✓ Parsed ${this.gen.length} generators`);
  }

  /**
   * Parse and validate branch matrix.
   * Format: fbus tbus r x b rateA rateB rateC ratio angle status angmin angmax
   * Columns: 0=from, 1=to, 2=r, 3=x, 4=b, 5=rateA, 6=rateB, 7=rateC, 8=ratio, 9=angle, 10=status, 11=angmin, 12=angmax
   */
  validateAndProcessBranch(branchMatrix) {
    if (branchMatrix.length !== 186) {
      console.warn(
        `Warning: Expected 186 branches, got ${branchMatrix.length}. Proceeding anyway.`
      );
    }

    this.branch = branchMatrix.map((row, idx) => {
      if (row.length < 13) {
        throw new Error(
          `Branch row ${idx} has insufficient columns: ${row.length} (expected 13)`
        );
      }

      const fbus = Math.round(row[0]);
      const tbus = Math.round(row[1]);
      const r = row[2]; // resistance
      const x = row[3]; // reactance
      const b = row[4]; // susceptance
      const rateA = row[5];
      const rateB = row[6];
      const rateC = row[7];
      const ratio = row[8]; // transformer tap ratio
      const angle = row[9]; // phase shift in degrees
      const status = Math.round(row[10]);
      const angmin = row[11];
      const angmax = row[12];

      return {
        id: idx + 1,
        fbus,
        tbus,
        r,
        x,
        b,
        rateA,
        rateB,
        rateC,
        ratio,
        angle,
        status,
        angmin,
        angmax
      };
    });

    console.log(`✓ Parsed ${this.branch.length} branches`);
  }

  /**
   * Main parsing pipeline.
   */
  parse(filePath) {
    console.log(`Parsing IEEE 118-bus case from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const source = fs.readFileSync(filePath, 'utf8');

    // Parse baseMVA
    this.parseBaseMVA(source);
    console.log(`✓ Base MVA: ${this.baseMVA}`);

    // Extract and validate matrices
    const busMatrix = this.extractMatrix(source, 'bus');
    const genMatrix = this.extractMatrix(source, 'gen');
    const branchMatrix = this.extractMatrix(source, 'branch');

    this.validateAndProcessBus(busMatrix);
    this.validateAndProcessGen(genMatrix);
    this.validateAndProcessBranch(branchMatrix);

    return {
      version: '2',
      baseMVA: this.baseMVA,
      bus: this.bus,
      gen: this.gen,
      branch: this.branch,
      metadata: {
        busCount: this.bus.length,
        genCount: this.gen.length,
        branchCount: this.branch.length,
        parsedAt: new Date().toISOString()
      }
    };
  }
}

/**
 * CLI entry point.
 */
function main() {
  const inputPath =
    process.argv[2] || path.join(process.cwd(), 'data', 'case118.m');
  const outputPath =
    process.argv[3] || path.join(process.cwd(), 'data', 'case118.json');

  try {
    const parser = new MATCase118Parser();
    const caseData = parser.parse(inputPath);

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(caseData, null, 2));
    console.log(`\n✓ Case file successfully converted!`);
    console.log(`  Output: ${outputPath}`);
    console.log(
      `  Summary: ${caseData.bus.length} buses, ${caseData.gen.length} generators, ${caseData.branch.length} branches`
    );
  } catch (error) {
    console.error(`\n✗ Parser error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MATCase118Parser };
