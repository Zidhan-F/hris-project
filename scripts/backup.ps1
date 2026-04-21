# HRIS Database Backup Script (PowerShell)
# This script dumps the 'ems_db' from the Docker container to a local file.

$CONTAINER_NAME = "ems-mongodb"
$DB_NAME = "ems_db"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_DIR = "backups"
$BACKUP_FILE = "$BACKUP_DIR/backup_$DB_NAME`_$TIMESTAMP.archive"

# Create backup directory if it doesn't exist
if (!(Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "📂 Created backup directory: $BACKUP_DIR" -ForegroundColor Cyan
}

Write-Host "🚀 Starting backup from $CONTAINER_NAME..." -ForegroundColor Green

# Use docker exec to run mongodump inside the container and stream to local file
docker exec $CONTAINER_NAME mongodump --db $DB_NAME --archive | Set-Content -Path $BACKUP_FILE -Encoding Byte

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup successful!" -ForegroundColor Green
    Write-Host "💾 File: $BACKUP_FILE" -ForegroundColor Cyan
} else {
    Write-Host "❌ Backup failed. Make sure docker is running." -ForegroundColor Red
}
