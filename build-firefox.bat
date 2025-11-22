@echo off
cd /d "%~dp0"
echo ========================================
echo Building FlowRef for FIREFOX
echo ========================================
echo.
echo [1/6] Building TypeScript files...
node node_modules\esbuild\bin\esbuild src/popup/popup.ts --bundle --outfile=dist/popup/popup.js --format=iife
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build popup
    pause
    exit /b 1
)

node node_modules\esbuild\bin\esbuild src/options/options.ts --bundle --outfile=dist/options/options.js --format=iife
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build options
    pause
    exit /b 1
)

node node_modules\esbuild\bin\esbuild src/background/background.ts --bundle --outfile=dist/background/background.js --format=iife
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build background
    pause
    exit /b 1
)

node node_modules\esbuild\bin\esbuild src/settings/settings.ts --bundle --outfile=dist/settings/settings.js --format=iife
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build settings
    pause
    exit /b 1
)

echo [2/6] Copying HTML files...
copy /Y src\popup\popup.html dist\popup\popup.html >nul
copy /Y src\options\options.html dist\options\options.html >nul
copy /Y src\settings\settings.html dist\settings\settings.html >nul

echo [3/6] Copying CSS files...
copy /Y src\popup\popup.css dist\popup\popup.css >nul
copy /Y src\options\options.css dist\options\options.css >nul
copy /Y src\settings\settings.css dist\settings\settings.css >nul

echo [4/6] Copying content script...
if not exist dist\content mkdir dist\content
copy /Y src\content\contentScript.js dist\content\contentScript.js >nul

echo [5/6] Copying PDF.js worker...
if not exist dist\pdfjs mkdir dist\pdfjs
copy /Y node_modules\pdfjs-dist\build\pdf.worker.min.js dist\pdfjs\pdf.worker.min.js >nul

echo [6/6] Copying icons and manifest...
if not exist dist\icons mkdir dist\icons
copy /Y icons\*.* dist\icons\ >nul
copy /Y manifest.firefox.json dist\manifest.json >nul

echo.
echo ========================================
echo FIREFOX BUILD COMPLETE!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Go to about:debugging in Firefox
echo 2. Click "This Firefox"
echo 3. Click "Load Temporary Add-on"
echo 4. Select dist\manifest.json
echo.
pause
