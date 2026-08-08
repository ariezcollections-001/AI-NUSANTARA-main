@echo off
echo === SMOKE TESTS ===
echo.
echo 1) GET /api/founder/profile
curl -s -o NUL -w "HTTP %%{http_code}\n" http://localhost:3000/api/founder/profile
echo.
echo 2) GET /api/founder/users
curl -s -o NUL -w "HTTP %%{http_code}\n" http://localhost:3000/api/founder/users
echo.
echo 3) GET /api/founder/config?key=platform_logo
curl -s -o NUL -w "HTTP %%{http_code}\n" "http://localhost:3000/api/founder/config?key=platform_logo"
echo.
echo 4) POST /api/founder/features
curl -s -X POST -o NUL -w "HTTP %%{http_code}\n" http://localhost:3000/api/founder/features -H "Content-Type: application/json" -d "{}"
echo.
echo 5) GET /x-founder-control-99f7jK (non-founder redirect)
curl -s -o NUL -w "HTTP %%{http_code}\n" http://localhost:3000/x-founder-control-99f7jK
echo.
echo === END SMOKE TESTS ===
pause