const fs = require('fs');
const path = require('path');

const drawPath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/drawings/drawing2.xml';
const content = fs.readFileSync(drawPath, 'utf8');

const relsPath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/drawings/_rels/drawing2.xml.rels';
const relsContent = fs.readFileSync(relsPath, 'utf8');
const relMap = {};
const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
let rm;
while ((rm = relRegex.exec(relsContent)) !== null) {
    relMap[rm[1]] = path.basename(rm[2]);
}

const regex = /<xdr:(twoCellAnchor|oneCellAnchor)[\s\S]*?<xdr:pic[\s\S]*?<\/xdr:\1>/g;
let m;
let count = 0;
while ((m = regex.exec(content)) !== null) {
    const chunk = m[0];
    const fromCol = chunk.match(/<xdr:col>(\d+)<\/xdr:col>/)[1];
    const fromRow = chunk.match(/<xdr:row>(\d+)<\/xdr:row>/)[1];
    const blipMatch = chunk.match(/r:embed="([^"]+)"/);
    const rId = blipMatch ? blipMatch[1] : 'none';
    const imgName = relMap[rId] || 'unknown';
    console.log(`Pic Anchor ${count + 1}: Row=${fromRow} (Excel Row ${parseInt(fromRow, 10) + 1}), Col=${fromCol} (Col ${String.fromCharCode(65 + parseInt(fromCol, 10))}), Image=${imgName}`);
    count++;
    if (count >= 15) break;
}
console.log(`Total pic anchors matched: ${count}`);
