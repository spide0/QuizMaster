import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/navbar";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

type RouteInfo = {
  path: string;
  name: string;
  description: string;
  restricted: boolean;
};

export default function AllLinkPage() {
  const { user, isLoading } = useAuth();
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  useEffect(() => {
    // Only fetch routes if user is authenticated as superuser
    if (user && user.role === 'superuser') {
      fetch('/api/all-routes', {
        headers: {
          'Authorization': `Bearer ${process.env.SUPERUSER_API_KEY || ''}`
        }
      })
      .then(res => res.json())
      .then(data => {
        setRoutes(data.routes);
        setApiKey(data.apiKey);
      })
      .catch(error => {
        console.error('Error fetching routes:', error);
      });
    }
  }, [user]);
  
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
  
  // Restricted only to superuser
  if (!user || user.role !== 'superuser') {
    return <Redirect to="/auth" />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">All System Routes</h1>
        <p className="text-gray-600 mb-8">
          Welcome, Superuser {user.username}. You have access to all system routes.
        </p>
        
        {apiKey && (
          <Card className="mb-8 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>SuperUser API Key</CardTitle>
              <CardDescription>This key is used for authenticated API requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm p-3 bg-blue-100 rounded overflow-x-auto">
                {apiKey.substring(0, 5)}...{apiKey.substring(apiKey.length - 5)} (Masked for security)
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Note: The full API key is stored securely as an environment variable.
              </p>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route, index) => (
            <Card key={index} className={route.restricted ? "border-amber-200" : "border-green-200"}>
              <CardHeader className={route.restricted ? "bg-amber-50" : "bg-green-50"}>
                <CardTitle>{route.name}</CardTitle>
                <CardDescription>
                  {route.path}
                  {route.restricted && (
                    <span className="ml-2 text-xs bg-amber-200 text-amber-800 py-0.5 px-1.5 rounded">Restricted</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{route.description}</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={route.path}>Access Route</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}