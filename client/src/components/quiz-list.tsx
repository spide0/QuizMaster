import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { QuizCard } from "@/components/quiz-card";
import { Loader2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Quiz } from "@shared/schema";

export function QuizList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);

  // Fetch all quizzes
  const { data: quizzes = [], isLoading, error } = useQuery<Quiz[]>({
    queryKey: ["/api/quizzes"],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<{ id: number, name: string }[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch questions for each quiz to get count
  const { data: quizzesWithQuestionCounts = [] } = useQuery<
    { id: number; questionCount: number }[]
  >({
    queryKey: ["/api/quizzes", "questionCounts"],
    queryFn: async () => {
      const counts = await Promise.all(
        quizzes.map(async (quiz) => {
          const questions = await fetch(`/api/quizzes/${quiz.id}/questions`).then(
            (res) => res.json()
          );
          return {
            id: quiz.id,
            questionCount: questions.length,
          };
        })
      );
      return counts;
    },
    enabled: quizzes.length > 0,
  });

  // Filter quizzes based on search and category
  useEffect(() => {
    if (!quizzes) return;

    let filtered = [...quizzes];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (quiz) => quiz.title.toLowerCase().includes(query) || 
                 (quiz.description && quiz.description.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      const categoryId = parseInt(selectedCategory);
      filtered = filtered.filter((quiz) => quiz.categoryId === categoryId);
    }

    setFilteredQuizzes(filtered);
  }, [quizzes, searchQuery, selectedCategory]);

  // Get question count for a quiz
  const getQuestionCount = (quizId: number) => {
    const quiz = quizzesWithQuestionCounts.find((q) => q.id === quizId);
    return quiz?.questionCount || 0;
  };

  // Get category name
  const getCategoryName = (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Uncategorized";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load quizzes</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">Available Quizzes</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Browse and take quizzes.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                className="pl-8 w-full"
                type="text"
                placeholder="Search quizzes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No quizzes found matching your criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              id={quiz.id}
              title={quiz.title}
              category={getCategoryName(quiz.categoryId)}
              description={quiz.description || undefined}
              timeLimit={quiz.timeLimit}
              questionCount={getQuestionCount(quiz.id)}
              passingScore={quiz.passingScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
