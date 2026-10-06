Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "c:\Users\Admin\Desktop\project\full_workbook.xlsx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)

Write-Output "=== ZIP ENTRIES (Drawings and Relationships) ==="
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*drawing*" -or $entry.FullName -like "*sheet2*" -or $entry.FullName -like "*workbook.xml*") {
        Write-Output "$($entry.FullName) ($($entry.Length) bytes)"
    }
}

$zip.Dispose()
