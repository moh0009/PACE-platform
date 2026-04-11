import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/utils";

/**
 * GradeSlider Component
 * A modern dual-range slider for filtering grades 0-100.
 */
export default function GradeSlider({ min = 0, max = 100, values, onChange }) {
  const [minVal, setMinVal] = useState(values[0] || min);
  const [maxVal, setMaxVal] = useState(values[1] || max);
  const minSelectRef = useRef(null);
  const maxSelectRef = useRef(null);
  const rangeRef = useRef(null);

  // Convert value to percentage
  const getPercent = useCallback(
    (value) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );

  // Set width of the range to decrease from the left side
  useEffect(() => {
    if (maxSelectRef.current) {
      const minPercent = getPercent(minVal);
      const maxPercent = getPercent(maxVal);

      if (rangeRef.current) {
        rangeRef.current.style.left = `${minPercent}%`;
        rangeRef.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [minVal, getPercent]);

  // Set width of the range to decrease from the right side
  useEffect(() => {
    if (minSelectRef.current) {
      const minPercent = getPercent(minVal);
      const maxPercent = getPercent(maxVal);

      if (rangeRef.current) {
        rangeRef.current.style.width = `${maxPercent - minPercent}%`;
      }
    }
  }, [maxVal, getPercent]);

  // Handle change
  const handleMinChange = (event) => {
    const value = Math.min(Number(event.target.value), maxVal - 1);
    setMinVal(value);
  };

  const handleMaxChange = (event) => {
    const value = Math.max(Number(event.target.value), minVal + 1);
    setMaxVal(value);
  };

  // Trigger onChange after user stops sliding (or immediately if needed)
  // Here we use a useEffect to trigger it to avoid prop-drilling issues during render
  useEffect(() => {
      const timer = setTimeout(() => {
          onChange([minVal, maxVal]);
      }, 50); // Small buffer
      return () => clearTimeout(timer);
  }, [minVal, maxVal]);

  return (
    <div className="flex flex-col gap-5 w-full sm:w-[240px] px-2 pt-6">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade Range</span>
        <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[11px] font-bold">{minVal}</span>
            <span className="text-slate-400 text-[10px]">to</span>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[11px] font-bold">{maxVal}</span>
        </div>
      </div>
      
      <div className="relative h-1.5 flex items-center">
        {/* Hidden inputs for functionality */}
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={handleMinChange}
          className="thumb thumb--zindex-3"
          ref={minSelectRef}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={handleMaxChange}
          className="thumb thumb--zindex-4"
          ref={maxSelectRef}
        />

        {/* Visual Slider */}
        <div className="slider">
          <div className="slider__track bg-slate-100" />
          <div ref={rangeRef} className="slider__range primary-gradient shadow-sm shadow-indigo-200" />
        </div>
      </div>
    </div>
  );
}
