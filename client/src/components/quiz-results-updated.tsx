import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ChevronLeft, 
  Download, 
  CheckCircle, 
  XCircle, 
  Award, 
  Medal, 
  Trophy 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  calculateTimeSpent, 
  formatDate, 
  toPercentage, 
  getResultStatus 
} from "@/lib/utils";

interface ResultsProps {
  attemptId: string;
}

interface Result {
  attempt: {
    id: number;
    userId: number;
    quizId: number;
    startTime: string;
    endTime: string | null;
    score: number | null;
    tabSwitches: number;
    answers: Record<string, number>;
    completed: boolean;
  };
  quiz: {
    id: number;
    title: string;
    description: string | null;
    categoryId: number;
    timeLimit: number;
    passingScore: number;
    createdBy: number;
    createdAt: string;
  };
  questions: {
    id: number;
    quizId: number;
    questionText: string;
    options: string[];
    correctAnswer: number;
    explanation: string | null;
  }[];
  user?: {
    id: number;
    username: string;
    email: string;
    profilePicture: string | null;
    role: string;
  };
}

interface Mark {
  id: number;
  mark: string;
  justification: string;
  internalRoute: string;
  threshold: number;
}

export function QuizResults({ attemptId }: ResultsProps) {
  // Fetch the quiz results
  const { data: results, isLoading, error } = useQuery<Result>({
    queryKey: [`/api/attempts/${attemptId}/results`],
  });
  
  // Fetch marks to determine the user's grade based on score
  const { data: marks = [] } = useQuery<Mark[]>({
    queryKey: ['/api/marks'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-2 text-gray-500">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load results</p>
        <Button 
          asChild
          className="mt-4"
        >
          <Link href="/quizzes">Back to Quizzes</Link>
        </Button>
      </div>
    );
  }

  const { attempt, quiz, questions, user } = results;
  
  // Calculate some derived values
  const correctCount = questions.reduce((count, question) => {
    const userAnswer = attempt.answers[question.id];
    return userAnswer === question.correctAnswer ? count + 1 : count;
  }, 0);
  
  const totalQuestions = questions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const timeSpent = calculateTimeSpent(attempt.startTime, attempt.endTime);
  const status = getResultStatus(percentage, quiz.passingScore);
  
  // Determine mark based on percentage score
  const sortedMarks = [...marks].sort((a, b) => b.threshold - a.threshold);
  const userMark = sortedMarks.find(mark => percentage >= mark.threshold) || sortedMarks[sortedMarks.length - 1];

  // Group questions by topic or category for the performance breakdown
  // For this example, we'll simulate by dividing questions into equal groups
  const categories = ['Knowledge', 'Comprehension', 'Application', 'Analysis'];
  const performanceByCategory = categories.map((category, index) => {
    const startIdx = Math.floor((index * questions.length) / categories.length);
    const endIdx = Math.floor(((index + 1) * questions.length) / categories.length);
    const categoryQuestions = questions.slice(startIdx, endIdx);
    
    const correct = categoryQuestions.reduce((count, question) => {
      const userAnswer = attempt.answers[question.id];
      return userAnswer === question.correctAnswer ? count + 1 : count;
    }, 0);
    
    const percentage = Math.round((correct / categoryQuestions.length) * 100);
    
    return {
      name: category,
      percentage,
      correct,
      total: categoryQuestions.length,
    };
  });

  // Helper function to download results as JSON
  const downloadResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `quiz-results-${attempt.id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">{quiz.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Completed on {formatDate(attempt.endTime || attempt.startTime)}
          </p>
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">{percentage}%</div>
                <div className="mt-2 text-sm font-medium text-gray-500">Your Score</div>
                {userMark && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-sm font-semibold">
                      {userMark.mark}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{correctCount} / {totalQuestions}</div>
                <div className="mt-2 text-sm font-medium text-gray-500">Correct Answers</div>
                <div className="mt-4">
                  <Badge variant={status === 'passed' ? "outline" : "destructive"} className={status === 'passed' ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                    {status === 'passed' ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {/* Mark Justification section for admin users */}
          {userMark && user?.role === 'admin' && (
            <div className="mt-8 bg-gray-50 p-4 rounded-md border border-gray-200">
              <h3 className="text-md font-medium text-gray-900 mb-2">Mark Justification</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Grade</p>
                  <p className="text-md">{userMark.mark}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-gray-700">Justification</p>
                  <p className="text-md">{userMark.justification}</p>
                </div>
              </div>
              <Separator className="my-3" />
              <div>
                <p className="text-sm font-semibold text-gray-700">Internal Route</p>
                <code className="text-xs bg-gray-100 p-1 rounded">{userMark.internalRoute}{attempt.userId}</code>
              </div>
            </div>
          )}
          
          {/* Performance by Category Section */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900">Performance by Category</h3>
            <div className="mt-4 bg-gray-50 p-4 rounded-md">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {performanceByCategory.map((category, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{category.name}</span>
                      <span className="text-sm font-medium text-gray-700">{category.percentage}%</span>
                    </div>
                    <Progress value={category.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Quiz Statistics</h3>
            </div>
            <div className="mt-4 bg-gray-50 p-4 rounded-md grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-md p-2 mr-3">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time Spent</p>
                  <p className="font-medium">{timeSpent}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-md p-2 mr-3">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Passing Score</p>
                  <p className="font-medium">{quiz.passingScore}%</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-md p-2 mr-3">
                  <SwitchHorizontal className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tab Switches</p>
                  <p className="font-medium">{attempt.tabSwitches}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Question Analysis */}
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900">Question Analysis</h3>
            <div className="mt-4 space-y-4">
              {questions.map((question, idx) => {
                const userAnswer = attempt.answers[question.id];
                const isCorrect = userAnswer === question.correctAnswer;
                
                return (
                  <Card 
                    key={question.id}
                    className={`${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex">
                        <div className="flex-shrink-0 pt-0.5">
                          {isCorrect ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="ml-3">
                          <h4 className={`text-sm font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                            Question {idx + 1}: {question.questionText}
                          </h4>
                          <div className={`mt-2 text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                            <p>Your answer: {userAnswer !== undefined ? question.options[userAnswer] : "Not answered"}</p>
                            {!isCorrect && (
                              <p className="mt-1">Correct answer: {question.options[question.correctAnswer]}</p>
                            )}
                            {question.explanation && (
                              <p className="mt-1 text-xs">Explanation: {question.explanation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              asChild
            >
              <Link href="/">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button 
              onClick={downloadResults}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Additional components for icons
function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SwitchHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M21 5H9" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M3 19h12" />
    </svg>
  );
}