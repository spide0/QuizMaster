import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface TabWarningProps {
  isVisible: boolean;
  onClose: () => void;
  switchCount: number;
}

export function TabWarning({ isVisible, onClose, switchCount }: TabWarningProps) {
  const [countdown, setCountdown] = useState(5);
  
  // Auto close after countdown
  useEffect(() => {
    if (!isVisible) return;
    
    let timer: NodeJS.Timeout;
    
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else {
      onClose();
      setCountdown(5); // Reset for next time
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, isVisible, onClose]);
  
  // Reset countdown when popup becomes visible
  useEffect(() => {
    if (isVisible) {
      setCountdown(5);
    }
  }, [isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-in slide-in-from-top duration-300">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-medium text-gray-900">Tab Switching Detected!</h3>
            <p className="mt-2 text-sm text-gray-500">
              We've detected that you switched tabs or windows. This may be considered cheating.
              <br /><br />
              <span className="font-semibold">Tab switches: {switchCount}</span>
              <br />
              Multiple tab switches may result in automatic quiz submission.
            </p>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Closing in {countdown} seconds...
              </span>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm leading-5 font-medium rounded-md text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
                onClick={onClose}
              >
                <X className="h-4 w-4 mr-1" />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}