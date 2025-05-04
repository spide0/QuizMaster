import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import QuizzesPage from "@/pages/quizzes-page";
import QuizDetailsPage from "@/pages/quiz-details-page";
import QuizCreatePage from "@/pages/quiz-create-page";
import QuizSessionPage from "@/pages/quiz-session-page";
import ResultsPage from "@/pages/results-page";
import MonitorPage from "@/pages/monitor-page";
import MarksPage from "@/pages/marks-page";
import DifficultyAnalysisPage from "@/pages/difficulty-analysis-page";
import InfoPage from "@/pages/info-page";
import AllLinkPage from "@/pages/all-link-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/quizzes" component={QuizzesPage} />
      <ProtectedRoute path="/quizzes/:id" component={QuizDetailsPage} />
      <ProtectedRoute path="/quiz/create" component={QuizCreatePage} roles={["admin", "superuser"]} />
      <ProtectedRoute path="/quiz/session/:id" component={QuizSessionPage} />
      <ProtectedRoute path="/results" component={ResultsPage} />
      <ProtectedRoute path="/results/:id" component={ResultsPage} />
      <ProtectedRoute path="/monitor" component={MonitorPage} roles={["admin", "superuser"]} />
      <ProtectedRoute path="/marks" component={MarksPage} roles={["admin", "superuser"]} />
      <ProtectedRoute path="/difficulty-analysis" component={DifficultyAnalysisPage} roles={["admin", "superuser"]} />
      <ProtectedRoute path="/info" component={InfoPage} />
      <ProtectedRoute path="/all-link" component={AllLinkPage} roles={["superuser"]} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="quizmaster-theme">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
