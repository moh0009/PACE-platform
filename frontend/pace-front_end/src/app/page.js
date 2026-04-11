"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import Sidebar from "../../components/Sidebar";
import UploadSection from "../../components/UploadSection";
import StudentsTable from "../../components/StudentsTable";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Upload file");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#191c1d]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full overflow-hidden">
        <main className="p-4 sm:p-8 lg:p-12">
          {/* Active Pipelines */}
          {activeTab === "Upload file" && <UploadSection />}

          {/* Student Registry */}
          {activeTab === "Students" && <StudentsTable />}
        </main>
      </div>
    </div>
  );
}
