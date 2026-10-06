const { execSync } = require('child_process');

const sheetId = '1-3RKcRJC_ENe-xCWMIYYHqYYaKj0cyCG8n-MwMWQMXM';
const html = execSync(`curl.exe -s "https://docs.google.com/spreadsheets/d/${sheetId}/htmlview"`).toString();

const re = /items\.push\(\{name:\s*"([^"]+)"[^}]+gid:\s*"([^"]+)"/g;
let m;
const sheets = [];
while ((m = re.exec(html)) !== null) {
    sheets.push({ name: m[1].trim(), gid: m[2] });
}

console.log('Sheets found in OEE workbook:', sheets);
