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
  /** Base64 data URLs (supports multiple images). */
  images?: string[];
  /** Backward-compatible single image (Base64 data URL). */
  image?: string;
  /** Single generation latency in milliseconds; set on model replies. */
  generationDurationMs?: number;
}

export type ModelProvider = 'openai' | 'gemini';
export type ModelModality = 'text' | 'image' | 'video';

export interface Model {
  id: string;
  name: string;
  description?: string;
  vision: boolean;
  provider?: ModelProvider;
  /** Primary capability used for filtering (text/image/video). */
  modality?: ModelModality;
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
  {
    id: 'sora-video-10s',
    name: 'sora-video-10s',
    description: 'Landscape - 10s',
    vision: true,
    provider: 'openai',
    modality: 'video',
  },
  {
    id: 'sora-video-15s',
    name: 'sora-video-15s',
    description: 'Landscape - 15s',
    vision: true,
    provider: 'openai',
    modality: 'video',
  },
  {
    id: 'sora-video-portrait-10s',
    name: 'sora-video-portrait-10s',
    description: 'Portrait - 10s',
    vision: true,
    provider: 'openai',
    modality: 'video',
  },
  {
    id: 'sora-video-portrait-15s',
    name: 'sora-video-portrait-15s',
    description: 'Portrait - 15s',
    vision: true,
    provider: 'openai',
    modality: 'video',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'gemini-3-pro-preview',
    description: 'Gemini 3 Pro Preview',
    vision: true,
    provider: 'gemini',
    modality: 'text',
  },
];
