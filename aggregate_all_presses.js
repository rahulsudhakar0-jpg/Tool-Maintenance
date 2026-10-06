const { execSync } = require('child_process');

const sheetId = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';

const pressSheets = [
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

const allPartsGoodQty = {};
const pressBreakdown = {};

pressSheets.forEach(ps => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${ps.gid}`;
        const res = execSync(`curl.exe -s "${url}"`).toString();
        const m = res.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (!m) return;
        const d = JSON.parse(m[1]);
        
        // Find column index for Part No and Good quantity
        let colPartNo = 10;
        let colPartName = 9;
        let colGoodQty = 29;

        // Check if headers match
        d.table.cols.forEach((c, idx) => {
            const lbl = (c.label || c.id || '').toLowerCase();
            if (lbl.includes('part no') || lbl.includes('part_no')) colPartNo = idx;
            if (lbl.includes('product name') || lbl.includes('产品名称')) colPartName = idx;
            if (lbl.includes('good quantity') || lbl.includes('合格数')) colGoodQty = idx;
        });

        let sheetSum = 0;
        let sheetRuns = 0;

        d.table.rows.forEach(r => {
            const c = r.c || [];
            const partNo = c[colPartNo] ? String(c[colPartNo].v !== null ? c[colPartNo].v : c[colPartNo].f || '').trim() : '';
            const partName = c[colPartName] ? String(c[colPartName].v !== null ? c[colPartName].v : c[colPartName].f || '').trim() : '';
            const goodQty = c[colGoodQty] ? Number(c[colGoodQty].v) || 0 : 0;

            if (partNo && goodQty > 0) {
                // Normalize part number
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
                sheetSum += goodQty;
                sheetRuns++;
            }
        });

        console.log(`Press ${ps.name.padEnd(15)}: ${sheetRuns} runs logged, sum Good Qty = ${sheetSum.toLocaleString()}`);
    } catch (e) {
        console.error(`Error fetching ${ps.name}:`, e.message);
    }
});

console.log(`\n=== Total unique parts with Good Quantity across all presses: ${Object.keys(allPartsGoodQty).length} ===`);

// Convert Set to Array for JSON output
const outputList = Object.values(allPartsGoodQty).map(item => ({
    partNo: item.partNo,
    partName: item.partName,
    totalGoodQuantity: item.totalGoodQuantity,
    runs: item.runs,
    presses: Array.from(item.presses)
})).sort((a,b) => b.totalGoodQuantity - a.totalGoodQuantity);

console.log('\nTop 20 parts by cumulative Good Quantity:');
outputList.slice(0, 20).forEach((item, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. [${item.partNo.padEnd(22)}] ${item.partName.padEnd(25)} -> ${item.totalGoodQuantity.toLocaleString().padStart(11)} (${item.runs} runs across ${item.presses.join(', ')})`);
});

const fs = require('fs');
fs.writeFileSync('c:/Users/Admin/Desktop/project/oee_good_quantities_summary.json', JSON.stringify(outputList, null, 2), 'utf8');
console.log('Saved oee_good_quantities_summary.json');
