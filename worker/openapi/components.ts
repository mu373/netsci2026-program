import { openApiComponentResponses } from "./componentResponses";
import { openApiSchemas } from "./schemas";

export const openApiComponents = {
  responses: openApiComponentResponses,
  schemas: openApiSchemas,
} as const;
