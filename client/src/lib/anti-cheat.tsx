import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useQuizMonitoring } from './socket';

interface AntiCheatOptions {
  attemptId: number;
  onTabSwitch?: (count: number) => void;
  onLeave?: () => void;
  enableAutoSubmit?: boolean;
  submitQuiz: () => void;
}

export function useAntiCheat({
  attemptId,
  onTabSwitch,
  onLeave,
  enableAutoSubmit = true,
  submitQuiz
}: AntiCheatOptions) {
  // Track tab switches
  const tabSwitchCountRef = useRef(0);
  
  // Use WebSocket to report tab switches to server
  const { reportTabSwitch } = useQuizMonitoring();
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tabs or minimized window
        tabSwitchCountRef.current += 1;
        
        // Report to server
        reportTabSwitch(attemptId);
        
        // Notify via callback
        if (onTabSwitch) {
          onTabSwitch(tabSwitchCountRef.current);
        }
        
        // Show warning
        toast.warning('Tab switch detected! This activity is recorded.');
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
  }, [attemptId, enableAutoSubmit, submitQuiz]);
  
  return {
    tabSwitchCount: tabSwitchCountRef.current
  };
}
