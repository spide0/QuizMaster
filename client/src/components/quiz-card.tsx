import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Clock, HelpCircle, Award, Info } from "lucide-react";
import { truncateText } from "@/lib/utils";

interface QuizCardProps {
  id: number;
  title: string;
  category: string;
  description?: string;
  timeLimit: number;
  questionCount: number;
  passingScore: number;
  imageUrl?: string;
}

export function QuizCard({
  id,
  title,
  category,
  description,
  timeLimit,
  questionCount,
  passingScore,
  imageUrl = "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"
}: QuizCardProps) {
  return (
    <Card className="overflow-hidden shadow rounded-lg border border-gray-200 h-full">
      <CardContent className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
              <img 
                className="h-full w-full object-cover" 
                src={imageUrl} 
                alt={category} 
              />
            </div>
          </div>
          <div className="ml-5">
            <h3 className="text-lg font-medium text-gray-900">{truncateText(title, 24)}</h3>
            <p className="text-sm text-gray-500">{category}</p>
          </div>
        </div>
        
        {description && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">{truncateText(description, 100)}</p>
          </div>
        )}
        
        <div className="mt-4">
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="mr-2 h-4 w-4" />
            <span>{timeLimit} minutes</span>
          </div>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>{questionCount} questions</span>
          </div>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <Award className="mr-2 h-4 w-4" />
            <span>Passing: {passingScore}%</span>
          </div>
        </div>
        
        <div className="mt-5 flex justify-between">
          <Button asChild>
            <Link href={`/quizzes/${id}`}>
              Start Quiz
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/quizzes/${id}`}>
              <Info className="h-5 w-5 text-gray-400 hover:text-gray-500" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
