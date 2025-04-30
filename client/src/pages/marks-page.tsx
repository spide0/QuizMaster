import { Navbar } from "@/components/navbar";
import { MarksDisplay } from "@/components/marks-display";

export default function MarksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Marks Analysis</h1>
          
          <MarksDisplay />
        </div>
      </main>
    </div>
  );
}
