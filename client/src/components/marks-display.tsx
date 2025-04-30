import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { D3Table } from "@/components/ui/d3-table";
import { BarChart, PieChart, Loader2 } from "lucide-react";

interface Mark {
  id: number;
  mark: string;
  justification: string;
  internalRoute: string;
  threshold: number;
}

interface UserPerformanceData {
  mark: string;
  count: number;
  attempts: number[];
  percentage: number;
}

const markFormSchema = z.object({
  mark: z.string().min(3, { message: "Mark must be at least 3 characters" }),
  justification: z.string().min(10, { message: "Justification must be at least 10 characters" }),
  internalRoute: z.string().min(3, { message: "Internal route must be at least 3 characters" }),
  threshold: z.number().min(0).max(100),
});

type MarkFormValues = z.infer<typeof markFormSchema>;

export function MarksDisplay() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("table");
  
  // Fetch marks data
  const { data: marks = [], isLoading: isLoadingMarks } = useQuery<Mark[]>({
    queryKey: ["/api/marks"],
  });
  
  // Fetch user performance data (distributed by marks)
  const { data: userPerformanceData = [], isLoading: isLoadingPerformance } = useQuery<UserPerformanceData[]>({
    queryKey: ["/api/user-performance"],
  });
  
  // Format data for D3 table
  const tableData = {
    headers: ["Mark", "Justification", "Internal Route", "Threshold (%)", "Student Count"],
    rows: marks.map(mark => {
      // Find the corresponding performance data for this mark
      const performanceData = userPerformanceData.find(p => p.mark === mark.mark);
      return {
        "Mark": mark.mark,
        "Justification": mark.justification,
        "Internal Route": mark.internalRoute,
        "Threshold (%)": mark.threshold,
        "Student Count": performanceData ? performanceData.count : 0
      };
    })
  };
  
  // Format data for pie chart
  const pieChartData = {
    headers: ["Mark", "Student Count", "Percentage"],
    rows: userPerformanceData.map(data => ({
      "Mark": data.mark,
      "Student Count": data.count,
      "Percentage": data.percentage
    }))
  };
  
  // Add new mark mutation
  const addMarkMutation = useMutation({
    mutationFn: async (values: MarkFormValues) => {
      const res = await fetch("/api/marks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to add mark");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mark added",
        description: "The mark has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add mark",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: MarkFormValues) => {
    addMarkMutation.mutate(values);
  };
  
  // Performance Chart using D3Table
  const PerformanceChart = () => (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Mark Distribution</CardTitle>
          <CardDescription>Student performance distribution by mark grade</CardDescription>
        </CardHeader>
        <CardContent>
          <D3Table 
            data={pieChartData} 
            valueKey="Percentage"
            colorScale={['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7']}
            width={700}
            height={350}
          />
        </CardContent>
      </Card>
    </div>
  );
  
  // Performance Table
  const PerformanceTable = () => (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Marks Table</CardTitle>
          <CardDescription>Mark definitions with associated thresholds and routes</CardDescription>
        </CardHeader>
        <CardContent>
          <D3Table 
            data={tableData} 
            valueKey="Threshold (%)"
            colorScale={['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7']}
            width={700}
            height={450}
          />
        </CardContent>
      </Card>
    </div>
  );
  
  const isLoading = isLoadingMarks || isLoadingPerformance;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Marks Visualization</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="table" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            <span>Marks Table</span>
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span>Distribution</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="table" className="space-y-4">
          <PerformanceTable />
        </TabsContent>
        
        <TabsContent value="chart" className="space-y-4">
          <PerformanceChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}