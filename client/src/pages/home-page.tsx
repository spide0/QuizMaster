import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2, 
  ClipboardList, 
  ChartLine, 
  Medal, 
  Presentation, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  BarChart4 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  categoryId: number;
  timeLimit: number;
  passingScore: number;
  createdAt: string;
}

interface QuizStats {
  id: number;
  title: string;
  description: string | null;
  timeLimit: number;
  passingScore: number;
  totalAttempts: number;
  uniqueUsers: number;
  averageScore: number;
  passRate: number;
  recentAttempt: string | Date | null;
}

interface Attempt {
  id: number;
  quizId: number;
  startTime: string;
  endTime: string | null;
  score: number | null;
  completed: boolean;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Fetch recent attempts
  const { data: attempts = [], isLoading: isLoadingAttempts } = useQuery<Attempt[]>({
    queryKey: ["/api/user/attempts"],
  });
  
  // Fetch quizzes for recent attempts
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });
  
  // Fetch quiz statistics (for admin users)
  const { data: quizStats = [], isLoading: isLoadingStats } = useQuery<QuizStats[]>({
    queryKey: ["/api/admin/quiz-stats"],
    enabled: isAdmin,
  });
  
  // Fetch available quizzes (limit to 3 for dashboard)
  const { data: availableQuizzes = [], isLoading: isLoadingAvailable } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes", "available"],
    queryFn: async () => {
      const res = await fetch("/api/quizzes");
      const allQuizzes = await res.json();
      
      // For admin users, we'll show quizzes they created
      // For regular users, we'll show quizzes they can take (excluding completed ones)
      if (isAdmin) {
        return allQuizzes
          .filter((q: Quiz) => q.createdBy === user.id)
          .slice(0, 3); // Limit to 3 for the dashboard
      } else {
        // Filter out quizzes the user has already completed
        const completedQuizIds = new Set(
          attempts
            .filter(a => a.completed)
            .map(a => a.quizId)
        );
        return allQuizzes
          .filter((q: Quiz) => !completedQuizIds.has(q.id))
          .slice(0, 3); // Limit to 3 for the dashboard
      }
    },
    enabled: !isLoadingAttempts,
  });
  
  // Compute stats
  const completedAttempts = attempts.filter(a => a.completed);
  const quizzesTaken = completedAttempts.length;
  
  // Calculate average score
  const avgScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length)
    : 0;
  
  // Get highest score
  const highestScore = completedAttempts.length > 0
    ? Math.max(...completedAttempts.map(a => a.score || 0))
    : 0;
  
  // Get quizzes created (for admins)
  const quizzesCreated = user?.role === 'admin'
    ? quizzes.filter(q => q.createdBy === user.id).length
    : 0;
  
  // Get recent quizzes (limit to 5)
  const recentQuizzes = [...attempts]
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 5);
    
  // Determine if the user can attempt quizzes (only regular users, not admins)
  const canAttemptQuizzes = user?.role !== 'admin';
  
  // Find quiz title by id
  const getQuizTitle = (quizId: number) => {
    const quiz = quizzes.find(q => q.id === quizId);
    return quiz?.title || 'Unknown Quiz';
  };
  
  // Find quiz category by id
  const getQuizCategory = (quiz: Quiz) => {
    const categoryMap: Record<number, string> = {
      1: 'Mathematics',
      2: 'Science',
      3: 'Language',
      4: 'History',
      5: 'Geography',
      6: 'Computer Science',
      7: 'Other'
    };
    return categoryMap[quiz.categoryId] || 'Uncategorized';
  };
  
  // Loading state
  const isLoading = isLoadingAttempts || isLoadingQuizzes || isLoadingAvailable || (isAdmin && isLoadingStats);
  
  // Format date for quiz statistics
  const formatQuizDate = (dateValue: Date | string | null) => {
    if (!dateValue) return 'N/A';
    
    // Convert to Date object if it's a string
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          
          <div className="mt-6">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">
                  Welcome back, {user?.username}!
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Here's an overview of your quiz activities.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                      <ClipboardList className="text-primary text-xl" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Quizzes Taken</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{quizzesTaken}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link href="/quizzes" className="font-medium text-primary hover:text-indigo-700">
                      View all quizzes <span className="sr-only">quizzes</span>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2 */}
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                      <ChartLine className="text-primary text-xl" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{avgScore}%</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link href="/results" className="font-medium text-primary hover:text-indigo-700">
                      View all results <span className="sr-only">results</span>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 - Conditional for Admins */}
            {user?.role === 'admin' ? (
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                        <Presentation className="text-primary text-xl" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Quizzes Created</dt>
                          <dd>
                            <div className="text-lg font-medium text-gray-900">{quizzesCreated}</div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link href="/quiz/create" className="font-medium text-primary hover:text-indigo-700">
                        Create new quiz <span className="sr-only">create quiz</span>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                        <Medal className="text-primary text-xl" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Highest Score</dt>
                          <dd>
                            <div className="text-lg font-medium text-gray-900">{highestScore}%</div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link href="/results" className="font-medium text-primary hover:text-indigo-700">
                        View achievements <span className="sr-only">achievements</span>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Quizzes Section */}
          <div className="mt-8">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Recent Quizzes</h2>
            <div className="mt-2 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Quiz Title</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Score</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recentQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        You haven't taken any quizzes yet.
                      </td>
                    </tr>
                  ) : (
                    recentQuizzes.map((attempt) => {
                      const quiz = quizzes.find(q => q.id === attempt.quizId);
                      return (
                        <tr key={attempt.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {getQuizTitle(attempt.quizId)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {quiz ? getQuizCategory(quiz) : 'Unknown'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {formatDate(attempt.startTime)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {attempt.completed ? `${attempt.score}%` : 'In Progress'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {attempt.completed ? (
                              <Link href={`/results/${attempt.id}`} className="text-primary hover:text-indigo-700">
                                Review
                              </Link>
                            ) : (
                              <Link href={`/quiz/session/${attempt.quizId}`} className="text-primary hover:text-indigo-700">
                                Continue
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quiz Statistics Section - Admin Only */}
          {isAdmin && quizStats.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg leading-6 font-medium text-gray-900">Quiz Statistics</h2>
              <div className="mt-2 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:pl-6">Quiz Title</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Score</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass Rate</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Activity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {quizStats.map((stat) => (
                      <tr key={stat.id}>
                        <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {stat.title}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <ClipboardList className="mr-2 h-4 w-4 text-gray-400" />
                            {stat.totalAttempts}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Users className="mr-2 h-4 w-4 text-gray-400" />
                            {stat.uniqueUsers}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <BarChart4 className="mr-2 h-4 w-4 text-gray-400" />
                            {stat.averageScore.toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            {stat.passRate >= 70 ? (
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                            )}
                            {stat.passRate.toFixed(1)}%
                          </div>
                          <div className="mt-1">
                            <Progress 
                              value={stat.passRate} 
                              className="h-1.5"
                              style={{ 
                                '--progress-indicator-color': stat.passRate >= 70 ? '#22c55e' : '#f59e0b' 
                              } as React.CSSProperties}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-gray-400" />
                            {formatQuizDate(stat.recentAttempt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Available Quizzes Section - different title based on role */}
          <div className="mt-8">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              {user?.role === 'admin' ? 'Your Created Quizzes' : 'Available Quizzes'}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {availableQuizzes.length === 0 ? (
                <div className="col-span-3 text-center py-12 bg-white shadow sm:rounded-lg">
                  <p className="text-gray-500">No available quizzes found.</p>
                  <Button asChild className="mt-4">
                    <Link href="/quizzes">Browse All Quizzes</Link>
                  </Button>
                </div>
              ) : (
                availableQuizzes.map((quiz) => (
                  <Card key={quiz.id} className="overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                            <span className="text-primary font-medium text-lg">
                              {quiz.title.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-5">
                          <h3 className="text-lg font-medium text-gray-900">{quiz.title}</h3>
                          <p className="text-sm text-gray-500">{getQuizCategory(quiz)}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span>{quiz.timeLimit} minutes</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <span>25 questions</span>
                        </div>
                      </div>
                      <div className="mt-5">
                        {canAttemptQuizzes ? (
                          <Button asChild>
                            <Link href={`/quizzes/${quiz.id}`}>
                              Start Quiz
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="outline" asChild>
                            <Link href={`/quizzes/${quiz.id}`}>
                              View Details
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            
            {availableQuizzes.length > 0 && (
              <div className="mt-4 text-center">
                <Button variant="outline" asChild>
                  <Link href="/quizzes">
                    View All Quizzes
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
