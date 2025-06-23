import { create } from 'zustand';

export interface AppFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path?: string;
  file: File;
}

interface SessionState {
  sessionId: string | null;
  sandboxPath: string | null;
  dataFiles: AppFile[];
  formFiles: AppFile[];
  isProcessing: boolean;
  
  addDataFiles: (files: File[]) => void;
  addFormFiles: (files: File[]) => void;
  removeFile: (id: string, type: 'data' | 'form') => void;
  clearFiles: () => void;
  setSession: (sessionId: string, sandboxPath: string) => void;
  setProcessing: (processing: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  sandboxPath: null,
  dataFiles: [],
  formFiles: [],
  isProcessing: false,
  
  addDataFiles: (files: File[]) => {
    const newFiles: AppFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    set((state) => ({ dataFiles: [...state.dataFiles, ...newFiles] }));
  },
  
  addFormFiles: (files: File[]) => {
    const newFiles: AppFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    set((state) => ({ formFiles: [...state.formFiles, ...newFiles] }));
  },
  
  removeFile: (id: string, type: 'data' | 'form') => {
    if (type === 'data') {
      set((state) => ({ dataFiles: state.dataFiles.filter((f) => f.id !== id) }));
    } else {
      set((state) => ({ formFiles: state.formFiles.filter((f) => f.id !== id) }));
    }
  },
  
  clearFiles: () => set({ dataFiles: [], formFiles: [] }),
  
  setSession: (sessionId: string, sandboxPath: string) => 
    set({ sessionId, sandboxPath }),
    
  setProcessing: (processing: boolean) => set({ isProcessing: processing }),
}));