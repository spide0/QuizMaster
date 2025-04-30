import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

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
    lastActivity: number;
    attempt?: {
      quizId: number;
      progress: number;
      timeRemaining: number;
      tabSwitches: number;
      answeredQuestions: number;
      totalQuestions: number;
    };
  }[];
  quizStats: Record<number, {
    totalParticipants: number;
    onlineParticipants: number;
    averageProgress: number;
    totalTabSwitches: number;
    quizTitle: string;
    timeLimit: number;
  }>;
}

// Store WebSocket connections
const wsClients: Record<number, {
  ws: WebSocket;
  lastActivity: number;
}> = {};
const monitoringClients: MonitoringClient[] = [];

// Keep track of user activities in real-time
const userActivities: Record<number, {
  lastAction: string;
  lastActionTime: number;
  currentQuestion?: number;
  flagged: boolean;
}> = {};

export function setupWebSocketServer(httpServer: Server) {
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Connection handler
  wss.on('connection', (ws) => {
    let userId: number | null = null;
    let isAdmin = false;

    // Message handler
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle authentication
        if (data.type === 'auth') {
          userId = data.userId;
          isAdmin = data.userRole === 'admin';

          if (userId) {
            // Store client connection with timestamp
            wsClients[userId] = {
              ws,
              lastActivity: Date.now()
            };

            // Initialize user activity tracking
            if (!userActivities[userId]) {
              userActivities[userId] = {
                lastAction: 'connected',
                lastActionTime: Date.now(),
                flagged: false
              };
            }

            // Add to monitoring clients if admin
            if (isAdmin) {
              monitoringClients.push({ ws, userId, isAdmin });
              // Send initial monitoring data
              const monitoringData = await getMonitoringData();
              ws.send(JSON.stringify({
                type: 'monitoring_update',
                data: monitoringData
              }));
            }

            console.log(`User ${userId} (${isAdmin ? 'admin' : 'student'}) connected via WebSocket`);
          }
        }

        // Handle quiz status updates
        if (data.type === 'quiz_status' && userId) {
          // Update user activity timestamp
          if (wsClients[userId]) {
            wsClients[userId].lastActivity = Date.now();
          }

          // Track user activity
          userActivities[userId] = {
            ...userActivities[userId],
            lastAction: 'updated quiz status',
            lastActionTime: Date.now(),
            currentQuestion: data.data.currentQuestion
          };

          // Update status for monitoring clients
          broadcastToAdmins({
            type: 'user_update',
            data: {
              userId,
              status: 'online',
              lastActivity: Date.now(),
              attempt: data.data
            }
          });
        }

        // Handle tab switch events
        if (data.type === 'tab_switch' && userId) {
          if (data.attemptId) {
            // Increment tab switch count in the attempt
            try {
              await storage.incrementTabSwitches(data.attemptId);
              
              // Track user activity
              userActivities[userId] = {
                ...userActivities[userId],
                lastAction: 'switched tab',
                lastActionTime: Date.now()
              };

              // Notify monitoring clients
              broadcastToAdmins({
                type: 'tab_switch',
                data: {
                  userId,
                  attemptId: data.attemptId,
                  timestamp: Date.now()
                }
              });

              console.log(`Tab switch detected for user ${userId}, attempt ${data.attemptId}`);
            } catch (error) {
              console.error('Failed to increment tab switches:', error);
            }
          }
        }

        // Handle admin commands to students
        if (data.type === 'admin_command' && isAdmin) {
          const targetUserId = data.targetUserId;
          
          if (wsClients[targetUserId] && wsClients[targetUserId].ws.readyState === WebSocket.OPEN) {
            // Forward command to student
            wsClients[targetUserId].ws.send(JSON.stringify({
              type: 'admin_message',
              from: userId,
              command: data.command,
              message: data.message
            }));

            // Mark student as flagged if necessary
            if (data.command === 'flag') {
              if (userActivities[targetUserId]) {
                userActivities[targetUserId].flagged = true;
              }
              
              // Notify all admins about the flagging
              broadcastToAdmins({
                type: 'student_flagged',
                data: {
                  userId: targetUserId,
                  flaggedBy: userId,
                  reason: data.message || 'Suspicious activity'
                }
              });
            }

            console.log(`Admin ${userId} sent ${data.command} command to user ${targetUserId}`);
          }
        }

        // Handle student responses to admin
        if (data.type === 'student_response' && userId && data.adminId) {
          const adminId = data.adminId;
          
          if (monitoringClients.some(client => client.userId === adminId)) {
            // Find the admin's WebSocket
            const adminClient = monitoringClients.find(client => client.userId === adminId);
            
            if (adminClient && adminClient.ws.readyState === WebSocket.OPEN) {
              // Send response to admin
              adminClient.ws.send(JSON.stringify({
                type: 'student_message',
                from: userId,
                message: data.message
              }));
              
              console.log(`User ${userId} responded to admin ${adminId}`);
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Every 30 seconds

    // Close handler
    ws.on('close', () => {
      clearInterval(heartbeatInterval);
      
      if (userId) {
        console.log(`User ${userId} disconnected from WebSocket`);
        
        // Remove client connection
        delete wsClients[userId];

        // Remove from monitoring clients
        const index = monitoringClients.findIndex(client => client.userId === userId);
        if (index !== -1) {
          monitoringClients.splice(index, 1);
        }

        // Update user activity
        if (userActivities[userId]) {
          userActivities[userId].lastAction = 'disconnected';
          userActivities[userId].lastActionTime = Date.now();
        }

        // Update status for monitoring clients
        broadcastToAdmins({
          type: 'user_update',
          data: {
            userId,
            status: 'offline',
            lastActivity: Date.now()
          }
        });
      }
    });
  });

  // Set up periodic monitoring data broadcast
  setInterval(async () => {
    if (monitoringClients.length > 0) {
      try {
        const monitoringData = await getMonitoringData();
        broadcastToAdmins({
          type: 'monitoring_update',
          data: monitoringData
        });
      } catch (error) {
        console.error('Error getting monitoring data:', error);
      }
    }
  }, 3000); // Every 3 seconds for more real-time monitoring

  // Set up periodic check for inactive users
  setInterval(() => {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    Object.entries(wsClients).forEach(([userId, client]) => {
      // Check if user has been inactive for too long
      if (now - client.lastActivity > inactiveThreshold) {
        // Mark as idle in the monitoring system
        broadcastToAdmins({
          type: 'user_update',
          data: {
            userId: parseInt(userId),
            status: 'idle',
            lastActivity: client.lastActivity
          }
        });
      }
    });
  }, 60000); // Check every minute
}

function broadcastToAdmins(message: any) {
  const messageString = JSON.stringify(message);
  
  monitoringClients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageString);
    }
  });
}

async function getMonitoringData(): Promise<QuizMonitoringData> {
  // Get active attempts
  const activeAttempts = await storage.getActiveAttempts();
  
  // Get user data for attempts
  const userIds = [...new Set(activeAttempts.map(attempt => attempt.userId))];
  const onlineUsers = [];
  
  // Gather quiz stats
  const quizStats: Record<number, {
    totalParticipants: number;
    onlineParticipants: number;
    averageProgress: number;
    totalTabSwitches: number;
    quizTitle: string;
    timeLimit: number;
  }> = {};
  
  for (const userId of userIds) {
    const user = await storage.getUser(userId);
    if (user) {
      // Find user's attempt
      const attempt = activeAttempts.find(a => a.userId === userId);
      
      if (attempt) {
        // Get quiz info
        const quiz = await storage.getQuizById(attempt.quizId);
        const questions = await storage.getQuizQuestions(attempt.quizId);
        
        // Initialize quiz stats if this is the first user for this quiz
        if (!quizStats[attempt.quizId]) {
          quizStats[attempt.quizId] = {
            totalParticipants: 0,
            onlineParticipants: 0,
            averageProgress: 0,
            totalTabSwitches: 0,
            quizTitle: quiz?.title || `Quiz ${attempt.quizId}`,
            timeLimit: quiz?.timeLimit || 30
          };
        }
        
        // Update quiz stats
        quizStats[attempt.quizId].totalParticipants++;
        quizStats[attempt.quizId].totalTabSwitches += attempt.tabSwitches;
        
        if (userId in wsClients) {
          quizStats[attempt.quizId].onlineParticipants++;
        }
        
        const progress = calculateProgress(attempt, questions.length);
        
        // Add to running total for average calculation later
        quizStats[attempt.quizId].averageProgress += progress;
        
        onlineUsers.push({
          id: user.id,
          username: user.username,
          status: userId in wsClients ? 'online' : 'offline',
          lastActivity: userActivities[userId]?.lastActionTime || Date.now(),
          attempt: {
            quizId: attempt.quizId,
            progress: progress,
            timeRemaining: calculateTimeRemaining(attempt, quiz?.timeLimit || 30),
            tabSwitches: attempt.tabSwitches,
            answeredQuestions: Object.keys(attempt.answers || {}).length,
            totalQuestions: questions.length
          }
        });
      } else {
        // User without an attempt
        onlineUsers.push({
          id: user.id,
          username: user.username,
          status: userId in wsClients ? 'online' : 'offline',
          lastActivity: userActivities[userId]?.lastActionTime || Date.now()
        });
      }
    }
  }
  
  // Calculate averages for each quiz
  Object.keys(quizStats).forEach(quizId => {
    const numericId = parseInt(quizId);
    if (quizStats[numericId].totalParticipants > 0) {
      quizStats[numericId].averageProgress = Math.round(
        quizStats[numericId].averageProgress / quizStats[numericId].totalParticipants
      );
    }
  });
  
  return {
    activeAttempts,
    onlineUsers,
    quizStats
  };
}

// Helper to calculate progress
function calculateProgress(attempt: any, totalQuestions: number): number {
  if (!attempt) return 0;
  
  const answeredCount = Object.keys(attempt.answers || {}).length;
  return Math.round((answeredCount / totalQuestions) * 100);
}

// Helper to calculate time remaining
function calculateTimeRemaining(attempt: any, timeLimit: number): number {
  if (!attempt || attempt.completed) return 0;
  
  const startTime = new Date(attempt.startTime).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  
  // Convert time limit to seconds
  const timeLimitSeconds = timeLimit * 60;
  const remainingSeconds = Math.max(0, timeLimitSeconds - elapsedSeconds);
  
  return remainingSeconds;
}