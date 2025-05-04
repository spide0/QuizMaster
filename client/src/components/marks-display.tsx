import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import * as d3 from 'd3';

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
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Fetch marks data
  const { data: marks = [], isLoading: isLoadingMarks } = useQuery<Mark[]>({
    queryKey: ["/api/marks"],
  });
  
  // Fetch user performance data (distributed by marks)
  const { data: userPerformanceData = [], isLoading: isLoadingPerformance } = useQuery<UserPerformanceData[]>({
    queryKey: ["/api/user-performance"],
  });
  
  // Create D3.js table - rebuild with simpler approach
  useEffect(() => {
    if (tableRef.current && !isLoadingMarks) {
      // Clear previous content
      d3.select(tableRef.current).selectAll("*").remove();
      
      const containerWidth = tableRef.current.clientWidth || 800;
      const width = Math.min(containerWidth, 1000);
      const height = 500;
      
      // Create table element directly
      const table = d3.select(tableRef.current)
        .append("table")
        .attr("class", "min-w-full divide-y divide-gray-200 border-collapse")
        .style("border-collapse", "collapse")
        .style("width", "100%");
      
      // Add table caption
      table.append("caption")
        .attr("class", "text-lg font-semibold py-2 text-center bg-blue-50")
        .text("QuizMaster Marking Scheme (out of 15)");
      
      // Create table header
      const thead = table.append("thead")
        .attr("class", "bg-blue-600");
      
      const headerRow = thead.append("tr");
      
      // Add header cells
      const headers = ["Mark (out of 15)", "Justification for Marking", "Internal Routes"];
      
      headers.forEach(header => {
        headerRow.append("th")
          .attr("class", "px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider")
          .style("background-color", "#2563eb")
          .style("color", "white")
          .style("padding", "12px")
          .style("font-weight", "bold")
          .style("border", "1px solid #ddd")
          .text(header);
      });
      
      // Create table body
      const tbody = table.append("tbody")
        .attr("class", "bg-white divide-y divide-gray-200");
      
      if (marks.length === 0) {
        // Show message if no marks
        const emptyRow = tbody.append("tr");
        emptyRow.append("td")
          .attr("colspan", "3")
          .attr("class", "px-6 py-4 text-center text-gray-500")
          .style("padding", "12px")
          .style("text-align", "center")
          .style("border", "1px solid #ddd")
          .text("No marks data available");
      } else {
        // Add data rows
        marks.forEach((mark, index) => {
          const row = tbody.append("tr")
            .attr("class", index % 2 === 0 ? "bg-white" : "bg-gray-50");
          
          // Mark cell
          row.append("td")
            .attr("class", "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900")
            .style("padding", "12px")
            .style("border", "1px solid #ddd")
            .style("font-weight", "bold")
            .style("text-align", "center")
            .text(mark.mark);
          
          // Justification cell
          row.append("td")
            .attr("class", "px-6 py-4 text-sm text-gray-700")
            .style("padding", "12px")
            .style("border", "1px solid #ddd")
            .text(mark.justification);
          
          // Internal route cell
          row.append("td")
            .attr("class", "px-6 py-4 whitespace-nowrap text-sm text-blue-600")
            .style("padding", "12px")
            .style("border", "1px solid #ddd")
            .append("a")
            .attr("href", mark.internalRoute)
            .style("color", "#2563eb")
            .style("text-decoration", "underline")
            .text(mark.internalRoute);
        });
      }
      
      // Add D3 features - colorize mark cells based on threshold
      tbody.selectAll("tr")
        .selectAll("td:first-child")
        .style("background-color", (d, i) => {
          const threshold = marks[i]?.threshold || 0;
          if (threshold >= 80) return "#dcfce7"; // Green for high
          if (threshold >= 60) return "#fef3c7"; // Yellow for medium
          return "#fee2e2"; // Red for low
        });
    }
  }, [marks, isLoadingMarks]);
  
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
      <h1 className="text-2xl font-bold mb-6">Marking Scheme Visualization</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Marks Table</CardTitle>
          <CardDescription>Grading system with justifications and internal routes</CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            ref={tableRef} 
            className="d3-table-container overflow-x-auto"
            style={{ minHeight: "500px" }}
          ></div>
        </CardContent>
      </Card>
      
      <div className="mt-4 bg-gray-50 p-4 rounded-md">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> The marks table shows the grading system for the QuizMaster platform. 
          Each row represents a specific mark level with its justification and internal route for accessing related features.
        </p>
      </div>
    </div>
  );
}