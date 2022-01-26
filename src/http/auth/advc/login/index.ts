import * as arc from "@architect/functions";
import { HttpRequest, HttpResponse } from "@architect/functions";
import {
  getTables,
  getUser,
  attachCommonHeaders,
  commonHeaders,
} from "@architect/shared/middleware";
import { Route } from "@architect/shared/types";
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
} = process.env;

const ADVC_AUTHORITY = `https://login.microsoftonline.com/${ADVC_TENANT_ID}`;
const ADVC_REQUEST_ENDPOINT = `https://beta.did.msidentity.com/v1.0/${ADVC_TENANT_ID}/verifiablecredentials/request`;

const ADVC_SERVICE_SCOPE = "bbb94529-53a3-4be5-a069-7eaf2712b826/.default";

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
    return arc.http.async(async function http(
      req: HttpRequest
    ): Promise<HttpResponse> {
      try {
        const payload = {
          includeQRCode: true,
          callback: {
            url: "https://https://yzs3zsa9n7.execute-api.us-west-2.amazonaws.com/advc/callback",
            state: nanoid(),
            headers: {
              "api-key": ADVC_API_KEY,
            },
          },
          authority: `did:ion:${ADVC_DID}`,
          registration: {
            clientName: "Veriable Credential Expert Verifier",
            purpose: "So we can see that you a verifiable credentials expert",
          },
          presentation: {
            includeReceipt: false,
            requestedCredentials: [
              {
                type: "VerifiedCredentialExpert",
                purpose:
                  "So we can see that you a verifiable credentials expert",
                acceptedIssuers: [`did:ion:${ADVC_DID}`],
              },
            ],
          },
        };

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

        return attachCommonHeaders({
          statusCode: 200,
          json: { qrCode },
        });
      } catch (e) {
        console.log("Unhandled Error: ");
        console.log(e);
        return {
          statusCode: 500,
        };
      }
    });
  }
}

exports.handler = Handler.get();
