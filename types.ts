export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type ApiMode = 'openai' | 'gemini';
export type ThemeMode = 'system' | 'light' | 'dark';
export type Language = 'system' | 'en' | 'zh';
export type ToolView = 'promptLibrary' | 'slicer' | 'storyboard' | 'videoFrames' | 'xhs' | 'timeline' | 'more';
export type GeminiResolution = '1K' | '2K' | '4K';
export type GeminiAspectRatio =
  | 'auto'
  | '21:9'
  | '16:9'
  | '3:2'
  | '4:3'
  | '5:4'
  | '1:1'
  | '4:5'
  | '3:4'
  | '2:3'
  | '9:16';

export type GeminiImageSettings = {
  enabled: boolean;
  resolution: GeminiResolution;
  aspectRatio: GeminiAspectRatio;
};

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

export type AssetKind = 'image' | 'video';

export type AssetLibraryItem = {
  id: string;
  kind: AssetKind;
  name: string;
  src: string;
  createdAt: number;
  updatedAt: number;
};

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
  /** Multiple capabilities used for filtering (text/image/video). */
  modalities?: ModelModality[];
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
  /** HTTP-ish error code extracted from failures or model logs (e.g. 400/401/500). */
  errorCode?: number;
}

export type RoleCardKind = 'role' | 'prompt';

export type RoleCardItem = {
  id: string;
  kind: RoleCardKind;
  alias: string;
  /** Only for role items (without leading @). */
  atId?: string;
  /** Only for prompt items. */
  insertContent?: string;
  avatarDataUrl?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

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
