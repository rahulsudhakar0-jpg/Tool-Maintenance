Add-Type -AssemblyName System.Drawing

$mappingsJson = Get-Content "c:\Users\Admin\Desktop\project\sheet_image_mappings.json" -Raw | ConvertFrom-Json
$excelJsonPath = "c:\Users\Admin\Desktop\project\excel_data.json"
$excelData = Get-Content $excelJsonPath -Raw | ConvertFrom-Json

$mediaDir = "c:\Users\Admin\Desktop\project\extracted_drawings\xl\media"
$outDir = "c:\Users\Admin\Desktop\project\images\tools"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]85)

$processedCount = 0
$yearCounters = @{ "2024" = 0; "2025" = 0; "2026" = 0 }

foreach ($tool in $excelData.tools) {
    $y = "$($tool.year)"
    if (-not $yearCounters.ContainsKey($y)) { $yearCounters[$y] = 0 }
    $localIdx = $yearCounters[$y]
    $yearCounters[$y]++

    $rowIdx = $localIdx + 3 # 0-indexed row (row 4 in excel is index 3)
    $mapObj = $mappingsJson.$y
    $imgFile = $null
    if ($mapObj -and $mapObj.PSObject.Properties[$rowIdx.ToString()]) {
        $imgFile = $mapObj.PSObject.Properties[$rowIdx.ToString()].Value
    }

    $destFileName = "tool_$($tool.id).jpg"
    $destFilePath = Join-Path $outDir $destFileName

    if ($imgFile -and (Test-Path (Join-Path $mediaDir $imgFile))) {
        $srcPath = Join-Path $mediaDir $imgFile
        try {
            $srcImg = [System.Drawing.Image]::FromFile($srcPath)
            
            # Calculate resize dimensions (max 600px width/height)
            $maxDim = 600
            $w = $srcImg.Width
            $h = $srcImg.Height
            if ($w -gt $maxDim -or $h -gt $maxDim) {
                if ($w -gt $h) {
                    $newW = $maxDim
                    $newH = [int]($h * ($maxDim / $w))
                } else {
                    $newH = $maxDim
                    $newW = [int]($w * ($maxDim / $h))
                }
            } else {
                $newW = $w
                $newH = $h
            }

            $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.DrawImage($srcImg, 0, 0, $newW, $newH)

            $bmp.Save($destFilePath, $jpegEncoder, $encoderParams)

            $graphics.Dispose()
            $bmp.Dispose()
            $srcImg.Dispose()

            $tool.image = "images/tools/$destFileName"
            $processedCount++
        } catch {
            $tool.image = "images/image1.png"
        }
    } else {
        $tool.image = "images/image1.png"
    }
}

Write-Output "Optimized and mapped $processedCount tools with exact pictures!"

# Save updated excel_data.json
$jsonStr = $excelData | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($excelJsonPath, $jsonStr, [System.Text.Encoding]::UTF8)

# Save updated data.js
$dataJsPath = "c:\Users\Admin\Desktop\project\data.js"
$jsContent = @"
/**
 * Tool Maintenance Web Application - Consolidated Multi-Year Dataset (2024, 2025, 2026)
 * Total Tools: 253
 * 2024 Tools: 105
 * 2025 Tools: 126
 * 2026 Tools: 22
 * Matched with Column B Part Pictures from Google Sheet
 * Linked with Tool Shot Template - Column AD, AI, AH, F
 * Generated: 2026-10-06
 */

var INITIAL_DATA = $jsonStr;

if (typeof window !== 'undefined') {
    window.INITIAL_DATA = INITIAL_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = INITIAL_DATA;
}
"@
[System.IO.File]::WriteAllText($dataJsPath, $jsContent, [System.Text.Encoding]::UTF8)

Write-Output "Updated excel_data.json and data.js successfully."
