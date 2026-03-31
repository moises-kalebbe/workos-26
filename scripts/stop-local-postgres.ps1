$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgData = "C:\workos-26\.local-postgres\data"

if (!(Test-Path $pgData)) {
  Write-Error "Local cluster not found at $pgData"
}

& "$pgBin\pg_ctl.exe" -D $pgData stop
