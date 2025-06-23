import { create } from 'zustand';

interface AppState {
  platform: 'darwin' | 'linux' | 'win32' | null;
  hasNode: boolean;
  hasClaude: boolean;
  isSetupComplete: boolean;
  setupStatus: {
    nodeInstalled: boolean;
    claudeInstalled: boolean;
    error: string | null;
  };
  checkSetup: () => Promise<void>;
  setSetupComplete: (complete: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  platform: null,
  hasNode: false,
  hasClaude: false,
  isSetupComplete: false,
  setupStatus: {
    nodeInstalled: false,
    claudeInstalled: false,
    error: null,
  },
  
  checkSetup: async () => {
    try {
      const platform = await window.electronAPI.getPlatform();
      const hasNode = await window.electronAPI.checkNode();
      const hasClaude = await window.electronAPI.checkClaude();
      
      set({
        platform,
        hasNode,
        hasClaude,
        isSetupComplete: hasNode && hasClaude,
        setupStatus: {
          nodeInstalled: hasNode,
          claudeInstalled: hasClaude,
          error: null,
        },
      });
    } catch (error) {
      set({
        setupStatus: {
          ...get().setupStatus,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  },
  
  setSetupComplete: (complete: boolean) => set({ isSetupComplete: complete }),
}));