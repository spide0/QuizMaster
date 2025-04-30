import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useQuizMonitoring } from './socket';
import { TabWarning } from '@/components/ui/tab-warning';
import { apiRequest } from '@/lib/queryClient';

interface AntiCheatOptions {
  attemptId: number;
  onTabSwitch?: (count: number) => void;
  onLeave?: () => void;
  enableAutoSubmit?: boolean;
  submitQuiz: () => void;
  maxTabSwitches?: number;
}

export function useAntiCheat({
  attemptId,
  onTabSwitch,
  onLeave,
  enableAutoSubmit = true,
  submitQuiz,
  maxTabSwitches = 5
}: AntiCheatOptions) {
  // Track tab switches
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  
  // Use WebSocket to report tab switches to server
  const { reportTabSwitch } = useQuizMonitoring();
  
  // Increment tab switch count on server
  const incrementTabSwitches = async () => {
    if (attemptId) {
      try {
        await apiRequest("PATCH", `/api/attempts/${attemptId}/tab-switch`, {});
      } catch (error) {
        console.error("Failed to report tab switch:", error);
      }
    }
  };
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tabs or minimized window
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        
        // Report to server via WebSocket
        reportTabSwitch(attemptId);
        
        // Also increment the counter in the database
        incrementTabSwitches();
        
        // Notify via callback
        if (onTabSwitch) {
          onTabSwitch(newCount);
        }
        
        // Show warning popup when visibility returns
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            setShowWarning(true);
          }
        }, 100);
        
        // Auto-submit after max tab switches
        if (newCount >= maxTabSwitches && enableAutoSubmit) {
          toast.error(`Maximum tab switches (${maxTabSwitches}) reached. Your quiz is being submitted automatically.`);
          submitQuiz();
        }
      }
    };
    
    // Detect when user leaves the page/tab
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (enableAutoSubmit) {
        // Show confirmation dialog
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your quiz will be auto-submitted.';
        
        // Notify via callback
        if (onLeave) {
          onLeave();
        }
      }
    };
    
    // Handle page leave (auto-submit)
    const handleUnload = () => {
      if (enableAutoSubmit) {
        // Auto-submit the quiz
        submitQuiz();
      }
    };
    
    // Register event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    
    // Clean up event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [attemptId, enableAutoSubmit, submitQuiz, tabSwitchCount, maxTabSwitches]);
  
  // Render the TabWarning component along with the state and handlers
  const tabWarningComponent = (
    <TabWarning 
      isVisible={showWarning} 
      onClose={() => setShowWarning(false)} 
      switchCount={tabSwitchCount}
    />
  );
  
  return {
    tabSwitchCount,
    tabWarningComponent,
    showWarning,
    setShowWarning
  };
}
