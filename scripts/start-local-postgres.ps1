$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$baseDir = "C:\workos-26\.local-postgres"
$pgData = Join-Path $baseDir "data"
$pgLog = Join-Path $baseDir "postgres.log"
$port = 55432

if (!(Test-Path $pgData)) {
  Write-Error "Local cluster not found at $pgData"
}

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -First 1

if ($existing) {
  Write-Output "Postgres local already running on port $port (PID $($existing.OwningProcess))."
  exit 0
}

& "$pgBin\pg_ctl.exe" -D $pgData -l $pgLog -o " -p $port" start
Start-Sleep -Seconds 2
& "$pgBin\pg_isready.exe" -h localhost -p $port
