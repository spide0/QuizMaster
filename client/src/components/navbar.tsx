import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, X, ChevronDown } from "lucide-react";

export function Navbar() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close menus on location change
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Generate user initials for avatar fallback
  const getInitials = () => {
    if (!user?.username) return "U";
    return user.username.charAt(0).toUpperCase();
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <h1 className="text-xl font-bold text-primary cursor-pointer">QuizMaster</h1>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className={`${isActive("/") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                Dashboard
              </Link>
              <Link href="/quizzes" className={`${isActive("/quizzes") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                Quizzes
              </Link>
              <Link href="/results" className={`${isActive("/results") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                Results
              </Link>
              {/* Admin only navigation */}
              {user?.role === "admin" && (
                <>
                  <Link href="/marks" className={`${isActive("/marks") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                    Marks
                  </Link>
                  <Link href="/quiz/create" className={`${isActive("/quiz/create") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                    Create Quiz
                  </Link>
                  <Link href="/monitor" className={`${isActive("/monitor") ? "border-primary text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                    Monitor
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Profile dropdown */}
            <div className="ml-3 relative" ref={menuRef}>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full focus:outline-none"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <span className="sr-only">Open user menu</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profilePicture || ""} alt={user?.username || "User"} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </div>
              {isUserMenuOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="block px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    {user?.username || "User"}
                  </div>
                  <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Your Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            {/* Mobile menu button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link 
              href="/"
              className={`${
                isActive("/")
                  ? "bg-indigo-50 border-primary text-primary"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            >
              Dashboard
            </Link>
            <Link 
              href="/quizzes"
              className={`${
                isActive("/quizzes")
                  ? "bg-indigo-50 border-primary text-primary"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            >
              Quizzes
            </Link>
            <Link 
              href="/results"
              className={`${
                isActive("/results")
                  ? "bg-indigo-50 border-primary text-primary"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
            >
              Results
            </Link>
            {/* Admin only navigation - mobile */}
            {user?.role === "admin" && (
              <>
                <Link 
                  href="/marks"
                  className={`${
                    isActive("/marks")
                      ? "bg-indigo-50 border-primary text-primary"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                >
                  Marks
                </Link>
                <Link 
                  href="/quiz/create"
                  className={`${
                    isActive("/quiz/create")
                      ? "bg-indigo-50 border-primary text-primary"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                >
                  Create Quiz
                </Link>
                <Link 
                  href="/monitor"
                  className={`${
                    isActive("/monitor")
                      ? "bg-indigo-50 border-primary text-primary"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800"
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                >
                  Monitor
                </Link>
              </>
            )}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.profilePicture || ""} alt={user?.username || "User"} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">{user?.username}</div>
                <div className="text-sm font-medium text-gray-500">{user?.email}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link href="/profile" className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                Your Profile
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
