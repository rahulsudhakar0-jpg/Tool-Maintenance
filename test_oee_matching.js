const fs = require('fs');

const excelData = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/excel_data.json', 'utf8'));
const oeeList = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/oee_good_quantities_summary.json', 'utf8'));

// Build lookup maps for OEE data
// 1. Exact part number
// 2. Normalized part number (alphanumeric only)
const oeeMapExact = new Map();
const oeeMapNorm = new Map();

oeeList.forEach(item => {
    oeeMapExact.set(item.partNo.toLowerCase(), item);
    const norm = item.partNo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (norm) {
        if (!oeeMapNorm.has(norm) || oeeMapNorm.get(norm).totalGoodQuantity < item.totalGoodQuantity) {
            oeeMapNorm.set(norm, item);
        }
    }
});

let matchedCount = 0;
const matchedDetails = [];

excelData.tools.forEach(tool => {
    const rawPn = tool.partNumber || '';
    const cleanPn = rawPn.toLowerCase().trim();
    const normPn = rawPn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    let match = oeeMapExact.get(cleanPn);

    // Fuzzy matching against part number tokens
    if (!match) {
        // Split multi-part numbers like "48187088&7089" or "48187061AA /S1B14877"
        const tokens = rawPn.split(/[\/&, \s]+/);
        for (const tok of tokens) {
            const tokClean = tok.toLowerCase().trim();
            const tokNorm = tok.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (tokClean && oeeMapExact.has(tokClean)) {
                match = oeeMapExact.get(tokClean);
                break;
            }
            if (tokNorm && oeeMapNorm.has(tokNorm)) {
                match = oeeMapNorm.get(tokNorm);
                break;
            }
        }
    }

    // Try normalized match
    if (!match && normPn) {
        match = oeeMapNorm.get(normPn);
    }

    // Substring match
    if (!match) {
        for (const [k, v] of oeeMapNorm.entries()) {
            if (k.length >= 6 && (normPn.includes(k) || k.includes(normPn))) {
                match = v;
                break;
            }
        }
    }

    if (match) {
        matchedCount++;
        matchedDetails.push({
            toolId: tool.id,
            toolName: tool.description,
            partNumber: tool.partNumber,
            matchedOeePart: match.partNo,
            oeeGoodQuantitySum: match.totalGoodQuantity,
            runs: match.runs,
            presses: match.presses
        });
    }
});

console.log(`Matched ${matchedCount} / ${excelData.tools.length} tools to OEE Good Quantity sum!`);
console.log('\nSample matches:');
matchedDetails.slice(0, 25).forEach(m => {
    console.log(`[${m.toolId}] ${m.toolName.padEnd(25)} | PN: ${m.partNumber.padEnd(25)} -> OEE: ${m.matchedOeePart.padEnd(15)} = ${m.oeeGoodQuantitySum.toLocaleString().padStart(11)} strokes (${m.runs} runs)`);
});
