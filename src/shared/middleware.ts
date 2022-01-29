import {
  HttpHandler,
  HttpRequest,
  HttpResponse,
  tables,
} from "@architect/functions";
import * as dotenv from "dotenv";
dotenv.config();

import {
  createDataWrapper,
  Datastore,
  getTableMeta,
  WrappedDatastore,
  DBKeys,
} from "./data";
import { nanoid } from "./nanoid";
import { decodeToken } from "./token";
import { AdvcAttempt, AuthProviders, Tables, User } from "./types";

export interface TableDatastores {}

export interface HttpRequestWithTables extends HttpRequest {
  tables: { get: <T>(prop: Tables, tableName?: string) => WrappedDatastore<T> };
}

export interface HttpRequestWithUser extends HttpRequestWithTables {
  user: User;
}

export const getTables = async function (
  req: HttpRequest,
  context: any
): Promise<HttpResponse | void> {
  const data = await tables();

  (req as HttpRequestWithTables).tables = {
    get<T>(prop: Tables, tableName: string = "core") {
      const table = data[tableName] as unknown as Datastore;
      return createDataWrapper<T>(prop, table, data._doc);
    },
  };
} as HttpHandler;

// requires tables to be fetched first
export const getUser = async function (
  req: HttpRequestWithTables,
  context: any
): Promise<HttpResponse | void> {
  (req as HttpRequestWithUser).user = {
    partitionKey: "",
    sortKey: "",
    userId: "foo",
    provider: AuthProviders.ADVC,
    providerId: "foo",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };

  return;

  const token = req.headers.authorization.substring("Bearer ".length);

  try {
    const usersTable = req.tables.get<User>(Tables.Users);
    const usersTableMeta = getTableMeta(Tables.Users);
    const decodedToken = decodeToken(token);
    const userId = (decodedToken.sub as any).userId;
    const user = await usersTable.getById({ userId });

    if (!user) {
      throw new Error("No user found.");
    }

    (req as HttpRequestWithUser).user = user;
  } catch (e) {
    console.log("Error decoding token and fetching user");
    console.log(e);

    return attachCommonHeaders({
      statusCode: 401,
      json: {},
    });
  }
} as HttpHandler;

export function isValidRequest(schema: any) {
  return async function (
    req: HttpRequestWithTables,
    context: any
  ): Promise<HttpResponse | void> {
    try {
      schema.strict().parse(req.body);
    } catch (e) {
      console.log("Error validating request body");
      console.log(e);

      return attachCommonHeaders({
        statusCode: 400,
        json: e,
      });
    }
  } as HttpHandler;
}

export const logDatabase = async function (
  req: HttpRequestWithTables
): Promise<HttpResponse> {
  try {
    const everything = await req.tables
      .get<User>(Tables.Users)
      .GET_EVERYTHING();

    const other = await req.tables
      .get<AdvcAttempt>(Tables.AdvcAttempts, "advc")
      .GET_EVERYTHING();

    console.log("EVERYTHING", JSON.stringify(everything, null, 2));
    console.log("OTHER", JSON.stringify(other, null, 2));
  } catch (e) {
    console.log("Error logging EVERYTHING");
    console.log(e);

    return attachCommonHeaders({
      statusCode: 500,
      json: e,
    });
  }
} as HttpHandler;

export const commonHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "cache-control": "no-cache, no-store, must-revalidate, max-age=0, s-maxage=0",
  "content-type": "application/json; charset=utf8",
};

export function attachCommonHeaders(response: HttpResponse): HttpResponse {
  response.headers = {
    ...(response.headers || {}),
    ...commonHeaders,
  };

  (response as any).cors = true;
  return response;
}
