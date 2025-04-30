import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Clock, HelpCircle, Award, ArrowLeft } from "lucide-react";

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

interface Question {
  id: number;
  quizId: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
}

export default function QuizDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  
  // Fetch quiz details
  const { data: quiz, isLoading: isLoadingQuiz } = useQuery<Quiz>({
    queryKey: [`/api/quizzes/${id}`],
  });
  
  // Fetch quiz questions (just to get count, not actual questions)
  const { data: questions = [], isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: [`/api/quizzes/${id}/questions`],
    enabled: !!quiz,
  });
  
  // Get category name
  const getCategoryName = (categoryId: number) => {
    const categoryMap: Record<number, string> = {
      1: 'Mathematics',
      2: 'Science',
      3: 'Language',
      4: 'History',
      5: 'Geography',
      6: 'Computer Science',
      7: 'Other'
    };
    return categoryMap[categoryId] || 'Uncategorized';
  };
  
  // Start the quiz
  const handleStartQuiz = () => {
    setLocation(`/quiz/session/${id}`);
  };
  
  // Loading state
  if (isLoadingQuiz || isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  // Handle missing quiz
  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Quiz Not Found</h1>
            <p className="text-gray-500 mb-6">The quiz you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => setLocation('/quizzes')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quizzes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button 
            variant="outline" 
            className="mb-6"
            onClick={() => setLocation('/quizzes')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quizzes
          </Button>
          
          <Card className="shadow-lg">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-2xl">{quiz.title}</CardTitle>
              <CardDescription>{getCategoryName(quiz.categoryId)}</CardDescription>
            </CardHeader>
            
            <CardContent className="pt-6">
              {quiz.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-600">{quiz.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="flex items-center">
                  <div className="bg-indigo-100 rounded-md p-3 mr-3">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time Limit</p>
                    <p className="font-medium">{quiz.timeLimit} minutes</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-indigo-100 rounded-md p-3 mr-3">
                    <HelpCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Questions</p>
                    <p className="font-medium">{questions.length}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-indigo-100 rounded-md p-3 mr-3">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Passing Score</p>
                    <p className="font-medium">{quiz.passingScore}%</p>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                <h3 className="text-amber-800 font-medium flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Important Information
                </h3>
                <ul className="mt-2 text-sm text-amber-700 space-y-1 ml-7 list-disc">
                  <li>The quiz will automatically submit when the time expires.</li>
                  <li>Switching tabs or leaving the page will be recorded.</li>
                  <li>You cannot return to previous questions once submitted.</li>
                  <li>Ensure you have a stable internet connection.</li>
                </ul>
              </div>
            </CardContent>
            
            <CardFooter className="bg-gray-50 border-t border-gray-200 p-6">
              <AlertDialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button className="w-full sm:w-auto">Start Quiz</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you ready to begin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You're about to start "{quiz.title}" quiz. It contains {questions.length} questions 
                      and you have {quiz.timeLimit} minutes to complete it. The timer will start immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleStartQuiz}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Start Now
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
