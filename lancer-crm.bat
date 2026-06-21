@echo off
chcp 65001 >nul
title CRM SUDICONE
color 0B

echo ============================================
echo    CRM SUDICONE
echo ============================================
echo.

REM --- Verifie que Node.js est installe ---
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur ce PC.
    echo.
    echo Va sur https://nodejs.org et installe la version "LTS"
    echo Une fois installe, relance ce fichier.
    echo.
    pause
    exit /b
)

cd /d "%~dp0"

REM --- Installe les dependances si le dossier node_modules n'existe pas encore ---
if not exist "node_modules" (
    echo Premiere installation, ca peut prendre 1-2 minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERREUR] L'installation a echoue. Verifie ta connexion internet.
        pause
        exit /b
    )
    echo.
)

REM --- Cree le fichier .env si absent ---
if not exist ".env" (
    echo Configuration initiale...
    copy .env.example .env >nul
)

REM --- Initialise la base de donnees si elle n'existe pas encore ---
if not exist "data\crm.db" (
    echo Creation de la base de donnees...
    call npm run initdb
    echo.
    echo ============================================
    echo  IMPORTANT - Note ces identifiants :
    echo  (ils sont aussi affiches juste au-dessus)
    echo ============================================
    echo.
    pause
)

REM --- Ouvre le navigateur apres un court delai, puis demarre le serveur ---
start "" cmd /c "timeout /t 2 >nul && start http://localhost:4000/login.html"

echo.
echo Demarrage du serveur...
echo Pour ARRETER le CRM : ferme cette fenetre ou appuie sur Ctrl+C
echo.

call npm start

pause
