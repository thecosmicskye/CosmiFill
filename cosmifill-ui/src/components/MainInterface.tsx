import React, { useState } from 'react';
import { DragDropZone } from './DragDropZone';
import { ChatPanel } from './ChatPanel';
import { FileList } from './FileList';
import { EmptyState } from './EmptyState';
import { ProcessOverlay } from './ProcessOverlay';
import { RotateCcw } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';

export function MainInterface() {
  const { dataFiles, formFiles, addDataFiles, addFormFiles, removeFile, clearFiles, setSession } = useSessionStore();
  const [sessionActive, setSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartProcess = async (additionalContext?: string) => {
    const canProcess = formFiles.length > 0;
    if (!canProcess) return;
    
    setError(null);
    
    try {
      // 1. Create sandbox
      const sandbox = await window.electronAPI.createSandbox();
      setSession(sandbox.sessionId, sandbox.path);
      
      // 2. Prepare analysis data
      const analysisData = {
        formFiles: formFiles.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
        dataFiles: dataFiles.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      };
      
      // 3. Create prompt
      let prompt = `Welcome to CosmiFill! I've set up a session with ${formFiles.length} PDF form(s) and ${dataFiles.length} data file(s).\n\n`;
      
      if (additionalContext) {
        prompt += `Additional context from user: ${additionalContext}\n\n`;
      }
      
      prompt += `Your task is to:
1. Load the pre-analyzed data from COSMIFILL_ANALYSIS.json
2. Review the form fields and extracted data
3. Match data to form fields intelligently
4. Fill the PDF forms with the available data

Run: python cosmifill_setup.py to get started.`;
      
      // 4. Launch Claude
      await window.electronAPI.launchClaude({
        sessionId: sandbox.sessionId,
        workDir: sandbox.path,
        prompt,
        analysisData,
      });
      
      setSessionActive(true);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-white dark:from-gray-900 dark:via-purple-900/10 dark:to-gray-900">
      {/* Header with draggable area for macOS */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b border-gray-200/50 dark:border-gray-700/50 pt-6" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/25">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">CosmiFill</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Intelligent PDF Form Filling with AI</p>
              </div>
            </div>
            {(dataFiles.length > 0 || formFiles.length > 0) && !sessionActive && (
              <button
                onClick={() => {
                  clearFiles();
                  setError(null);
                }}
                className="px-3 py-2 text-sm bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 border border-gray-300 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600 shadow-sm hover:shadow-md flex items-center space-x-2"
                title="Clear all files"
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - File Management */}
        <div className="w-2/5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-700/50">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Files</h2>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">{dataFiles.length} file{dataFiles.length !== 1 ? 's' : ''}</span>
                </div>
                <DragDropZone
                  onFilesDropped={addDataFiles}
                  accept={{
                    'text/*': ['.txt', '.csv'],
                    'application/json': ['.json'],
                    'application/pdf': ['.pdf'],
                  }}
                  label="Drop your data files here (TXT, CSV, JSON, PDF)"
                />
                {dataFiles.length > 0 && (
                  <FileList files={dataFiles} onRemove={(id) => removeFile(id, 'data')} />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">PDF Forms</h2>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">{formFiles.length} form{formFiles.length !== 1 ? 's' : ''}</span>
                </div>
                <DragDropZone
                  onFilesDropped={addFormFiles}
                  accept={{
                    'application/pdf': ['.pdf'],
                  }}
                  label="Drop your PDF forms here"
                />
                {formFiles.length > 0 && (
                  <FileList files={formFiles} onRemove={(id) => removeFile(id, 'form')} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Dynamic Content */}
        <div className="w-3/5 relative">
          {dataFiles.length === 0 && formFiles.length === 0 ? (
            <EmptyState />
          ) : !sessionActive ? (
            <div className="h-full flex flex-col">
              <ProcessOverlay 
                canProcess={formFiles.length > 0}
                onStartProcess={handleStartProcess}
              />
              {error && (
                <div className="absolute bottom-4 left-4 right-4 p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-700 rounded-lg animate-fade-in">
                  <p className="text-sm text-pink-800 dark:text-pink-300">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <ChatPanel sessionActive={sessionActive} />
          )}
        </div>
      </div>
    </div>
  );
}