@echo off
REM ExamGenius AI - start the app (Windows). Double-click or run:  .\start.bat
cd /d "%~dp0backend"
if not exist venv (echo Run setup.bat first. & pause & exit /b 1)
call venv\Scripts\activate.bat
echo Starting ExamGenius AI at http://127.0.0.1:8000  (press CTRL+C to stop)
start "" http://127.0.0.1:8000
python manage.py runserver 127.0.0.1:8000
