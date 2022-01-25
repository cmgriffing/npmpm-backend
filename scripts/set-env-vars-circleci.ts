import * as fs from "fs-extra";
import * as child_process from "child_process";

const ENV_KEYS = [
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_ENDPOINT",
  "UNSPLASH_API_KEY",
  "UNSPLASH_SECRET_KEY",
  "SENDGRID_API_KEY",
  "TRANSACTIONAL_SENDER_EMAIL",
  "MAILJET_ACCESS_KEY",
  "MAILJET_SECRET_KEY",
  "YELP_CLIENT_ID",
  "YELP_API_KEY",
];

const { CIRCLE_BRANCH } = process.env;

let envFileString = "";

ENV_KEYS.forEach((key) => {
  const value = process.env[`${CIRCLE_BRANCH.toUpperCase()}_${key}`];

  if (key === "MAILJET_ACCESS_KEY") {
    console.log("STAGING KEY", value);
  }

  console.log("Setting ENV VAR: ", key);
  const addedKeyResult = child_process.spawnSync(`arc`, [
    "env",
    CIRCLE_BRANCH,
    key,
    value,
  ]);

  envFileString += `${key}=${value}\n`;
});

fs.outputFileSync("./env", envFileString);
