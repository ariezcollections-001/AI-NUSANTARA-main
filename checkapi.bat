@echo off
set TOK=%VERCEL_TOKEN%
curl.exe -s -H "Authorization: Bearer %TOK%" "https://api.vercel.com/v6/deployments?projectId=prj_AdaqARqoTedsF5sk7VNi4eRCRST8&limit=5" -o dlist.json
node checkstatus.js dlist.json
echo DONE >> api_status.txt