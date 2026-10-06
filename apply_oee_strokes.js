const fs = require('fs');

const excelJsonPath = 'c:/Users/Admin/Desktop/project/excel_data.json';
const excelData = JSON.parse(fs.readFileSync(excelJsonPath, 'utf8'));

const oeeList = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/oee_good_quantities_summary.json', 'utf8'));

// Build lookup maps
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

let updatedCount = 0;

excelData.tools.forEach(tool => {
    const rawPn = tool.partNumber || '';
    const cleanPn = rawPn.toLowerCase().trim();
    const normPn = rawPn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    let match = oeeMapExact.get(cleanPn);

    // Fuzzy matching against part number tokens
    if (!match) {
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

    if (!match && normPn) {
        match = oeeMapNorm.get(normPn);
    }

    if (!match) {
        for (const [k, v] of oeeMapNorm.entries()) {
            if (k.length >= 6 && (normPn.includes(k) || k.includes(normPn))) {
                match = v;
                break;
            }
        }
    }

    if (match && match.totalGoodQuantity > 0) {
        tool.strokesCurrent = match.totalGoodQuantity;
        tool.colAD_ToolShot = match.totalGoodQuantity;
        tool.oeeRuns = match.runs;
        tool.oeePresses = match.presses.join(', ');
        tool.matchedOeePart = match.partNo;

        // Recalculate wear %
        const wearPct = Math.round((tool.strokesCurrent / tool.strokesMax) * 100);
        tool.strokeWearPercent = wearPct;

        if (wearPct >= 90) {
            tool.healthStatus = 'Critical Attention';
        } else if (wearPct >= 75) {
            tool.healthStatus = 'Maintenance Due';
        } else {
            tool.healthStatus = 'Operational';
        }

        updatedCount++;
    }
});

console.log(`Updated ${updatedCount} tools with exact sum of Column AD Good Quantity from OEE sheet!`);

// Update metadata
excelData.metadata.strokeDataSource = 'OEE-2026 (Col AD Good Quantity Sum across Press Logs)';
excelData.metadata.lastUpdated = new Date().toISOString();

// Write updated excel_data.json
fs.writeFileSync(excelJsonPath, JSON.stringify(excelData, null, 2), 'utf8');

// Write updated data.js
const dataJsPath = 'c:/Users/Admin/Desktop/project/data.js';
const jsHeader = `/**
 * Tool Maintenance Web Application - Consolidated Multi-Year Dataset (2024, 2025, 2026)
 * Total Tools: 253
 * 2024 Tools: 105
 * 2025 Tools: 126
 * 2026 Tools: 22
 * Matched with Column B Part Pictures from Google Sheet
 * Stroke values linked to Column AD 'Good quantity' sum from OEE Production Logs
 * Generated: ${new Date().toISOString()}
 */

var INITIAL_DATA = ${JSON.stringify(excelData, null, 4)};

if (typeof window !== 'undefined') {
    window.INITIAL_DATA = INITIAL_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = INITIAL_DATA;
}
`;

fs.writeFileSync(dataJsPath, jsHeader, 'utf8');
console.log('Saved data.js and excel_data.json successfully!');
