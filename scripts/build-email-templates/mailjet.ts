import * as dotenv from "dotenv";
dotenv.config();
import Axios from "axios";
import { EmailService, ExistingTemplates } from "./types";
import mjml2html = require("mjml");
import { getEnvVariable } from "../../src/shared/constants";

const MAILJET_ACCESS_KEY = getEnvVariable("MAILJET_ACCESS_KEY");
const MAILJET_SECRET_KEY = getEnvVariable("MAILJET_SECRET_KEY");
console.log("ACCESS_KEY", MAILJET_ACCESS_KEY);

export const MailjetService: EmailService = {
  axios: Axios.create({
    baseURL: "https://api.mailjet.com/v3/REST",
    auth: {
      username: MAILJET_ACCESS_KEY,
      password: MAILJET_SECRET_KEY,
    },
  }),

  async getExistingTemplates() {
    // get existing dynamic templates
    const templateResponse = await this.axios.get("/template");
    const templates = templateResponse.data.Data;

    const existingTemplates: ExistingTemplates = {};
    if (templates.length) {
      await Promise.all(
        templates.map(async (template) => {
          const templateVersion = (
            await this.axios
              .get(`/template/${template.ID}/detailcontent`)
              .catch((error) => {
                console.log(
                  "Catching 404 from detailcontent if no content has been uploaded yet."
                );
                return {
                  data: {
                    ["Html-part"]: "",
                  },
                };
              })
          ).data;

          existingTemplates[template.Name] = {
            id: template.ID,
            version: template.ID,
            content: templateVersion["Html-part"],
          };
        })
      );
    }

    return existingTemplates;
  },

  async processTemplate(templateContent: string) {
    return mjml2html(templateContent).html;
  },
  async createNewTemplateIfNeeded(
    existingTemplates: ExistingTemplates,
    templateName: string
  ) {
    if (!existingTemplates[templateName]) {
      const createResult = await this.axios.post("/template", {
        Name: templateName,
        Purposes: ["transactional"],
      });

      const { ID } = createResult.data;

      existingTemplates[templateName] = {
        id: ID,
        version: ID,
        content: "",
      };
    }

    return existingTemplates;
  },

  async uploadCurrentContentIfNeeded(
    existingTemplates,
    templateName,
    templateData,
    templateContent
  ) {
    if (existingTemplates[templateName]?.content !== templateContent) {
      console.log(`Creating new version for "${templateName}"...`);

      // update template content
      const newTemplateVersion = (
        await this.axios.post(
          `template/${existingTemplates[templateName].id}/detailcontent`,
          {
            "Html-part": templateContent,
            Headers: {
              Subject: templateData.subject,
            },
          }
        )
      ).data;
    }
  },
};
