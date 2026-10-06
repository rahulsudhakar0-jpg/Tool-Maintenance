const fs = require('fs');
const path = require('path');

const mappings = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/sheet_image_mappings.json', 'utf8'));
const map2024 = mappings['2024'];

const excelData = JSON.parse(fs.readFileSync('c:/Users/Admin/Desktop/project/excel_data.json', 'utf8'));
const tools2024 = excelData.tools.filter(t => t.year === '2024');

console.log('Verifying alignment for 2024 tools:');
tools2024.slice(0, 15).forEach((t, i) => {
    // Excel row for item i is (i + 4) -> 0-indexed row is (i + 3)
    const expected0IndexedRow = i + 3;
    const imgFile = map2024[expected0IndexedRow];
    const fullImgPath = imgFile ? path.join('c:/Users/Admin/Desktop/project/extracted_drawings/xl/media', imgFile) : null;
    const exists = fullImgPath && fs.existsSync(fullImgPath);

    console.log(`Item #${i + 1} (Row ${expected0IndexedRow + 1}): [${t.partNumber}] "${t.description}" -> Img: ${imgFile} (Exists: ${exists})`);
});
