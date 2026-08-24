@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ========================================
echo  MUSIC FLOW - Windows インストーラー作成
echo ========================================
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false

echo [1/2] アプリをビルドしています...
call npm run build
if errorlevel 1 (
  echo ビルドに失敗しました。
  pause
  exit /b 1
)

echo.
echo [2/2] セットアップ EXE を作成しています...
echo 出力先: installer\
call npx electron-builder --win
if errorlevel 1 (
  echo インストーラー作成に失敗しました。
  pause
  exit /b 1
)

echo.
echo ========================================
echo  完了
echo ========================================
echo インストーラー:
echo   installer\MUSIC-FLOW-Setup-*.exe
echo.
echo 他のPCではこの EXE を実行してください。
echo インストール時にデスクトップへショートカットが作成されます。
echo.
explorer "%~dp0..\installer"
pause
