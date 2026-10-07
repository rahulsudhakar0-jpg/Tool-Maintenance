/**
 * update_unified_csv.js
 * Updates unified_tools_2024_2025_2026.csv with Jinrong Warranty Tool Shots (Col AH)
 * and Current Total Tool Shots (Col AI)
 */

const fs = require('fs');
const d = require('./data.js');

const csvPath = 'c:/Users/Admin/Desktop/project/unified_tools_2024_2025_2026.csv';
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');

const newLines = [lines[0].trim()];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const tool = d.tools[i - 1];
    if (!tool) {
        newLines.push(line);
        continue;
    }

    const cols = [
        tool.year,
        `"${i}"`,
        `"${tool.customer || ''}"`,
        `"${(tool.description || tool.partName || '').replace(/"/g, '""')}"`,
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
        tool.currentTotalShot || tool.strokesCurrent || 0,
        tool.warrantyToolShots || tool.strokesMax || 0,
        tool.actualToolShot || '',
        tool.strokeWearPercent || Math.min(100, Math.round(((tool.currentTotalShot || tool.strokesCurrent) / (tool.warrantyToolShots || tool.strokesMax || 1)) * 100)),
        `"${tool.healthStatus || 'Operational'}"`,
        `"${tool.matchedToolShotId || ''}"`,
        `"${(tool.matchedToolShotName || tool.matchedToolName || '').replace(/"/g, '""')}"`,
        `"${(tool.matchReason || tool.matchTrace || '').replace(/"/g, '""')}"`,
        `"${tool.image || ''}"`
    ];

    newLines.push(cols.join(','));
}

fs.writeFileSync(csvPath, newLines.join('\n') + '\n', 'utf8');
console.log('SUCCESS: Updated unified_tools_2024_2025_2026.csv with Jinrong Warranty and Current Total Shots!');
