import { Navbar } from "@/components/navbar";
import { QuizForm } from "@/components/quiz-form";

export default function QuizCreatePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Create Quiz</h1>
          
          <QuizForm />
        </div>
      </main>
    </div>
  );
}
