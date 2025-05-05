import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Github, Users, Book, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProjectInfo {
  name: string;
  id: string;
  personal_notion_page: string;
  personal_group_page_notion: string;
  github_id: string;
  project_github_link: string;
}

export default function InfoPage() {
  const { user, isLoading: authLoading } = useAuth();
  
  const { data: projectInfo, isLoading, error } = useQuery<ProjectInfo>({
    queryKey: ["/api/info"],
  });
  
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load project information. Please try again later.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  if (!projectInfo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>
              No project information available.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Project Information</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="col-span-1 md:col-span-2 shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5 text-primary" />
                Project Details
              </CardTitle>
              <CardDescription>General information about the QuizMaster platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md">
                <div className="font-semibold text-gray-700">Project Name</div>
                <div>{projectInfo.name}</div>
              </div>
              
              <div className="flex justify-between items-center p-4 rounded-md">
                <div className="font-semibold text-gray-700">Project ID</div>
                <div>{projectInfo.id}</div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">External Links</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LinkCard 
                    icon={<Book className="h-5 w-5 text-blue-500" />}
                    title="Din Mohammad Rabiul Islam Khan"
                    description="ID-1921457"
                 
                  />
                  
                  <LinkCard 
                    icon={<Users className="h-5 w-5 text-purple-500" />}
                    title="Din Mohammad Rafiul Islam Khan"
                    description="ID-1921457"
                    
                  />
                  
                  <LinkCard 
                    icon={<Github className="h-5 w-5 text-gray-800" />}
                    title=" Shahriar Akib "
                    description="ID-2022222"
                    
                  />
                  
                  <LinkCard 
                    icon={<Github className="h-5 w-5 text-gray-800" />}
                    title="Mehedi Hasan Nirob"
                    description="ID-1811016"
                    
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {user?.role === "admin" && (
            <Card className="shadow-lg border-t-4 border-t-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-yellow-500" />
                  Admin Information
                </CardTitle>
                <CardDescription>Administrator-specific details and capabilities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p>As an administrator, you have access to:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Create and manage quizzes</li>
                    <li>Monitor active quiz sessions</li> 
                    <li>View comprehensive performance analytics</li>
                    <li>Analyze question difficulty levels</li>
                    <li>Access mark distribution data</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="shadow-lg border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-green-500" />
                User Account
              </CardTitle>
              <CardDescription>Your account details on the QuizMaster platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md">
                  <div className="font-semibold text-gray-700">Username</div>
                  <div>{user?.username}</div>
                </div>
                
                <div className="flex justify-between items-center p-4 rounded-md">
                  <div className="font-semibold text-gray-700">Email</div>
                  <div>{user?.email}</div>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md">
                  <div className="font-semibold text-gray-700">Role</div>
                  <div className="capitalize">{user?.role}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LinkCard({ 
  icon, 
  title, 
  description, 
  link, 
  value 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  link?: string;
  value?: string;
}) {
  return (
    <Card className="shadow-sm hover:shadow transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="mt-1">{icon}</div>
          <div className="flex-1">
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-gray-500">{description}</p>
            
            {link ? (
              <a 
                href={link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm text-primary hover:text-primary/80"
              >
                Visit Link
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            ) : value ? (
              <p className="mt-2 text-sm font-mono bg-gray-100 p-1 rounded">{value}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}