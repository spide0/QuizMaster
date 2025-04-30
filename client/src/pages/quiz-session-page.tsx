import { useEffect } from "react";
import { useParams } from "wouter";
import { Navbar } from "@/components/navbar";
import { QuizSession } from "@/components/quiz-session";

export default function QuizSessionPage() {
  const { id } = useParams<{ id: string }>();

  // Warn users if they try to refresh or close the page during the quiz
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave? Your quiz progress may be lost.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <QuizSession />
        </div>
      </main>
    </div>
  );
}
