@echo off
REM Setup script for push notification test project (Windows)

echo ============================================================
echo 🚀 Push Notification Test Project Setup
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    exit /b 1
)

node --version
echo.

REM Step 1: Build the library
echo Step 1: Building the library packages...
echo ----------------------------------------
cd ..
call npm install
call npm run build --workspaces

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to build packages
    exit /b 1
)

echo ✓ Packages built successfully
echo.

REM Step 2: Install test project dependencies
echo Step 2: Installing test project dependencies...
echo ------------------------------------------------
cd test-project
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

echo ✓ Dependencies installed
echo.

REM Step 3: Check for .env file
echo Step 3: Checking environment configuration...
echo ----------------------------------------------

if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo ⚠ IMPORTANT: You need to generate VAPID keys!
    echo.
    echo Run this command to generate keys:
    echo   node ..\packages\push-cli\dist\cjs\cli.js generate-keys
    echo.
    echo Then edit .env file and add your keys.
    echo.
) else (
    echo ✓ .env file already exists
)

echo.

REM Step 4: Initialize database
echo Step 4: Initializing database...
echo ---------------------------------
node ..\packages\push-cli\dist\cjs\cli.js migrate --database .\push.db

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to initialize database
    exit /b 1
)

echo ✓ Database initialized
echo.

REM Done!
echo ============================================================
echo ✅ Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo.
echo 1. Generate VAPID keys (if not done):
echo    node ..\packages\push-cli\dist\cjs\cli.js generate-keys
echo.
echo 2. Edit .env file and add your VAPID keys
echo.
echo 3. Start the server:
echo    npm start
echo.
echo 4. Start the worker (optional):
echo    npm run worker
echo.
echo 5. Open http://localhost:3000 in your browser
echo.
echo For detailed instructions, see SETUP-GUIDE.md
echo ============================================================

pause
