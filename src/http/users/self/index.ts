import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithUser,
} from "./node_modules/@architect/shared/middleware";
import { Route, Tables, Word } from "./node_modules/@architect/shared/types";
import { DBKeys } from "./node_modules/@architect/shared/data";

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/users/self",
    tags: ["users"],
    headers: {
      ...commonHeaders,
    },
    method: "GET",
    responseJsonSchemaPath: "emptyResponseSchema.json",
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
      async function http(req: HttpRequestWithUser): Promise<HttpResponse> {
        try {
          const { userId } = req.user;

          const wordsTable = req.tables.get<Word>(Tables.Words);

          const words = await wordsTable.getAllById(
            { userId },
            {},
            DBKeys.Partition
          );

          const score = words.reduce(
            (total, word) => total + (word.score || 0),
            0
          );

          console.log({ score });

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
