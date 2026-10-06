const fs = require('fs');
const path = require('path');

const relsPath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/drawings/_rels/drawing2.xml.rels';
const relsContent = fs.readFileSync(relsPath, 'utf8');

const relMap = {};
const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
let m;
while ((m = relRegex.exec(relsContent)) !== null) {
    relMap[m[1]] = path.basename(m[2]);
}

console.log('Relationships mapped:', Object.keys(relMap).length);

const drawPath = 'c:/Users/Admin/Desktop/project/extracted_drawings/xl/drawings/drawing2.xml';
const drawContent = fs.readFileSync(drawPath, 'utf8');

// Match twoCellAnchor
const anchorRegex = /<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g;
let anchorMatch;
const rowToImage = {};

while ((anchorMatch = anchorRegex.exec(drawContent)) !== null) {
    const chunk = anchorMatch[0];
    const fromRowMatch = chunk.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const fromColMatch = chunk.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
    const blipMatch = chunk.match(/<a:blip[^>]*r:embed="([^"]+)"/);

    if (fromRowMatch && fromColMatch && blipMatch) {
        const row = parseInt(fromRowMatch[1], 10);
        const col = parseInt(fromColMatch[1], 10);
        const rId = blipMatch[1];
        const imgName = relMap[rId];
        
        // Col 1 is Column B (Part Picture)
        if (col === 1) {
            rowToImage[row] = imgName;
            console.log(`Row ${row + 1} (0-indexed ${row}) -> Col B -> rId: ${rId} -> Image: ${imgName}`);
        }
    }
}

console.log(`Total Col B images mapped for Sheet 2024: ${Object.keys(rowToImage).length}`);
