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
