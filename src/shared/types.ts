import { string } from "zod";
import {
  HTTPClientErrorResponses,
  HTTPServerErrorResponses,
} from "./http-status";

// DUPLICATED IN request-types.ts
// END DUPLICATES

export enum Tables {
  Users = "users",
  Words = "words",
}

export interface DatastoreRecord {
  partitionKey: string;
  sortKey: string;
  createdAt: number;
  modifiedAt: number;
}

export interface User extends DatastoreRecord {
  userId: string;
  name: string;
  email: string;
}

export interface Word extends DatastoreRecord {
  userId: string;
  word: string;
}

export interface TableTypes {
  [Tables.Users]: User;
  [Tables.Words]: Word;
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

export interface DictionaryResult {
  word: string;
  phonetic: string;
  phonetics: {
    text: string;
    audio: string;
  }[];
  origin: string;
  meanings: {
    partOfSpeech: string; //"noun", "verb", "adjective", "adverb"
    definitions: {
      definition: string;
      synonyms: string[];
      antonyms: string[];
    }[];
  }[];
}
