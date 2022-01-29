import * as arc from "@architect/functions";
import { HttpRequest, HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
  HttpRequestWithTables,
} from "@architect/shared/middleware";
import {
  Route,
  Tables,
  AdvcAttempt,
  AdvcCallbackStatusCode,
} from "@architect/shared/types";
import { getTableMeta } from "@architect/shared/data";
import { nanoid } from "@architect/shared/nanoid";
import { ClientSecretCredential } from "@azure/identity";
import axios from "axios";

const {
  ADVC_TENANT_ID,
  ADVC_DID,
  ADVC_CLIENT_ID,
  ADVC_CLIENT_SECRET,
  ADVC_CREDENTIAL_URL,
  ADVC_API_KEY,
  ADVC_ISSUER_DID,
} = process.env;

const ADVC_AUTHORITY = `https://login.microsoftonline.com`;
// const ADVC_AUTHORITY = `https://login.microsoftonline.com/${ADVC_TENANT_ID}`;
const ADVC_REQUEST_ENDPOINT = `https://beta.did.msidentity.com/v1.0/${ADVC_TENANT_ID}/verifiablecredentials/request`;

const ADVC_SERVICE_SCOPE = "bbb94529-53a3-4be5-a069-7eaf2712b826/.default";

// const BASE_URL = "https://b2012161c66c.ngrok.io";
const BASE_URL = "https://yzs3zsa9n7.execute-api.us-west-2.amazonaws.com";

const purpose = "So that you can play NPMPM";

class Handler {
  @Route({
    summary: "",
    description: "",
    path: "/advc/login",
    tags: ["auth", "advc"],
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
      async function http(req: HttpRequestWithTables): Promise<HttpResponse> {
        try {
          const state = nanoid();

          const payload = {
            includeQRCode: true,
            callback: {
              url: `${BASE_URL}/advc/callback`,
              state,
              headers: {
                "api-key": ADVC_API_KEY,
              },
            },
            authority: ADVC_DID,
            registration: {
              clientName: "NPMPM",
              purpose,
            },
            presentation: {
              includeReceipt: false,
              requestedCredentials: [
                {
                  type: "StreamViewer",
                  purpose,
                  acceptedIssuers: [ADVC_ISSUER_DID],
                },
              ],
            },
          };

          console.log(JSON.stringify(payload, undefined, 2));

          const accessToken = new ClientSecretCredential(
            ADVC_TENANT_ID,
            ADVC_CLIENT_ID,
            ADVC_CLIENT_SECRET,
            {
              authorityHost: ADVC_AUTHORITY,
            }
          ).getToken([ADVC_SERVICE_SCOPE]);

          const requestResponse = await axios.post(
            ADVC_REQUEST_ENDPOINT,
            payload,
            {
              headers: {
                Authorization: `Bearer ${(await accessToken).token}`,
              },
            }
          );

          const { qrCode } = requestResponse?.data || { qrCode: "" };

          if (!qrCode) {
            return attachCommonHeaders({
              statusCode: 500,
              json: { message: "Error generating QR Code" },
            });
          }

          const advcTable = req.tables.get<AdvcAttempt>(
            Tables.AdvcAttempts,
            "advc"
          );

          const advcTableMeta = getTableMeta(Tables.AdvcAttempts);
          const advcPartitionKey = advcTableMeta.partitionKey({ state });
          const advcSortKey = advcTableMeta.sortKey({ state });
          const now = Date.now();

          const createdRow = await advcTable.create({
            partitionKey: advcPartitionKey,
            sortKey: advcSortKey,
            code: AdvcCallbackStatusCode.Uninitiated,
            state,
            createdAt: now,
            modifiedAt: now,
          });

          console.log({ createdRow });

          return attachCommonHeaders({
            statusCode: 200,
            json: { qrCode, state },
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
