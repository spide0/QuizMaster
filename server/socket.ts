import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { storage } from "./storage";

interface MonitoringClient {
  ws: WebSocket;
  userId: number;
  isAdmin: boolean;
}

interface QuizMonitoringData {
  activeAttempts: any[];
  onlineUsers: {
    id: number;
    username: string;
    status: string;
    attempt?: {
      quizId: number;
      progress: number;
      timeRemaining: number;
      tabSwitches: number;
    };
  }[];
}

let clients: MonitoringClient[] = [];

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    // New connection - we'll store user information after authentication
    let clientInfo: MonitoringClient | null = null;
    
    // Handle messages from clients
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication
        if (data.type === 'auth') {
          const { userId, userRole } = data;
          
          if (!userId) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Authentication required' 
            }));
            return;
          }
          
          clientInfo = {
            ws,
            userId,
            isAdmin: userRole === 'admin'
          };
          
          clients.push(clientInfo);
          
          // Send initial status to the client
          if (clientInfo.isAdmin) {
            // Send monitoring data to admin
            const monitoringData = await getMonitoringData();
            ws.send(JSON.stringify({
              type: 'monitoring_update',
              data: monitoringData
            }));
          } else {
            // Send acknowledgment to regular users
            ws.send(JSON.stringify({ 
              type: 'connected', 
              userId 
            }));
          }
        } 
        // Handle quiz status updates from users
        else if (data.type === 'quiz_status' && clientInfo) {
          // User sent quiz status (progress update, etc.)
          // Broadcast to admin clients
          broadcastToAdmins({
            type: 'user_update',
            data: {
              userId: clientInfo.userId,
              ...data.data
            }
          });
        }
        // Handle tab switch event
        else if (data.type === 'tab_switch' && clientInfo) {
          const { attemptId } = data;
          
          if (attemptId) {
            // Record tab switch in the database
            await storage.incrementTabSwitches(attemptId);
            
            // Notify all admins
            broadcastToAdmins({
              type: 'tab_switch',
              data: {
                userId: clientInfo.userId,
                attemptId
              }
            });
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      if (clientInfo) {
        // Remove from clients array
        clients = clients.filter(client => client.ws !== ws);
        
        // If it was a student, notify admins
        if (!clientInfo.isAdmin) {
          broadcastToAdmins({
            type: 'user_disconnect',
            data: {
              userId: clientInfo.userId
            }
          });
        }
      }
    });
  });
  
  // Set up a periodic update for monitoring data (every 10 seconds)
  setInterval(async () => {
    try {
      const monitoringData = await getMonitoringData();
      broadcastToAdmins({
        type: 'monitoring_update',
        data: monitoringData
      });
    } catch (error) {
      console.error('Error sending monitoring updates:', error);
    }
  }, 10000);
}

// Helper function to broadcast messages to all admin clients
function broadcastToAdmins(message: any) {
  const adminClients = clients.filter(client => client.isAdmin);
  
  for (const client of adminClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

// Helper function to get real-time monitoring data
async function getMonitoringData(): Promise<QuizMonitoringData> {
  try {
    // Get all active attempts
    const activeAttempts = await storage.getActiveAttempts();
    
    // Get user information for each active attempt
    const onlineUsers = [];
    
    for (const attempt of activeAttempts) {
      const user = await storage.getUser(attempt.userId);
      if (user) {
        const quiz = await storage.getQuizById(attempt.quizId);
        const questions = await storage.getQuizQuestions(attempt.quizId);
        
        // Calculate progress
        const answeredQuestions = attempt.answers ? Object.keys(attempt.answers).length : 0;
        const progress = questions.length > 0 
          ? Math.round((answeredQuestions / questions.length) * 100) 
          : 0;
        
        // Calculate time remaining
        let timeRemaining = 0;
        if (quiz && attempt.startTime) {
          const endTime = new Date(attempt.startTime);
          endTime.setMinutes(endTime.getMinutes() + quiz.timeLimit);
          
          const now = new Date();
          const remainingMs = endTime.getTime() - now.getTime();
          timeRemaining = Math.max(0, Math.floor(remainingMs / 1000)); // in seconds
        }
        
        // Check if user is connected
        const isConnected = clients.some(client => 
          client.userId === user.id && 
          client.ws.readyState === WebSocket.OPEN
        );
        
        onlineUsers.push({
          id: user.id,
          username: user.username,
          status: isConnected ? 'online' : 'offline',
          attempt: {
            quizId: attempt.quizId,
            progress,
            timeRemaining,
            tabSwitches: attempt.tabSwitches,
          }
        });
      }
    }
    
    return {
      activeAttempts,
      onlineUsers
    };
  } catch (error) {
    console.error('Error getting monitoring data:', error);
    return {
      activeAttempts: [],
      onlineUsers: []
    };
  }
}
