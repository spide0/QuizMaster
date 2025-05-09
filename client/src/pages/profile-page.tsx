import { Navbar } from "@/components/navbar";
import { ProfileForm } from "@/components/profile-form";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Your Profile</h1>
          
          <div className="mt-6">
            <ProfileForm />
          </div>
        </div>
      </main>
    </div>
  );
}
