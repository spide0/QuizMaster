import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertQuizSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { toast } from "react-toastify";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { TrashIcon, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Extended schema for the form
const quizFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  categoryId: z.coerce.number().min(1, "Please select a category"),
  timeLimit: z.coerce.number().min(1, "Time limit must be at least 1 minute"),
  passingScore: z.coerce.number().min(1, "Passing score must be at least 1%").max(100, "Passing score cannot exceed 100%"),
  questions: z.array(z.object({
    questionText: z.string().min(3, "Question text must be at least 3 characters"),
    options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least 2 options are required"),
    correctAnswer: z.coerce.number().min(0, "Please select the correct answer"),
    explanation: z.string().optional()
  })).min(1, "At least one question is required")
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

export function QuizForm() {
  const [, setLocation] = useLocation();
  
  // Fetch categories
  const { data: categories = [] } = useQuery<{ id: number, name: string }[]>({
    queryKey: ["/api/categories"],
  });

  // Default form values
  const defaultValues: QuizFormValues = {
    title: "",
    description: "",
    categoryId: 0,
    timeLimit: 30,
    passingScore: 70,
    questions: [
      {
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: ""
      }
    ]
  };

  // Create form
  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues,
    mode: "onChange"
  });

  // Setup field array for questions
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions"
  });

  // Create quiz mutation
  const createQuizMutation = useMutation({
    mutationFn: async (values: QuizFormValues) => {
      // First create the quiz
      const res = await apiRequest("POST", "/api/quizzes", {
        title: values.title,
        description: values.description,
        categoryId: values.categoryId,
        timeLimit: values.timeLimit,
        passingScore: values.passingScore
      });
      
      const quiz = await res.json();
      
      // Then add questions
      await Promise.all(values.questions.map(async (question) => {
        await apiRequest("POST", `/api/quizzes/${quiz.id}/questions`, {
          questionText: question.questionText,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation
        });
      }));
      
      return quiz;
    },
    onSuccess: () => {
      toast.success("Quiz created successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      setLocation("/quizzes");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create quiz: ${error.message}`);
    }
  });

  // Submit handler
  const onSubmit = (values: QuizFormValues) => {
    createQuizMutation.mutate(values);
  };

  // Add a new question
  const addQuestion = () => {
    append({
      questionText: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: ""
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-8 divide-y divide-gray-200">
          {/* Quiz Details */}
          <div>
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Quiz Details</h3>
              <p className="mt-1 text-sm text-gray-500">
                Provide the basic information about your quiz.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-4">
                    <FormLabel>Quiz Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-4">
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-6">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormDescription>A brief description of the quiz.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeLimit"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Time Limit (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passingScore"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Passing Score (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Questions */}
          <div className="pt-8">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Questions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add questions to your quiz.
              </p>
            </div>
            
            <div className="mt-6 space-y-6">
              {fields.map((field, index) => (
                <Card key={field.id} className="bg-gray-50">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-md font-medium text-gray-900">Question {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                      <FormField
                        control={form.control}
                        name={`questions.${index}.questionText`}
                        render={({ field }) => (
                          <FormItem className="sm:col-span-6">
                            <FormLabel>Question Text</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch(`questions.${index}.options`).map((_, optionIndex) => (
                        <FormField
                          key={optionIndex}
                          control={form.control}
                          name={`questions.${index}.options.${optionIndex}`}
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel>Option {optionIndex + 1}</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}

                      <FormField
                        control={form.control}
                        name={`questions.${index}.correctAnswer`}
                        render={({ field }) => (
                          <FormItem className="sm:col-span-4">
                            <FormLabel>Correct Answer</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select correct option" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {form.watch(`questions.${index}.options`).map((option, optIdx) => (
                                  <SelectItem key={optIdx} value={optIdx.toString()}>
                                    Option {optIdx + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`questions.${index}.explanation`}
                        render={({ field }) => (
                          <FormItem className="sm:col-span-6">
                            <FormLabel>Explanation (Optional)</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Question
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/quizzes")}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            disabled={createQuizMutation.isPending}
          >
            {createQuizMutation.isPending ? "Creating..." : "Create Quiz"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
