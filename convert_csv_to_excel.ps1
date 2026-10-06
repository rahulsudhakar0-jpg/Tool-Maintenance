$csvPath = "c:\Users\Admin\Desktop\project\unified_tools_2024_2025_2026.csv"
$xlsxPath = "c:\Users\Admin\Desktop\project\unified_tools_2024_2025_2026.xlsx"

if (Test-Path $xlsxPath) {
    Remove-Item $xlsxPath -Force -ErrorAction SilentlyContinue
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($csvPath)
    $ws = $wb.Sheets.Item(1)
    $ws.Name = "Unified_Tools_2024-2026"

    # Style header row
    $headerRange = $ws.Range("A1:AE1")
    $headerRange.Font.Bold = $true
    $headerRange.Font.Color = 0xFFFFFF
    $headerRange.Interior.Color = 0x82461E # #1e4682
    $headerRange.RowHeight = 24
    $headerRange.VerticalAlignment = -4108 # Center

    # Auto fit
    $ws.UsedRange.Columns.AutoFit() | Out-Null

    # Freeze header row
    $ws.Activate()
    $excel.ActiveWindow.SplitRow = 1
    $excel.ActiveWindow.FreezePanes = $true

    # Save as XLSX (51 = xlOpenXMLWorkbook)
    $wb.SaveAs($xlsxPath, 51)
    $wb.Close($false)
    Write-Output "SUCCESS: Created $xlsxPath"
} catch {
    Write-Error $_
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
