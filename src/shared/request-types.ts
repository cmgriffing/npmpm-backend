// DUPLICATED FROM types.ts
export enum AdvcCallbackStatusCode {
  Uninitiated = "uninitiated",
  RequestRetrieved = "request_retrieved",
  PresentationVerified = "presentation_verified",
}
// END DUPLICATES

export interface PostWordRequest {
  /**
   * The word to be checked.
   *
   * @minLength 3
   * @maxLength 10
   * @pattern ^[a-zA-Z]+$
   */
  word: string;
}

export interface AdvcCallbackRequest {
  requestId: string;
  state: string;
  code?: AdvcCallbackStatusCode;
  issuers?: {
    claims: { [key: string]: string | number };
  }[];
  subject?: string;
  receipt?: string;
}

export interface AdvcTokenRequest {
  state: string;
}

export interface OAuthCallbackRequest {
  code: string;
}
