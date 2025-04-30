import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Loader2, Search, ChevronUp, ChevronDown, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  // Fetch all completed attempts across all users
  const { data: attempts = [], isLoading: isAttemptsLoading } = useQuery<Attempt[]>({
    queryKey: ["/api/admin/attempts"],
  });

  // Fetch all users
  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch all marks
  const { data: marks = [] } = useQuery<Mark[]>({
    queryKey: ["/api/marks"],
  });

  // State for filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all");
  const [selectedScore, setSelectedScore] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "ascending" | "descending";
  }>({
    key: "username",
    direction: "ascending",
  });

  // Group attempts by user ID
  const attemptsByUser = attempts.reduce<Record<number, Attempt[]>>((acc, attempt) => {
    if (!acc[attempt.userId]) {
      acc[attempt.userId] = [];
    }
    acc[attempt.userId].push(attempt);
    return acc;
  }, {});

  // Get user data for each user ID
  const usersWithAttempts = users
    .filter(user => user.role !== "admin") // Only regular users
    .map(user => {
      const userAttempts = attemptsByUser[user.id] || [];
      return {
        userData: user,
        attempts: userAttempts,
      };
    })
    .filter(({ attempts }) => attempts.length > 0); // Only users with attempts
  
  // Extract unique quiz IDs and titles for the filter
  const quizOptions = [...new Set(attempts.map(a => a.quizId))]
    .map(quizId => {
      const quiz = attempts.find(a => a.quizId === quizId)?.quiz;
      return {
        id: quizId,
        title: quiz?.title || `Quiz #${quizId}`,
      };
    });

  // Filter and sort the users list
  const filteredUsers = usersWithAttempts
    .filter(({ userData, attempts }) => {
      // Apply search filter
      const matchesSearch = searchTerm === "" || 
        userData.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Apply quiz filter
      const matchesQuiz = selectedQuiz === "all" ||
        attempts.some(attempt => attempt.quizId === parseInt(selectedQuiz));
      
      // Apply score filter
      let matchesScore = true;
      if (selectedScore !== "all") {
        const [min, max] = selectedScore.split("-").map(Number);
        matchesScore = attempts.some(attempt => {
          return attempt.score !== null && 
            attempt.score >= min && 
            (max ? attempt.score <= max : true);
        });
      }
      
      return matchesSearch && matchesQuiz && matchesScore;
    })
    .sort((a, b) => {
      const direction = sortConfig.direction === "ascending" ? 1 : -1;
      
      // Sort by the selected key
      if (sortConfig.key === "username") {
        return a.userData.username.localeCompare(b.userData.username) * direction;
      } else if (sortConfig.key === "email") {
        return a.userData.email.localeCompare(b.userData.email) * direction;
      } else if (sortConfig.key === "attempts") {
        return (a.attempts.length - b.attempts.length) * direction;
      } else if (sortConfig.key === "averageScore") {
        const avgA = a.attempts.reduce((sum, att) => sum + (att.score || 0), 0) / a.attempts.length;
        const avgB = b.attempts.reduce((sum, att) => sum + (att.score || 0), 0) / b.attempts.length;
        return (avgA - avgB) * direction;
      }
      
      return 0;
    });

  // Function to toggle sort
  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Helper to get sort indicator
  const getSortDirectionIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };
  
  // Helper to get mark for a score
  const getMarkForScore = (score: number | null) => {
    if (!score || marks.length === 0) return "N/A";
    const sortedMarks = [...marks].sort((a, b) => b.threshold - a.threshold);
    const mark = sortedMarks.find(m => score >= m.threshold);
    return mark ? mark.mark : sortedMarks[sortedMarks.length - 1].mark;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">All User Results</h2>
      
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              className="pl-8" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Quiz</label>
          <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
            <SelectTrigger>
              <SelectValue placeholder="Select a quiz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quizzes</SelectItem>
              {quizOptions.map(quiz => (
                <SelectItem key={quiz.id} value={quiz.id.toString()}>
                  {quiz.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Score</label>
          <Select value={selectedScore} onValueChange={setSelectedScore}>
            <SelectTrigger>
              <SelectValue placeholder="Select score range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="90-100">A (90-100%)</SelectItem>
              <SelectItem value="80-90">B (80-89%)</SelectItem>
              <SelectItem value="70-80">C (70-79%)</SelectItem>
              <SelectItem value="60-70">D (60-69%)</SelectItem>
              <SelectItem value="0-60">F (Below 60%)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Table */}
      {isAttemptsLoading || isUsersLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
            <User className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No Results Found</h3>
          <p className="text-gray-500 mt-2">
            No users match your current filter criteria.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => requestSort("username")}>
                  <div className="flex items-center space-x-1">
                    <span>User</span>
                    {getSortDirectionIndicator("username")}
                  </div>
                </th>
                <th scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => requestSort("email")}>
                  <div className="flex items-center space-x-1">
                    <span>Email</span>
                    {getSortDirectionIndicator("email")}
                  </div>
                </th>
                <th scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => requestSort("attempts")}>
                  <div className="flex items-center space-x-1">
                    <span>Attempts</span>
                    {getSortDirectionIndicator("attempts")}
                  </div>
                </th>
                <th scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => requestSort("averageScore")}>
                  <div className="flex items-center space-x-1">
                    <span>Avg. Score</span>
                    {getSortDirectionIndicator("averageScore")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(({ userData, attempts }) => {
                // Calculate average score
                const avgScore = attempts.reduce((sum, att) => sum + (att.score || 0), 0) / attempts.length;
                
                return (
                  <tr key={userData.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {userData.profilePicture ? (
                            <img 
                              className="h-10 w-10 rounded-full" 
                              src={userData.profilePicture} 
                              alt={userData.username} 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{userData.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{userData.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{attempts.length}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{avgScore.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">{getMarkForScore(avgScore)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* User Attempt Details */}
      {filteredUsers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Detailed Attempt Information</h3>
          
          <Accordion type="single" collapsible className="border rounded-lg">
            {filteredUsers.map(({ userData, attempts }) => (
              <AccordionItem key={userData.id} value={userData.id.toString()}>
                <AccordionTrigger className="px-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {userData.profilePicture ? (
                        <img 
                          className="h-8 w-8 rounded-full" 
                          src={userData.profilePicture} 
                          alt={userData.username} 
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium">{userData.username}</span>
                    <Badge className="ml-3" variant="outline">
                      {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="overflow-x-auto rounded-lg border mt-2">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mark</th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tab Switches</th>
                          <th scope="col" className="relative px-4 py-2">
                            <span className="sr-only">View</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {attempts.map(attempt => (
                          <tr key={attempt.id}>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {attempt.quiz?.title || `Quiz #${attempt.quizId}`}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {new Date(attempt.endTime || attempt.startTime).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(attempt.endTime || attempt.startTime).toLocaleTimeString()}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{attempt.score}%</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {getMarkForScore(attempt.score)}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className={`text-sm ${attempt.tabSwitches > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                {attempt.tabSwitches}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                              <Button variant="link" asChild>
                                <Link href={`/results/${attempt.id}`}>View Details</Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}