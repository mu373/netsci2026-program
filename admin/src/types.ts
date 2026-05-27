export type ChatMessageSource = "template" | "freeform" | null;

export type ChatLogRecord = {
  key: string;
  id: string;
  at: string;
  sessionId: string | null;
  messageSource: ChatMessageSource;
  message: string;
  messageCount: number;
  lastUserMessageId?: string;
  country: string | null;
  ray: string | null;
  referrer: string | null;
  userAgent: string | null;
};
