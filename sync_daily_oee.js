/**
 * Automated Daily OEE Synchronization Script
 * Fetches all 13 press machine logs from Google Sheet:
 * 'OEE-2026 original format 2026' (ID: 1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM)
 * Extracts and sums Column AD ('X2 合格数 Good quantity') across all daily production entries
 * Updates data.js, excel_data.json, and consolidated files
 */

const fs = require('fs');
const https = require('https');

const SHEET_ID = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';

const PRESS_SHEETS = [
    { name: '1# OCP-80T', gid: '587870018' },
    { name: '2# MHS-80T', gid: '2065750272' },
    { name: '3# OCP-110T', gid: '1363407651' },
    { name: '4# SN1-110T', gid: '280483646' },
    { name: '5# OCP-110T', gid: '1314347229' },
    { name: '6# STD-150T', gid: '43426348' },
    { name: '7# GTX-300T', gid: '236922057' },
    { name: '8# GTX-500T', gid: '323827484' },
    { name: '9# OCP-110T', gid: '1496168527' },
    { name: '10# OCP-260 T', gid: '804228985' },
    { name: '11# 200T', gid: '797360584' },
    { name: '12# 200T', gid: '190763615' },
    { name: '13# 110T', gid: '659449304' }
];

function fetchGvizSheet(sheetId, gid) {
    return new Promise((resolve, reject) => {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
        https.get(url, { rejectUnauthorized: false }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const match = body.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
                if (!match) return reject(new Error('Invalid gviz format'));
                try {
                    const data = JSON.parse(match[1]);
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runDailySync() {
    console.log(`[${new Date().toISOString()}] Starting Daily OEE Column AD Sync...`);
    const allPartsGoodQty = {};
    let totalRuns = 0;
    let totalGoodQty = 0;

    for (const ps of PRESS_SHEETS) {
        try {
            const data = await fetchGvizSheet(SHEET_ID, ps.gid);
            if (!data.table || !data.table.rows) continue;

            let colPartNo = 10;
            let colPartName = 9;
            let colGoodQty = 29; // Column AD (0-indexed 29)

            data.table.cols.forEach((c, idx) => {
                const lbl = (c.label || c.id || '').toLowerCase();
                if (lbl.includes('part no') || lbl.includes('part_no')) colPartNo = idx;
                if (lbl.includes('product name') || lbl.includes('产品名称')) colPartName = idx;
                if (lbl.includes('good quantity') || lbl.includes('合格数')) colGoodQty = idx;
            });

            let sheetGoodQty = 0;
            let sheetRuns = 0;

            data.table.rows.forEach(r => {
                const c = r.c || [];
                const partNo = c[colPartNo] ? String(c[colPartNo].v !== null ? c[colPartNo].v : c[colPartNo].f || '').trim() : '';
                const partName = c[colPartName] ? String(c[colPartName].v !== null ? c[colPartName].v : c[colPartName].f || '').trim() : '';
                const goodQty = c[colGoodQty] ? Number(c[colGoodQty].v) || 0 : 0;

                if (partNo && goodQty > 0) {
                    const cleanPartNo = partNo.replace(/[\r\n]+/g, ' ').trim();
                    if (!allPartsGoodQty[cleanPartNo]) {
                        allPartsGoodQty[cleanPartNo] = {
                            partNo: cleanPartNo,
                            partName: partName.replace(/[\r\n]+/g, ' ').trim(),
                            totalGoodQuantity: 0,
                            runs: 0,
                            presses: new Set()
                        };
                    }
                    allPartsGoodQty[cleanPartNo].totalGoodQuantity += goodQty;
                    allPartsGoodQty[cleanPartNo].runs++;
                    allPartsGoodQty[cleanPartNo].presses.add(ps.name);

                    sheetGoodQty += goodQty;
                    sheetRuns++;
                    totalGoodQty += goodQty;
                    totalRuns++;
                }
            });

            console.log(`✓ ${ps.name.padEnd(16)}: ${sheetRuns.toString().padStart(4)} runs, Good Qty = ${sheetGoodQty.toLocaleString().padStart(12)}`);
        } catch (err) {
            console.error(`✗ Error fetching ${ps.name}: ${err.message}`);
        }
    }

    console.log(`\nAggregated ${Object.keys(allPartsGoodQty).length} parts with ${totalGoodQty.toLocaleString()} total Good Quantity across all 13 presses.`);

    // Read excel_data.json
    const excelJsonPath = __dirname + '/excel_data.json';
    if (!fs.existsSync(excelJsonPath)) {
        console.error('excel_data.json not found!');
        return;
    }

    const excelData = JSON.parse(fs.readFileSync(excelJsonPath, 'utf8'));

    // Build lookup maps
    const oeeMapExact = new Map();
    const oeeMapNorm = new Map();

    Object.values(allPartsGoodQty).forEach(item => {
        item.presses = Array.from(item.presses);
        oeeMapExact.set(item.partNo.toLowerCase(), item);
        const norm = item.partNo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (norm) {
            if (!oeeMapNorm.has(norm) || oeeMapNorm.get(norm).totalGoodQuantity < item.totalGoodQuantity) {
                oeeMapNorm.set(norm, item);
            }
        }
    });

    let updatedTools = 0;

    excelData.tools.forEach(tool => {
        const rawPn = tool.partNumber || '';
        const cleanPn = rawPn.toLowerCase().trim();
        const normPn = rawPn.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        let match = oeeMapExact.get(cleanPn);

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

            const wearPct = Math.round((tool.strokesCurrent / tool.strokesMax) * 100);
            tool.strokeWearPercent = wearPct;

            if (wearPct >= 90) {
                tool.healthStatus = 'Critical Attention';
            } else if (wearPct >= 75) {
                tool.healthStatus = 'Maintenance Due';
            } else {
                tool.healthStatus = 'Operational';
            }

            updatedTools++;
        }
    });

    const nowIso = new Date().toISOString();
    excelData.metadata.strokeDataSource = 'OEE-2026 (Col AD Good Quantity Sum across 13 Press Logs)';
    excelData.metadata.lastUpdated = nowIso;
    excelData.metadata.lastOeeSync = nowIso;

    // Save excel_data.json
    fs.writeFileSync(excelJsonPath, JSON.stringify(excelData, null, 2), 'utf8');

    // Save data.js
    const dataJsContent = `/**
 * Tool Maintenance Web Application - Consolidated Multi-Year Dataset (2024, 2025, 2026)
 * Total Tools: ${excelData.tools.length}
 * Stroke values linked to Column AD 'Good quantity' sum from OEE Production Logs
 * Daily Synchronized: ${nowIso}
 */

var INITIAL_DATA = ${JSON.stringify(excelData, null, 4)};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = INITIAL_DATA;
}
if (typeof window !== 'undefined') {
    window.INITIAL_DATA = INITIAL_DATA;
}
`;
    fs.writeFileSync(__dirname + '/data.js', dataJsContent, 'utf8');

    // Save summary JSON
    fs.writeFileSync(__dirname + '/oee_good_quantities_summary.json', JSON.stringify(Object.values(allPartsGoodQty), null, 2), 'utf8');

    console.log(`\n[SUCCESS] Updated ${updatedTools} tooling assets with latest Column AD Good Quantity!`);
    console.log(`Saved: excel_data.json and data.js (${nowIso})`);
}

if (require.main === module) {
    runDailySync().catch(err => {
        console.error('Fatal sync error:', err);
        process.exit(1);
    });
}

module.exports = { runDailySync, PRESS_SHEETS, SHEET_ID };
