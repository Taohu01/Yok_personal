@echo off
chcp 65001 >nul
title สมุดงาน (yok)
cd /d "%~dp0"

set "URL=http://localhost:3001"
set "PING=http://127.0.0.1:3001/api/imports"

rem ---- an older server still running? stop it so the newest code is used ----
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; if ($c) { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'node') { Stop-Process -Id $p.Id -Force; Start-Sleep -Milliseconds 700; exit 0 } }; exit 1"
if %errorlevel%==0 echo ปิดเซิร์ฟเวอร์ตัวเก่าแล้ว กำลังเปิดตัวใหม่...

where node >nul 2>nul
if errorlevel 1 (
  echo ไม่พบ Node.js กรุณาติดตั้ง Node.js 22 ขึ้นไปจาก https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo ติดตั้งแพ็กเกจครั้งแรก รอสักครู่...
  call npm install
  if errorlevel 1 (
    echo ติดตั้งไม่สำเร็จ
    pause
    exit /b 1
  )
)

echo กำลังเตรียมหน้าเว็บ...
call npm run build --silent -- --logLevel error
if errorlevel 1 (
  echo สร้างหน้าเว็บไม่สำเร็จ
  pause
  exit /b 1
)

rem ---- open the browser as soon as the server answers (up to ~20 s) ----
if not "%YOK_NO_BROWSER%"=="1" (
  start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 40; $i++) { try { Invoke-WebRequest -UseBasicParsing '%PING%' -TimeoutSec 1 | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep -Milliseconds 500 } }"
)

echo.
echo  สมุดงาน เปิดที่ %URL%
echo  ปิดหน้าต่างนี้ (หรือกด Ctrl+C) เพื่อปิดเซิร์ฟเวอร์
echo.
node --disable-warning=ExperimentalWarning server\index.js

echo.
echo เซิร์ฟเวอร์หยุดทำงานแล้ว
pause
