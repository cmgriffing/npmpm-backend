import { string } from "zod";
import {
  HTTPClientErrorResponses,
  HTTPServerErrorResponses,
} from "./http-status";

// DUPLICATED IN request-types.ts
export enum AdvcCallbackStatusCode {
  Uninitiated = "uninitiated",
  RequestRetrieved = "request_retrieved",
  PresentationVerified = "presentation_verified",
}
// END DUPLICATES

export enum Tables {
  Users = "users",
  Words = "words",
  HighScores = "highScores",
  AdvcAttempts = "advcAttempts",
}

export interface DatastoreRecord {
  partitionKey: string;
  sortKey: string;
  createdAt: number;
  modifiedAt: number;
}

export interface User extends DatastoreRecord {
  userId: string;
  provider: AuthProviders;
  providerId: string;
}

export interface Word extends DatastoreRecord {
  userId: string;
  word: string;
  score: number;
}

export interface HighScoreList extends DatastoreRecord {
  scoreType: string;
  words: {
    word: string;
    count: number;
  }[];
}

export enum ScoreType {
  Available = "available",
  Unavailable = "unavailable",
}

export interface TableTypes {
  [Tables.Users]: User;
  [Tables.Words]: Word;
  [Tables.AdvcAttempts]: AdvcAttempt;
}

export interface RouteOptions {
  path: string;
  summary: string;
  description: string;
  tags: string[];
  headers: { [key: string]: string };
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  definedErrors: (HTTPClientErrorResponses | HTTPServerErrorResponses)[];
  // Maybe we could combine the schema paths into a common interpolatable variable. (postUser)
  requestJsonSchemaPath?: string;
  responseJsonSchemaPath: string;
  errorJsonSchemaPath: string | "errorResponseSchema.json";
}

// There is probably a better place for this
export function Route(options: RouteOptions): Function {
  return () => {
    return;
  };
}

export interface AdvcAttempt extends DatastoreRecord {
  state: string;
  code: AdvcCallbackStatusCode;
  advcUserId?: string;
}

export enum AuthProviders {
  ADVC = "advc",
  Github = "github",
  Twitter = "twitter",
  Twitch = "twitch",
}
