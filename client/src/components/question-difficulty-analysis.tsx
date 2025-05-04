import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, PieChart, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import * as d3 from 'd3';

interface QuestionDifficulty {
  id: number;
  quizId: number;
  questionText: string;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  totalAttempts: number;
  correctPercentage: number;
  difficulty: "easy" | "moderate" | "hard";
}

export function QuestionDifficultyAnalysis() {
  const [activeTab, setActiveTab] = useState("table");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  
  const { data: questions = [], isLoading, error } = useQuery<QuestionDifficulty[]>({
    queryKey: ["/api/admin/question-difficulty"],
  });
  
  // Chart data for overall difficulty distribution
  const difficultyCount = {
    easy: questions.filter(q => q.difficulty === "easy").length,
    moderate: questions.filter(q => q.difficulty === "moderate").length,
    hard: questions.filter(q => q.difficulty === "hard").length
  };
  
  // Function to determine badge color based on difficulty
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 hover:bg-red-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };
  
  // Filter questions based on selected difficulty
  const filteredQuestions = selectedDifficulty 
    ? questions.filter(q => q.difficulty === selectedDifficulty)
    : questions;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load question difficulty data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Question Difficulty Analysis</h2>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge 
          className={`cursor-pointer ${!selectedDifficulty ? 'bg-primary' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          onClick={() => setSelectedDifficulty(null)}
        >
          All ({questions.length})
        </Badge>
        <Badge 
          className={`cursor-pointer ${selectedDifficulty === 'easy' ? getDifficultyColor('easy') : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          onClick={() => setSelectedDifficulty('easy')}
        >
          Easy ({difficultyCount.easy})
        </Badge>
        <Badge 
          className={`cursor-pointer ${selectedDifficulty === 'moderate' ? getDifficultyColor('moderate') : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          onClick={() => setSelectedDifficulty('moderate')}
        >
          Moderate ({difficultyCount.moderate})
        </Badge>
        <Badge 
          className={`cursor-pointer ${selectedDifficulty === 'hard' ? getDifficultyColor('hard') : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
          onClick={() => setSelectedDifficulty('hard')}
        >
          Hard ({difficultyCount.hard})
        </Badge>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="table" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Detailed Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span>Distribution</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Question Difficulty Breakdown</CardTitle>
              <CardDescription>Analysis of question performance based on student answers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3">Question</th>
                      <th scope="col" className="px-6 py-3">Correct</th>
                      <th scope="col" className="px-6 py-3">Incorrect</th>
                      <th scope="col" className="px-6 py-3">% Correct</th>
                      <th scope="col" className="px-6 py-3">Difficulty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((question) => (
                      <tr key={question.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-normal max-w-xs">
                          {question.questionText}
                        </td>
                        <td className="px-6 py-4">
                          {question.correctAnswerCount}
                        </td>
                        <td className="px-6 py-4">
                          {question.incorrectAnswerCount}
                        </td>
                        <td className="px-6 py-4">
                          {question.correctPercentage.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={getDifficultyColor(question.difficulty)}>
                            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filteredQuestions.length === 0 && (
                      <tr className="bg-white border-b">
                        <td colSpan={5} className="px-6 py-4 text-center">
                          No questions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Overall distribution of question difficulty levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div className="w-full max-w-md">
                  <DifficultyPieChart 
                    data={[
                      { label: 'Easy', value: difficultyCount.easy, color: '#22c55e' },
                      { label: 'Moderate', value: difficultyCount.moderate, color: '#eab308' },
                      { label: 'Hard', value: difficultyCount.hard, color: '#ef4444' }
                    ]} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Simple Pie Chart using D3
interface ChartData {
  label: string;
  value: number;
  color: string;
}

function DifficultyPieChart({ data }: { data: ChartData[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chartRef.current && data && data.length > 0) {
      // Clear previous chart
      d3.select(chartRef.current as Element).selectAll('*').remove();
      
      const width = 400;
      const height = 300;
      const radius = Math.min(width, height) / 2;
      
      const svg = d3.select(chartRef.current as Element)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
      
      const totalValue = data.reduce((sum, d) => sum + d.value, 0);
      
      // Generate pie chart data
      const pie = d3.pie<ChartData>()
        .value((d: ChartData) => d.value);
      
      const arc = d3.arc<d3.PieArcDatum<ChartData>>()
        .innerRadius(0)
        .outerRadius(radius);
      
      // Draw pie segments
      const segments = svg.selectAll('path')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', (d: d3.PieArcDatum<ChartData>) => d.data.color)
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('opacity', 0.8);
      
      // Add labels
      const labels = svg.selectAll('text')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('transform', (d: d3.PieArcDatum<ChartData>) => {
          const [x, y] = arc.centroid(d);
          const labelRadius = radius * 0.7;
          const angle = (d.startAngle + d.endAngle) / 2;
          return `translate(${Math.cos(angle) * labelRadius}, ${Math.sin(angle) * labelRadius})`;
        })
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'white')
        .text((d: d3.PieArcDatum<ChartData>) => d.data.value > 0 ? d.data.label : '');
      
      // Add percentage labels
      const percentageLabels = svg.selectAll('text.percentage')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('class', 'percentage')
        .attr('transform', (d: d3.PieArcDatum<ChartData>) => {
          const [x, y] = arc.centroid(d);
          return `translate(${x}, ${y})`;
        })
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', 'white')
        .text((d: d3.PieArcDatum<ChartData>) => {
          const percentage = Math.round((d.data.value / totalValue) * 100);
          return percentage > 0 ? `${percentage}%` : '';
        });
      
      // Add legend
      const legend = svg.selectAll('.legend')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d: ChartData, i: number) => `translate(-${width/3}, ${height/3 - i * 20})`);
      
      legend.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', (d: ChartData) => d.color);
      
      legend.append('text')
        .attr('x', 20)
        .attr('y', 12.5)
        .style('font-size', '12px')
        .text((d: ChartData) => `${d.label} (${d.value})`);
    }
  }, [data]);
  
  return (
    <div className="h-[300px] w-full" ref={chartRef}></div>
  );
}