import React from 'react';
import { X, FileText, FileJson, FileSpreadsheet } from 'lucide-react';
import { AppFile } from '../store/useSessionStore';

interface FileListProps {
  files: AppFile[];
  onRemove: (id: string) => void;
}

export function FileList({ files, onRemove }: FileListProps) {
  const getFileIcon = (type: string, name: string) => {
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-pink-500" />;
    if (type === 'application/json') return <FileJson className="w-5 h-5 text-purple-500" />;
    if (name.endsWith('.csv')) return <FileSpreadsheet className="w-5 h-5 text-purple-600" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / 1048576) + ' MB';
  };

  return (
    <div className="mt-4 space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="group flex items-center justify-between p-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors duration-200">
              {getFileIcon(file.type, file.name)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <button
            onClick={() => onRemove(file.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 dark:text-gray-500 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-all duration-200"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}