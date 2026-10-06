Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "c:\Users\Admin\Desktop\project\full_workbook.xlsx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

function Read-ZipEntry($path) {
    $e = $zip.GetEntry($path)
    if ($e) {
        $reader = New-Object System.IO.StreamReader($e.Open())
        $content = $reader.ReadToEnd()
        $reader.Close()
        return $content
    }
    return $null
}

Write-Output "=== SHEET2 RELS ==="
Write-Output (Read-ZipEntry "xl/worksheets/_rels/sheet2.xml.rels")

Write-Output "`n=== WORKBOOK RELS ==="
Write-Output (Read-ZipEntry "xl/_rels/workbook.xml.rels")

$zip.Dispose()
