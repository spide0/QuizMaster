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
  
  // Create enhanced D3.js table with visual indicators
  useEffect(() => {
    if (tableRef.current && !isLoadingMarks) {
      // Clear previous content
      d3.select(tableRef.current).selectAll("*").remove();
      
      const containerWidth = tableRef.current.clientWidth || 800;
      const width = Math.min(containerWidth, 1000);
      const height = 800; // Increase height for more rows
      
      // Create table element directly
      const table = d3.select(tableRef.current)
        .append("table")
        .attr("class", "min-w-full divide-y divide-gray-200 border-collapse")
        .style("border-collapse", "collapse")
        .style("width", "100%")
        .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)");
      
      // Add table caption with gradient and shadow
      table.append("caption")
        .attr("class", "text-xl font-semibold py-4 text-center")
        .style("background", "linear-gradient(90deg, #e0f2fe 0%, #dbeafe 100%)")
        .style("color", "#1e40af")
        .style("border-top-left-radius", "8px")
        .style("border-top-right-radius", "8px")
        .style("box-shadow", "0 1px 2px 0 rgba(0, 0, 0, 0.05)")
        .text("QuizMaster Platform Feature Evaluation (out of 15)");
      
      // Create table header
      const thead = table.append("thead")
        .attr("class", "bg-blue-600");
      
      const headerRow = thead.append("tr");
      
      // Add header cells with improved styling
      const headers = ["Mark", "Feature Justification", "Internal Routes"];
      
      headers.forEach(header => {
        headerRow.append("th")
          .attr("class", "px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider")
          .style("background", "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)")
          .style("color", "white")
          .style("padding", "14px")
          .style("font-weight", "bold")
          .style("border", "1px solid #93c5fd")
          .style("text-align", "center")
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
        // Sort marks by threshold in descending order
        const sortedMarks = [...marks].sort((a, b) => b.threshold - a.threshold);
        
        // Add data rows with interactive features
        sortedMarks.forEach((mark, index) => {
          const row = tbody.append("tr")
            .attr("class", index % 2 === 0 ? "bg-white" : "bg-gray-50")
            .style("transition", "all 0.2s ease-in-out")
            .on("mouseover", function() {
              d3.select(this)
                .style("background", "#f0f9ff")
                .style("transform", "scale(1.01)");
            })
            .on("mouseout", function() {
              d3.select(this)
                .style("background", index % 2 === 0 ? "#ffffff" : "#f9fafb")
                .style("transform", "scale(1.0)");
            });
          
          // Mark cell with color indicator based on threshold
          const markCell = row.append("td")
            .attr("class", "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900")
            .style("padding", "12px")
            .style("border", "1px solid #e5e7eb")
            .style("font-weight", "bold")
            .style("text-align", "center")
            .style("width", "130px");
          
          // Create color indicator and mark text
          markCell.append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("align-items", "center")
            .style("gap", "6px");
            
          // Add mark text
          markCell.append("span")
            .text(mark.mark)
            .style("font-size", "16px");
            
          // Add threshold indicator
          markCell.append("div")
            .style("width", "80%")
            .style("height", "8px")
            .style("margin", "6px auto 0")
            .style("border-radius", "4px")
            .style("background", getGradientForThreshold(mark.threshold));
            
          // Add threshold text
          markCell.append("span")
            .text(`${mark.threshold}%`)
            .style("font-size", "12px")
            .style("color", "#6b7280");
          
          // Justification cell with feature highlights
          const justCell = row.append("td")
            .attr("class", "px-6 py-4 text-sm text-gray-700")
            .style("padding", "16px")
            .style("border", "1px solid #e5e7eb")
            .style("line-height", "1.5");
          
          // Highlight key features in justification text
          const keyFeatures = [
            "role-based authentication", "anti-cheat", "WebSocket", 
            "D3.js", "PDF", "CSV", "export", "visualization", 
            "monitoring", "superuser", "real-time", "difficulty analysis"
          ];
          
          // Process justification text to highlight keywords
          let justificationText = mark.justification;
          keyFeatures.forEach(feature => {
            const regex = new RegExp(feature, 'gi');
            justificationText = justificationText.replace(regex, match => 
              `<span style="background-color: #dbeafe; padding: 2px 4px; border-radius: 4px; font-weight: 500;">${match}</span>`
            );
          });
          
          justCell.html(justificationText);
          
          // Internal route cell with interactive link
          const routeCell = row.append("td")
            .attr("class", "px-6 py-4 whitespace-nowrap text-sm text-blue-600")
            .style("padding", "12px")
            .style("border", "1px solid #e5e7eb")
            .style("text-align", "center")
            .style("width", "160px");
          
          // Create button-like link
          routeCell.append("a")
            .attr("href", mark.internalRoute)
            .style("display", "inline-block")
            .style("padding", "8px 16px")
            .style("background", "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)")
            .style("color", "white")
            .style("border-radius", "6px")
            .style("font-weight", "medium")
            .style("text-decoration", "none")
            .style("transition", "all 0.2s")
            .style("box-shadow", "0 1px 2px rgba(0, 0, 0, 0.1)")
            .text(mark.internalRoute)
            .on("mouseover", function() {
              d3.select(this)
                .style("background", "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)")
                .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.1)");
            })
            .on("mouseout", function() {
              d3.select(this)
                .style("background", "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)")
                .style("box-shadow", "0 1px 2px rgba(0, 0, 0, 0.1)");
            });
        });
      }
      
      // Add table footer with summary
      const tfoot = table.append("tfoot");
      const footerRow = tfoot.append("tr");
      
      footerRow.append("td")
        .attr("colspan", "3")
        .style("padding", "12px")
        .style("background", "#f8fafc")
        .style("border", "1px solid #e5e7eb")
        .style("text-align", "center")
        .style("font-size", "14px")
        .style("color", "#475569")
        .html(`Showing <strong>${marks.length}</strong> feature grades for the QuizMaster platform.
          Each feature set has internal route links to the corresponding functionality.`);
    }
  }, [marks, isLoadingMarks]);
  
  // Helper function to generate gradient colors based on threshold
  function getGradientForThreshold(threshold: number): string {
    if (threshold >= 90) return "linear-gradient(90deg, #10b981 0%, #059669 100%)";
    if (threshold >= 80) return "linear-gradient(90deg, #34d399 0%, #10b981 100%)";
    if (threshold >= 70) return "linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)";
    if (threshold >= 60) return "linear-gradient(90deg, #fcd34d 0%, #f59e0b 100%)";
    if (threshold >= 50) return "linear-gradient(90deg, #fbbf24 0%, #d97706 100%)";
    if (threshold >= 40) return "linear-gradient(90deg, #f59e0b 0%, #b45309 100%)";
    if (threshold >= 30) return "linear-gradient(90deg, #f87171 0%, #ef4444 100%)";
    return "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)";
  }
  
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