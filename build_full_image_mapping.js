const fs = require('fs');
const path = require('path');

const sheetsInfo = [
    { year: '2024', drawingXml: 'drawing2.xml', relsXml: 'drawing2.xml.rels' },
    { year: '2025', drawingXml: 'drawing3.xml', relsXml: 'drawing3.xml.rels' },
    { year: '2026', drawingXml: 'drawing4.xml', relsXml: 'drawing4.xml.rels' }
];

const basePath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/drawings';
const mediaPath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/media';
const targetImgDir = 'c:/Users/Admin/Desktop/project/images/tools';

if (!fs.existsSync(targetImgDir)) {
    fs.mkdirSync(targetImgDir, { recursive: true });
}

const allSheetMappings = {};

sheetsInfo.forEach(info => {
    const drawFile = path.join(basePath, info.drawingXml);
    const relsFile = path.join(basePath, '_rels', info.relsXml);

    if (!fs.existsSync(drawFile) || !fs.existsSync(relsFile)) {
        console.warn(`Files missing for ${info.year}`);
        return;
    }

    const relsContent = fs.readFileSync(relsFile, 'utf8');
    const relMap = {};
    const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    let rm;
    while ((rm = relRegex.exec(relsContent)) !== null) {
        relMap[rm[1]] = path.basename(rm[2]);
    }

    const drawContent = fs.readFileSync(drawFile, 'utf8');
    const regex = /<xdr:(twoCellAnchor|oneCellAnchor)[\s\S]*?<xdr:pic[\s\S]*?<\/xdr:\1>/g;
    let m;
    const rowMap = {};

    while ((m = regex.exec(drawContent)) !== null) {
        const chunk = m[0];
        const fromColMatch = chunk.match(/<xdr:col>(\d+)<\/xdr:col>/);
        const fromRowMatch = chunk.match(/<xdr:row>(\d+)<\/xdr:row>/);
        const blipMatch = chunk.match(/r:embed="([^"]+)"/);

        if (fromColMatch && fromRowMatch && blipMatch) {
            const col = parseInt(fromColMatch[1], 10);
            const row = parseInt(fromRowMatch[1], 10);
            const rId = blipMatch[1];
            const imgFile = relMap[rId];

            // Col 1 is Column B (Part Picture)
            if (col === 1 && imgFile) {
                // If row already has an image, keep the first or last
                if (!rowMap[row]) {
                    rowMap[row] = imgFile;
                }
            }
        }
    }

    allSheetMappings[info.year] = rowMap;
    console.log(`Year ${info.year}: ${Object.keys(rowMap).length} tools have matched pictures in Col B!`);
});

fs.writeFileSync('c:/Users/Admin/Desktop/project/sheet_image_mappings.json', JSON.stringify(allSheetMappings, null, 2), 'utf8');
console.log('Saved sheet_image_mappings.json');
