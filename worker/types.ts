export type Env = {
  Bindings: {
    ASSETS: Fetcher;
    GEMINI_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    CHAT_RATE_LIMITER: RateLimit;
    NETSCI2026_CHAT_MESSAGES?: KVNamespace;
    CHAT_MESSAGE_RETENTION_DAYS?: string;
  };
};

export type ChatSavedItem = {
  itemId: string;
  savedAt?: string;
  status?: string;
  note?: string;
};

export type ChatMessageRecord = {
  id: string;
  at: string;
  sessionId: string | null;
  messageSource: "template" | "freeform" | null;
  message: string;
  messageCount: number;
  lastUserMessageId?: string;
  country: string | null;
  ray: string | null;
  referrer: string | null;
  userAgent: string | null;
};
