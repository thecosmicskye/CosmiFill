import React from 'react';
import { FileText, ArrowLeft } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="h-full bg-gradient-to-br from-gray-50/50 via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-900/50 dark:to-gray-900">
      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center">
        {/* Left section for the arrow */}
        <div className="flex h-full items-center justify-center pointer-events-none">
          <ArrowLeft className="h-16 w-16 animate-slow-pulse text-purple-300 dark:text-purple-500 transform translate-x-[2px]" />
        </div>

        {/* Center section for the main content */}
        <div className="text-center space-y-6 max-w-sm">
          <div>
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 shadow-lg shadow-purple-500/10 dark:from-purple-900/30 dark:to-pink-900/30">
              <FileText className="h-16 w-16 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Add your files to get started
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Drag and drop or browse for PDFs and data files in the left panel
            </p>
          </div>
          <div className="flex flex-col space-y-2 text-sm text-gray-500 dark:text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-400"></div>
              <span>Data files: TXT, CSV, JSON, PDF</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-pink-400"></div>
              <span>Form files: PDF forms to fill</span>
            </div>
          </div>
        </div>

        {/* Right section (empty) */}
        <div />
      </div>
    </div>
  );
}