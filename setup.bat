@echo off
REM ExamGenius AI - one-time setup (Windows). Double-click or run:  .\setup.bat
cd /d "%~dp0backend"
echo [1/5] Creating Python virtual environment...
python -m venv venv || (echo Python not found. Install Python 3.12+ from python.org and tick "Add to PATH". & pause & exit /b 1)
call venv\Scripts\activate.bat
echo [2/5] Installing packages (takes 1-3 minutes)...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt || (echo Package install failed - check your internet connection. & pause & exit /b 1)
echo [3/5] Creating backend\.env ...
if not exist .env copy .env.example .env >nul
echo [4/5] Creating the database...
python manage.py migrate
echo [5/5] Loading subjects and demo accounts...
python manage.py seed_demo
echo.
echo ======================================================================
echo  Setup complete!
echo  NEXT: open backend\.env in VS Code and paste your OpenAI key after
echo        OPENAI_API_KEY=   then run  start.bat
echo ======================================================================
pause
