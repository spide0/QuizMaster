import { Navbar } from "@/components/navbar";
import { MonitoringPanel } from "@/components/monitoring-panel";

export default function MonitorPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <MonitoringPanel />
        </div>
      </main>
    </div>
  );
}
