import { Navbar } from "@/components/navbar";
import { QuizList } from "@/components/quiz-list";

export default function QuizzesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Quizzes</h1>
          
          <QuizList />
        </div>
      </main>
    </div>
  );
}
