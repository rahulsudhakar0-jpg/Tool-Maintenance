/**
 * sync_monthly_tool_shots.js
 * Automatically detects the latest monthly Jinrong Tool Shot template,
 * extracts Column AH (Warranty Tool Shots) and Column AI (Current total Tool Shots),
 * links them to part numbers in the system, and updates data.js, excel_data.json,
 * and unified_tools_2024_2025_2026.csv.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log(`[${new Date().toISOString()}] Starting Monthly Tool Shot Sync...`);

// 1. Locate the target Excel file
let targetFile = process.argv[2];

if (!targetFile) {
    console.log('Searching for latest Tool Shot Tempalte-Jinrong file on disk...');
    const searchDirs = [
        'C:\\Users\\Admin\\Desktop',
        'C:\\Users\\Admin\\Downloads',
        'C:\\Users\\Admin\\Desktop\\PD02\\DOC1\\STL Documents\\Tool Shots'
    ];

    let candidates = [];
    searchDirs.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        try {
            const findFiles = (d, depth = 0) => {
                if (depth > 4) return;
                const entries = fs.readdirSync(d, { withFileTypes: true });
                for (const e of entries) {
                    const full = path.join(d, e.name);
                    if (e.isDirectory()) {
                        findFiles(full, depth + 1);
                    } else if (e.isFile() && !e.name.startsWith('~$') && e.name.toLowerCase().includes('tool shot') && e.name.toLowerCase().endsWith('.xlsx')) {
                        try {
                            const stat = fs.statSync(full);
                            candidates.push({ path: full, mtime: stat.mtimeMs, name: e.name });
                        } catch (err) {}
                    }
                }
            };
            findFiles(dir);
        } catch (err) {}
    });

    if (candidates.length > 0) {
        candidates.sort((a, b) => b.mtime - a.mtime);
        targetFile = candidates[0].path;
        console.log(`✓ Found latest file: "${targetFile}" (${new Date(candidates[0].mtime).toLocaleString()})`);
    } else {
        targetFile = 'C:\\Users\\Admin\\Desktop\\Tool Shot Tempalte-Jinrong CH-TH(9).xlsx';
        console.log(`Defaulting to: "${targetFile}"`);
    }
}

if (!fs.existsSync(targetFile)) {
    console.error(`ERROR: Target file "${targetFile}" does not exist.`);
    process.exit(1);
}

// 2. Extract Jinrong-TH-CHN sheet data via PowerShell COM
console.log(`Extracting 'Jinrong-TH-CHN' from "${path.basename(targetFile)}"...`);

const psScript = `
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open('${targetFile.replace(/'/g, "''")}', 0, $true)
    $ws = $wb.Sheets.Item('Jinrong-TH-CHN')
    $range = $ws.Range('A1:AI135')
    $vals = $range.Value2

    function ToNumber($v) {
        if ($v -eq $null) { return $null }
        $out = 0.0
        if ([double]::TryParse("$v", [ref]$out)) { return $out }
        return "$v"
    }

    $rows = @()
    for ($r = 2; $r -le 135; $r++) {
        $toolNo = [string]$vals[$r, 1]
        $toolName = [string]$vals[$r, 2]
        $vendor = [string]$vals[$r, 3]
        $empNo = [string]$vals[$r, 4]
        $status = [string]$vals[$r, 5]
        $actual = ToNumber $vals[$r, 6]
        $warranty = ToNumber $vals[$r, 34]
        $currShot = ToNumber $vals[$r, 35]

        if ($toolNo -or $toolName) {
            $rows += [PSCustomObject]@{
                RowIndex = $r
                ToolNumber = $toolNo.Trim()
                ToolName = $toolName.Trim()
                Vendor = $vendor.Trim()
                EmployeeNumber = $empNo.Trim()
                ToolStatus = $status.Trim()
                ActualToolShot = $actual
                WarrantyToolShots = $warranty
                CurrentTotalToolShots = $currShot
            }
        }
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $json = $rows | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText('C:\\Users\\Admin\\Desktop\\project\\jinrong_tool_shots.json', $json, $utf8NoBom)
} finally {
    $wb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
`;

fs.writeFileSync('extract_temp.ps1', psScript, 'utf8');
try {
    execSync('powershell -ExecutionPolicy Bypass -File extract_temp.ps1', { stdio: 'inherit' });
} catch (err) {
    console.error('PowerShell extraction failed:', err.message);
} finally {
    if (fs.existsSync('extract_temp.ps1')) fs.unlinkSync('extract_temp.ps1');
}

// 3. Apply linkage
console.log('Linking tool shot values to system part numbers...');
execSync('node apply_jinrong_linkage.js', { stdio: 'inherit' });

// 4. Update CSV
console.log('Updating unified_tools_2024_2025_2026.csv...');
execSync('node update_unified_csv.js', { stdio: 'inherit' });

console.log(`[SUCCESS] Monthly Tool Shot sync complete! Linked against: ${path.basename(targetFile)}`);
