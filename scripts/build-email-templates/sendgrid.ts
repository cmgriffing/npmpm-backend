import * as dotenv from "dotenv";
dotenv.config();
import Axios from "axios";
import { EmailService, ExistingTemplates } from "./types";
import mjml2html = require("mjml");

const { SENDGRID_API_KEY } = process.env;

export const SendgridService: EmailService = {
  axios: Axios.create({
    baseURL: "https://api.sendgrid.com/v3",
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}` },
  }),
  async getExistingTemplates() {
    // get existing dynamic templates
    const templateResponse = await this.axios.get(
      "/templates?generations=dynamic&page_size=100"
    );
    const templates = templateResponse.data.result;

    const existingTemplates: ExistingTemplates = {};
    if (templates.length) {
      await Promise.all(
        templates.map(async (template) => {
          const activeTemplateVersion = template.versions.find(
            (version) => version.active === 1
          ).id;

          const templateVersion = (
            await this.axios.get(
              `/templates/${template.id}/versions/${activeTemplateVersion}`
            )
          ).data;

          existingTemplates[template.name] = {
            id: template.id,
            version: activeTemplateVersion,
            content: templateVersion.html_content,
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
      // create template
      const newTemplate = (
        await this.axios.post("/templates", {
          name: templateName,
          generation: "dynamic",
        })
      ).data;

      // set it on existingTemplates
      existingTemplates[templateName] = {
        id: newTemplate.id,
        version: "",
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
          `/templates/${existingTemplates[templateName].id}/versions`,
          {
            active: 1,
            html_content: templateContent,
            name: templateName,
            subject: templateData.subject,
          }
        )
      ).data;
    }
  },
};
