import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  isValidRequest,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithTables,
  logDatabase,
} from "./node_modules/@architect/shared/middleware";
import {
  Route,
  User,
  Tables,
  AdvcAttempt,
  AdvcCallbackStatusCode,
  AuthProviders,
} from "./node_modules/@architect/shared/types";
import { advcTokenRequestSchema } from "./node_modules/@architect/shared/request-schemas";
import { encodeAccessToken } from "./node_modules/@architect/shared/token";
import { DBKeys } from "./node_modules/@architect/shared/data";

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
    requestJsonSchemaPath: "advcTokenRequestSchema.json",
    responseJsonSchemaPath: "advcTokenResponseSchema.json",
    errorJsonSchemaPath: "errorResponseSchema.json",
    definedErrors: [400, 403, 404, 500],
  })
  static get() {
    return arc.http.async(
      getTables,
      isValidRequest(advcTokenRequestSchema),
      logDatabase,
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const { state } = req.body;
          const usersTable = req.tables.get<User>(Tables.Users);

          const advcTable = req.tables.get<AdvcAttempt>(
            Tables.AdvcAttempts,
            "advc"
          );

          const advcAttempt = await advcTable.getById({ state });

          if (!advcAttempt) {
            return attachCommonHeaders({
              statusCode: 404,
              json: {},
            });
          }

          console.log({ advcAttempt });

          if (advcAttempt.createdAt + 30000 < Date.now()) {
            return attachCommonHeaders({
              statusCode: 403,
              json: {},
            });
          }

          const { code, createdAt, advcUserId } = advcAttempt;

          if (
            advcAttempt.code === AdvcCallbackStatusCode.PresentationVerified
          ) {
            if (!advcUserId) {
              // something went wrong, we should have a userId

              console.log({ advcUserId });

              return attachCommonHeaders({
                statusCode: 500,
                json: {},
              });
            }

            const user = await usersTable.getById(
              {
                provider: AuthProviders.ADVC,
                providerId: advcUserId,
              },
              DBKeys.Sort
            );

            console.log({ user });

            if (!user) {
              // something went wrong, we should have a user
              return attachCommonHeaders({
                statusCode: 500,
                json: {},
              });
            }

            return attachCommonHeaders({
              statusCode: 200,
              json: { code, createdAt, accessToken: encodeAccessToken(user) },
            });
          } else {
            return attachCommonHeaders({
              statusCode: 200,
              json: { code, createdAt },
            });
          }
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
