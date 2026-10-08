const fs = require('fs');
const path = require('path');

function parseCase118MatFile(fileText) {
  const busMatch = fileText.match(/mpc\.bus\s*=\s*\[([\s\S]*?)\];\s*\n\s*%%\s*generator data/i);
  const genMatch = fileText.match(/mpc\.gen\s*=\s*\[([\s\S]*?)\];\s*\n\s*%%\s*branch data/i);
  const branchMatch = fileText.match(/mpc\.branch\s*=\s*\[([\s\S]*?)\];\s*\n\s*%%\s*-----\s*OPF Data/i);
  const baseMvaMatch = fileText.match(/mpc\.baseMVA\s*=\s*([0-9.]+)/i);

  if (!busMatch || !genMatch || !branchMatch) {
    throw new Error('Unable to find required mpc.bus / mpc.gen / mpc.branch blocks in case118.m');
  }

  const parseMatrix = (text) => {
    return text
      .split(';')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((row) => row
        .split(/\s+/)
        .map((cell) => cell.trim())
        .filter(Boolean)
        .map((value) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : value;
        })
      )
      .filter((row) => row.length > 0)
      .map((row) => row.map((value) => typeof value === 'number' ? value : Number(value)));
  };

  const baseMVA = baseMvaMatch ? Number(baseMvaMatch[1]) : 100;
  const bus = parseMatrix(busMatch[1]).filter((row) => row.length >= 13);
  const gen = parseMatrix(genMatch[1]).filter((row) => row.length >= 10);
  const branch = parseMatrix(branchMatch[1]).filter((row) => row.length >= 13);

  return {
    version: '2',
    baseMVA,
    bus: bus.map((row, idx) => ({
      id: row[0],
      type: row[1],
      Pd: row[2],
      Qd: row[3],
      Gs: row[4],
      Bs: row[5],
      area: row[6],
      Vm: row[7],
      Va: row[8],
      baseKV: row[9],
      zone: row[10],
      Vmax: row[11],
      Vmin: row[12]
    })),
    gen: gen.map((row) => ({
      bus: row[0],
      Pg: row[1],
      Qg: row[2],
      Qmax: row[3],
      Qmin: row[4],
      Vg: row[5],
      mBase: row[6],
      status: row[7],
      Pmax: row[8],
      Pmin: row[9]
    })),
    branch: branch.map((row, idx) => ({
      id: idx + 1,
      fbus: row[0],
      tbus: row[1],
      r: row[2],
      x: row[3],
      b: row[4],
      rateA: row[5],
      rateB: row[6],
      rateC: row[7],
      ratio: row[8],
      angle: row[9],
      status: row[10],
      angmin: row[11],
      angmax: row[12]
    })),
    metadata: {
      source: 'MATPOWER official case118.m',
      busCount: bus.length,
      genCount: gen.length,
      branchCount: branch.length,
      parsedAt: new Date().toISOString()
    }
  };
}

async function main() {
  const inputPath = process.argv[2] || path.join(process.cwd(), 'data', 'case118.m');
  const outputPath = process.argv[3] || path.join(process.cwd(), 'data', 'case118.json');

  const inputText = fs.readFileSync(inputPath, 'utf8');
  const parsed = parseCase118MatFile(inputText);
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

  console.log(`Parsed: ${parsed.bus.length} buses`);
  console.log(`Parsed: ${parsed.gen.length} generators`);
  console.log(`Parsed: ${parsed.branch.length} branches`);
  console.log(`Saved to: ${outputPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}

module.exports = { parseCase118MatFile };
