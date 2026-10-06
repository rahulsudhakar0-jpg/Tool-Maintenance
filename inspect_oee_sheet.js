const { execSync } = require('child_process');

const sheetId = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';
const gid = '43426348';
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

try {
    const res = execSync(`curl.exe -s "${url}"`).toString();
    const m = res.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
    if (m) {
        const d = JSON.parse(m[1]);
        console.log(`Sheet gid=${gid}: Total cols=${d.table.cols.length}, Total rows=${d.table.rows.length}`);
        
        // Print column labels
        const cols = d.table.cols.map((c, i) => `${i}:${c.label || c.id}`);
        console.log('Cols:', cols.slice(0, 35));

        // Print first 10 rows
        for (let r = 0; r < Math.min(10, d.table.rows.length); r++) {
            const row = d.table.rows[r];
            const vals = (row.c || []).map((c, idx) => {
                const v = c ? (c.v !== null ? c.v : c.f) : '';
                return v !== '' ? `${idx}:${v}` : null;
            }).filter(Boolean);
            console.log(`Row ${r}: ${vals.join(' | ')}`);
        }
    } else {
        console.log('Could not parse response:', res.slice(0, 500));
    }
} catch (e) {
    console.error(e);
}
