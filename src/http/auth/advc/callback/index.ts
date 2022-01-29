import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
  isValidRequest,
  HttpRequestWithTables,
} from "./node_modules/@architect/shared/middleware";
import {
  Route,
  AdvcCallbackStatusCode,
  AdvcAttempt,
  Tables,
  User,
  AuthProviders,
} from "./node_modules/@architect/shared/types";
import { advcCallbackRequestSchema } from "./node_modules/@architect/shared/request-schemas";
import { getTableMeta, DBKeys } from "./node_modules/@architect/shared/data";
import { nanoid } from "./node_modules/@architect/shared/nanoid";

const { ADVC_API_KEY } = process.env;

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/advc/callback",
    tags: ["advc"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestJsonSchemaPath: "advcCallbackRequestSchema.json",
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
      isValidRequest(advcCallbackRequestSchema),
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          console.log("request body", JSON.stringify(req.body, undefined, 2));
          console.log(
            "request headers",
            JSON.stringify(req.headers, undefined, 2)
          );

          const { state, code, subject } = req.body;

          const usersTable = req.tables.get<User>(Tables.Users);

          const advcTable = req.tables.get<AdvcAttempt>(
            Tables.AdvcAttempts,
            "advc"
          );

          if (req.headers["api-key"] !== ADVC_API_KEY) {
            return attachCommonHeaders({
              statusCode: 500,
              json: {},
            });
          }

          const now = Date.now();

          if (code === AdvcCallbackStatusCode.RequestRetrieved) {
            await advcTable.update(
              { state },
              {
                code,
                modifiedAt: now,
              },
              { state }
            );
          }

          if (code === AdvcCallbackStatusCode.PresentationVerified) {
            const scrubbedSubject = subject.replace("did:ion:", "");
            const advcUserId = scrubbedSubject.split(":")[0];

            await advcTable.update(
              { state },
              {
                code,
                modifiedAt: now,
                advcUserId,
              },
              { state }
            );

            const providerDetails = {
              provider: AuthProviders.ADVC,
              providerId: advcUserId,
            };

            const user = await usersTable.getById(providerDetails, DBKeys.Sort);

            if (!user) {
              const userTableMeta = getTableMeta(Tables.Users);
              const userId = nanoid();
              const userPartitionKey = userTableMeta.partitionKey({ userId });
              const userSortKey = userTableMeta.sortKey(providerDetails);

              const newUser = await usersTable.create({
                partitionKey: userPartitionKey,
                sortKey: userSortKey,
                userId,
                provider: AuthProviders.ADVC,
                providerId: advcUserId,
                createdAt: now,
                modifiedAt: now,
              });

              console.log("creating user", {
                partitionKey: userPartitionKey,
                sortKey: userSortKey,
                userId,
                provider: AuthProviders.ADVC,
                providerId: advcUserId,
                createdAt: now,
                modifiedAt: now,
              });

              console.log({ newUser });
            }
          }

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
