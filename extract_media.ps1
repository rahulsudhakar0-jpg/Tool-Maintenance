Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "c:\Users\Admin\Desktop\project\full_workbook.xlsx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

$outDir = "c:\Users\Admin\Desktop\project\extracted_drawings"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

Write-Output "Extracting drawings and media..."
$extractedCount = 0

foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "xl/drawings/*" -or $entry.FullName -like "xl/media/*") {
        $destPath = Join-Path $outDir ($entry.FullName -replace '/', '\')
        $destParent = Split-Path $destPath
        if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
        $extractedCount++
    }
}

$zip.Dispose()
Write-Output "Extracted $extractedCount files to $outDir"
