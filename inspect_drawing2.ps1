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

$drawingXmlStr = Read-ZipEntry "xl/drawings/drawing2.xml"
$relsXmlStr = Read-ZipEntry "xl/drawings/_rels/drawing2.xml.rels"

[xml]$relsXml = $relsXmlStr
$relMap = @{}
foreach ($rel in $relsXml.Relationships.Relationship) {
    $relMap[$rel.Id] = $rel.Target
}

[xml]$drawingXml = $drawingXmlStr

$count = 0
foreach ($node in $drawingXml.DocumentElement.ChildNodes) {
    if ($node.Name -like "*twoCellAnchor*" -or $node.Name -like "*oneCellAnchor*") {
        $fromRow = $node.from.row
        $fromCol = $node.from.col
        $pic = $node.pic
        $embedId = $pic.blipFill.blip.GetAttribute("r:embed")
        $target = $relMap[$embedId]
        Write-Output "Anchor: Row=$fromRow, Col=$fromCol -> rId=$embedId -> Target=$target"
        $count++
        if ($count -ge 15) { break }
    }
}

Write-Output "Total Anchors in drawing2: $($drawingXml.DocumentElement.ChildNodes.Count)"
$zip.Dispose()
