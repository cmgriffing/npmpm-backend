import * as dotenv from "dotenv";
import * as fs from "fs-extra";
import * as child_process from "child_process";

let [environment] = process.argv.slice(2);
if (!environment) {
  environment = "testing";
}

console.log("Setting ENV vars for ", environment);

// copy preferences.template over existing preferences.arc
fs.copyFileSync("preferences.template.arc", "preferences.arc");

// load env file based on argument
const envVars = dotenv.parse(
  fs.readFileSync(`.${environment}.env`, { encoding: "utf8" })
);

// set arc env vars using cli
Object.entries(envVars).forEach(([key, value]) => {
  console.log("Setting ENV var: ", key);
  const addedKeyResult = child_process.spawnSync(`arc`, [
    "env",
    environment,
    key,
    value,
  ]);
});

const envResult = child_process.spawnSync("arc", ["env"]);

console.log("Finished loading env vars");
