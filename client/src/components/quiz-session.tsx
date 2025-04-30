import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAntiCheat } from "@/lib/anti-cheat";
import { useQuizMonitoring } from "@/lib/socket";
import { calculateTimeRemaining, formatTimeRemaining } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Flag, ArrowLeft, ArrowRight } from "lucide-react";

interface Question {
  id: number;
  quizId: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
}

interface Quiz {
  id: number;
  title: string;
  description: string | null;
  categoryId: number;
  timeLimit: number;
  passingScore: number;
  createdBy: number;
  createdAt: string;
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
}

export function QuizSession() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  
  // Load quiz data
  const { data: quiz, isLoading: isLoadingQuiz } = useQuery<Quiz>({
    queryKey: [`/api/quizzes/${id}`],
  });

  // Load questions
  const { data: questions = [], isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: [`/api/quizzes/${id}/questions`],
    enabled: !!quiz,
  });
  
  // Start or get attempt
  const { data: attempt, isLoading: isLoadingAttempt } = useQuery<Attempt>({
    queryKey: [`/api/attempts`, quiz?.id],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/attempts", { quizId: parseInt(id) });
      return await res.json();
    },
    enabled: !!quiz,
  });

  // Update answer mutation
  const updateAnswerMutation = useMutation({
    mutationFn: async (params: { attemptId: number; answers: Record<string, number> }) => {
      const res = await apiRequest("PATCH", `/api/attempts/${params.attemptId}`, {
        answers: params.answers,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/attempts`, quiz?.id], data);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save answer: ${error.message}`);
    },
  });

  // Submit quiz mutation
  const submitQuizMutation = useMutation({
    mutationFn: async (attemptId: number) => {
      const res = await apiRequest("PATCH", `/api/attempts/${attemptId}`, {
        complete: true,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/attempts`, quiz?.id], data);
      // Redirect to results page
      setLocation(`/results/${data.id}`);
      toast.success("Quiz submitted successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit quiz: ${error.message}`);
    },
  });

  // Socket connection for real-time monitoring
  const { updateQuizStatus } = useQuizMonitoring();

  // Anti-cheat measures
  const { tabSwitchCount } = useAntiCheat({
    attemptId: attempt?.id || 0,
    submitQuiz: () => {
      if (attempt?.id) {
        submitQuizMutation.mutate(attempt.id);
      }
    },
    onTabSwitch: (count) => {
      toast.warning(`Tab switch detected (${count})! This activity is recorded.`);
    },
    enableAutoSubmit: true,
  });

  // Initialize answers from attempt
  useEffect(() => {
    if (attempt?.answers && Object.keys(attempt.answers).length > 0) {
      setAnswers(attempt.answers);
    }
  }, [attempt]);

  // Timer effect
  useEffect(() => {
    if (!quiz || !attempt) return;
    
    // Calculate initial remaining time
    const initialRemaining = calculateTimeRemaining(attempt.startTime, quiz.timeLimit);
    setRemainingTime(initialRemaining);
    
    // Set timer
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        const newTime = prev - 1;
        
        // Auto-submit when time is up
        if (newTime <= 0 && !attempt.completed) {
          clearInterval(timer);
          toast.info("Time's up! Your quiz is being submitted automatically.");
          submitQuizMutation.mutate(attempt.id);
        }
        
        return Math.max(0, newTime);
      });
    }, 1000);
    
    // Clean up timer
    return () => clearInterval(timer);
  }, [quiz, attempt]);

  // Send progress updates for monitoring
  useEffect(() => {
    if (!attempt || !questions.length) return;
    
    const answeredCount = Object.keys(answers).length;
    const progress = Math.floor((answeredCount / questions.length) * 100);
    
    updateQuizStatus({
      attemptId: attempt.id,
      progress,
      timeRemaining: remainingTime,
    });
  }, [answers, remainingTime, attempt, questions]);

  // Handle answer selection
  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    const newAnswers = { ...answers, [questionId]: optionIndex };
    setAnswers(newAnswers);
    
    // Save to server
    if (attempt) {
      updateAnswerMutation.mutate({
        attemptId: attempt.id,
        answers: newAnswers,
      });
    }
  };

  // Toggle flag for a question
  const toggleFlagQuestion = (questionId: number) => {
    const newFlagged = new Set(flaggedQuestions);
    if (newFlagged.has(questionId)) {
      newFlagged.delete(questionId);
    } else {
      newFlagged.add(questionId);
    }
    setFlaggedQuestions(newFlagged);
  };

  // Navigate to next question
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Navigate to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Submit quiz
  const handleSubmitQuiz = () => {
    if (attempt) {
      submitQuizMutation.mutate(attempt.id);
    }
  };

  // Loading state
  if (isLoadingQuiz || isLoadingQuestions || isLoadingAttempt) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-2 text-gray-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Check if we have data
  if (!quiz || !questions.length || !attempt) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load quiz data</p>
        <Button 
          onClick={() => setLocation('/quizzes')}
          className="mt-4"
        >
          Back to Quizzes
        </Button>
      </div>
    );
  }

  // Current question
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = Math.round((currentQuestionIndex + 1) / totalQuestions * 100);

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 bg-primary text-white">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <div className="flex items-center text-white">
            <span id="quiz-timer" className="text-lg font-medium mr-2">
              {formatTimeRemaining(remainingTime)}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <p className="mt-1 text-sm text-indigo-100">
          Tab switches detected: {tabSwitchCount}
        </p>
      </div>
      
      <div className="p-6">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="flex items-center mb-4 sm:mb-0">
            <span className="text-lg font-medium text-gray-900">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>
          <div className="w-full sm:w-auto sm:flex-grow sm:max-w-md">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
        
        <div className="mb-10">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {currentQuestion.questionText}
          </h3>
          
          <RadioGroup
            value={answers[currentQuestion.id]?.toString() || ""}
            onValueChange={(value) => handleAnswerSelect(currentQuestion.id, parseInt(value))}
            className="space-y-4"
          >
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center">
                <RadioGroupItem id={`option-${index}`} value={index.toString()} />
                <Label htmlFor={`option-${index}`} className="ml-3 block text-sm font-medium text-gray-700">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={goToNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => toggleFlagQuestion(currentQuestion.id)}
            className={flaggedQuestions.has(currentQuestion.id) ? "text-amber-500" : "text-gray-500"}
          >
            <Flag className="mr-1 h-4 w-4" />
            {flaggedQuestions.has(currentQuestion.id) ? "Flagged" : "Flag for review"}
          </Button>
          
          <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="success">
                Submit Quiz
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to submit?</AlertDialogTitle>
                <AlertDialogDescription>
                  You've answered {Object.keys(answers).length} out of {questions.length} questions.
                  {Object.keys(answers).length < questions.length && 
                    " You have unanswered questions. You won't be able to return to this quiz after submitting."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Working</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSubmitQuiz}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Yes, Submit Quiz
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
