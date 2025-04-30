import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { 
  InsertUser, 
  User, 
  LoginData, 
  ProfileUpdate, 
  PasswordChange, 
  PasswordResetRequest 
} from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { toast } from "react-toastify";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  updateProfileMutation: UseMutationResult<User, Error, ProfileUpdate>;
  changePasswordMutation: UseMutationResult<{ message: string }, Error, PasswordChange>;
  deleteAccountMutation: UseMutationResult<{ message: string }, Error, void>;
  requestPasswordResetMutation: UseMutationResult<{ message: string }, Error, PasswordResetRequest>;
  updateProfilePictureMutation: UseMutationResult<User, Error, { profilePicture: string }>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast: showToast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast.success("Login successful!");
    },
    onError: (error: Error) => {
      toast.error(`Login failed: ${error.message}`);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast.success("Registration successful!");
    },
    onError: (error: Error) => {
      toast.error(`Registration failed: ${error.message}`);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast.success("Logged out successfully");
    },
    onError: (error: Error) => {
      toast.error(`Logout failed: ${error.message}`);
    },
  });
  
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: ProfileUpdate) => {
      const res = await apiRequest("PATCH", "/api/user/profile", profileData);
      return await res.json();
    },
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast.success("Profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Profile update failed: ${error.message}`);
    },
  });
  
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData: PasswordChange) => {
      const res = await apiRequest("POST", "/api/user/change-password", passwordData);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      toast.success(response.message);
    },
    onError: (error: Error) => {
      toast.error(`Password change failed: ${error.message}`);
    },
  });
  
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/account");
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      queryClient.setQueryData(["/api/user"], null);
      toast.success(response.message);
    },
    onError: (error: Error) => {
      toast.error(`Account deletion failed: ${error.message}`);
    },
  });
  
  const requestPasswordResetMutation = useMutation({
    mutationFn: async (data: PasswordResetRequest) => {
      const res = await apiRequest("POST", "/api/request-password-reset", data);
      return await res.json();
    },
    onSuccess: (response: { message: string }) => {
      toast.success(response.message);
    },
    onError: (error: Error) => {
      toast.error(`Password reset request failed: ${error.message}`);
    },
  });
  
  const updateProfilePictureMutation = useMutation({
    mutationFn: async (data: { profilePicture: string }) => {
      const res = await apiRequest("POST", "/api/user/profile-picture", data);
      return await res.json();
    },
    onSuccess: (updatedUser: User) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast.success("Profile picture updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Profile picture update failed: ${error.message}`);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        updateProfileMutation,
        changePasswordMutation,
        deleteAccountMutation,
        requestPasswordResetMutation,
        updateProfilePictureMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
