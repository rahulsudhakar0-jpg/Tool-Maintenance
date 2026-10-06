<#
    Tool Maintenance Web Application - Built-in Local HTTP & API Server
    Zero external dependencies, uses .NET HttpListener built into Windows PowerShell.
    Features: Static file serving, JSON state persistence, and Auto-Push to GitHub!
#>

$port = 8080
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

# Set Git in PATH
$gitCmdDir = "C:\Program Files\Git\cmd"
if (Test-Path $gitCmdDir) {
    $env:Path = "$gitCmdDir;" + $env:Path
}

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

# Helper function to push to GitHub
function Push-ToGitHub([string]$commitMessage) {
    try {
        Write-Host "[Git Auto-Sync] Staging and committing changes..." -ForegroundColor Yellow
        $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        if (-not $commitMessage) {
            $commitMessage = "auto-sync: update tooling data and maintenance logs at $ts"
        }
        
        git add .
        git commit -m "$commitMessage" 2>&1 | Out-Null
        
        Write-Host "[Git Auto-Sync] Pushing to GitHub origin main..." -ForegroundColor Yellow
        $pushOut = git push origin main 2>&1 | Out-String
        Write-Host "[Git Auto-Sync] Output: $pushOut" -ForegroundColor Cyan
        return @{ success = $true; output = $pushOut }
    } catch {
        Write-Host "[Git Auto-Sync Error] $($_.Exception.Message)" -ForegroundColor Red
        return @{ success = $false; error = $_.Exception.Message }
    }
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
Write-Host " Auto-Git Sync: ENABLED (Pushes every time data changes)" -ForegroundColor Magenta
Write-Host " Serving directory: $rootDir" -ForegroundColor Gray
Write-Host " Press Ctrl+C in this terminal to stop the server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Open in browser if not already open
$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $prefix -ErrorAction SilentlyContinue
} else {
    Start-Process $prefix -ErrorAction SilentlyContinue
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

        # API: Explicit Git Push Trigger
        if ($cleanPath -eq "api/git-push" -and ($request.HttpMethod -eq "POST" -or $request.HttpMethod -eq "GET")) {
            $result = Push-ToGitHub "chore: manual push from Tool Maintenance web app"
            $json = $result | ConvertTo-Json -Compress
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.OutputStream.Close()
            continue
        }

        # API: Sync and Auto-Push
        if ($cleanPath -eq "api/sync" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $dataFile = Join-Path $rootDir "excel_data_synced.json"
                [System.IO.File]::WriteAllText($dataFile, $body, [System.Text.Encoding]::UTF8)
                
                # Auto push to GitHub on sync!
                $gitResult = Push-ToGitHub "chore: sync tooling data and maintenance logs"

                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok","message":"Data saved and auto-pushed to GitHub"}')
                $response.ContentType = "application/json"
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"error","message":"' + $_.Exception.Message + '"}')
                $response.ContentType = "application/json"
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
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
