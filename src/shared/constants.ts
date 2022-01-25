import * as dotenv from "dotenv";
dotenv.config();

export const CLIENT_BASE_URL = `http://localhost:19006`;
export const WEBSITE_BASE_URL = `http://localhost:3000`;
// export const CLIENT_BASE_URL = `https://mealection.com`;
// export const WEBSITE_BASE_URL = `https://mealection.com`;

export function getEnvVariable(baseEnvVar: string): string {
  const { CIRCLE_BRANCH } = process.env;

  if (CIRCLE_BRANCH === "staging" || CIRCLE_BRANCH === "production") {
    return process.env[`${CIRCLE_BRANCH.toUpperCase()}_${baseEnvVar}`];
  } else {
    return process.env[baseEnvVar];
  }

  return "";
}
