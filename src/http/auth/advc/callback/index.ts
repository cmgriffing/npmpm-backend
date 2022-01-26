import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
} from "./node_modules/@architect/shared/middleware";
import { Route } from "./node_modules/@architect/shared/types";

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/",
    tags: [""],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestJsonSchemaPath: "postUserRequestSchema.json",
    responseJsonSchemaPath: "postUserResponseSchema.json",
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
      async function http(req): Promise<HttpResponse> {
        try {
          return attachCommonHeaders({
            statusCode: 200,
            json: {},
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
