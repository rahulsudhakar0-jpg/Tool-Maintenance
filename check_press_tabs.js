const { execSync } = require('child_process');

const sheetId = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';

const testSheets = [
    { name: '6# STD-150T', gid: '43426348' },
    { name: '1# OCP-80T', gid: '587870018' },
    { name: '2# MHS-80T', gid: '2065750272' },
    { name: '3# OCP-110T', gid: '1363407651' },
    { name: 'production_logs', gid: '164863658' }
];

testSheets.forEach(s => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${s.gid}`;
        const res = execSync(`curl.exe -s "${url}"`).toString();
        const m = res.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (m) {
            const d = JSON.parse(m[1]);
            const cols = d.table.cols.map((c, i) => `${i}:${c.label || c.id}`);
            console.log(`Sheet "${s.name}" (gid: ${s.gid}): rows=${d.table.rows.length}, cols=${d.table.cols.length}`);
            console.log('Sample cols around 29 (AD):', cols.slice(27, 32));
        }
    } catch (e) {
        console.error(`Error on ${s.name}:`, e.message);
    }
});
