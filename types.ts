export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type ApiMode = 'openai' | 'gemini';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'system' | 'en' | 'zh';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  image?: string; // Base64 data URL
  /** Single generation latency in milliseconds; set on model replies. */
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
  /** Current video generation progress 0-100; undefined means unknown. */
  progress?: number;
  error?: string;
}

export const AVAILABLE_MODELS: Model[] = [
  { id: 'sora-video-10s', name: 'sora-video-10s', description: 'Landscape - 10s', vision: true, provider: 'openai' },
  { id: 'sora-video-15s', name: 'sora-video-15s', description: 'Landscape - 15s', vision: true, provider: 'openai' },
  { id: 'sora-video-portrait-10s', name: 'sora-video-portrait-10s', description: 'Portrait - 10s', vision: true, provider: 'openai' },
  { id: 'sora-video-portrait-15s', name: 'sora-video-portrait-15s', description: 'Portrait - 15s', vision: true, provider: 'openai' },
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', description: 'Gemini 3 Pro Preview', vision: true, provider: 'gemini' },
];
