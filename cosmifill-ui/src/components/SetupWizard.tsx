import React, { useState } from 'react';
import { CheckCircle, XCircle, Download, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function SetupWizard() {
  const { platform, hasNode, hasClaude, setupStatus, checkSetup, setSetupComplete } = useAppStore();
  const [installing, setInstalling] = useState<'node' | 'claude' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const installNode = async () => {
    setInstalling('node');
    setError(null);
    try {
      await window.electronAPI.installNode();
      await checkSetup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install Node.js');
    } finally {
      setInstalling(null);
    }
  };

  const installClaude = async () => {
    setInstalling('claude');
    setError(null);
    try {
      await window.electronAPI.installClaude();
      await checkSetup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install Claude Code');
    } finally {
      setInstalling(null);
    }
  };

  const canProceed = hasNode && hasClaude;

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to CosmiFill</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Let's set up your environment to start filling PDF forms intelligently.
        </p>

        <div className="space-y-6">
          <div className="border dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {hasNode ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : installing === 'node' ? (
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Node.js</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Required for running Claude Code
                  </p>
                </div>
              </div>
              {!hasNode && (
                <button
                  onClick={installNode}
                  disabled={installing !== null}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-md hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Install</span>
                </button>
              )}
            </div>
          </div>

          <div className="border dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {hasClaude ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : installing === 'claude' ? (
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Claude Code</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    AI assistant for intelligent form filling
                  </p>
                </div>
              </div>
              {!hasClaude && hasNode && (
                <button
                  onClick={installClaude}
                  disabled={installing !== null}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-md hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Install</span>
                </button>
              )}
              {!hasClaude && !hasNode && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Install Node.js first</span>
              )}
            </div>
          </div>

          {platform === 'win32' && (
            <div className="border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-300">Windows WSL Required</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
                    Claude Code runs in Windows Subsystem for Linux (WSL). We'll set this up automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 dark:text-red-300">Installation Error</h4>
                  <p className="text-sm text-red-800 dark:text-red-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => setSetupComplete(true)}
            disabled={!canProceed}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-md hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Continue to CosmiFill
          </button>
        </div>
      </div>
    </div>
  );
}