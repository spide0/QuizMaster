import { useParams } from "wouter";
import { Navbar } from "@/components/navbar";
import { QuizResults } from "@/components/quiz-results-updated";
import { AdminResultsView } from "@/components/admin-results-view";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Attempt {
  id: number;
  userId: number;
  quizId: number;
  startTime: string;
  endTime: string | null;
  score: number | null;
  completed: boolean;
}

interface Mark {
  id: number;
  mark: string;
  justification: string;
  internalRoute: string;
  threshold: number;
}

export default function ResultsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Check if there's a specific attempt ID in the URL
  const { id } = useParams<{ id: string }>();

  // If no specific ID, fetch all user attempts to show a list
  const { data: attempts = [], isLoading } = useQuery<Attempt[]>({
    queryKey: ["/api/user/attempts"],
    enabled: !id
  });
  
  // Fetch marks data
  const { data: marks = [] } = useQuery<Mark[]>({
    queryKey: ['/api/marks'],
    enabled: !id
  });
  
  // Active tab state for admins (my results vs. all users results)
  const [activeTab, setActiveTab] = useState<string>("my-results");

  // Filter to only completed attempts if we're showing all
  const completedAttempts = attempts.filter(attempt => attempt.completed);
  
  // Get mark for a given score
  const getMarkForScore = (score: number | null) => {
    if (!score || marks.length === 0) return "N/A";
    const sortedMarks = [...marks].sort((a, b) => b.threshold - a.threshold);
    const mark = sortedMarks.find(m => score >= m.threshold);
    return mark ? mark.mark : sortedMarks[sortedMarks.length - 1].mark;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            {id ? "Quiz Results" : "Your Results"}
          </h1>
          
          {id ? (
            // Show specific result
            <QuizResults attemptId={id} />
          ) : (
            // Show list of all results
            isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : completedAttempts.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h2>
                <p className="text-gray-500 mb-4">You haven't completed any quizzes yet.</p>
                <Button asChild>
                  <Link href="/quizzes">Browse Quizzes</Link>
                </Button>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mark</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">View</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {completedAttempts.map(attempt => (
                      <tr key={attempt.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">Quiz #{attempt.quizId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{new Date(attempt.endTime || attempt.startTime).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{attempt.score}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{getMarkForScore(attempt.score)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            attempt.score && attempt.score >= 70
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {attempt.score && attempt.score >= 70 ? "Passed" : "Failed"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="link" asChild>
                            <Link href={`/results/${attempt.id}`}>View Details</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
