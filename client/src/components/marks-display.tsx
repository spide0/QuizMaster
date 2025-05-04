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
  
  // Create D3.js table
  useEffect(() => {
    if (tableRef.current && marks.length > 0 && !isLoadingMarks) {
      // Clear previous content
      d3.select(tableRef.current).selectAll("*").remove();
      
      const width = 800;
      const height = 500;
      const margin = { top: 30, right: 30, bottom: 30, left: 30 };
      
      // Create SVG
      const svg = d3.select(tableRef.current)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
      
      // Title
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .style("fill", "#1e293b")
        .text("QuizMaster Marking Scheme (out of 15)");
      
      // Table container
      const table = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top + 40})`);
      
      // Define table dimensions
      const tableWidth = width - margin.left - margin.right;
      const columnCount = 3;
      const columnWidth = tableWidth / columnCount;
      const rowHeight = 60;
      const headerHeight = 40;
      
      // Table headers
      const headers = ["Mark (out of 15)", "Justification for Marking", "Internal Routes"];
      
      // Header cells
      table.selectAll(".header")
        .data(headers)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * columnWidth)
        .attr("y", 0)
        .attr("width", columnWidth)
        .attr("height", headerHeight)
        .attr("fill", "#3b82f6")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1);
      
      // Header text
      table.selectAll(".header-text")
        .data(headers)
        .enter()
        .append("text")
        .attr("x", (d, i) => i * columnWidth + columnWidth / 2)
        .attr("y", headerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-weight", "bold")
        .style("fill", "white")
        .text(d => d);
      
      // Data rows
      marks.forEach((mark, rowIndex) => {
        // Row cells
        table.append("rect")
          .attr("x", 0)
          .attr("y", headerHeight + rowIndex * rowHeight)
          .attr("width", columnWidth)
          .attr("height", rowHeight)
          .attr("fill", rowIndex % 2 === 0 ? "#f8fafc" : "#f1f5f9")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 1);
        
        table.append("rect")
          .attr("x", columnWidth)
          .attr("y", headerHeight + rowIndex * rowHeight)
          .attr("width", columnWidth)
          .attr("height", rowHeight)
          .attr("fill", rowIndex % 2 === 0 ? "#f8fafc" : "#f1f5f9")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 1);
        
        table.append("rect")
          .attr("x", columnWidth * 2)
          .attr("y", headerHeight + rowIndex * rowHeight)
          .attr("width", columnWidth)
          .attr("height", rowHeight)
          .attr("fill", rowIndex % 2 === 0 ? "#f8fafc" : "#f1f5f9")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 1);
        
        // Mark value
        table.append("text")
          .attr("x", columnWidth / 2)
          .attr("y", headerHeight + rowIndex * rowHeight + rowHeight / 2)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .style("font-weight", "bold")
          .style("fill", "#334155")
          .text(mark.mark);
        
        // Justification text with word wrap
        const justificationText = table.append("text")
          .attr("x", columnWidth + 10)
          .attr("y", headerHeight + rowIndex * rowHeight + 20)
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "middle")
          .style("fill", "#334155")
          .style("font-size", "14px");
        
        const justificationWords = mark.justification.split(/\s+/);
        let justificationLine = "";
        let justificationLineNumber = 0;
        
        justificationWords.forEach(word => {
          const testLine = justificationLine + (justificationLine ? " " : "") + word;
          if (testLine.length * 6 > columnWidth - 20) {
            justificationText.append("tspan")
              .attr("x", columnWidth + 10)
              .attr("dy", justificationLineNumber === 0 ? 0 : 20)
              .text(justificationLine);
            justificationLine = word;
            justificationLineNumber++;
          } else {
            justificationLine = testLine;
          }
        });
        
        // Add the last line
        justificationText.append("tspan")
          .attr("x", columnWidth + 10)
          .attr("dy", justificationLineNumber === 0 ? 0 : 20)
          .text(justificationLine);
        
        // Route text
        table.append("text")
          .attr("x", columnWidth * 2 + 10)
          .attr("y", headerHeight + rowIndex * rowHeight + rowHeight / 2)
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "middle")
          .style("fill", "#334155")
          .text(mark.internalRoute);
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