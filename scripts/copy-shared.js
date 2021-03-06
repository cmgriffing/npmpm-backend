const glob = require("glob");
const fs = require("fs-extra");
const path = require("path");

const sharedFolder = path.resolve("src/shared");

console.log({ sharedFolder });

glob
  .sync("src/http/**/index.ts", {
    ignore: "**/node_modules/**/index.ts",
  })
  .map((filePath) => path.resolve(filePath))
  .filter((filePath) => filePath.indexOf("node_modules" === -1))
  .forEach((indexFile) => {
    const lastSlashIndex = indexFile.lastIndexOf("/");
    const targetFolderPath = indexFile.substring(0, lastSlashIndex);

    const nodeModulesFolderPath = `${targetFolderPath}/node_modules/@architect/shared`;

    console.log(`Found shared path: `, nodeModulesFolderPath);

    if (!fs.existsSync(nodeModulesFolderPath)) {
      console.log(`Writing shared path: `, nodeModulesFolderPath);
      const indexOfLastSlash = nodeModulesFolderPath.lastIndexOf("/");
      const architectFolder = nodeModulesFolderPath.substring(
        0,
        indexOfLastSlash
      );

      fs.ensureDirSync(architectFolder);
      fs.copySync(sharedFolder, nodeModulesFolderPath);
    }
  });
