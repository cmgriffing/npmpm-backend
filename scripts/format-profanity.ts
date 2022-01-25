import * as fs from "fs-extra";

import * as profaneWords from "../src/shared/words_profanity_raw.json";

const dictionary = {};

profaneWords.forEach((word) => {
  dictionary[word] = 1;
});

fs.outputJsonSync("./src/shared/words_profanity.json", dictionary);
