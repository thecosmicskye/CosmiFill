import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface ProcessOverlayProps {
  onStartProcess: (additionalContext?: string) => void;
  canProcess: boolean;
}

export function ProcessOverlay({ onStartProcess, canProcess }: ProcessOverlayProps) {
  const [context, setContext] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStart = () => {
    onStartProcess(context.trim() || undefined);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-white dark:from-gray-900 dark:via-purple-900/10 dark:to-gray-900">
      <div className="max-w-md w-full space-y-6">
        {/* Optional Context Area */}
        <div className={`transition-all duration-300 ${isExpanded ? 'mb-8' : 'mb-4'}`}>
          <label 
            htmlFor="context" 
            className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2"
          >
            Additional instructions (optional)
          </label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => !context && setIsExpanded(false)}
            placeholder="Any special instructions? You can guide Claude during the process..."
            className={`w-full px-4 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white transition-all duration-300 resize-none ${
              isExpanded ? 'h-32' : 'h-12'
            }`}
          />
          {isExpanded && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 animate-fade-in">
              Provide any specific requirements or context that might help Claude better understand your needs
            </p>
          )}
        </div>

        {/* Main CTA Button */}
        <div className="text-center">
          <button
            onClick={handleStart}
            disabled={!canProcess}
            className="group relative inline-flex items-center justify-center space-x-3 px-8 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold text-lg transition-all duration-300 shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/30 disabled:shadow-none transform hover:scale-105 disabled:hover:scale-100"
          >
            <Sparkles className="w-6 h-6" />
            <span>Start Intelligent Form Filling</span>
          </button>
          
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Claude will analyze your files and fill the forms automatically
          </p>
          
          {!canProcess && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 animate-fade-in">
              Please add PDF forms to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}