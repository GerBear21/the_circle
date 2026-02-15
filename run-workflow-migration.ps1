# Quick script to apply the workflow_definitions migration
# Make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local

$envFile = ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $serviceRoleKey) {
    Write-Host "Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local" -ForegroundColor Red
    exit 1
}

$migrationFile = "database\migrations\create_workflow_definitions_table.sql"
$sql = Get-Content $migrationFile -Raw

Write-Host "Applying workflow_definitions migration..." -ForegroundColor Yellow

$headers = @{
    "apikey" = $serviceRoleKey
    "Authorization" = "Bearer $serviceRoleKey"
    "Content-Type" = "application/json"
}

$body = @{
    query = $sql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body
    Write-Host "Migration applied successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error applying migration: $_" -ForegroundColor Red
    Write-Host "Please run this SQL manually in your Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host $sql
}
