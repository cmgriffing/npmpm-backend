import { AuthProviders } from "./../../../../shared/types";
import * as arc from "@architect/functions";
import { HttpResponse } from "@architect/functions";
import axios from "axios";
import {
  getTables,
  getUser,
  isValidRequest,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithTables,
} from "./node_modules/@architect/shared/middleware";
import { oAuthCallbackRequestSchema } from "./node_modules/@architect/shared/request-schemas";
import { Route, User, Tables } from "./node_modules/@architect/shared/types";
import { DBKeys, getTableMeta } from "./node_modules/@architect/shared/data";
import { encodeAccessToken } from "./node_modules/@architect/shared/token";
import { nanoid } from "./node_modules/@architect/shared/nanoid";

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_CALLBACK_URL,
} = process.env;

const providerDetails: {
  [key: string]: {
    getUserDetails: Function;
    makeVerificationRequest: Function;
  };
} = {
  github: {
    getUserDetails(accessToken: string) {
      return axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      });
    },
    makeVerificationRequest(code: string) {
      return axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          redirect_uri: GITHUB_CALLBACK_URL,
          code,
        },
        {
          headers: { Accept: "application/json" },
        }
      );
    },
  },
  twitch: {
    getUserDetails(accessToken: string) {
      return axios
        .get("https://api.twitch.tv/helix/users", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Client-ID": TWITCH_CLIENT_ID,
          },
        })
        .then((result) => {
          return {
            data: result.data.data[0],
          };
        });
    },
    makeVerificationRequest(code: string) {
      return axios.post(
        `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&code=${code}&grant_type=authorization_code&redirect_uri=${TWITCH_CALLBACK_URL}`
      );
    },
  },
};

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/oauth/:provider/callback",
    tags: ["oauth"],
    headers: {
      ...commonHeaders,
    },
    method: "POST",
    requestJsonSchemaPath: "oAuthCallbackRequestSchema.json",
    responseJsonSchemaPath: "oAuthCallbackResponseSchema.json",
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
      isValidRequest(oAuthCallbackRequestSchema),
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const { provider } = req.pathParameters;
          const { code } = req.body;

          if (!providerDetails[provider]) {
            return attachCommonHeaders({
              statusCode: 400,
              json: { message: "Invalid OAuth provider" },
            });
          }

          const { getUserDetails, makeVerificationRequest } =
            providerDetails[provider];

          const defaultResponse = {
            access_token: "",
            scope: "",
            token_type: "",
          };

          const verificationResponse = await makeVerificationRequest(code);

          if (!verificationResponse?.data?.access_token) {
            console.log("Error verifying code", {
              code,
              provider,
              data: verificationResponse?.data,
            });

            return attachCommonHeaders({
              statusCode: 500,
              json: {},
            });
          }

          const defaultUserDetails = { id: "" };

          const providerUserResponse = await getUserDetails(
            verificationResponse?.data?.access_token
          ).catch((error: any) => {
            console.log("Error fetching provider user details: ", error);
            return { data: defaultUserDetails };
          });

          if (!verificationResponse?.data?.access_token) {
            console.log("Error verifying code", {
              code,
              provider,
              data: providerUserResponse?.data,
            });

            return attachCommonHeaders({
              statusCode: 500,
              json: { message: "Error fetching user details from provider" },
            });
          }
          const providerId = providerUserResponse?.data?.id;

          const usersTable = req.tables.get<User>(Tables.Users);
          let user = await usersTable.getById(
            { provider, providerId },
            DBKeys.Sort
          );

          console.log({ user });

          if (!user) {
            const usersTableMeta = getTableMeta(Tables.Users);
            const userId = nanoid();
            const partitionKey = usersTableMeta.partitionKey({ userId });
            const sortKey = usersTableMeta.sortKey({ provider, providerId });
            const now = Date.now();

            user = await usersTable.create({
              partitionKey,
              sortKey,
              userId,
              provider: provider as AuthProviders,
              providerId,
              createdAt: now,
              modifiedAt: now,
            });

            console.log({ user });
          }

          return attachCommonHeaders({
            statusCode: 200,
            json: { accessToken: encodeAccessToken(user) },
          });
        } catch (e) {
          console.log("Unhandled Error: ");
          console.log(e);
          return attachCommonHeaders({
            statusCode: 500,
            json: {},
          });
        }
      }
    );
  }
}

exports.handler = Handler.get();
