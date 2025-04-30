import { useQuery } from "@tanstack/react-query";
import { Mark } from "@shared/schema";
import { D3MarksTable } from "@/components/ui/d3-table";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "react-toastify";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PlusCircle } from "lucide-react";
import * as d3 from 'd3';

// Create a schema for the form
const markFormSchema = z.object({
  mark: z.string().min(1, "Mark is required"),
  justification: z.string().min(5, "Justification must be at least 5 characters"),
  internalRoute: z.string().min(1, "Internal route is required"),
  threshold: z.coerce.number().min(0, "Threshold must be at least 0").max(100, "Threshold must be at most 100"),
});

type MarkFormValues = z.infer<typeof markFormSchema>;

export function MarksDisplay() {
  const [showForm, setShowForm] = useState(false);

  // Fetch marks
  const { data: marks = [], isLoading: marksLoading, error: marksError } = useQuery<Mark[]>({
    queryKey: ["/api/marks"],
  });
  
  // Fetch user performance data for real-time visualization
  const { data: performanceData = [], isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ["/api/user-performance"],
  });
  
  // Combined loading and error states
  const isLoading = marksLoading || performanceLoading;
  const error = marksError || performanceError;

  // Create mark mutation
  const createMarkMutation = useMutation({
    mutationFn: async (values: MarkFormValues) => {
      const res = await apiRequest("POST", "/api/marks", values);
      return res.json();
    },
    onSuccess: () => {
      toast.success("Mark created successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/marks"] });
      setShowForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create mark: ${error.message}`);
    },
  });

  // Form for adding new marks
  const form = useForm<MarkFormValues>({
    resolver: zodResolver(markFormSchema),
    defaultValues: {
      mark: "",
      justification: "",
      internalRoute: "/api/grades/",
      threshold: 0,
    },
  });

  // Handler for form submission
  const onSubmit = (values: MarkFormValues) => {
    createMarkMutation.mutate(values);
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
        <p className="text-red-500">Failed to load marks data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Marks Analysis</CardTitle>
              <CardDescription>
                Grading scale and performance justification
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setShowForm(!showForm)}
            >
              <PlusCircle className="h-4 w-4" />
              <span>{showForm ? "Cancel" : "Add Mark"}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="mb-8 p-4 border rounded-md bg-slate-50">
              <h3 className="text-lg font-medium mb-4">Add New Mark</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="mark"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mark</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. A (90-100%)" {...field} />
                          </FormControl>
                          <FormDescription>
                            The grade mark and range
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Threshold (%)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={100} {...field} />
                          </FormControl>
                          <FormDescription>
                            Minimum percentage required
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="justification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justification</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Explain the justification for this marking"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="internalRoute"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Route</FormLabel>
                        <FormControl>
                          <Input placeholder="/api/grades/..." {...field} />
                        </FormControl>
                        <FormDescription>
                          API endpoint for this grade
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={createMarkMutation.isPending}
                    >
                      {createMarkMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Mark
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <D3MarksTable marks={marks} performanceData={performanceData} />
        </CardContent>
      </Card>
    </div>
  );
}
