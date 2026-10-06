const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/sheet_image_mappings.json', 'utf8'));
const map2025 = mappings['2025'];
const map2026 = mappings['2026'];

const excelData = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/excel_data.json', 'utf8'));
const tools2025 = excelData.tools.filter(t => t.year === '2025');
const tools2026 = excelData.tools.filter(t => t.year === '2026');

console.log('=== Verifying 2025 tools ===');
tools2025.slice(0, 5).forEach((t, i) => {
    const row = i + 3;
    const img = map2025[row];
    console.log(`2025 Item #${i + 1} (Row ${row + 1}): [${t.partNumber}] "${t.description}" -> ${img}`);
});

console.log('=== Verifying 2026 tools ===');
tools2026.slice(0, 5).forEach((t, i) => {
    const row = i + 3;
    const img = map2026[row];
    console.log(`2026 Item #${i + 1} (Row ${row + 1}): [${t.partNumber}] "${t.description}" -> ${img}`);
});
