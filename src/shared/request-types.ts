// DUPLICATED FROM types.ts
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

// export interface PostMealRequest {
//   name: string;
//   pollId?: string;
//   unsplashImageData?: {
//     thumbUrl: string;
//     imageUrl: string;
//     author: string;
//     authorUrl: string;
//   };
// }

// export type UpdateMealRequest = Omit<Partial<PostMealRequest>, "pollId">;
