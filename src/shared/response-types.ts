// DUPLICATED FROM types.ts
export interface DatastoreRecord {
  createdAt: number;
  modifiedAt: number;
}
// END DUPLICATES

export interface ErrorResponse {
  message?: string;
}

export interface EmptyResponse {}

export interface PostWordResponse extends DatastoreRecord {
  userId: string;
  attemptId: string;
  word: string;
  result: {
    score: number;
  };
}
