import { TinyLM } from 'tinylm';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isTyping?: boolean;
}

export interface Log {
  timestamp: string;
  message: string;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ProgressFile {
  id: string;
  name: string;
  status: string;
  percentComplete: number;
  bytesLoaded?: number;
  bytesTotal?: number;
  speed?: number;
  timeRemaining?: number;
}

export interface ProgressOverall {
  bytesLoaded: number;
  bytesTotal: number;
  speed: number;
  timeRemaining: number;
  formattedLoaded?: string;
  formattedTotal?: string;
  formattedSpeed?: string;
  formattedRemaining?: string;
}

export interface Progress {
  status: string;
  type: string;
  percentComplete: number;
  message: string;
  files?: ProgressFile[];
  overall?: ProgressOverall;
}

export interface TinyLMCapabilities {
  isWebGPUSupported: boolean;
  fp16Supported: boolean;
  environment?: {
    backend?: string;
    [key: string]: any;
  };
}

// Props for our components
export interface SystemStatusProps {
  webGPUStatus: string;
  fp16Status: string;
  modelStatus: string;
  backendValue: string;
  progress: Progress | null;
  loadedModelName: string | null;
}

export interface ModelControlsProps {
  onLoadModel: (config: ModelConfig) => void;
  onUnloadModel: () => void;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  isGenerating: boolean;
  streamingEnabled: boolean;
  onToggleStreaming: (enabled: boolean) => void;
}

export interface ChatInterfaceProps {
  messages: Message[];
  userInput: string;
  setUserInput: (input: string) => void;
  onSendMessage: () => void;
  onStopGeneration: () => void;
  isGenerating: boolean;
  isModelLoaded: boolean;
}

export interface SystemLogProps {
  logs: Log[];
}

// Declare the global window interface to include TinyLM-related methods
declare global {
  interface Window {
    fs?: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<Uint8Array | string>;
    };
  }
}