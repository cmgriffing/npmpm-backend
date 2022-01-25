const jsStringEscape = require("js-string-escape");
import { nanoid } from "./nanoid";
import { Tables, User } from "./types";
import { omit } from "lodash";

export enum DBKeys {
  Partition = "partitionKey",
  Sort = "sortKey",
  Tertiary = "tertiaryKey",
}

export interface Datastore {
  put: Function;
  get: Function;
  delete: Function;
  query: Function;
  scan: Function;
  update: Function;
  _doc: {
    batchGet: Function;
  };
}

export type BatchGetKeys = {
  [value in DBKeys]?: string;
};

// export interface QueryKeys {
//   partitionKey?: string;
//   sortKey?: string;
//   tertiaryKey?: string;
//   extraIds?: { [key: string]: string };
// }
export interface QueryKeys {
  [key: string]: string;
}

interface GetAllOptions {
  filterExpression?: string;
  filterExpressionNames?: { [key: string]: string };
  filterExpressionValues?: { [key: string]: string };
  indexKey?: string;
}

type DBRecord<T> =
  | T
  | { partitionKey: string; sortKey: string; tertiaryKey?: string };

type CleanRecord<T> = Omit<T, "partitionKey" | "sortKey" | "tertiaryKey">;

function omitKeys<T extends Object>(
  object: T
): Omit<T, "partitionKey" | "sortKey" | "tertiaryKey"> {
  return omit<T>(
    object,
    "partitionKey",
    "sortKey",
    "tertiaryKey"
  ) as CleanRecord<T>;
}

export interface WrappedDatastore<T> {
  GET_EVERYTHING: () => Promise<any>;
  create: (putObject: DBRecord<T>) => Promise<T>;
  getById: (
    idValue: QueryKeys,
    index?: DBKeys,
    secondaryId?: string
  ) => Promise<T>;
  getByIndex: (
    idValue: QueryKeys,
    index?: DBKeys,
    secondaryId?: string
  ) => Promise<T>;
  getRandom: (
    ignoreKey?: string,
    ignoreValue?: string,
    index?: DBKeys
  ) => Promise<T>;
  scanIdsByFilter: (options?: GetAllOptions) => Promise<T[]>;
  getAllById: (
    idValue: QueryKeys,
    options?: GetAllOptions,
    index?: DBKeys,
    secondaryId?: string
  ) => Promise<T[]>;
  getAllByManyIds: (
    idValues: string[],
    idKey: string,
    index?: DBKeys,
    secondaryId?: string
  ) => Promise<T[]>;
  update: (
    idValue: QueryKeys,
    patchObject: Partial<T>,
    secondaryId: QueryKeys,
    index?: DBKeys
  ) => Promise<T>;
  remove: (
    idValue: QueryKeys,
    secondaryId: string,
    index?: DBKeys
  ) => Promise<T>;
}

// usage: const posts = createDataWrapper(app.posts)
export function createDataWrapper<T>(
  datastoreName: Tables,
  datastore: Datastore,
  documentClient: any
): WrappedDatastore<T> {
  const tableKeyMethods = getTableMeta(datastoreName);

  return {
    async GET_EVERYTHING() {
      return datastore.scan();
    },
    async create(putObject: T) {
      if (!Object.keys(putObject)?.length) {
        // empty putObject
        return;
      }

      return datastore.put(putObject).then(omitKeys);
    },
    async getById(idValue, index = DBKeys.Partition, secondaryId) {
      return this.getAllById(idValue, {}, index).then((result: any) => {
        return result[0];
      });
    },
    async getByIndex(idValue, index = DBKeys.Partition, secondaryId) {
      return this.getAllById(idValue, { indexKey: index }, index).then(
        (result: any) => {
          return result[0];
        }
      );
    },
    async getRandom(
      ignoreKey?: string,
      ignoreValue?: string,
      index = DBKeys.Partition
    ) {
      index = jsStringEscape(index);
      let record;
      let scanConfig: any = {
        Limit: 5,
        ExclusiveStartKey: {
          [index]: jsStringEscape(nanoid()),
        },
      };

      if (ignoreKey && ignoreValue) {
        scanConfig = {
          ...scanConfig,
          FilterExpression: "#ignoreKey <> :ignoreValue",
          ExpressionAttributeNames: {
            [`#ignoreKey`]: ignoreKey,
          },
          ExpressionAttributeValues: {
            [`:ignoreValue`]: ignoreValue,
          },
        };
      }

      for (let i = 0; i < 5; i++) {
        const scanResult = await datastore.scan(scanConfig);

        if (scanResult.Count > 0) {
          record = scanResult.Items[0];
          break;
        }
      }

      if (!record) {
        return;
      }

      return omitKeys<T>(record) as T;
    },
    async scanIdsByFilter(options?: GetAllOptions, index = DBKeys.Partition) {
      const query: any = {
        ExpressionAttributeNames: {},
        ExpressionAttributeValues: {},
      };

      if (options?.filterExpression) {
        query.FilterExpression = options?.filterExpression;
      }

      if (options?.filterExpressionNames) {
        query.ExpressionAttributeNames = {
          ...query.ExpressionAttributeNames,
          ...options?.filterExpressionNames,
        };
      }

      if (options?.filterExpressionValues) {
        query.ExpressionAttributeValues = {
          ...query.ExpressionAttributeValues,
          ...options?.filterExpressionValues,
        };
      }

      if (index !== DBKeys.Partition) {
        query.IndexName = index;
      }

      return datastore
        .scan(query)
        .then((results: { Items: T[] }) => results.Items.map(omitKeys));
    },
    async getAllById(
      idValue: QueryKeys,
      options?: GetAllOptions,
      index = DBKeys.Partition
    ) {
      index = jsStringEscape(index);
      idValue = escapeQueryKeys(idValue);
      const key = tableKeyMethods[index](idValue);

      const query: any = {
        KeyConditionExpression: `#${index} = :${index}`,
        ExpressionAttributeNames: {
          [`#${index}`]: index,
        },
        ExpressionAttributeValues: {
          [`:${index}`]: key,
        },
      };

      if (options?.filterExpression) {
        query.FilterExpression = options?.filterExpression;
      }

      if (options?.filterExpressionNames) {
        query.ExpressionAttributeNames = {
          ...query.ExpressionAttributeNames,
          ...options?.filterExpressionNames,
        };
      }

      if (options?.filterExpressionValues) {
        query.ExpressionAttributeValues = {
          ...query.ExpressionAttributeValues,
          ...options?.filterExpressionValues,
        };
      }

      if (index !== DBKeys.Partition) {
        query.IndexName = index;
      }

      console.log({ query });

      return datastore.query(query).then((response: any) => {
        return response.Items.map(omitKeys);
      });
    },
    async update(
      idValue: QueryKeys,
      patchObject = {},
      secondaryId: QueryKeys = {},
      index = DBKeys.Partition
    ) {
      index = jsStringEscape(index);
      idValue = escapeQueryKeys(idValue);
      const key = tableKeyMethods[index](idValue);
      const patchEntries: string[][] = Object.entries(patchObject);

      if (!patchEntries?.length) {
        // nothing to see here
        return;
      }

      const updateRequest = {
        Key: {
          [index]: key,
        },
        UpdateExpression: "",
        ExpressionAttributeNames: {} as { [key: string]: string },
        ExpressionAttributeValues: {} as { [key: string]: string },
        ReturnValues: "ALL_NEW",
      };

      let baseExpressionString = "";
      patchEntries.forEach(([key, value], index) => {
        if (index === 0) {
          baseExpressionString = `SET `;
        } else {
          baseExpressionString = baseExpressionString + ", ";
        }

        baseExpressionString += `#key${index} = :value${index}`;

        updateRequest.UpdateExpression = baseExpressionString;
        updateRequest.ExpressionAttributeNames[`#key${index}`] = key;
        updateRequest.ExpressionAttributeValues[`:value${index}`] = value;
      });

      if (secondaryId) {
        const secondaryIndex =
          index === DBKeys.Partition ? DBKeys.Sort : DBKeys.Partition;
        updateRequest.Key[secondaryIndex] =
          tableKeyMethods[secondaryIndex](secondaryId);
      }

      return datastore
        .update(updateRequest)
        .then((result: { Attributes: T }) => omitKeys(result.Attributes));
    },
    // TODO: Refactor this to one batch request
    async getAllByManyIds(
      idValues: string[],
      idKey: string,
      index = DBKeys.Partition
    ) {
      const options: { index?: DBKeys } = { index: undefined };
      if (index !== DBKeys.Partition) {
        options.index = index;
      }
      const itemsGroupedByKey = await Promise.all(
        idValues.map((idValue) => {
          return this.getAllById({ [idKey]: idValue }, options, index);
        })
      );

      const items: T[] = [];
      itemsGroupedByKey.forEach((itemGroup) => {
        items.push(...itemGroup);
      });

      return items;
    },
    async remove(
      idValue: QueryKeys,
      secondaryId = "",
      index = DBKeys.Partition
    ) {
      idValue = escapeQueryKeys(idValue);
      const key = tableKeyMethods[index](idValue);

      const deleteRequest: any = {
        [index]: key,
      };

      if (secondaryId) {
        const secondaryIndex =
          index === DBKeys.Partition ? DBKeys.Sort : DBKeys.Partition;
        deleteRequest[secondaryIndex] = tableKeyMethods[secondaryIndex](
          jsStringEscape(secondaryId)
        );
      }

      return datastore.delete(deleteRequest);
    },
  };
}

type TableMeta = {
  [value in DBKeys]?: (ids: QueryKeys) => string;
};

type TableMetaMap = { [value in Tables]: TableMeta };

const tableMeta: TableMetaMap = {
  [Tables.Users]: {
    [DBKeys.Partition]: escapedKeyMethod(({ userId }) => {
      return `#USERS#USER_ID#${userId}`;
    }),
    [DBKeys.Sort]: escapedKeyMethod(({ email }) => {
      return `#USERS#EMAIL_ID#${email}`;
    }),
  },
  [Tables.Words]: {
    [DBKeys.Partition]: escapedKeyMethod(({ userId }) => {
      return `#WORDS#USER_ID#${userId}`;
    }),
    [DBKeys.Sort]: escapedKeyMethod(({ word }) => {
      return `#WORDS#WORD#${word}`;
    }),
    [DBKeys.Tertiary]: escapedKeyMethod(({ userId, word }) => {
      return `#WORDS#USER_ID#${userId}#WORD#${word}`;
    }),
  },
};

export function getTableMeta(table: Tables) {
  return tableMeta[table];
}

function escapeQueryKeys(queryKeys: QueryKeys) {
  const newQueryKeys: QueryKeys = {};
  Object.entries(queryKeys).forEach(([key, value]) => {
    newQueryKeys[key] = jsStringEscape(value);
  });
  return newQueryKeys;
}

function escapedKeyMethod(callback: (queryKeys: QueryKeys) => string) {
  return function (queryKeys: QueryKeys) {
    const escapedQueryKeys = escapeQueryKeys(queryKeys);
    return callback(escapedQueryKeys);
  };
}
