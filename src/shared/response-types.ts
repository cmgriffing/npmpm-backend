// DUPLICATED FROM types.ts
export interface DatastoreRecord {
  createdAt: number;
  modifiedAt: number;
}

export enum AdvcCallbackStatusCode {
  Uninitiated = "uninitiated",
  RequestRetrieved = "request_retrieved",
  PresentationVerified = "presentation_verified",
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

export interface AdvcTokenResponse {
  code: string;
  status: AdvcCallbackStatusCode;
  accessToken?: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
}
