import { openApiBaseSchemas } from "./schema-parts/base";
import { openApiCompactSchemas } from "./schema-parts/compact";
import { openApiDiscoverySchemas } from "./schema-parts/discovery";
import { openApiPeopleSchemas } from "./schema-parts/people";
import { openApiResponseSchemas } from "./schema-parts/responses";
import { openApiScheduleSchemas } from "./schema-parts/schedule";

export const openApiSchemas = {
  ...openApiBaseSchemas,
  ...openApiPeopleSchemas,
  ...openApiDiscoverySchemas,
  ...openApiCompactSchemas,
  ...openApiScheduleSchemas,
  ...openApiResponseSchemas,
} as const;
