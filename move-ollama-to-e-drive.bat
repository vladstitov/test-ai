@echo off
echo ========================================
echo Moving Ollama Models to E: Drive
echo ========================================
echo.

REM Stop Ollama if running
echo [1/5] Stopping Ollama service...
taskkill /F /IM ollama.exe 2>nul
timeout /t 2 >nul

REM Create new directory on E:
echo [2/5] Creating directory on E: drive...
if not exist "E:\ollama-models" (
    mkdir "E:\ollama-models"
    echo Created E:\ollama-models
) else (
    echo E:\ollama-models already exists
)

REM Check if models exist on C:
set "OLLAMA_DIR=%USERPROFILE%\.ollama\models"
if exist "%OLLAMA_DIR%" (
    echo [3/5] Copying existing models from C: to E:...
    xcopy /E /I /Y "%OLLAMA_DIR%" "E:\ollama-models"
    echo Models copied successfully
) else (
    echo [3/5] No existing models found on C: drive
)

REM Set environment variable
echo [4/5] Setting OLLAMA_MODELS environment variable...
setx OLLAMA_MODELS "E:\ollama-models" /M
if %ERRORLEVEL% EQU 0 (
    echo Environment variable set successfully
) else (
    echo ERROR: Failed to set environment variable. Run as Administrator!
    pause
    exit /b 1
)

echo [5/5] Configuration complete!
echo.
echo ========================================
echo IMPORTANT: Restart your computer or run:
echo   ollama serve
echo to start Ollama with the new location.
echo ========================================
echo.
echo Models will now be stored in: E:\ollama-models
echo.
pause
