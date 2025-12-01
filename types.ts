export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type ApiMode = 'openai' | 'gemini';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  image?: string; // Base64 data URL
  /** 单次生成耗时，毫秒；仅模型回复会有 */
  generationDurationMs?: number;
}

export type ModelProvider = 'openai' | 'gemini';

export interface Model {
  id: string;
  name: string;
  description?: string;
  vision: boolean;
  provider?: ModelProvider;
}

export interface LaneConfig {
  id: string;
  model: string;
  temperature: number;
  name: string;
}

export interface LaneState extends LaneConfig {
  messages: Message[];
  isThinking: boolean;
  /** 当前视频生成进度，0-100；undefined 表示未知 */
  progress?: number;
  error?: string;
}

export const AVAILABLE_MODELS: Model[] = [
  { id: 'sora-video-10s', name: 'sora-video-10s', description: '横版 · 10 秒', vision: true },
  { id: 'sora-video-15s', name: 'sora-video-15s', description: '横版 · 15 秒', vision: true },
  { id: 'sora-video-portrait-10s', name: 'sora-video-portrait-10s', description: '竖版 · 10 秒', vision: true },
  { id: 'sora-video-portrait-15s', name: 'sora-video-portrait-15s', description: '竖版 · 15 秒', vision: true },
];