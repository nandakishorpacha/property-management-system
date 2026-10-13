@echo off
echo ========================================================
echo  Starting Property Management System (Java Edition)
echo  Database: MySQL 8.0 on localhost:3306
echo ========================================================

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

if not exist bin (
    mkdir bin
)

echo [1/2] Compiling Java classes with MySQL Connector...
javac -cp "lib/mysql-connector-j.jar" src/*.java -d bin
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo [2/2] Launching Java Server on http://localhost:8080 ...
java -cp "bin;lib/mysql-connector-j.jar" Server
pause
