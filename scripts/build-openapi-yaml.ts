import * as glob from "glob";
import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";
import { getRouteMetadata } from "./build-openapi-yaml/get-route-metadata";
import { OpenAPIV3 } from "openapi-types";
import { RouteOptions } from "../src/shared/types";
import * as YAML from "yaml";

const schemaFolder = "./schema";

const handlers = glob.sync("src/http/**/index.ts");

const routeOptions: RouteOptions[] = [];

handlers
  .filter((handlerPath) => handlerPath.indexOf("node_modules") === -1)
  .map((handlerPath) => path.resolve(handlerPath))
  .map((handlerPath) => {
    // parse http handlers using ts
    const fileName = handlerPath.substring(handlerPath.lastIndexOf("/"));
    const sourceText = fs.readFileSync(handlerPath, { encoding: "utf8" });

    return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest);
  })
  .map((sourceFile) => {
    // map parsed handlers and extract metadata from Route
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node)) {
        routeOptions.push(...getRouteMetadata(node, sourceFile));
      }
    });
  });

// map routes to openApi path objects
// and build spec json adding paths
const schema = {
  openapi: "3.0.3",
  info: {
    version: "1.0.0",
    title: "A Generic API",
    description: "",
  },
  paths: {},
  components: {
    schemas: {},
  },
} as OpenAPIV3.Document;

routeOptions.forEach((routeOptionObject) => {
  if (!schema.paths[routeOptionObject.path]) {
    schema.paths[routeOptionObject.path] = {} as OpenAPIV3.PathItemObject;
  }

  let requestSchema: any;
  if (routeOptionObject?.requestJsonSchemaPath) {
    const requestJson = fs.readFileSync(
      `${schemaFolder}/${routeOptionObject.requestJsonSchemaPath}`,
      { encoding: "utf8" }
    );

    requestSchema = JSON.parse(requestJson);

    Object.entries(requestSchema["components/schemas"]).forEach(
      ([key, value]) => {
        schema.components.schemas[key] = value as OpenAPIV3.SchemaObject;
      }
    );
  }

  const responses: any = {};

  // set 200 response
  const responseSchema = JSON.parse(
    fs.readFileSync(
      `${schemaFolder}/${routeOptionObject.responseJsonSchemaPath}`,
      {
        encoding: "utf8",
      }
    )
  );
  responses["200"] = {
    description: "Response",
    content: {
      "application/json": {
        schema: {
          $ref: responseSchema.$ref,
        },
      },
    },
  };

  Object.entries(responseSchema["components/schemas"]).forEach(
    ([key, value]) => {
      schema.components.schemas[key] = value as OpenAPIV3.ResponseObject;
    }
  );

  // set error responses
  const errorSchema = JSON.parse(
    fs.readFileSync(
      `${schemaFolder}/${routeOptionObject.errorJsonSchemaPath}`,
      {
        encoding: "utf8",
      }
    )
  );

  Object.entries(errorSchema["components/schemas"]).forEach(([key, value]) => {
    schema.components.schemas[key] = value as OpenAPIV3.SchemaObject;
  });

  routeOptionObject.definedErrors.forEach((errorCode) => {
    const definedError = {
      description: "Error",
      content: {
        "application/json": {
          schema: {
            $ref: errorSchema.$ref,
          },
        },
      },
    };

    responses[errorCode] = definedError;
  });

  const pathObject: any = {
    responses,
    tags: routeOptionObject.tags,
  };

  if (requestSchema) {
    pathObject.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: requestSchema.$ref,
          },
        },
      },
    };
  }
  schema.paths[routeOptionObject.path][routeOptionObject.method.toLowerCase()] =
    pathObject;
});

// convert json to yaml
const yaml = YAML.stringify(schema);

// output yaml file
fs.outputFile("openapi.yml", yaml);
