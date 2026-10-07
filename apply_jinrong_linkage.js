/**
 * apply_jinrong_linkage.js
 * Links Warranty Tool Shots (Col AH) and Current Total Tool Shots (Col AI)
 * from 'Tool Shot Tempalte-Jinrong CH-TH(9).xlsx' to the part numbers in the system.
 */

const fs = require('fs');

const shotsFile = 'jinrong_tool_shots.json';
const dataJsFile = 'data.js';
const excelJsonFile = 'excel_data.json';
const csvFile = 'unified_tools_2024_2025_2026.csv';

const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8').replace(/^\uFEFF/, ''));
const excelData = JSON.parse(fs.readFileSync(excelJsonFile, 'utf8'));

console.log(`Loaded ${shots.length} records from Jinrong template.`);
console.log(`Loaded ${excelData.tools.length} tools from system.`);

// Helper function to extract and expand tokens from codes
function expandCodes(str) {
  const codes = new Set();
  if (!str) return [];

  let s = str.trim().toUpperCase();

  // Handle scientific notation e.g. 7.5170148E7 -> 75170148
  if (/^\d+\.?\d*E\+?\d+$/i.test(s)) {
    const num = Math.round(Number(s));
    codes.add(num.toString());
    return Array.from(codes);
  }

  // Handle SIB -> S1B
  if (s.includes('SIB')) {
    s = s.replace(/SIB/g, 'S1B');
  }

  // Extract base words and numbers
  const tokens = s.match(/[A-Z0-9\-\,\/\_]+/g) || [];
  tokens.forEach(tok => {
    const sub = tok.match(/[A-Z0-9]+/g) || [];
    sub.forEach(st => {
      if (st.length >= 4) codes.add(st);
    });

    // Check hyphen ranges like BRU30887-88-89 or BRU53697-711
    const prefixMatch = tok.match(/^([A-Z]+)(\d+)(.*)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const baseNum = prefixMatch[2];
      codes.add(prefix + baseNum);
      codes.add(baseNum);

      const rest = prefixMatch[3];
      const restParts = rest.match(/\d+/g) || [];
      restParts.forEach(rp => {
        if (rp.length === baseNum.length) {
          codes.add(prefix + rp);
          codes.add(rp);
        } else if (rp.length < baseNum.length) {
          const expandedNum = baseNum.slice(0, baseNum.length - rp.length) + rp;
          codes.add(prefix + expandedNum);
          codes.add(expandedNum);
        }
      });
    }

    // Check digit prefix without letters like 48187051-251 or 48187094-095
    const numPrefixMatch = tok.match(/^(\d{5,8})[\-\/](\d{2,8})/);
    if (numPrefixMatch) {
      const baseNum = numPrefixMatch[1];
      const secondNum = numPrefixMatch[2];
      codes.add(baseNum);
      if (secondNum.length === baseNum.length) {
        codes.add(secondNum);
      } else if (secondNum.length < baseNum.length) {
        codes.add(baseNum.slice(0, baseNum.length - secondNum.length) + secondNum);
      }
    }
  });

  return Array.from(codes);
}

// Pre-expand tokens for Jinrong shots
shots.forEach(s => {
  s._tokens = expandCodes(s.ToolNumber);
  s._nameTokens = expandCodes(s.ToolName);
});

let matchedCount = 0;
const matchLog = [];

excelData.tools.forEach(tool => {
  // Fix scientific notation in partNumber if present
  let rawPNo = tool.partNumber || '';
  if (/7\.51701\d+E7/i.test(rawPNo)) {
    tool.partNumber = Math.round(Number(rawPNo)).toString();
    rawPNo = tool.partNumber;
  }

  const pTokens = expandCodes(rawPNo + ' ' + (tool.manufactureNo || '') + ' ' + (tool.toolId || ''));
  const pName = (tool.partName || tool.description || '').toUpperCase();

  let bestShot = null;
  let matchReason = '';
  let highestScore = 0;

  for (const shot of shots) {
    let score = 0;
    let reason = '';

    // 1. Direct code token match
    for (const pt of pTokens) {
      if (pt.length < 4) continue;
      for (const st of shot._tokens) {
        if (st.length < 4) continue;

        if (pt === st) {
          const s = 100 + pt.length;
          if (s > score) {
            score = s;
            reason = `Exact PartNo token '${pt}' in ToolNumber '${shot.ToolNumber}'`;
          }
        } else if (pt.startsWith(st) && st.length >= 6) {
          const s = 85 + st.length;
          if (s > score) {
            score = s;
            reason = `PartNo token '${pt}' starts with Tool '${st}'`;
          }
        } else if (st.startsWith(pt) && pt.length >= 6) {
          const s = 85 + pt.length;
          if (s > score) {
            score = s;
            reason = `Tool '${st}' starts with PartNo '${pt}'`;
          }
        } else if (st.length >= 6 && pt.includes(st)) {
          const s = 70 + st.length;
          if (s > score) {
            score = s;
            reason = `Tool '${st}' in PartNo '${pt}'`;
          }
        } else if (pt.length >= 6 && shot.ToolNumber.toUpperCase().includes(pt)) {
          const s = 70 + pt.length;
          if (s > score) {
            score = s;
            reason = `PartNo '${pt}' in ToolNumber '${shot.ToolNumber}'`;
          }
        }
      }
    }

    // 2. Name keywords if no strong code match
    if (score < 80) {
      const distinctKws = [
        'BIMETAL', 'PRIMARY LATCH', 'SECONDARY LATCH', 'MIDDLE TERMINAL',
        'LOAD TERM', 'MAGNET LOOP', 'PADLOCKING', 'YOKE', 'UPPER LINK',
        'LOWER LINK', 'ARMATURE', 'CRADLE', 'DEFLECTEUR', 'MOVING CONTACT',
        'FIXED CONTACT', 'SHUNT', 'LOCKING LEVER', 'OUTPUT CONNECTOR',
        'INPUT CONNECTOR', 'CLAMP PLATE', 'ARC STACK', 'HANDLE ARM',
        'PLATE THREAD', 'LOCK SLIDE', 'BETA ARC', 'UPPER PLATE', 'GLAND PLATE',
        'EARTHPAD', 'NEUTRAL BUSBAR', 'NEUTRAL BRIDGE', 'METAL BOX', 'COVER'
      ];

      for (const kw of distinctKws) {
        if (pName.includes(kw) && shot.ToolName.toUpperCase().includes(kw)) {
          let kwScore = 40 + kw.length;
          if (tool.customer === 'STL') kwScore += 15;
          if (kwScore > score) {
            score = kwScore;
            reason = `Keyword '${kw}' matches in '${shot.ToolName}'`;
          }
        }
      }
    }

    // 3. Special cases:
    if (tool.id === 'TL-083' && shot.ToolNumber.includes('725905')) {
      score = 99;
      reason = 'Beta Arc extinguishing chamber match';
    }

    if (score > highestScore) {
      highestScore = score;
      bestShot = shot;
      matchReason = reason;
    }
  }

  if (bestShot && highestScore >= 50) {
    matchedCount++;

    const warranty = (typeof bestShot.WarrantyToolShots === 'number') ? bestShot.WarrantyToolShots : null;
    const currentTotal = (typeof bestShot.CurrentTotalToolShots === 'number') ? bestShot.CurrentTotalToolShots : null;
    const actualShot = (typeof bestShot.ActualToolShot === 'number') ? bestShot.ActualToolShot : null;

    tool.warrantyToolShots = warranty;
    tool.currentTotalShot = currentTotal;
    tool.actualToolShot = actualShot;
    tool.matchedToolShotId = bestShot.ToolNumber;
    tool.matchedToolShotName = bestShot.ToolName;
    tool.matchedVendor = bestShot.Vendor;
    tool.matchedEmployee = bestShot.EmployeeNumber;
    tool.matchedToolStatus = bestShot.ToolStatus;
    tool.matchReason = matchReason;

    // Synchronize strokesMax if warranty limit is certified
    if (warranty && warranty > 0) {
      tool.strokesMax = warranty;
    }

    // If strokesCurrent was not set or came from baseline, provide currentTotal
    if (!tool.colAD_ToolShot && currentTotal && currentTotal > 0) {
      tool.strokesCurrent = Math.round(currentTotal);
    }

    // Recompute health status based on strokesCurrent / strokesMax
    const pct = tool.strokesMax > 0 ? (tool.strokesCurrent / tool.strokesMax) * 100 : 0;
    if (pct >= 90) {
      tool.healthStatus = 'Critical Attention';
    } else if (pct >= 70) {
      tool.healthStatus = 'Needs Maintenance';
    } else {
      tool.healthStatus = 'Healthy Operational';
    }

    matchLog.push({
      id: tool.id,
      year: tool.year,
      partNumber: tool.partNumber,
      partName: tool.partName,
      matchedId: bestShot.ToolNumber,
      matchedName: bestShot.ToolName,
      warranty: warranty,
      currentTotal: currentTotal,
      strokesCurrent: tool.strokesCurrent,
      strokesMax: tool.strokesMax,
      reason: matchReason
    });
  }
});

console.log(`\n======================================================`);
console.log(`SUCCESSFULLY LINKED ${matchedCount} TOOLS TO JINRONG TEMPLATE!`);
console.log(`======================================================`);

// Update metadata
const nowIso = new Date().toISOString();
excelData.metadata.lastJinrongSync = nowIso;
excelData.metadata.totalJinrongLinked = matchedCount;
excelData.metadata.jinrongSourceFile = "Tool Shot Tempalte-Jinrong CH-TH(9).xlsx (Gid: 767889023)";

// Save excel_data.json
fs.writeFileSync(excelJsonFile, JSON.stringify(excelData, null, 2), 'utf8');
console.log(`Saved updated: ${excelJsonFile}`);

// Save data.js
const dataJsContent = `/**
 * Tool Maintenance Web Application - Consolidated Multi-Year Dataset (2024, 2025, 2026)
 * Total Tools: ${excelData.tools.length}
 * Stroke values linked to Column AD 'Good quantity' sum from OEE Production Logs
 * Warranty & Current Total Tool Shots linked to Jinrong Tool Shot Template (Col AH & AI)
 * Synchronized: ${nowIso}
 */

var INITIAL_DATA = ${JSON.stringify(excelData, null, 4)};

// If running in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = INITIAL_DATA;
}
`;

fs.writeFileSync(dataJsFile, dataJsContent, 'utf8');
console.log(`Saved updated: ${dataJsFile}`);

// Save match log summary
fs.writeFileSync('jinrong_linkage_summary.json', JSON.stringify(matchLog, null, 2), 'utf8');
console.log(`Saved summary of ${matchLog.length} matched tools to jinrong_linkage_summary.json`);
