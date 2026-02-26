$ErrorActionPreference = "Stop"

Write-Host "Starting Item Service (Port 8002)..." -ForegroundColor Cyan
$item = Start-Process -FilePath "go" -ArgumentList "run main.go" -WorkingDirectory "item-service" -PassThru -NoNewWindow

Write-Host "Starting User Service (Port 8001)..." -ForegroundColor Cyan
$user = Start-Process -FilePath "go" -ArgumentList "run main.go" -WorkingDirectory "user-service" -PassThru -NoNewWindow

# Quick delay to let the inner microservices initialize
Start-Sleep -Seconds 2

Write-Host "Starting API Gateway (Port 8000)..." -ForegroundColor Cyan
$api = Start-Process -FilePath "go" -ArgumentList "run main.go" -WorkingDirectory "api-gateway" -PassThru -NoNewWindow

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "✅ All microservices are running!" -ForegroundColor Green
Write-Host "Gateway is live at: http://localhost:8000" -ForegroundColor Green
Write-Host "Press [CTRL+C] at any time to softly kill all servers." -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Green

try {
    # Block infinitely until the user hits CTRL+C
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`nStopping all services..." -ForegroundColor Red
    
    if ($item -and !$item.HasExited) { Stop-Process -Id $item.Id -Force }
    if ($user -and !$user.HasExited) { Stop-Process -Id $user.Id -Force }
    if ($api -and !$api.HasExited) { Stop-Process -Id $api.Id -Force }
    
    Write-Host "All services stopped." -ForegroundColor DarkGray
}
