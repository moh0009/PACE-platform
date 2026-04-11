'use client';

import React, { useEffect, useState } from "react";
import { UserSearch, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import Dropdown from "./dropdown";
import MinimalDropdown from "./MinimalDropdown";
import GradeSlider from "./GradeSlider";
import { cn } from "../lib/utils";
import fetchAPI from "../lib/utils";

export default function StudentsTable() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [searchNameQuery, setSearchNameQuery] = useState("");
  const [subjectSelected, setSubjectSelected] = useState("");
  const [gradeMin, setGradeMin] = useState(0);
  const [gradeMax, setGradeMax] = useState(100);
  const totalPages = Math.ceil(totalCount / pageSize);

  const subjectOptions = ['All Subjects', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'English Literature', 'Computer Science', 'Art', 'Music', 'Geography'].map(s => ({ value: s, label: s }));
  const pageSizeOptions = [10, 25, 50, 100].map(n => ({ value: n, label: `${n} per page` }));

  const fetchStudents = async ({ 
    page, 
    cursor = null, 
    direction = 'next', 
    sort = sortConfig, 
    name = searchNameQuery || null, 
    subject = subjectSelected || null,
    minG = gradeMin || null,
    maxG = gradeMax || null
  }) => {
    setIsLoading(true);
    try {
      let sortQuery = "";
      if (sort.key && sort.direction) {
        sortQuery = `&sortBy=${sort.key} ${sort.direction.toUpperCase()}`;
      }

      let cursorParams = "";
      if (cursor) {
        const { id, value } = cursor;
        if (direction === 'next') {
          cursorParams = `&afterId=${id}&afterValue=${encodeURIComponent(value)}`;
        } else {
          cursorParams = `&beforeId=${id}&beforeValue=${encodeURIComponent(value)}`;
        }
      }

      let nameQuery = "";
      if (name) {
        nameQuery = `&name=${name}`;
      }

      let subjectQuery = "";
      if (subject) {
        subjectQuery = `&subject=${subject}`;
      }

      let gradeQuery = "";
      if (minG !== null && minG !== undefined && minG !== 0) gradeQuery += `&gradeMin=${minG}`;
      if (maxG !== null && maxG !== undefined && maxG !== 100) gradeQuery += `&gradeMax=${maxG}`;

      const data = await fetchAPI(`/students?pageSize=${pageSize}${sortQuery}${cursorParams}${nameQuery}${subjectQuery}${gradeQuery}`, "GET", null);
      if (Array.isArray(data)) {
        setStudents(data);
        setCurrentPage(page);
      } else {
        if (data == null) {
          setStudents([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCount = async (filters = {}) => {
    const { name, subject, minG, maxG } = filters;
    let queryParams = "";
    if (name) queryParams += `&name=${name}`;
    if (subject) queryParams += `&subject=${subject}`;
    if (minG !== null && minG !== undefined && minG !== 0) queryParams += `&gradeMin=${minG}`;
    if (maxG !== null && maxG !== undefined && maxG !== 100) queryParams += `&gradeMax=${maxG}`;

    const data = await fetchAPI(`/students/count?${queryParams}`, "GET", null);
    if (data && typeof data.count === "number") {
      setTotalCount(data.count);
    }
  };

  const refreshData = async () => {
    const filters = { name: searchNameQuery, subject: subjectSelected, minG: gradeMin, maxG: gradeMax };
    await fetchCount(filters);
    await fetchStudents({ page: 1, ...filters });
  };

  useEffect(() => {
    refreshData();
  }, [pageSize]);

  const handlePageChange = (direction) => {
    if (direction === 'next' && currentPage < totalPages) {
      const lastItem = students[students.length - 1];
      const sortKey = sortConfig.key || 'id';
      fetchStudents({ 
        page: currentPage + 1, 
        direction: 'next',
        cursor: { id: lastItem.id, value: lastItem[sortKey] }
      });
    } else if (direction === 'prev' && currentPage > 1) {
      const firstItem = students[0];
      const sortKey = sortConfig.key || 'id';
      fetchStudents({ 
        page: currentPage - 1, 
        direction: 'prev',
        cursor: { id: firstItem.id, value: firstItem[sortKey] }
      });
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (key === "id") {
      direction = "desc";
    }
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }

    const newSort = { key: direction ? key : null, direction };
    setSortConfig(newSort);
    // Reset to page 1 on sort change
    fetchStudents({ page: 1, sort: newSort });
  };

  // Pagination logic: mimicing the range-based style from the photo
  const getPaginationItems = () => {
    const range = [];
    if (totalPages <= 10) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
      return range;
    }

    // Show first 4, dots, last 4 (as seen in photo)
    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    
    if (currentPage >= totalPages - 2) {
      return [1, 2, 3, 4, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    // Middle case
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const paginationItems = getPaginationItems();

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchNameQuery, subjectSelected, gradeMin, gradeMax]);

  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h3 className="text-xl font-bold tracking-tight mb-2">Student Data Registry</h3>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:min-w-[280px]">
            <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="Search by Student Name"
              type="text"
              value={searchNameQuery}
              onChange={(e) => setSearchNameQuery(e.target.value)}
            />
          </div>
          <Dropdown 
            options={subjectOptions} 
            placeholder="All Subjects" 
            onChange={(val) => setSubjectSelected(val.value === "All Subjects" ? null : val.value)} 
          />
          <GradeSlider 
            min={0} 
            max={100} 
            values={[gradeMin, gradeMax]} 
            onChange={([min, max]) => {
              setGradeMin(min);
              setGradeMax(max);
            }} 
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("id")}>
                  <div className="flex items-center gap-2">
                    ID {sortConfig.key === "id" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />) : <ArrowUpDown size={14} />}
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-2">
                    Name {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />) : <ArrowUpDown size={14} />}
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" >
                  <div className="flex items-center gap-2">
                    Subject
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("grade")}>
                  <div className="flex items-center gap-2">
                    Grade {sortConfig.key === "grade" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-indigo-600" /> : <ArrowDown size={14} className="text-indigo-600" />) : <ArrowUpDown size={14} />}
                  </div>
                </th>
                <th className="px-4 sm:px-8 py-5 text-sm font-semibold text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                      <p className="text-sm font-bold text-slate-400 animate-pulse">Synchronizing Students...</p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 sm:px-8 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">{student.id}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-4 text-slate-500 text-xs sm:text-sm">{student.subject}</td>
                    <td className="px-4 sm:px-8 py-4">
                      <span
                        className={cn(
                          "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg",
                          student.grade >= 50 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-500"
                        )}
                      >
                        {student.grade}
                      </span>
                    </td>
                    <td className="px-4 sm:px-8 py-4 text-right">
                      <MinimalDropdown student={student} onSuccess={refreshData} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-8 py-6 flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-50/50 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <p className="text-[10px] sm:text-xs font-medium text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} Students
            </p>
            <Dropdown
              className="w-full sm:w-[140px]"
              options={pageSizeOptions}
              value={pageSizeOptions.find(opt => opt.value === pageSize)}
              onChange={(opt) => setPageSize(opt.value)}
              menuPlacement="top"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-x divide-slate-200">
            <button
              className="px-4 py-2 flex items-center gap-2 text-[10px] sm:text-xs font-bold text-indigo-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              disabled={currentPage === 1}
              onClick={() => handlePageChange('prev')}
            >
              <div className="w-5 h-5 flex items-center justify-center rounded-full border border-indigo-200">
                <ChevronLeft size={12} />
              </div>
              <span>Previous</span>
            </button>
            
            <div className="flex items-center px-4 py-2 text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-50/50">
              Page {currentPage} of {totalPages}
            </div>

            <button
              className="px-4 py-2 flex items-center gap-2 text-[10px] sm:text-xs font-bold text-indigo-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange('next')}
            >
              <span>Next</span>
              <div className="w-5 h-5 flex items-center justify-center rounded-full border border-indigo-200">
                <ChevronRight size={12} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}