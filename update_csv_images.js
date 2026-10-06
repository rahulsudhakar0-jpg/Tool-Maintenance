const fs = require('fs');
const d = require('./data.js');
const tools = d.tools;

const csvPath = 'c:/Users/Admin/Desktop/project/unified_tools_2024_2025_2026.csv';
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');

// Check if header already has Part_Picture_File
let header = lines[0].trim();
let hasCol = header.includes('Part_Picture_File');

if (!hasCol) {
    header += ',Part_Picture_File';
}

const newLines = [header];
for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    const tool = tools[i - 1];
    const img = tool ? tool.image : '';
    
    if (hasCol) {
        // Replace last col
        const lastComma = line.lastIndexOf(',');
        line = line.substring(0, lastComma);
    }
    newLines.push(`${line},"${img}"`);
}

fs.writeFileSync(csvPath, newLines.join('\n') + '\n', 'utf8');
console.log('SUCCESS: Updated unified_tools_2024_2025_2026.csv with Part_Picture_File!');
