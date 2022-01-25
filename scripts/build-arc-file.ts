import * as Mustache from "mustache";
import * as fs from "fs-extra";
import * as glob from "glob";

const routeFiles = glob.sync("./arc/routes/*.arc");

let routesString = "";

routeFiles.forEach((routeFile) => {
  const fileContents = fs.readFileSync(routeFile, { encoding: "utf8" });

  routesString += fileContents;
});

const templateFile = fs.readFileSync("./app.template.arc", {
  encoding: "utf8",
});

const renderedTemplate = Mustache.render(templateFile, {
  routes: routesString,
});

fs.outputFileSync("./app.arc", renderedTemplate);
