const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const arr = j.deployments || j;
let out = "";
for (const d of arr) {
  out += d.uid + " | readyState=" + d.readyState + " | " + (d.readyStateReason || "") + "\n";
}
fs.writeFileSync("api_status.txt", out);