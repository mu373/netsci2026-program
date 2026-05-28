import { openApiChatPaths } from "./routes/chat";
import { openApiMetadataPaths } from "./routes/metadata";
import { openApiPeoplePaths } from "./routes/people";
import { openApiProgramPaths } from "./routes/program";
import { openApiSearchPaths } from "./routes/search";
import { openApiTopicPaths } from "./routes/topics";

export const openApiPaths = {
  ...openApiMetadataPaths,
  ...openApiProgramPaths,
  ...openApiTopicPaths,
  ...openApiPeoplePaths,
  ...openApiSearchPaths,
  ...openApiChatPaths,
} as const;
