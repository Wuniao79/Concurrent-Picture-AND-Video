import { LaneState } from '../types';

export const createDefaultLane = (
  id: string,
  model: string,
  index: number,
  seedMessages: LaneState['messages'] = []
): LaneState => ({
  id,
  model,
  temperature: 0.7,
  name: `Model ${index}`,
  messages: seedMessages,
  isThinking: false,
  progress: 0
});

export const extractErrorCodeFromText = (text: string): number | null => {
  if (!text) return null;

  const direct = text.match(/(?:API request failed|请求失败)\s*[:：]?\s*(400|401|403|429|500)\b/i);
  if (direct) return parseInt(direct[1], 10);

  // Only fall back to scanning raw codes when the text actually looks like an error.
  if (!/(failed|失败|error|ERR|invalid_request|unauthorized|server error)/i.test(text)) return null;

  const match = text.match(/\b(400|401|403|429|500)\b/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

/**
 * Extract the latest progress percentage from model output text.
 */
export const extractProgressFromText = (text: string): number | null => {
  if (!text) return null;

  let maxPercent: number | null = null;
  const percentRegex = /(\d{1,3})\s*%/g;
  let match: RegExpExecArray | null;

  while ((match = percentRegex.exec(text)) !== null) {
    const value = parseInt(match[1], 10);
    if (isNaN(value)) continue;
    if (value < 0 || value > 100) continue;
    if (maxPercent === null || value > maxPercent) {
      maxPercent = value;
    }
  }

  if (maxPercent !== null) {
    return Math.min(100, Math.max(0, maxPercent));
  }

  if (/Video Generation Completed|Generation Completed/i.test(text)) {
    return 100;
  }

  return null;
};
