import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  isValidRequest,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithUser,
} from "./node_modules/@architect/shared/middleware";
import { Route, Word, Tables } from "./node_modules/@architect/shared/types";
import { postWordRequestSchema } from "./node_modules/@architect/shared/request-schemas";
import axios from "axios";
import { DBKeys, getTableMeta } from "./node_modules/@architect/shared/data";
// dictionary from https://github.com/dwyl/english-words (uses Unlicese)
import rawWords from "./node_modules/@architect/shared/words_dictionary.json";
// profane words from https://github.com/zacanger/profane-words (uses WTFPL)
import rawProfaneWords from "./node_modules/@architect/shared/words_profanity.json";

interface WordDictionary {
  [key: string]: number;
}

const words = rawWords as unknown as WordDictionary;
const profaneWords = rawProfaneWords as WordDictionary;
const npmCache: WordDictionary = {};

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/words",
    tags: ["words"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestJsonSchemaPath: "postWordRequestSchema.json",
    responseJsonSchemaPath: "postWordResponseSchema.json",
    errorJsonSchemaPath: "errorResponseSchema.json",
    definedErrors: [400, 401, 404, 500],
  })
  static get() {
    return arc.http.async(
      getTables,
      getUser,
      isValidRequest(postWordRequestSchema),
      async function http(req: HttpRequestWithUser): Promise<HttpResponse> {
        try {
          const { userId } = req.user;
          let { word } = req.body;
          word = word.toLowerCase();

          // check if word is profane
          const wordIsProfane = !!profaneWords[word];
          if (wordIsProfane) {
            return attachCommonHeaders({
              statusCode: 400,
              json: { message: "Profanity not allowed" },
            });
          }

          // check if word is in dictionary
          const wordIsInDictionary = !!words[word];

          // 404 if word is not in dictionary
          if (!wordIsInDictionary) {
            return attachCommonHeaders({
              statusCode: 404,
              json: { message: "Word not in dictionary API" },
            });
          }

          // check if word is repo
          // TODO: refactor any to proper types
          let npmResults: any = npmCache[word];

          if (!npmResults) {
            npmResults = await axios
              .get(`https://api.npms.io/v2/search?q=${word}`)
              .catch(() => {});
          }

          if (!npmResults) {
            return attachCommonHeaders({
              statusCode: 500,
              json: { message: "NPM fetch failed" },
            });
          }

          let score = 0;

          if (npmResults?.data.total === 0) {
            score = 2;
          } else if (npmResults.data.results[0].searchScore >= 100000) {
            score = 0;
          } else {
            score = 1;
          }

          // update user score (scoring values not set in stone yet)
          const wordsTable = req.tables.get<Word>(Tables.Words);

          console.log({ userId, word });
          // if user has already submit word send 420 enhance calm
          if (await wordsTable.getById({ userId, word }, DBKeys.Tertiary)) {
            return attachCommonHeaders({
              statusCode: 420,
              json: { message: "User has already submitted this word" },
            });
          }

          const tableMeta = getTableMeta(Tables.Words);
          const partitionKey = tableMeta.partitionKey({ userId });
          const sortKey = tableMeta.sortKey({ word });
          const tertiaryKey = tableMeta.tertiaryKey({ userId, word });
          const now = Date.now();
          await wordsTable.create({
            partitionKey,
            sortKey,
            tertiaryKey,
            userId,
            word,
            score,
            createdAt: now,
            modifiedAt: now,
          });

          return attachCommonHeaders({
            statusCode: 200,
            json: { score },
          });
        } catch (e) {
          console.log("Unhandled Error: ");
          console.log(e);
          return {
            statusCode: 500,
          };
        }
      }
    );
  }
}

exports.handler = Handler.get();
