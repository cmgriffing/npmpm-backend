import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithTables,
} from "./node_modules/@architect/shared/middleware";
import {
  Route,
  Tables,
  Word,
  HighScoreList,
  ScoreType,
} from "./node_modules/@architect/shared/types";
import { pick } from "lodash";
import {
  DBKeys,
  getTableMeta,
  WrappedDatastore,
} from "./node_modules/@architect/shared/data";

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/words/top",
    tags: ["words"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    responseJsonSchemaPath: "highScoresResponseSchema.json",
    errorJsonSchemaPath: "errorResponseSchema.json",
    definedErrors: [
      // HTTPStatusCode.BadRequest,
      // HTTPStatusCode.InternalServerError,
      400, 500,
    ],
  })
  static get() {
    return arc.http.async(
      getTables,
      getUser,
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const now = Date.now();
          const cacheTimeout = 3600000;

          const wordsTable = req.tables.get<Word>(Tables.Words);
          const highScoresTable = req.tables.get<HighScoreList>(
            Tables.HighScores
          );
          const scoresTableMeta = getTableMeta(Tables.HighScores);
          const partitionKey = scoresTableMeta.partitionKey({});
          const availableSortKey = scoresTableMeta.partitionKey({
            scoreType: ScoreType.Available,
          });
          const unavailableSortKey = scoresTableMeta.partitionKey({
            scoreType: ScoreType.Unavailable,
          });

          const existingScores = await highScoresTable.getAllById(
            {},
            {},
            DBKeys.Partition
          );

          const rawAvailableScores = existingScores.find(
            (scoreList) => scoreList.scoreType === ScoreType.Available
          );
          const rawUnavailableScores = existingScores.find(
            (scoreList) => scoreList.scoreType === ScoreType.Unavailable
          );

          if (!rawAvailableScores || !rawUnavailableScores) {
            // create scores

            const { availableScores, unavailableScores } = await aggregateWords(
              wordsTable
            );

            await Promise.all([
              highScoresTable.create({
                partitionKey,
                sortKey: availableSortKey,
                scoreType: ScoreType.Available,
                words: availableScores,
                createdAt: now,
                modifiedAt: now,
              }),
              highScoresTable.create({
                partitionKey,
                sortKey: unavailableSortKey,
                scoreType: ScoreType.Unavailable,
                words: unavailableScores,
                createdAt: now,
                modifiedAt: now,
              }),
            ]);

            return attachCommonHeaders({
              statusCode: 200,
              json: { availableScores, unavailableScores },
            });
          }

          let availableScores = rawAvailableScores.words;
          let unavailableScores = rawUnavailableScores.words;

          if (
            rawAvailableScores.modifiedAt < now - cacheTimeout ||
            rawUnavailableScores.modifiedAt < now - cacheTimeout
          ) {
            const aggregatedWords = await aggregateWords(wordsTable);
            availableScores = aggregatedWords.availableScores;
            unavailableScores = aggregatedWords.unavailableScores;

            await Promise.all([
              highScoresTable.update(
                {},
                { words: availableScores },
                { scoreType: ScoreType.Available }
              ),
              highScoresTable.update(
                {},
                { words: unavailableScores },
                { scoreType: ScoreType.Unavailable }
              ),
            ]);
          }

          return attachCommonHeaders({
            statusCode: 200,
            json: { availableScores, unavailableScores },
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

function getHighScoresFromMap(scoresMap: { [key: string]: number }) {
  return Object.entries(scoresMap)
    .filter(([word, score]) => !!score)
    .sort(([wordA, scoreA], [wordB, scoreB]) => scoreB - scoreA)
    .map(([word, count]) => ({ word, count }))
    .slice(0, 9);
}

async function aggregateWords(wordsTable: WrappedDatastore<Word>) {
  const allWords = await wordsTable.scanIdsByFilter();

  const availableScoresMap: { [key: string]: number } = {};
  const unavailableScoresMap: { [key: string]: number } = {};

  allWords.forEach((wordRow) => {
    if (wordRow.score === 2) {
      if (!availableScoresMap[wordRow.word]) {
        availableScoresMap[wordRow.word] = 1;
      } else {
        availableScoresMap[wordRow.word] += 1;
      }
    }
    if (wordRow.score === 0) {
      if (!unavailableScoresMap[wordRow.word]) {
        unavailableScoresMap[wordRow.word] = 1;
      } else {
        unavailableScoresMap[wordRow.word] += 1;
      }
    }
  });

  const availableScores = getHighScoresFromMap(availableScoresMap);
  const unavailableScores = getHighScoresFromMap(unavailableScoresMap);

  return { availableScores, unavailableScores };
}

exports.handler = Handler.get();
