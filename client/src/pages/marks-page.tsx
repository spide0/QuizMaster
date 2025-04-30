import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/navbar";
import { MarksDisplay } from "@/components/marks-display";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

export default function MarksPage() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  // Only admin users should have access to this page
  if (!user || user.role !== 'admin') {
    return <Redirect to="/auth" />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <MarksDisplay />
      </div>
    </div>
  );
}