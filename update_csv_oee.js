const fs = require('fs');
const d = require('./data.js');

const csvPath = 'c:/Users/Admin/Desktop/project/unified_tools_2024_2025_2026.csv';
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');

const headerCols = lines[0].trim().split(',');
const idxColAD = headerCols.indexOf('Col_AD_Tool_Shot');
const idxStrokes = headerCols.indexOf('Current_Total_Strokes');
const idxWear = headerCols.indexOf('Stroke_Wear_Percent');
const idxHealth = headerCols.indexOf('Health_Status');

const newLines = [lines[0].trim()];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV row respecting quotes
    const tool = d.tools[i - 1];
    if (!tool) {
        newLines.push(line);
        continue;
    }

    // Replace line with updated values from tool
    // We can rebuild the line using tool properties
    const cols = [
        tool.year,
        `"${i}"`,
        `"${tool.customer || ''}"`,
        `"${(tool.description || '').replace(/"/g, '""')}"`,
        `"${(tool.partNumber || '').replace(/"/g, '""')}"`,
        `"${tool.rev || ''}"`,
        `"${tool.mfgNo || tool.toolId || ''}"`,
        `"${tool.pressTonnage || ''}"`,
        `"${tool.mechNo || ''}"`,
        `"${tool.toolingLife || ''}"`,
        `"${tool.speed || ''}"`,
        `"${tool.model || ''}"`,
        `"${tool.cavity || ''}"`,
        `"${tool.toolingSize || ''}"`,
        `"${tool.material || ''}"`,
        `"${tool.thickness || ''}"`,
        `"${tool.materialWidthStep || ''}"`,
        `"${tool.ppepNo || ''}"`,
        `"${tool.blankingGap || ''}"`,
        `"${tool.designer || ''}"`,
        `"${tool.platingSupplier || ''}"`,
        `"${tool.productPosition || ''}"`,
        tool.colAD_ToolShot || '',
        tool.strokesCurrent || 0,
        tool.strokesMax || 0,
        tool.actualToolShot || '',
        tool.strokeWearPercent || 0,
        `"${tool.healthStatus || 'Operational'}"`,
        `"${tool.matchedToolShotId || ''}"`,
        `"${(tool.matchedToolName || '').replace(/"/g, '""')}"`,
        `"${(tool.matchTrace || '').replace(/"/g, '""')}"`,
        `"${tool.image || ''}"`
    ];

    newLines.push(cols.join(','));
}

fs.writeFileSync(csvPath, newLines.join('\n') + '\n', 'utf8');
console.log('SUCCESS: Updated unified_tools_2024_2025_2026.csv with OEE Good quantity strokes!');
