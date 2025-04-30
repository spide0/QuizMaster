import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Filter, UserCheck, Clock, Award } from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string;
  profilePicture: string | null;
  role: string;
}

interface Attempt {
  id: number;
  userId: number;
  quizId: number;
  startTime: string;
  endTime: string | null;
  score: number | null;
  tabSwitches: number;
  answers: Record<string, number>;
  completed: boolean;
  user?: User;
  quiz?: {
    id: number;
    title: string;
    description: string | null;
    categoryId: number;
    timeLimit: number;
    passingScore: number;
  };
}

interface Mark {
  id: number;
  mark: string;
  justification: string;
  internalRoute: string;
  threshold: number;
}

export function AdminResultsView() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [quizFilter, setQuizFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  
  // Fetch all completed attempts across all users
  const { data: allAttempts = [], isLoading: isLoadingAttempts } = useQuery<Attempt[]>({
    queryKey: ["/api/admin/attempts"],
    enabled: user?.role === "admin",
  });

  // Fetch all quizzes
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuery<{id: number, title: string}[]>({
    queryKey: ["/api/quizzes"],
    enabled: user?.role === "admin",
  });
  
  // Fetch all regular users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "admin",
  });
  
  // Fetch marks data
  const { data: marks = [] } = useQuery<Mark[]>({
    queryKey: ['/api/marks'],
    enabled: user?.role === "admin",
  });
  
  // Organize attempts by user
  const [organizedAttempts, setOrganizedAttempts] = useState<{
    [userId: string]: {
      userData: User;
      attempts: Attempt[];
    }
  }>({});
  
  // Process attempts when data is loaded
  useEffect(() => {
    if (allAttempts.length && users.length) {
      const attemptsByUser: {
        [userId: string]: {
          userData: User;
          attempts: Attempt[];
        }
      } = {};
      
      // Group attempts by user
      allAttempts.forEach(attempt => {
        const userId = attempt.userId.toString();
        const userData = users.find(u => u.id === attempt.userId);
        
        if (userData && userData.role !== 'admin') { // Include only regular users
          if (!attemptsByUser[userId]) {
            attemptsByUser[userId] = {
              userData,
              attempts: []
            };
          }
          attemptsByUser[userId].attempts.push(attempt);
        }
      });
      
      // Sort attempts for each user by date (newest first)
      Object.keys(attemptsByUser).forEach(userId => {
        attemptsByUser[userId].attempts.sort((a, b) => {
          return new Date(b.endTime || b.startTime).getTime() - 
                 new Date(a.endTime || a.startTime).getTime();
        });
      });
      
      setOrganizedAttempts(attemptsByUser);
    }
  }, [allAttempts, users]);
  
  // Filter and sort attempts based on user inputs
  const filteredUsers = Object.values(organizedAttempts).filter(({ userData, attempts }) => {
    // Filter by username search
    const matchesSearch = searchTerm === "" || 
      userData.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by selected user
    const matchesUserFilter = userFilter === "all" || 
      userData.id.toString() === userFilter;
    
    // Filter by quiz
    const matchesQuizFilter = quizFilter === "all" || 
      attempts.some(attempt => attempt.quizId.toString() === quizFilter);
    
    return matchesSearch && matchesUserFilter && matchesQuizFilter;
  });
  
  // Sort users/attempts based on selection
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case "username":
        return a.userData.username.localeCompare(b.userData.username);
      case "score":
        // Sort by highest score on any attempt
        const aHighestScore = Math.max(...a.attempts.map(attempt => attempt.score || 0));
        const bHighestScore = Math.max(...b.attempts.map(attempt => attempt.score || 0));
        return bHighestScore - aHighestScore;
      case "count":
        // Sort by number of attempts
        return b.attempts.length - a.attempts.length;
      case "date":
      default:
        // Sort by most recent attempt
        const aLatestDate = Math.max(...a.attempts.map(attempt => 
          new Date(attempt.endTime || attempt.startTime).getTime()));
        const bLatestDate = Math.max(...b.attempts.map(attempt => 
          new Date(attempt.endTime || attempt.startTime).getTime()));
        return bLatestDate - aLatestDate;
    }
  });
  
  // Get mark for a given score
  const getMarkForScore = (score: number | null) => {
    if (!score || marks.length === 0) return "N/A";
    const sortedMarks = [...marks].sort((a, b) => b.threshold - a.threshold);
    const mark = sortedMarks.find(m => score >= m.threshold);
    return mark ? mark.mark : sortedMarks[sortedMarks.length - 1].mark;
  };
  
  // Loading state
  if (isLoadingAttempts || isLoadingQuizzes || isLoadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-gray-500">Loading results data...</p>
        </div>
      </div>
    );
  }
  
  // No data state
  if (Object.keys(organizedAttempts).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Results</CardTitle>
          <CardDescription>
            There are no completed quiz attempts from regular users yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-500 mb-4">
            Once users start taking quizzes, their results will appear here.
          </p>
          <Button asChild>
            <Link href="/quizzes">View Quizzes</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>All User Results</CardTitle>
          <CardDescription>
            View and analyze quiz results from all regular users
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by username"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-2/3">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Filter:</span>
              
              <Select value={quizFilter} onValueChange={setQuizFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by quiz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizzes.map(quiz => (
                    <SelectItem key={quiz.id} value={quiz.id.toString()}>
                      {quiz.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users
                    .filter(user => user.role !== 'admin')
                    .map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Most Recent</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                  <SelectItem value="score">Highest Score</SelectItem>
                  <SelectItem value="count">Attempt Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Results Table - One section per user */}
          <div className="space-y-8">
            {sortedUsers.map(({ userData, attempts }) => (
              <Card key={userData.id} className="border border-gray-200">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{userData.username}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-medium">{attempts.length} attempt{attempts.length !== 1 ? 's' : ''}</span>
                      <span>|</span>
                      <span className="font-medium">
                        Avg Score: {Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / attempts.length)}%
                      </span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-4 pb-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quiz</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Mark</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map(attempt => {
                        const quiz = quizzes.find(q => q.id === attempt.quizId);
                        const passingThreshold = attempt.quiz?.passingScore || 70;
                        return (
                          <TableRow key={attempt.id}>
                            <TableCell className="font-medium">
                              {quiz?.title || `Quiz #${attempt.quizId}`}
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {new Date(attempt.endTime || attempt.startTime).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{attempt.score}%</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                attempt.score && attempt.score >= 80 
                                  ? "bg-green-100 text-green-800" 
                                  : attempt.score && attempt.score >= 60
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}>
                                {getMarkForScore(attempt.score)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                attempt.score && attempt.score >= passingThreshold
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {attempt.score && attempt.score >= passingThreshold ? "Passed" : "Failed"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/results/${attempt.id}`}>
                                  View Details
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Card>
              <CardContent className="flex items-center pt-6">
                <UserCheck className="h-10 w-10 p-2 rounded-full bg-primary/10 text-primary mr-4" />
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold">
                    {Object.keys(organizedAttempts).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center pt-6">
                <Clock className="h-10 w-10 p-2 rounded-full bg-primary/10 text-primary mr-4" />
                <div>
                  <p className="text-sm text-gray-500">Total Attempts</p>
                  <p className="text-2xl font-bold">
                    {allAttempts.filter(a => a.completed).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center pt-6">
                <Award className="h-10 w-10 p-2 rounded-full bg-primary/10 text-primary mr-4" />
                <div>
                  <p className="text-sm text-gray-500">Average Score</p>
                  <p className="text-2xl font-bold">
                    {Math.round(
                      allAttempts
                        .filter(a => a.completed)
                        .reduce((sum, a) => sum + (a.score || 0), 0) / 
                        Math.max(1, allAttempts.filter(a => a.completed).length)
                    )}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}