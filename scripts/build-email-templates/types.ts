import { AxiosInstance } from "axios";
import { EmailTemplate } from "../../src/shared/email";

export interface EmailService {
  axios: AxiosInstance;
  getExistingTemplates: () => Promise<ExistingTemplates>;
  processTemplate: (templateContent: string) => Promise<string>;
  createNewTemplateIfNeeded: (
    existingTemplates: ExistingTemplates,
    templateName: string
  ) => Promise<ExistingTemplates>;
  uploadCurrentContentIfNeeded: (
    existingTemplates: ExistingTemplates,
    templateName: string,
    templateData: TemplateData,
    templateContent: string
  ) => Promise<void>;
}

export type ExistingTemplates = {
  [value in EmailTemplate]?: {
    id: string;
    version: string | number;
    content: string;
  };
};

export interface TemplateData {
  template: string;
  subject: string;
}
