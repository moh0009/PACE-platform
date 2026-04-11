import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Trash2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";
import { useNotification } from "../context/NotificationContext";
import StudentModal from "./StudentModal";

const MinimalDropdown = ({ actions, student, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const dropdownRef = useRef(null);
  const { showNotification } = useNotification();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultActions = [
    { 
      label: "View Details", 
      icon: <Eye size={14} />, 
      onClick: () => {
        setModalMode("view");
        setIsModalOpen(true);
      }, 
      color: "text-slate-600" 
    },
    { 
      label: "Edit Student", 
      icon: <Edit2 size={14} />, 
      onClick: () => {
        setModalMode("edit");
        setIsModalOpen(true);
      }, 
      color: "text-indigo-600" 
    },
    { label: "Delete Student", icon: <Trash2 size={14} />, onClick: async () => {
      try {
        const data = await fetchAPI(`/students/${student.id}`, "DELETE", null);
        if (data) {
          showNotification({ message: "Student deleted successfully", type: "success" });
          onSuccess?.();
        }
      } catch (err) {
        showNotification({ message: "Failed to delete student", type: "error" });
      }
    }, color: "text-rose-500" },
  ];

  const displayActions = actions || defaultActions;

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-2 rounded-full transition-all duration-200 flex items-center justify-center",
            isOpen 
              ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20" 
              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          )}
        >
          <MoreVertical size={18} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] overflow-hidden"
            >
              {displayActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-sm flex items-center gap-3 transition-colors text-left",
                    "hover:bg-slate-50 active:bg-slate-100",
                    action.color || "text-slate-600"
                  )}
                >
                  <span className="shrink-0">{action.icon}</span>
                  <span className="font-medium">{action.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        student={student} 
        mode={modalMode}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default MinimalDropdown;
