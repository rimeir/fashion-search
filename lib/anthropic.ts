import Anthropic from "@anthropic-ai/sdk";

// 서버 전용 싱글턴 클라이언트. API 키는 .env.local의 ANTHROPIC_API_KEY 사용.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const PARSE_MODEL = "claude-sonnet-5";
export const RECOMMEND_MODEL = "claude-sonnet-5";
