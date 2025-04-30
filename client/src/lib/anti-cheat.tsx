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
  maxTabSwitches = 3
}: AntiCheatOptions) {
  // Track tab switches
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [forceSubmitRequired, setForceSubmitRequired] = useState(false);
  const submittingRef = useRef(false);
  
  // Use WebSocket to report tab switches to server
  const { reportTabSwitch } = useQuizMonitoring();
  
  // Handle force submission
  const handleForceSubmit = () => {
    if (submittingRef.current) return; // Prevent duplicate submissions
    
    submittingRef.current = true;
    toast.error("Quiz forcefully submitted due to excessive tab switching.");
    submitQuiz();
  };
  
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
        
        // Check if we need to force submit
        const exceedsThreshold = newCount >= maxTabSwitches;
        
        if (exceedsThreshold) {
          setForceSubmitRequired(true);
        }
        
        // Show warning popup when visibility returns
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            setShowWarning(true);
          }
        }, 100);
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
  
  // Force submit if required and display popup is closed
  useEffect(() => {
    if (forceSubmitRequired && !showWarning && enableAutoSubmit && !submittingRef.current) {
      handleForceSubmit();
    }
  }, [forceSubmitRequired, showWarning, enableAutoSubmit]);
  
  // Render the TabWarning component along with the state and handlers
  const tabWarningComponent = (
    <TabWarning 
      isVisible={showWarning} 
      onClose={() => {
        setShowWarning(false);
        // If we're closing the warning dialog and force submit is required, handle it
        if (forceSubmitRequired && enableAutoSubmit) {
          handleForceSubmit();
        }
      }} 
      switchCount={tabSwitchCount}
      threshold={maxTabSwitches}
      onForceSubmit={handleForceSubmit}
    />
  );
  
  return {
    tabSwitchCount,
    tabWarningComponent,
    showWarning,
    setShowWarning,
    forceSubmitRequired
  };
}
