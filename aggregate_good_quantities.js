const { execSync } = require('child_process');

const sheetId = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';

// All stamping press machine sheets in the workbook
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

function fetchSheet(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
    const res = execSync(`curl.exe -s "${url}"`).toString();
    const m = res.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
    if (!m) return null;
    return JSON.parse(m[1]);
}

// 1. First, check 6# STD-150T specifically
console.log('=== Checking 6# STD-150T (gid: 43426348) ===');
const d6 = fetchSheet('43426348');
const sumsSheet6 = {};

if (d6) {
    d6.table.rows.forEach((r, idx) => {
        const c = r.c || [];
        const partNo = c[10] ? String(c[10].v !== null ? c[10].v : c[10].f || '').trim() : '';
        const partName = c[9] ? String(c[9].v !== null ? c[9].v : c[9].f || '').trim() : '';
        const goodQty = c[29] ? Number(c[29].v) || 0 : 0;

        if (partNo && goodQty > 0) {
            if (!sumsSheet6[partNo]) {
                sumsSheet6[partNo] = { partNo, partName, totalGoodQty: 0, runCount: 0 };
            }
            sumsSheet6[partNo].totalGoodQty += goodQty;
            sumsSheet6[partNo].runCount++;
        }
    });

    console.log(`Found ${Object.keys(sumsSheet6).length} distinct parts with production runs in 6# STD-150T:`);
    Object.values(sumsSheet6).sort((a,b) => b.totalGoodQty - a.totalGoodQty).forEach(item => {
        console.log(`  Part No: ${item.partNo.padEnd(20)} | Name: ${item.partName.padEnd(25)} | Sum Good Qty: ${item.totalGoodQty.toLocaleString().padStart(10)} | Runs: ${item.runCount}`);
    });
}
