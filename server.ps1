<#
    Tool Maintenance Web Application - Built-in Local HTTP & API Server
    Zero external dependencies, uses .NET HttpListener built into Windows PowerShell.
#>

$port = 8080
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

# MIME Types Dictionary
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

# Start HttpListener
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$port/"

try {
    $listener.Prefixes.Add($prefix)
    $listener.Start()
} catch {
    $port = 8081
    $prefix = "http://localhost:$port/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " TOOL MAINTENANCE WEB APP - LOCAL SERVER ACTIVE" -ForegroundColor Green
Write-Host " URL: $prefix" -ForegroundColor Yellow
Write-Host " Serving directory: $rootDir" -ForegroundColor Gray
Write-Host " Press Ctrl+C in this terminal to stop the server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Open in browser
$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $prefix
} else {
    Start-Process $prefix
}

# Request loop
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl
        $cleanPath = $rawUrl.Split('?')[0].TrimStart('/')
        if ($cleanPath -eq "" -or $cleanPath -eq "/") {
            $cleanPath = "index.html"
        }

        # API Endpoints
        if ($cleanPath -eq "api/sync" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $dataFile = Join-Path $rootDir "excel_data_synced.json"
                [System.IO.File]::WriteAllText($dataFile, $body, [System.Text.Encoding]::UTF8)
                
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok","message":"Data synced successfully"}')
                $response.ContentType = "application/json"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
            }
            $response.OutputStream.Close()
            continue
        }

        # Static file resolution
        $filePath = Join-Path $rootDir $cleanPath
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("File Not Found: $cleanPath")
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }

        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
