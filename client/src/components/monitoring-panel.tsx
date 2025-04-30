import { useState, useEffect } from "react";
import { useQuizMonitoring, formatTimeRemaining } from "@/lib/socket";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  Users, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  MessageSquare, 
  Flag, 
  UserCheck 
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "react-toastify";

interface Quiz {
  id: number;
  title: string;
  timeLimit: number;
  createdAt: string;
}

interface Participant {
  id: number;
  username: string;
  status: string;
  attempt?: {
    quizId: number;
    progress: number;
    timeRemaining: number;
    tabSwitches: number;
  };
}

export function MonitoringPanel() {
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const { activeParticipants, quizStatus, connectionStatus } = useQuizMonitoring(selectedQuizId || undefined);
  
  // Fetch all quizzes
  const { data: quizzes = [] } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });

  // Get active quizzes
  const { data: activeAttempts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/active-attempts"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Select first quiz by default
  useEffect(() => {
    if (!selectedQuizId && activeAttempts.length > 0) {
      const quizIds = [...new Set(activeAttempts.map(attempt => attempt.quizId))];
      if (quizIds.length > 0) {
        setSelectedQuizId(quizIds[0]);
      }
    }
  }, [selectedQuizId, activeAttempts]);

  // Get quiz info
  const getQuizInfo = (quizId: number) => {
    return quizzes.find(q => q.id === quizId);
  };

  // Get participants for a quiz
  const getQuizParticipants = (quizId: number) => {
    return activeParticipants.filter(
      p => p.attempt && p.attempt.quizId === quizId
    );
  };

  // Get active quiz IDs
  const activeQuizIds = [...new Set(activeAttempts.map(attempt => attempt.quizId))];
  
  // Calculate quiz statistics
  const calculateStats = (quizId: number) => {
    const participants = getQuizParticipants(quizId);
    const onlineCount = participants.filter(p => p.status === 'online').length;
    const averageProgress = participants.length > 0
      ? participants.reduce((sum, p) => sum + (p.attempt?.progress || 0), 0) / participants.length
      : 0;
    const totalTabSwitches = participants.reduce((sum, p) => sum + (p.attempt?.tabSwitches || 0), 0);
    
    return {
      totalParticipants: participants.length,
      onlineParticipants: onlineCount,
      averageProgress: Math.round(averageProgress),
      totalTabSwitches
    };
  };

  // Simulate sending a message to a student
  const sendMessage = (userId: number, username: string) => {
    toast.info(`Message sent to ${username}`);
  };

  // Simulate flagging a student
  const flagStudent = (userId: number, username: string) => {
    toast.warning(`Flagged ${username} for suspicious activity`);
  };

  // Connection status indicator
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'open': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'closed': return 'bg-red-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Real-Time Monitoring</h1>
          <div className="flex items-center mt-1">
            <div className={`h-3 w-3 rounded-full ${getConnectionStatusColor()} mr-2`}></div>
            <p className="text-sm text-gray-500">
              {connectionStatus === 'open' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 
               'Disconnected'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Quizzes</CardTitle>
          <CardDescription>Monitor quizzes in progress</CardDescription>
        </CardHeader>
        <CardContent>
          {activeQuizIds.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No Active Quizzes</h3>
              <p className="mt-1 text-sm text-gray-500">There are currently no active quiz sessions.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Time Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeQuizIds.map((quizId) => {
                  const quiz = getQuizInfo(quizId);
                  const participants = getQuizParticipants(quizId);
                  const stats = calculateStats(quizId);
                  
                  return (
                    <TableRow key={quizId}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-primary font-medium">{quiz?.title?.charAt(0) || "Q"}</span>
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{quiz?.title || `Quiz ${quizId}`}</div>
                            <div className="text-sm text-gray-500">Created {quiz ? formatDate(quiz.createdAt) : 'Unknown'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-gray-900">{stats.onlineParticipants} online</div>
                          <div className="text-gray-500">{stats.totalParticipants} total</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900 mr-2">{stats.averageProgress}%</span>
                          <div className="w-24">
                            <Progress value={stats.averageProgress} className="h-2" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        Varies
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                          In Progress
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="link" 
                          className="text-primary hover:text-indigo-700"
                          onClick={() => setSelectedQuizId(quizId)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedQuizId && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  Participants - {getQuizInfo(selectedQuizId)?.title || `Quiz ${selectedQuizId}`}
                </CardTitle>
                <CardDescription>Real-time status of quiz participants</CardDescription>
              </div>
              <Tabs defaultValue="all" className="w-[200px]">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="flagged">Flagged</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Questions Answered</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Time Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tab Switches</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getQuizParticipants(selectedQuizId).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No Participants</h3>
                      <p className="mt-1 text-sm text-gray-500">There are currently no participants for this quiz.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  getQuizParticipants(selectedQuizId).map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={`https://ui-avatars.com/api/?name=${participant.username}&background=random`} />
                            <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{participant.username}</div>
                            <div className="text-sm text-gray-500">ID: {participant.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {participant.attempt ? (
                          <div className="text-sm text-gray-900">
                            {Math.round(participant.attempt.progress / 100 * 20)} / 20
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Unknown</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {participant.attempt && (
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900 mr-2">{participant.attempt.progress}%</span>
                            <div className="w-16">
                              <Progress value={participant.attempt.progress} className="h-2" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {participant.attempt ? formatTimeRemaining(participant.attempt.timeRemaining) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={participant.status === 'online' ? 'success' : 'outline'} className={participant.status === 'online' ? '' : 'bg-yellow-100 text-yellow-800'}>
                          {participant.status === 'online' ? (
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" /> Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Idle
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell 
                        className={`text-sm ${participant.attempt && participant.attempt.tabSwitches > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}`}
                      >
                        {participant.attempt ? participant.attempt.tabSwitches : 0}
                        {participant.attempt && participant.attempt.tabSwitches > 0 && (
                          <AlertTriangle className="h-3 w-3 inline ml-1" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendMessage(participant.id, participant.username)}
                            title="Send message"
                          >
                            <MessageSquare className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => flagStudent(participant.id, participant.username)}
                            title="Flag suspicious activity"
                          >
                            <Flag className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
