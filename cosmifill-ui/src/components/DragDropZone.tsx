import React, { useCallback } from 'react';
import { useDropzone, Accept } from 'react-dropzone';
import { Upload, FileIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface DragDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  accept?: Accept;
  label: string;
  multiple?: boolean;
}

export function DragDropZone({ onFilesDropped, accept, label, multiple = true }: DragDropZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesDropped(acceptedFiles);
  }, [onFilesDropped]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 group',
        isDragActive
          ? 'border-purple-400 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20 shadow-lg shadow-purple-500/10 scale-[1.02]'
          : 'border-gray-300 hover:border-purple-300 bg-white/50 hover:bg-purple-50/30 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-purple-600 dark:hover:bg-purple-900/10 hover:shadow-md'
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center space-y-4">
        <div className={clsx(
          'p-4 rounded-full transition-all duration-200',
          isDragActive 
            ? 'bg-purple-100 dark:bg-purple-900/30' 
            : 'bg-purple-50 group-hover:bg-purple-100 dark:bg-purple-900/20 dark:group-hover:bg-purple-900/30'
        )}>
          {isDragActive ? (
            <FileIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          ) : (
            <Upload className="w-8 h-8 text-purple-500 dark:text-purple-400" />
          )}
        </div>
        <div>
          <p className={clsx(
            'font-medium transition-colors duration-200',
            isDragActive ? 'text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'
          )}>
            {isDragActive ? 'Drop the files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
        </div>
        <button
          type="button"
          className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg group-hover:from-purple-600 group-hover:to-pink-600 transition-colors duration-200 shadow-md group-hover:shadow-lg relative z-10 cursor-pointer"
        >
          Browse Files
        </button>
      </div>
    </div>
  );
}