$sstXml = [xml](Get-Content "wb_extracted\sharedStrings.xml" -Raw)
$strings = New-Object System.Collections.Generic.List[string]
foreach ($si in $sstXml.sst.si) { 
    $t = ""
    if ($si.t) { $t = $si.t.InnerText }
    elseif ($si.r) { foreach ($r in $si.r) { $t += $r.t.InnerText } }
    else { $t = $si.InnerText }
    $strings.Add($t)
}

foreach ($sheetName in @("sheet2.xml", "sheet3.xml", "sheet4.xml")) {
    $xml = [xml](Get-Content "wb_extracted\$sheetName" -Raw)
    $rows = $xml.worksheet.sheetData.row
    Write-Output "=== COLUMNS IN $sheetName (Row 3) ==="
    $r3 = $rows | Where-Object { $_.GetAttribute("r") -eq "3" }
    foreach ($c in $r3.c) {
        $ref = $c.GetAttribute("r")
        $col = $ref -replace '\d+', ''
        $t = $c.GetAttribute("t")
        $v = $c.v
        $disp = $v
        if ($t -eq "s" -and $v -ne $null) {
            $idx = 0
            if ([int]::TryParse($v, [ref]$idx) -and $idx -lt $strings.Count) {
                $disp = $strings[$idx]
            }
        }
        $dispClean = ($disp -replace '[\r\n]+', ' ').Trim()
        Write-Output "Col $col -> '$dispClean'"
    }
}
