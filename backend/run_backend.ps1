# SmartFridge AI — Backend Startup Script (PowerShell)
# Run this from the refrigerator_website/ directory:
#   .\backend\run_backend.ps1

$ErrorActionPreference = "Stop"

$BackendDir = Join-Path $PSScriptRoot ""
Set-Location $BackendDir

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SmartFridge AI — Backend Startup   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Create virtual environment if needed ──────────────────
if (-not (Test-Path "venv")) {
    Write-Host "→ Creating virtual environment…" -ForegroundColor Yellow
    python -m venv venv
}

# ── 2. Activate venv ──────────────────────────────────────────
Write-Host "→ Activating virtual environment…" -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# ── 3. Install dependencies ────────────────────────────────────
Write-Host "→ Installing dependencies…" -ForegroundColor Yellow
pip install -q -r requirements.txt

# ── 4. Create model dir placeholder ───────────────────────────
if (-not (Test-Path "model")) {
    New-Item -ItemType Directory -Path "model" | Out-Null
    Write-Host "→ Created backend/model/ — add your .h5/.tflite/.onnx file here" -ForegroundColor DarkYellow
}

# ── 5. Start Flask ─────────────────────────────────────────────
Write-Host ""
Write-Host "→ Starting Flask on http://localhost:5000" -ForegroundColor Green
Write-Host "  Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""
python app.py
