'use client';

import React, { useState, useEffect } from "react";
import { X, User, BookOpen, GraduationCap, Save, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";
import { useNotification } from "../context/NotificationContext";

import Dropdown from "./dropdown";

const StudentModal = ({ isOpen, onClose, student, mode = "view", onSuccess }) => {
  const [currentMode, setCurrentMode] = useState(mode);
  const [formData, setFormData] = useState({
    name: student?.name || "",
    subject: student?.subject || "",
    grade: student?.grade || 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'English Literature', 'Computer Science', 'Art', 'Music', 'Geography'].map(s => ({ value: s, label: s }));

  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        subject: student.subject,
        grade: student.grade
      });
    }
  }, [student]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await fetchAPI(`/students/${student.id}`, "PUT", formData);
      if (data) {
        showNotification({ message: "Student updated successfully", type: "success" });
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      showNotification({ message: "Failed to update student", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[151] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden pointer-events-auto"
            >
              {/* Header */}
              <div className="relative h-32 bg-gradient-to-br from-indigo-500 to-purple-600 p-8">
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-5 mt-4">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center text-indigo-600">
                    <User size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight">
                      {currentMode === "edit" ? "Edit Academic Record" : "Student Credentials"}
                    </h2>
                    <p className="text-indigo-100 text-sm font-medium">Registry ID: #{student.id}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {currentMode === "view" ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <User size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Full Name</span>
                        </div>
                        <p className="font-bold text-slate-800">{student.name}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <BookOpen size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Subject</span>
                        </div>
                        <p className="font-bold text-slate-800">{student.subject}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
                          <GraduationCap size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Current Grade</p>
                          <p className="text-2xl font-black text-indigo-900">{student.grade}%</p>
                        </div>
                      </div>
                      <div className={cn(
                        "px-4 py-2 rounded-xl text-sm font-black",
                        student.grade >= 50 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                      )}>
                        {student.grade >= 50 ? "PASSING" : "FAILING"}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setCurrentMode("edit")}
                        className="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                      >
                        <Edit3 size={18} />
                        Edit Profile
                      </button>
                      <button
                        onClick={onClose}
                        className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdate} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Student Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none transition-all"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Academic Subject</label>
                      <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
                        <Dropdown 
                          options={subjects}
                          value={subjects.find(s => s.value === formData.subject)}
                          onChange={(val) => setFormData({ ...formData, subject: val.value })}
                          className="w-full"
                          placeholder="Select Subject"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Grade Score ({formData.grade}%)</label>
                      <div className="px-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={formData.grade}
                          onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                        />
                        <div className="flex justify-between mt-2 px-1">
                          <span className="text-[10px] font-bold text-rose-400">0%</span>
                          <span className="text-[10px] font-bold text-slate-300">Target: 50%+</span>
                          <span className="text-[10px] font-bold text-emerald-400">100%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentMode("view")}
                        className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-3 bg-indigo-600 text-white font-bold py-4 px-8 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save size={18} />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StudentModal;
