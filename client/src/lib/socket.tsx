import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  const {
    onMessage,
    reconnect = true,
    reconnectInterval = 3000,
    autoConnect = true
  } = options;

  // Initialize WebSocket connection
  const connect = () => {
    if (!user) return;
    
    try {
      setStatus('connecting');
      
      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      socketRef.current = new WebSocket(wsUrl);
      
      // Set event handlers
      socketRef.current.onopen = () => {
        setStatus('open');
        // Authenticate immediately after connection
        sendMessage({
          type: 'auth',
          userId: user.id,
          userRole: user.role
        });
      };
      
      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socketRef.current.onclose = () => {
        setStatus('closed');
        
        // Try to reconnect if enabled
        if (reconnect) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
      
      socketRef.current.onerror = () => {
        setStatus('error');
        socketRef.current?.close();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setStatus('error');
    }
  };
  
  // Send message through WebSocket
  const sendMessage = (data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };
  
  // Close WebSocket connection
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setStatus('closed');
  };
  
  // Connect on mount if autoConnect is true
  useEffect(() => {
    if (autoConnect && user) {
      connect();
    }
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [user?.id]);
  
  return {
    status,
    sendMessage,
    connect,
    disconnect
  };
}

export function useQuizMonitoring(quizId?: number) {
  const [activeParticipants, setActiveParticipants] = useState<any[]>([]);
  const [quizStatus, setQuizStatus] = useState<any>({});
  
  const { status, sendMessage } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'monitoring_update') {
        if (quizId) {
          // Filter for specific quiz
          const quizParticipants = data.data.onlineUsers.filter(
            (user: any) => user.attempt?.quizId === quizId
          );
          setActiveParticipants(quizParticipants);
          
          // Set quiz status
          const quizAttempts = data.data.activeAttempts.filter(
            (attempt: any) => attempt.quizId === quizId
          );
          setQuizStatus({
            totalParticipants: quizAttempts.length,
            activeParticipants: quizParticipants.length,
            averageProgress: calculateAverageProgress(quizParticipants)
          });
        } else {
          // Show all participants
          setActiveParticipants(data.data.onlineUsers);
          
          // Group by quiz
          const quizzes: Record<number, any[]> = {};
          data.data.activeAttempts.forEach((attempt: any) => {
            if (!quizzes[attempt.quizId]) {
              quizzes[attempt.quizId] = [];
            }
            quizzes[attempt.quizId].push(attempt);
          });
          
          setQuizStatus(quizzes);
        }
      } else if (data.type === 'user_update') {
        // Update specific user data
        setActiveParticipants(prev => 
          prev.map(participant => 
            participant.id === data.data.userId 
              ? { ...participant, ...data.data }
              : participant
          )
        );
      } else if (data.type === 'tab_switch') {
        // Update tab switch count for user
        setActiveParticipants(prev => 
          prev.map(participant => {
            if (participant.id === data.data.userId && participant.attempt) {
              return {
                ...participant,
                attempt: {
                  ...participant.attempt,
                  tabSwitches: (participant.attempt.tabSwitches || 0) + 1
                }
              };
            }
            return participant;
          })
        );
      }
    }
  });
  
  // Calculate average progress
  function calculateAverageProgress(participants: any[]) {
    if (!participants.length) return 0;
    
    const total = participants.reduce((sum, p) => sum + (p.attempt?.progress || 0), 0);
    return Math.round(total / participants.length);
  }
  
  // Send quiz status update (for quiz participants)
  const updateQuizStatus = (data: any) => {
    sendMessage({
      type: 'quiz_status',
      data
    });
  };
  
  // Report a tab switch (for quiz participants)
  const reportTabSwitch = (attemptId: number) => {
    sendMessage({
      type: 'tab_switch',
      attemptId
    });
  };
  
  return {
    activeParticipants,
    quizStatus,
    updateQuizStatus,
    reportTabSwitch,
    connectionStatus: status
  };
}

// Helper function to calculate time remaining
export function formatTimeRemaining(seconds: number) {
  if (seconds <= 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
