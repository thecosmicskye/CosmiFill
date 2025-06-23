import React, { useState, useEffect } from 'react';
import { SetupWizard } from './components/SetupWizard';
import { MainInterface } from './components/MainInterface';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { useAppStore } from './store/useAppStore';

function App() {
  const { isSetupComplete, checkSetup } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await checkSetup();
      setLoading(false);
    };
    init();
  }, [checkSetup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading CosmiFill...</p>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="h-screen bg-gray-50 dark:bg-gray-900">
        {!isSetupComplete ? <SetupWizard /> : <MainInterface />}
      </div>
    </AppErrorBoundary>
  );
}

export default App;