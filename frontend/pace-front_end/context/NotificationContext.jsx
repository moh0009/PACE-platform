"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

const NotificationContext = createContext(null);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = useCallback(({ message, type = "info", duration = 4000 }) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, message, type, duration }]);

        if (duration !== Infinity) {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    }, []);

    const icons = {
        success: <CheckCircle className="text-emerald-500" size={18} />,
        error: <XCircle className="text-rose-500" size={18} />,
        warning: <AlertCircle className="text-amber-500" size={18} />,
        info: <Info className="text-indigo-500" size={18} />,
    };

    const bgColors = {
        success: "bg-emerald-50 border-emerald-100",
        error: "bg-rose-50 border-rose-100",
        warning: "bg-amber-50 border-amber-100",
        info: "bg-indigo-50 border-indigo-100",
    };

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-[380px] pointer-events-none">
                <AnimatePresence>
                    {notifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            layout
                            className={cn(
                                "pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-sm",
                                bgColors[n.type] || bgColors.info
                            )}
                        >
                            <span className="shrink-0 mt-0.5">{icons[n.type] || icons.info}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 leading-tight">
                                    {n.message}
                                </p>
                            </div>
                            <button
                                onClick={() => removeNotification(n.id)}
                                className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    );
};
