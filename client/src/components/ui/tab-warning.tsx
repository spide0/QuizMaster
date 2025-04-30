import React, { useState, useEffect } from 'react';
import { AlertCircle, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TabWarningProps {
  isVisible: boolean;
  onClose: () => void;
  switchCount: number;
  threshold?: number;
  onForceSubmit?: () => void;
}

export function TabWarning({ 
  isVisible, 
  onClose, 
  switchCount, 
  threshold = 3,
  onForceSubmit 
}: TabWarningProps) {
  const [countdown, setCountdown] = useState(10);
  const exceededThreshold = switchCount >= threshold;
  
  // Auto close after countdown or force submit if threshold exceeded
  useEffect(() => {
    if (!isVisible) return;
    
    let timer: NodeJS.Timeout;
    
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else {
      if (exceededThreshold && onForceSubmit) {
        onForceSubmit();
      } else {
        onClose();
      }
      setCountdown(10); // Reset for next time
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, isVisible, onClose, exceededThreshold, onForceSubmit]);
  
  // Reset countdown when popup becomes visible
  useEffect(() => {
    if (isVisible) {
      setCountdown(10);
    }
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/60" onClick={exceededThreshold ? undefined : onClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in slide-in-from-top duration-300">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {exceededThreshold ? (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-red-500" />
            )}
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              Quiz Cancelled: Tab Switching Detected!
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              <span className="font-semibold text-red-500">Tab switching is not allowed during this quiz.</span>
              <br /><br />
              Your quiz has been cancelled and will be submitted in {countdown} seconds to maintain academic integrity.
              <br /><br />
              This is an automatic measure to prevent cheating.
            </p>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                <span className="text-red-500 font-medium">Submitting in {countdown} seconds...</span>
              </span>
              
              <Button 
                variant="destructive" 
                onClick={onForceSubmit}
                className="inline-flex items-center"
              >
                Submit & Exit Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}