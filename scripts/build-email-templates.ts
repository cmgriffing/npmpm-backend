import * as dotenv from "dotenv";
dotenv.config();
import * as fs from "fs-extra";
import { MailjetService } from "./build-email-templates/mailjet";
import { EmailService } from "./build-email-templates/types";
import { SendgridService } from "./build-email-templates/sendgrid";

const emailService: EmailService = MailjetService;
// const emailService: EmailService = SendgridService;

main().catch((error) => {
  console.error("Error doing template stuff", error);
});

async function main() {
  console.log("Getting existing templates and versions...");

  // get existing dynamic templates
  let existingTemplates = await emailService.getExistingTemplates();

  console.log("Evaluating local templates...");

  const templateMetadata = JSON.parse(
    fs.readFileSync("./src/shared/email-templates/templates.json", {
      encoding: "utf8",
    })
  );

  await Promise.all(
    Object.entries(templateMetadata).map(
      async ([templateKey, templateData]: [
        string,
        { template: string; subject: string }
      ]) => {
        const currentRawContent = fs.readFileSync(
          `./src/shared/email-templates/mjml/${templateData.template}`,
          { encoding: "utf8" }
        );

        const currentContent = await emailService.processTemplate(
          currentRawContent
        );

        existingTemplates = await emailService.createNewTemplateIfNeeded(
          existingTemplates,
          templateKey
        );

        await emailService.uploadCurrentContentIfNeeded(
          existingTemplates,
          templateKey,
          templateData,
          currentContent
        );
      }
    )
  );

  const idMapContents = Object.entries(existingTemplates)
    .map(([templateKey, existingTemplate]: [string, { id: string }]) => {
      return `  ${templateKey}: "${existingTemplate.id}"`;
    })
    .join(",\n");

  const tsFileContents = `import { EmailTemplate } from '../email';
export const emailTemplateIdMap: {[value in EmailTemplate]: string} = {
${idMapContents}
}
`;

  console.log("Writing TypeScript ID map for templates.");

  fs.outputFileSync(
    "./src/shared/email-templates/email-templates.ts",
    tsFileContents
  );

  console.log("Process finished.");
}
