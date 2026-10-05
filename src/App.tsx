import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import { GoogleGenAI } from "@google/genai";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Bell,
  Users,
  GraduationCap,
  CalendarCheck,
  ExternalLink,
  X,
  Upload,
  FileText,
  Download,
  Share2,
  Plus,
  Trash2,
  Lock,
  LogOut,
  Menu,
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  Sparkles,
  Search,
  Filter,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  ChevronRight,
  Link,
  User,
  Moon,
  Sun,
  BookOpen,
  Mail,
  Phone,
  BarChart3,
  Copy,
  Check,
} from "lucide-react";

// --- Helpers ---
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  // Check if it's already in DD/MM/YYYY format
  if (dateStr.includes("/") && dateStr.split("/")[0].length === 2)
    return dateStr;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "";
  try {
    // If it's already in AM/PM format, return it
    if (
      timeStr.toLowerCase().includes("am") ||
      timeStr.toLowerCase().includes("pm")
    )
      return timeStr;

    // Try to parse it. If it's just HH:mm, prepend a dummy date
    const timeToParse = timeStr.includes("T")
      ? timeStr
      : `2000-01-01T${timeStr}`;
    const date = new Date(timeToParse);
    if (isNaN(date.getTime())) return timeStr;

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return timeStr;
  }
};

const parseDateToISO = (dateStr: string): string => {
  if (!dateStr) return "";
  let trimmed = dateStr.trim().toLowerCase();

  // Try standard YYYY-MM-DD
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) return trimmed;

  // Malay month names mapping
  const malayMonths: { [key: string]: string } = {
    'januari': '01', 'februari': '02', 'mac': '03', 'april': '04', 'mei': '05', 'jun': '06',
    'julai': '07', 'ogos': '08', 'september': '09', 'oktober': '10', 'november': '11', 'disember': '12',
    'jan': '01', 'feb': '02', 'apr': '04',
    'jul': '07', 'ogo': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'dis': '12'
  };

  // Try DD Month YYYY (e.g., 1 Mac 2026)
  const ddMonthYyyy = trimmed.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (ddMonthYyyy) {
    const day = ddMonthYyyy[1].padStart(2, "0");
    const monthName = ddMonthYyyy[2];
    const year = ddMonthYyyy[3];
    const month = malayMonths[monthName];
    if (month) return `${year}-${month}-${day}`;
  }

  // Try DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    let year = ddmmyyyy[3];
    if (year.length === 2) {
      year = "20" + year; // Assume 20xx
    }
    return `${year}-${month}-${day}`;
  }
  
  // Try YYYY/MM/DD
  const yyyymmdd = trimmed.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, "0");
    const day = yyyymmdd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    }
  } catch (e) {
    console.error("Error parsing date:", trimmed);
  }

  return "";
};

// --- Types ---
type WebLink = { id: string; title: string; url: string; iconUrl?: string };
type Announcement = {
  id: string;
  title: string;
  date: string;
  content: string;
};
type Stat = { teachers: number; students: number };
type AbsentDetail = {
  name: string;
  reason: string;
  duration: string;
  bidang?: string;
};
type Attendance = {
  present: number;
  absent: number;
  total: number;
  date: string;
  absentDetails: AbsentDetail[];
};
type PanitiaFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  uploader: string;
};
type Teacher = {
  name: string;
  bidang: string;
  email?: string;
  phone?: string;
  grade?: string;
  image?: string;
};
type UserLink = {
  id: string;
  title: string;
  url: string;
  instructions: string;
  bidang: "Pentadbiran" | "Kurikulum" | "HEM" | "Kokurikulum" | "Kesenian";
  date: string;
};
type Student = {
  daftarMurid: string;
  nama: string;
  tingkatan: string;
  kadPengenalan: string;
  bidang: string;
};

type TakwimEvent = {
  id: string;
  title: string;
  date: string;
  type: "Cuti" | "Program" | "Peperiksaan" | "Lain-lain";
  description?: string;
};

// --- Helper Functions ---
const getDirectImageUrl = (url: string) => {
  if (!url) return "";

  // Regex to capture the FILE_ID from various Google Drive URL formats
  // Supports:
  // - drive.google.com/file/d/FILE_ID/view
  // - drive.google.com/open?id=FILE_ID
  // - drive.google.com/uc?id=FILE_ID
  // - drive.google.com/uc?export=view&id=FILE_ID
  const driveRegex =
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=view&id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);

  if (match && match[1]) {
    const fileId = match[1];
    // This is often the most reliable direct link format for images
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // If it's not a recognizable Google Drive link, return it as is
  return url;
};

// --- Google Sheet Config ---
const GOOGLE_SHEET_ID_LINKS = "14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0";
const GOOGLE_SHEET_CSV_URL_LINKS = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_LINKS}/export?format=csv&gid=0`;

const GOOGLE_SHEET_ID_TEACHERS = "14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0";
const GOOGLE_SHEET_CSV_URL_TEACHERS = `https://docs.google.com/spreadsheets/d/1GR4iXq-wLusCGHaUUN6gBTgMkZPyezYoSvwWmmkgJZ4/export?format=csv&gid=0`;
const GOOGLE_SHEET_CSV_URL_KEBERADAAN = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_TEACHERS}/export?format=csv&gid=2096914617`;
const GOOGLE_SHEET_CSV_URL_MURID = `https://docs.google.com/spreadsheets/d/12Ye1hVZJEouk1svCCQTdh09FWYibFsCn4QQI6wcgqiI/export?format=csv&gid=0`;
const GOOGLE_SHEET_CSV_URL_TAKWIM_READ = `https://docs.google.com/spreadsheets/d/1z-DEblbpyLRGb1-RxRubXSViWUM_dX2CIj-ugj53atw/export?format=csv&gid=0`;

// Google Apps Script Web App URL for Takwim (Replace this after deployment)
const GOOGLE_SCRIPT_URL_TAKWIM = "https://script.google.com/macros/s/AKfycbwZgeiUCQKluchVFCKAZY05QrSWmbQu-IX1t995Ud_lFu0PvVYnHvg3CquIXHf4LjvNIw/exec"; 

// --- Mock Data ---
const INITIAL_LINKS: WebLink[] = [
  {
    id: "1",
    title: "E-OPR",
    url: "https://eoperasi.moe.gov.my/",
    iconUrl: "https://eoperasi.moe.gov.my/images/logo_kpm.png",
  },
  { id: "2", title: "SMART RPH", url: "https://smartrph.com/", iconUrl: "" },
  {
    id: "3",
    title: "HRMIS",
    url: "https://hrmis2.eghrmis.gov.my/",
    iconUrl:
      "https://hrmis2.eghrmis.gov.my/HRMISNET/Common/Images/JPA_Logo.png",
  },
  { id: "4", title: "SPLKPM", url: "https://splkpm.moe.gov.my/", iconUrl: "" },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "Mesyuarat Guru Bil 3/2026",
    date: "2026-03-01",
    content: "Sila hadir ke bilik mesyuarat pada jam 2.00 petang.",
  },
  {
    id: "2",
    title: "Penghantaran RPH Minggu 10",
    date: "2026-02-28",
    content: "Mohon semua guru melengkapkan e-RPH sebelum hari Jumaat.",
  },
];

const INITIAL_STATS: Stat = { teachers: 0, students: 1850 };
const INITIAL_ATTENDANCE: Attendance = {
  present: 0,
  absent: 0,
  total: 0,
  date: new Date().toISOString().split("T")[0],
  absentDetails: [],
};

const INITIAL_FILES: PanitiaFile[] = [
  {
    id: "1",
    name: "Minit Mesyuarat Panitia BM Bil 1.pdf",
    type: "pdf",
    size: "2.4 MB",
    date: "2026-02-20",
    uploader: "Cikgu Ahmad",
  },
  {
    id: "2",
    name: "Modul Latihan Matematik Tingkatan 4.docx",
    type: "docx",
    size: "5.1 MB",
    date: "2026-02-22",
    uploader: "Cikgu Siti",
  },
  {
    id: "3",
    name: "Kertas Soalan Percubaan Sejarah.pdf",
    type: "pdf",
    size: "3.8 MB",
    date: "2026-02-25",
    uploader: "Cikgu Ramesh",
  },
];

// --- Components ---

const IframeViewer = ({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      <div className="relative flex-1 w-full h-full bg-slate-100">
        {/* Fallback overlay in case iframe fails to load due to X-Frame-Options */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-0">
          <ExternalLink size={48} className="text-slate-400 mb-4" />
          <h3 className="text-xl font-semibold text-slate-700 mb-2">
            Memuatkan {title}...
          </h3>
          <p className="text-slate-500 max-w-md mb-6 text-sm">
            Jika aplikasi tidak dipaparkan, ia mungkin disebabkan oleh tetapan keselamatan laman web tersebut.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-violet-200"
          >
            <ExternalLink size={20} /> Buka di Tab Baru
          </a>
        </div>

        {/* Unsandboxed iframe allows the application's native window.print() and PDF generation to execute directly without browser sandbox blocking */}
        <iframe
          src={url}
          className="w-full h-full border-0 absolute inset-0 z-10 bg-white"
          title={title}
          allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; geolocation"
        />

        {/* Minimal Floating Back Pill (Draggable) */}
        <motion.div
          drag
          dragMomentum={false}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-6 left-6 z-[120] flex items-center gap-2 p-1.5 bg-slate-900/90 hover:bg-slate-900 backdrop-blur-md text-white rounded-full shadow-2xl border border-white/20 cursor-grab active:cursor-grabbing transition-colors"
        >
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-xs font-bold whitespace-nowrap cursor-pointer"
            title="Kembali ke Dashboard S1STEN"
          >
            <ArrowLeft size={15} />
            <span>Kembali</span>
          </button>
          <span className="text-xs font-medium px-2 max-w-[140px] truncate hidden sm:inline opacity-70">
            {title}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-full transition-all text-xs font-bold text-white shadow-md cursor-pointer whitespace-nowrap"
            title="Buka terus di tab baharu untuk memaparkan kotak dialog cetak"
          >
            <ExternalLink size={14} />
            <span>Buka di Tab Baru (Untuk Kotak Dialog Cetak)</span>
          </a>
        </motion.div>
      </div>
    </div>
  );
};

const AttendanceDetailsModal = ({
  attendance,
  onClose,
}: {
  attendance: Attendance;
  onClose: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("semua");

  const filteredDetails = attendance.absentDetails.filter((detail) => {
    const matchesSearch = detail.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "semua" ||
      (filterType === "cuti" &&
        (detail.reason.includes("CUTI") || detail.reason.includes("MC"))) ||
      (filterType === "program" && detail.reason.includes("PROGRAM")) ||
      (filterType === "keluar" && detail.reason.includes("Keluar")) ||
      (filterType === "lewat" && detail.reason.includes("Lewat"));
    return matchesSearch && matchesFilter;
  });

  const getIcon = (reason: string) => {
    if (reason.includes("CUTI") || reason.includes("MC"))
      return <UserX size={18} className="text-red-500" />;
    if (reason.includes("PROGRAM"))
      return <MapPin size={18} className="text-purple-500" />;
    if (reason.includes("Keluar"))
      return <Clock size={18} className="text-amber-500" />;
    if (reason.includes("Lewat"))
      return <Clock size={18} className="text-blue-500" />;
    return <UserX size={18} className="text-gray-500" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="neu-glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 neu-icon-wrapper rounded-xl text-teal-500">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Perincian Keberadaan Guru
              </h2>
              <p className="text-xs font-medium text-gray-500">
                Tarikh: {formatDate(attendance.date)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 neu-button text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Stats Summary In Modal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 neu-inset rounded-2xl text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Jumlah
              </p>
              <p className="text-2xl font-light text-gray-800">
                {attendance.total}
              </p>
            </div>
            <div className="p-4 neu-inset rounded-2xl text-center">
              <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">
                Hadir
              </p>
              <p className="text-2xl font-light text-green-600">
                {attendance.present}
              </p>
            </div>
            <div className="p-4 neu-inset rounded-2xl text-center">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">
                Tiada
              </p>
              <p className="text-2xl font-light text-red-600">
                {attendance.absent}
              </p>
            </div>
            <div className="p-4 neu-inset rounded-2xl text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                Peratus
              </p>
              <p className="text-2xl font-light text-indigo-600">
                {Math.round((attendance.present / attendance.total) * 100)}%
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Cari nama guru..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 neu-input text-sm font-medium"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
              {["semua", "cuti", "program", "keluar", "lewat"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    filterType === type
                      ? "neu-inset text-indigo-600"
                      : "neu-button text-gray-500"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed List */}
          <div className="space-y-3">
            {filteredDetails.map((detail, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 neu-glass flex items-center gap-4 group hover:bg-white/40 transition-colors"
              >
                <div className="p-3 neu-icon-wrapper rounded-xl">
                  {getIcon(detail.reason)}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{detail.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <p className="text-xs font-medium text-gray-500">
                      {detail.reason}
                    </p>
                    {detail.bidang && (
                      <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                        {detail.bidang}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                    {detail.duration}
                  </span>
                </div>
              </motion.div>
            ))}

            {filteredDetails.length === 0 && (
              <div className="p-12 text-center text-gray-400 font-medium">
                Tiada rekod dijumpai untuk kriteria ini.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SenaraiPautan = ({
  links,
  onSave,
  onDelete,
}: {
  links: UserLink[];
  onSave: (link: UserLink) => void;
  onDelete: (id: string) => void;
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingLink, setEditingLink] = useState<UserLink | null>(null);
  const [formData, setFormData] = useState<Partial<UserLink>>({
    title: "",
    url: "",
    instructions: "",
    bidang: "Pentadbiran",
  });

  const categories = [
    "Pentadbiran",
    "Kurikulum",
    "HEM",
    "Kokurikulum",
    "Kesenian",
  ] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.url) {
      onSave({
        id: editingLink?.id || Date.now().toString(),
        title: formData.title,
        url: formData.url,
        instructions: formData.instructions || "",
        bidang: (formData.bidang as any) || "Pentadbiran",
        date: new Date().toISOString().split("T")[0],
      });
      setShowForm(false);
      setEditingLink(null);
      setFormData({
        title: "",
        url: "",
        instructions: "",
        bidang: "Pentadbiran",
      });
    }
  };

  const handleEdit = (link: UserLink) => {
    setEditingLink(link);
    setFormData(link);
    setShowForm(true);
  };

  const handleShare = (link: UserLink) => {
    const text = `*${link.title}*\n\nPautan: ${link.url}\n\nArahan: ${link.instructions}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="p-2 neu-icon-wrapper rounded-xl text-indigo-500">
            <ClipboardList size={20} />
          </div>
          Senarai Pautan/Link
        </h2>
        <button
          onClick={() => {
            setEditingLink(null);
            setFormData({
              title: "",
              url: "",
              instructions: "",
              bidang: "Pentadbiran",
            });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-6 py-3 neu-icon-wrapper text-indigo-600 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={20} /> Tambah Pautan
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="neu-glass p-8"
        >
          <h3 className="text-lg font-bold mb-6 text-gray-800">
            {editingLink ? "Edit Pautan" : "Tambah Pautan Baru"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                  Tajuk
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Contoh: Pengisian Google Form..."
                  className="w-full px-5 py-3 neu-input text-gray-800 font-medium"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                  Pautan/Link
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-5 py-3 neu-input text-gray-800 font-medium"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                  Arahan
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  placeholder="Masukkan arahan atau nota di sini..."
                  className="w-full px-5 py-3 neu-input text-gray-800 font-medium min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                  Bidang
                </label>
                <select
                  value={formData.bidang}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bidang: e.target.value as any,
                    })
                  }
                  className="w-full px-5 py-3 neu-input text-gray-800 font-medium bg-transparent"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 neu-button text-gray-500 font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-8 py-3 neu-icon-wrapper text-indigo-600 rounded-xl font-bold"
              >
                Simpan
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-10">
        {categories.map((cat) => {
          const filteredLinks = links.filter((l) => l.bidang === cat);
          if (filteredLinks.length === 0) return null;

          return (
            <div key={cat} className="space-y-4">
              <h3 className="text-lg font-bold text-indigo-600 px-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                {cat}
              </h3>
              <div className="neu-glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/40">
                        <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                          Tajuk & Arahan
                        </th>
                        <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                          Pautan
                        </th>
                        <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">
                          Tindakan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((link) => (
                        <tr
                          key={link.id}
                          className="border-b border-white/20 hover:bg-white/30 transition-colors"
                        >
                          <td className="p-5 max-w-md">
                            <div className="space-y-1">
                              <p className="font-bold text-gray-800">
                                {link.title}
                              </p>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                {link.instructions}
                              </p>
                            </div>
                          </td>
                          <td className="p-5">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline text-sm font-medium flex items-center gap-1"
                            >
                              Buka Pautan <ExternalLink size={14} />
                            </a>
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => handleShare(link)}
                                className="p-2 text-green-500 hover:text-green-700 neu-button"
                                title="Kongsi ke WhatsApp"
                              >
                                <Share2 size={16} />
                              </button>
                              <button
                                onClick={() => handleEdit(link)}
                                className="p-2 text-indigo-500 hover:text-indigo-700 neu-button"
                                title="Edit"
                              >
                                <Plus size={16} className="rotate-45" />
                              </button>
                              <button
                                onClick={() => onDelete(link.id)}
                                className="p-2 text-red-500 hover:text-red-700 neu-button"
                                title="Padam"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
        {links.length === 0 && (
          <div className="p-16 text-center neu-glass">
            <div className="flex justify-center mb-4">
              <div className="p-4 neu-icon-wrapper text-gray-300 rounded-2xl">
                <ClipboardList size={48} />
              </div>
            </div>
            <p className="text-gray-500 font-medium">
              Tiada pautan disenaraikan. Sila tambah pautan baru.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const dayName = days[time.getDay()];

  const dateStr = time.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="text-left">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
        {dayName}, {dateStr}
      </p>
      <p className="text-lg font-black text-slate-800 tabular-nums leading-none tracking-tight">
        {timeStr}
      </p>
    </div>
  );
};

const TeacherAvatar = ({ src, alt }: { src?: string; alt: string }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className="p-3 bg-violet-50 rounded-xl text-violet-600 w-12 h-12 flex items-center justify-center shrink-0">
        <User size={20} />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
      />
    </div>
  );
};

const WargaSSEMJModal = ({
  teachers,
  onClose,
}: {
  teachers: Teacher[];
  onClose: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="neu-glass-panel w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/20 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 neu-icon-wrapper rounded-xl text-violet-600">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Warga SSEMJ
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Senarai Guru dan Kakitangan
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 neu-button text-slate-500 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 flex-1">
          {teachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Users size={48} className="mb-4 opacity-20" />
              <p>Tiada data guru dijumpai.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teachers.map((teacher, index) => (
                <div
                  key={index}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between">
                    <TeacherAvatar src={teacher.image} alt={teacher.name} />
                    {teacher.grade && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        {teacher.grade}
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h3 
                      className={`font-bold text-slate-800 ${
                        teacher.name.length > 30 
                          ? 'text-[10px] leading-tight' 
                          : teacher.name.length > 20 
                            ? 'text-xs leading-tight' 
                            : 'text-sm'
                      }`} 
                      title={teacher.name}
                    >
                      {teacher.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide line-clamp-1">
                      {teacher.bidang}
                    </p>
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-50 space-y-2">
                    {teacher.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 overflow-hidden">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate" title={teacher.email}>{teacher.email}</span>
                      </div>
                    )}
                    {teacher.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{teacher.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Calendar = ({ events }: { events: TakwimEvent[] }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); // Default to Today
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }); // Default to Today's local date string

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Padding for previous month
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  // Days of current month
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Calendar Grid */}
        <div className="flex-1 neu-glass p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-800">
              {monthNames[month]} {year}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const today = new Date();
                  const offset = today.getTimezoneOffset() * 60000;
                  const localDate = new Date(today.getTime() - offset).toISOString().slice(0, 10);
                  setCurrentDate(today);
                  setSelectedDate(localDate);
                }} 
                className="px-3 py-2 neu-button text-indigo-600 text-[10px] font-bold uppercase tracking-wider"
              >
                Hari Ini
              </button>
              <button onClick={prevMonth} className="p-2 neu-button text-slate-600">
                <ArrowLeft size={18} />
              </button>
              <button onClick={nextMonth} className="p-2 neu-button text-slate-600">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {["Ahd", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-12 md:h-20" />;
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(day);
              const isSelected = selectedDate === dateStr;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`
                    h-12 md:h-20 p-1 md:p-2 rounded-xl border transition-all flex flex-col items-start relative group
                    ${isSelected ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}
                    ${isToday ? 'bg-amber-50/30 border-amber-200' : ''}
                  `}
                >
                  <span className={`text-xs md:text-sm font-bold ${isToday ? 'text-amber-600' : 'text-slate-700'}`}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1 overflow-hidden">
                    {dayEvents.map((e, i) => (
                      <div 
                        key={i} 
                        className={`
                          w-1.5 h-1.5 md:w-2 md:h-2 rounded-full
                          ${e.type === 'Cuti' ? 'bg-red-500' : e.type === 'Program' ? 'bg-indigo-500' : e.type === 'Peperiksaan' ? 'bg-amber-500' : 'bg-slate-400'}
                        `}
                        title={e.title}
                      />
                    ))}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="absolute top-1 right-1 hidden md:block">
                       <Sparkles size={10} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Event Details */}
        <div className="w-full md:w-80 space-y-4">
          <div className="neu-glass p-6 h-full">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <CalendarCheck size={16} className="text-indigo-500" />
              Acara {selectedDate ? formatDate(selectedDate) : 'Pilih Tarikh'}
            </h4>

            <div className="space-y-4">
              {selectedEvents.length > 0 ? (
                selectedEvents.map((e, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i}
                    className="p-4 neu-inset rounded-2xl border-l-4 border-l-indigo-500"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        e.type === 'Cuti' ? 'bg-red-50 text-red-600' : 
                        e.type === 'Program' ? 'bg-indigo-50 text-indigo-600' : 
                        e.type === 'Peperiksaan' ? 'bg-amber-50 text-amber-600' : 
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {e.type}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-800 text-sm">{e.title}</h5>
                    {e.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{e.description}</p>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 neu-inset rounded-full text-slate-300 mb-4">
                    <CalendarCheck size={32} />
                  </div>
                  <p className="text-slate-400 text-xs font-medium">
                    {selectedDate ? 'Tiada acara dijadualkan.' : 'Sila pilih tarikh pada kalendar untuk melihat acara.'}
                  </p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-2">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Petunjuk</h5>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Cuti Sekolah/Umum
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full bg-indigo-500" /> Program Sekolah
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Peperiksaan
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({
  links,
  isLoadingLinks,
  linksError,
  announcements,
  stats,
  attendance,
  onOpenApp,
  teachersError,
  onOpenWarga,
  takwimEvents,
  refreshTakwim,
}: {
  links: WebLink[];
  isLoadingLinks: boolean;
  linksError: string;
  announcements: Announcement[];
  stats: Stat;
  attendance: Attendance;
  onOpenApp: (link: WebLink) => void;
  teachersError: string;
  onOpenWarga: () => void;
  takwimEvents: TakwimEvent[];
  refreshTakwim: () => void;
}) => {
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const chartData = [
    { name: "Hadir", value: attendance.present, color: "#10b981" },
    { name: "Tiada", value: attendance.absent, color: "#ef4444" },
  ];

  return (
    <div className="space-y-10">
      <AnimatePresence>
        {showAttendanceModal && (
          <AttendanceDetailsModal
            attendance={attendance}
            onClose={() => setShowAttendanceModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative w-full p-8 rounded-3xl bg-gradient-to-r from-violet-500 to-purple-500 text-white overflow-hidden shadow-lg mb-8">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">Selamat Datang, Cikgu!</h1>
          <p className="text-purple-100 text-sm leading-relaxed max-w-md mb-6">
            Sistem Pengurusan Sekolah S1STEN. Akses pautan pantas, semak keberadaan guru, dan lihat makluman terkini dalam satu paparan.
          </p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenWarga}
            className="px-6 py-2 bg-white text-violet-600 rounded-xl text-sm font-bold shadow-md hover:bg-purple-50 transition-colors"
          >
            Jom kenali warga SSEMJ
          </motion.button>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute right-20 -bottom-10 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl"></div>
        
        {/* 3D-like Icon Placeholder */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center w-32 h-32 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl rotate-6 transform hover:rotate-0 transition-transform duration-500">
           <BookOpen size={48} className="text-white drop-shadow-md" />
        </div>
      </div>

      {/* Takwim Sekolah 2026 Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 neu-icon-wrapper rounded-xl text-indigo-500">
              <CalendarCheck size={20} />
            </div>
            Takwim Sekolah 2026
          </h2>
          <div className="flex items-center gap-2">
             <button 
               onClick={refreshTakwim}
               className="p-2 bg-white text-indigo-600 rounded-xl border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors flex items-center justify-center"
               title="Muat Semula Takwim"
             >
               <RefreshCw size={16} />
             </button>
             <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100 uppercase tracking-wider hidden sm:inline-block">
               {takwimEvents.length} Acara Dijadualkan
             </span>
          </div>
        </div>
        <Calendar events={takwimEvents} />
      </div>

      {/* Upcoming Events List */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          Aktiviti Akan Datang
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {takwimEvents
            .filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 6)
            .map((event) => (
              <motion.div
                key={event.id}
                whileHover={{ y: -2 }}
                className="p-5 neu-glass border-l-4 border-l-indigo-500 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                    {formatDate(event.date)}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    event.type === 'Cuti' ? 'bg-red-50 text-red-600' : 
                    event.type === 'Program' ? 'bg-indigo-50 text-indigo-600' : 
                    event.type === 'Peperiksaan' ? 'bg-amber-50 text-amber-600' : 
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {event.type}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm line-clamp-2">{event.title}</h4>
                {event.description && (
                  <p className="text-[10px] text-slate-500 mt-1 italic">{event.description}</p>
                )}
              </motion.div>
            ))}
          {takwimEvents.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0))).length === 0 && (
            <div className="col-span-full p-8 text-center neu-inset rounded-2xl text-slate-400 text-sm italic">
              Tiada aktiviti akan datang dijadualkan.
            </div>
          )}
        </div>
      </div>

      {/* Apps Grid Section */}
      <div className="space-y-6">
        {linksError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            {linksError}
          </div>
        )}

        {isLoadingLinks ? (
          <div className="flex flex-col items-center justify-center p-16 neu-glass rounded-2xl border border-white/20 shadow-sm">
            <RefreshCw
              className="animate-spin text-blue-500 mb-4"
              size={32}
            />
            <p className="text-slate-500 font-medium">Memuat turun pautan...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 auto-rows-fr grid-flow-dense">
            {links.map((link) => {
               const isProminent = link.title.toLowerCase().includes('smart rph') || link.title.toLowerCase().includes('e-opr');
               return (
              <motion.div
                key={link.id}
                onClick={() => onOpenApp(link)}
                whileHover={{ y: -4 }}
                className={`
                  bg-white rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all flex items-center justify-center group cursor-pointer relative overflow-hidden border border-slate-100
                  ${isProminent ? 'col-span-2 row-span-1 p-6 min-h-[160px] flex-row gap-6 text-left' : 'flex-col p-6 min-h-[160px] text-center'}
                `}
              >
                {/* Direct New Tab Shortcut Button */}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Buka di tab baharu (disyorkan untuk cetakan & muat turun fail PDF)"
                  className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-50 hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors z-10 opacity-70 group-hover:opacity-100 shadow-xs"
                >
                  <ExternalLink size={16} />
                </a>

                <div className={`
                  rounded-2xl flex items-center justify-center text-violet-600 transition-transform duration-300 group-hover:scale-110 bg-violet-50 shrink-0 shadow-inner
                  ${isProminent ? 'w-20 h-20 mb-0' : 'w-16 h-16 mb-4'}
                `}>
                  {link.iconUrl ? (
                    <img
                      src={getDirectImageUrl(link.iconUrl)}
                      alt={link.title}
                      className="w-full h-full object-contain p-3"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : (
                    <ExternalLink size={isProminent ? 32 : 24} />
                  )}
                  <ExternalLink
                    size={isProminent ? 32 : 24}
                    className={link.iconUrl ? "hidden" : ""}
                  />
                </div>
                <div className={isProminent ? "flex-1 min-w-0" : ""}>
                  <span className={`font-bold text-slate-800 line-clamp-2 group-hover:text-violet-600 transition-colors ${isProminent ? 'text-xl tracking-tight' : 'text-sm'}`}>
                    {link.title}
                  </span>
                  {isProminent && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      Klik untuk buka aplikasi
                    </p>
                  )}
                </div>
              </motion.div>
            )})}

            {links.length === 0 && !linksError && (
              <div className="col-span-full p-10 text-center text-slate-500 neu-glass rounded-2xl border border-white/40">
                Tiada pautan aplikasi dijumpai.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Displays */}
      {teachersError && (
        <div className="p-5 bg-red-50 text-red-700 rounded-2xl text-sm neu-inset border border-red-100">
          <p className="font-bold mb-2">Ralat Memuat Turun Data Guru:</p>
          <p>{teachersError}</p>
        </div>
      )}



      {/* Keberadaan Table Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 neu-icon-wrapper rounded-xl text-teal-500">
              <CalendarCheck size={20} />
            </div>
            Keberadaan Guru ({formatDate(attendance.date)})
          </h2>
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
          >
            Lihat Perincian Penuh <ChevronRight size={14} />
          </button>
        </div>

        <div className="neu-glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/40">
                  <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Nama Guru
                  </th>
                  <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Sebab / Status
                  </th>
                  <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Tempoh
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendance.absentDetails && attendance.absentDetails.length > 0 ? (
                  attendance.absentDetails.slice(0, 5).map((detail, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-white/20 hover:bg-white/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-sm">
                            {detail.name}
                          </span>
                          {detail.bidang && (
                            <span className="text-[10px] font-medium text-gray-400">
                              {detail.bidang}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                          {detail.reason}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-500">
                          {detail.duration}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-8 text-center text-green-600 font-bold text-sm"
                    >
                      Semua guru hadir bertugas hari ini.
                    </td>
                  </tr>
                )}
                {attendance.absentDetails && attendance.absentDetails.length > 5 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-3 text-center bg-gray-50/50"
                    >
                      <button
                        onClick={() => setShowAttendanceModal(true)}
                        className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest hover:text-indigo-700"
                      >
                        + {attendance.absentDetails.length - 5} lagi... Klik untuk lihat semua
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {/* Announcements Section - Landscape Layout */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 neu-icon-wrapper rounded-xl text-amber-500">
                <Bell size={20} />
              </div>
              Makluman Terkini
            </h2>
          </div>

          <div className="neu-glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/40">
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] w-32">
                      Tarikh
                    </th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] w-1/4">
                      Tajuk
                    </th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      Kandungan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.length > 0 ? (
                    announcements.map((ann) => (
                      <tr
                        key={ann.id}
                        className="border-b border-white/20 hover:bg-white/40 transition-colors"
                      >
                        <td className="p-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 neu-icon-wrapper rounded-full text-indigo-600 whitespace-nowrap">
                            {formatDate(ann.date)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-800 text-sm">
                            {ann.title}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-600 leading-relaxed">
                            {ann.content}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-gray-500 font-medium text-sm"
                      >
                        Tiada makluman terkini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PengurusanPanitia = ({
  files,
  setFiles,
}: {
  files: PanitiaFile[];
  setFiles: (files: PanitiaFile[]) => void;
}) => {
  const handleUpload = () => {
    const newFile = {
      id: Date.now().toString(),
      name: `Bahan_Baru_${Math.floor(Math.random() * 100)}.pdf`,
      type: "pdf",
      size: "1.2 MB",
      date: new Date().toISOString().split("T")[0],
      uploader: "Guru SSEMJ",
    };
    setFiles([newFile, ...files]);
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="p-2 neu-icon-wrapper rounded-xl text-indigo-500">
            <FolderOpen size={20} />
          </div>
          Pengurusan Panitia
        </h2>
        <button
          onClick={handleUpload}
          className="flex items-center gap-2 px-6 py-3 neu-icon-wrapper text-indigo-600 rounded-xl font-bold transition-all hover:scale-105 active:scale-95"
        >
          <Upload size={20} /> Muat Naik Bahan
        </button>
      </div>

      <div className="neu-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-white/40">
                <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                  Nama Fail
                </th>
                <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                  Saiz
                </th>
                <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                  Tarikh
                </th>
                <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs">
                  Dimuat Naik Oleh
                </th>
                <th className="p-5 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="border-b border-white/20 hover:bg-white/30 transition-colors"
                >
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 neu-inset text-red-500 rounded-xl">
                        <FileText size={20} />
                      </div>
                      <span className="font-semibold text-gray-700">
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-5 text-gray-600 text-sm font-medium">
                    {file.size}
                  </td>
                  <td className="p-5 text-gray-600 text-sm font-medium">
                    {formatDate(file.date)}
                  </td>
                  <td className="p-5 text-gray-600 text-sm font-medium">
                    {file.uploader}
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        className="p-2 text-indigo-500 hover:text-indigo-700 neu-button"
                        title="Muat Turun"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="p-2 text-teal-500 hover:text-teal-700 neu-button"
                        title="Kongsi"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-2 text-red-500 hover:text-red-700 neu-button"
                        title="Padam"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-gray-500 font-medium"
                  >
                    Tiada bahan dimuat naik.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminPanel = ({
  links,
  setLinks,
  announcements,
  setAnnouncements,
  stats,
  setStats,
  attendance,
  setAttendance,
  refreshLinks,
  saveAnnouncements,
  saveStats,
  takwimEvents,
  saveTakwim,
}: {
  links: WebLink[];
  setLinks: (l: WebLink[]) => void;
  announcements: Announcement[];
  setAnnouncements: (a: Announcement[]) => void;
  stats: Stat;
  setStats: (s: Stat) => void;
  attendance: Attendance;
  setAttendance: (a: Attendance) => void;
  refreshLinks: () => void;
  saveAnnouncements: (a: Announcement[]) => void;
  saveStats: (s: number) => void;
  takwimEvents: TakwimEvent[];
  saveTakwim: (e: TakwimEvent[]) => void;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "dzurri") {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Kata laluan salah");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="neu-glass p-10 w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <div className="p-5 neu-icon-wrapper text-indigo-500 rounded-2xl">
              <Lock size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Log Masuk Admin
          </h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Laluan"
                className="w-full px-5 py-4 neu-input text-gray-800 placeholder-gray-400 font-medium"
              />
              {error && (
                <p className="text-red-500 text-sm mt-3 px-2 font-medium">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-4 neu-icon-wrapper text-indigo-600 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Log Masuk
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="space-y-10">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="p-2 neu-icon-wrapper rounded-xl text-indigo-500">
            <Settings size={20} />
          </div>
          Panel Pentadbir
        </h2>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="flex items-center gap-2 px-5 py-2.5 text-red-500 neu-button font-bold"
        >
          <LogOut size={18} /> Log Keluar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Manage Takwim 2026 */}
        <div className="neu-glass p-8 space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CalendarCheck size={20} className="text-indigo-500" />
              Urus Takwim Sekolah 2026
            </h3>
            <div className="flex gap-3">
               {showConfirmDelete ? (
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-red-600 uppercase">Pasti?</span>
                   <button
                     onClick={() => {
                       saveTakwim([]);
                       setShowConfirmDelete(false);
                     }}
                     className="p-2 px-4 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
                   >
                     Ya, Padam Semua
                   </button>
                   <button
                     onClick={() => setShowConfirmDelete(false)}
                     className="p-2 px-4 neu-button text-gray-500 text-xs font-bold"
                   >
                     Batal
                   </button>
                 </div>
               ) : (
                 <button
                   onClick={() => setShowConfirmDelete(true)}
                   className="flex items-center gap-2 p-2 px-4 neu-button text-red-500 text-sm font-bold"
                 >
                   <Trash2 size={16} /> Padam Semua
                 </button>
               )}
            </div>
          </div>
          
          <div className="p-6 neu-inset rounded-2xl bg-indigo-50/30 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <p className="font-bold text-indigo-900 mb-1">Muat Naik Fail CSV Takwim</p>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Muat naik fail CSV dengan format: <b>Tarikh (YYYY-MM-DD), Tajuk, Jenis (Cuti/Program/Peperiksaan/Lain-lain), Deskripsi</b>.
                Sistem akan memproses data dan memaparkannya di kalendar Utama.
              </p>
            </div>
            <div className="shrink-0">
              <label className="flex items-center gap-2 px-6 py-3 neu-icon-wrapper text-indigo-600 rounded-xl font-bold cursor-pointer hover:scale-105 transition-transform">
                <Upload size={20} />
                <span>Pilih Fail CSV</span>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      Papa.parse(file, {
                        header: false,
                        skipEmptyLines: true,
                        complete: (results) => {
                          if (!results.data || results.data.length === 0) {
                            alert("Fail CSV kosong atau tidak dapat dibaca.");
                            return;
                          }

                          let rows = results.data as string[][];
                          
                          // If PapaParse failed to split columns (only 1 column found), try manual split by tab or semicolon
                          if (rows.length > 0 && rows[0].length === 1) {
                            if (rows[0][0].includes('\t')) {
                              rows = rows.map(r => r[0].split('\t'));
                            } else if (rows[0][0].includes(';')) {
                              rows = rows.map(r => r[0].split(';'));
                            }
                          }

                          // Find the header row (the one containing 'tarikh' or 'date')
                          let headerIdx = -1;
                          for (let i = 0; i < Math.min(rows.length, 50); i++) {
                            const row = rows[i].map(c => String(c).toLowerCase().trim());
                            if (row.some(c => c === 'tarikh' || c === 'date' || c.includes('tarikh') || c.includes('tkh'))) {
                              headerIdx = i;
                              break;
                            }
                          }

                          if (headerIdx === -1) {
                            // Fallback: if no header found, assume row 0 if it looks like it has dates
                            headerIdx = 0;
                          }

                          // Normalize headers: remove non-alphanumeric characters for better matching
                          const normalize = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                          const headers = rows[headerIdx].map(h => normalize(h));
                          const dataRows = rows.slice(headerIdx + 1);

                          const parsedEvents: TakwimEvent[] = [];
                          
                          dataRows.forEach((row, rowIdx) => {
                            const dateIdx = headers.findIndex(h => h.includes('tarikh') || h.includes('date'));
                            if (dateIdx === -1 || !row[dateIdx]) return;
                            
                            const rawDate = String(row[dateIdx]).trim();
                            if (!rawDate || rawDate === "" || rawDate === "-") return;

                            const isoDate = parseDateToISO(rawDate);
                            if (!isoDate) return;

                            // Specific columns to check for events
                            const deptColumns = [
                              { keywords: ['pengurusan', 'pentadbiran', 'admin'], label: 'Pengurusan', type: 'Lain-lain' },
                              { keywords: ['kurikulum', 'akademik', 'akdmk'], label: 'Kurikulum', type: 'Program' },
                              { keywords: ['hem', 'hal ehwal murid'], label: 'HEM', type: 'Program' },
                              { keywords: ['kokurikulum', 'koko', 'sukan', 'ko-ku'], label: 'Kokurikulum', type: 'Program' },
                              { keywords: ['kesenian', 'seni'], label: 'Kesenian', type: 'Program' },
                              { keywords: ['aktiviti', 'perkara', 'acara', 'tajuk', 'program', 'keterangan', 'peristiwa', 'catatan'], label: 'Umum', type: 'Program' }
                            ];

                            deptColumns.forEach(dept => {
                              const colIdx = headers.findIndex(h => dept.keywords.some(kw => h.includes(normalize(kw))));
                              if (colIdx !== -1 && row[colIdx]) {
                                const content = String(row[colIdx]).trim();
                                
                                // Skip if empty or just a dash or "tiada"
                                if (!content || content === "" || content === "-" || content.toLowerCase() === "tiada" || content.toLowerCase() === "n/a") return;

                                // Determine type based on content keywords
                                let finalType = dept.type;
                                const lowerContent = content.toLowerCase();
                                if (lowerContent.includes("cuti") || lowerContent.includes("perayaan") || lowerContent.includes("holiday")) finalType = "Cuti";
                                else if (lowerContent.includes("peperiksaan") || lowerContent.includes("ujian") || lowerContent.includes("assessment") || lowerContent.includes("pentaksiran") || lowerContent.includes("exam")) finalType = "Peperiksaan";
                                else if (lowerContent.includes("mesyuarat") || lowerContent.includes("taklimat") || lowerContent.includes("ladap") || lowerContent.includes("bengkel")) finalType = "Lain-lain";

                                // Avoid duplicates if multiple columns match the same content for the same date
                                const isDuplicate = parsedEvents.some(e => e.date === isoDate && e.title === content);
                                if (!isDuplicate) {
                                  parsedEvents.push({
                                    id: `csv-${Date.now()}-${rowIdx}-${dept.label}-${Math.random().toString(36).substr(2, 5)}`,
                                    title: content,
                                    date: isoDate,
                                    type: finalType as any,
                                    description: `Jabatan: ${dept.label}`
                                  });
                                }
                              }
                            });
                          });
                          
                          if (parsedEvents.length > 0) {
                            saveTakwim([...takwimEvents, ...parsedEvents]);
                            alert(`Berjaya memuat naik ${parsedEvents.length} acara.`);
                          } else {
                            alert("Tiada data acara sah dijumpai. Sila pastikan fail CSV mempunyai kolum 'Tarikh' dan kolum aktiviti (seperti Pengurusan, Kurikulum, HEM, Kokurikulum atau Aktiviti).");
                          }
                          
                          // Reset file input so the same file can be uploaded again
                          if (e.target) {
                            e.target.value = '';
                          }
                        },
                        error: (err) => {
                          alert(`Ralat memproses CSV: ${err.message}`);
                        }
                      });
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-white/40">
                  <th className="p-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Tarikh</th>
                  <th className="p-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Tajuk</th>
                  <th className="p-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Jenis</th>
                  <th className="p-4 font-bold text-gray-500 uppercase tracking-wider text-[10px] text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {takwimEvents.length > 0 ? (
                  [...takwimEvents].sort((a,b) => a.date.localeCompare(b.date)).map((event) => (
                    <tr key={event.id} className="border-b border-white/20 hover:bg-white/30 transition-colors">
                      <td className="p-4 text-xs font-medium text-gray-600">{formatDate(event.date)}</td>
                      <td className="p-4 text-xs font-bold text-gray-800">{event.title}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          event.type === 'Cuti' ? 'bg-red-50 text-red-600' : 
                          event.type === 'Program' ? 'bg-indigo-50 text-indigo-600' : 
                          event.type === 'Peperiksaan' ? 'bg-amber-50 text-amber-600' : 
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => saveTakwim(takwimEvents.filter(e => e.id !== event.id))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 text-sm italic">
                      Tiada data takwim. Sila muat naik fail CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manage Links */}
        <div className="neu-glass p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">
              Urus APLIKASI DIGITAL UNTUK WARGA SSEMJ
            </h3>
            <button
              onClick={refreshLinks}
              className="flex items-center gap-2 p-2 px-4 neu-button text-indigo-600 text-sm font-bold"
            >
              <RefreshCw size={16} /> Segar Semula
            </button>
          </div>
          <div className="p-5 neu-inset rounded-2xl text-sm text-indigo-800 bg-indigo-50/30">
            <p className="font-bold mb-2">Nota Penting:</p>
            <p className="leading-relaxed">
              Pautan kini diuruskan sepenuhnya melalui Google Sheet. Sila kemas
              kini data di dalam Google Sheet anda. Aplikasi ini akan memuat
              turun data secara automatik.
            </p>
            <a
              href={GOOGLE_SHEET_CSV_URL_LINKS.replace(
                "/export?format=csv&gid=0",
                "/edit",
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
            >
              Buka Google Sheet <ExternalLink size={16} />
            </a>
          </div>
          <div className="space-y-4 opacity-70 pointer-events-none">
            {links.map((link, index) => (
              <div
                key={link.id}
                className="flex flex-col gap-3 neu-inset p-5 rounded-2xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
                      Tajuk Aplikasi
                    </label>
                    <input
                      value={link.title}
                      readOnly
                      className="w-full px-4 py-2.5 neu-input text-sm mt-2 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
                      Pautan URL
                    </label>
                    <input
                      value={link.url}
                      readOnly
                      className="w-full px-4 py-2.5 neu-input text-sm mt-2 font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
                      URL Logo / Ikon
                    </label>
                    <input
                      value={link.iconUrl || ""}
                      readOnly
                      className="w-full px-4 py-2.5 neu-input text-sm mt-2 font-medium"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage Stats & Attendance */}
        <div className="space-y-10">
          <div className="neu-glass p-8 space-y-6">
            <h3 className="text-lg font-bold text-gray-800">
              Statistik Semasa
            </h3>
            <div className="p-5 neu-inset rounded-2xl text-sm text-teal-800 bg-teal-50/30">
              <p className="font-bold mb-2">Nota:</p>
              <p className="leading-relaxed">
                Jumlah guru kini diselaraskan secara automatik dari Google Sheet
                senarai nama guru.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Guru (Auto)
                </label>
                <input
                  type="number"
                  value={stats.teachers}
                  readOnly
                  className="w-full px-5 py-3 neu-input font-bold text-lg opacity-70"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Murid
                </label>
                <input
                  type="number"
                  value={stats.students}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setStats({
                      ...stats,
                      students: val,
                    });
                    saveStats(val);
                  }}
                  className="w-full px-5 py-3 neu-input font-bold text-lg"
                />
              </div>
            </div>
          </div>

          <div className="neu-glass p-8 space-y-6">
            <h3 className="text-lg font-bold text-gray-800">Keberadaan Guru</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mb-2">
                  Hadir
                </label>
                <input
                  type="number"
                  value={attendance.present}
                  onChange={(e) =>
                    setAttendance({
                      ...attendance,
                      present: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-5 py-3 neu-input font-bold text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mb-2">
                  Cuti / Tidak Hadir
                </label>
                <input
                  type="number"
                  value={attendance.absent}
                  onChange={(e) =>
                    setAttendance({
                      ...attendance,
                      absent: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-5 py-3 neu-input font-bold text-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Keseluruhan (Auto)
                </label>
                <input
                  type="number"
                  value={attendance.total}
                  readOnly
                  className="w-full px-5 py-3 neu-input font-bold text-lg opacity-70"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Manage Announcements */}
        <div className="neu-glass p-8 space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Urus Makluman</h3>
            <button
              onClick={() => {
                const newAnns = [
                  {
                    id: Date.now().toString(),
                    title: "Makluman Baru",
                    date: new Date().toISOString().split("T")[0],
                    content: "",
                  },
                  ...announcements,
                ];
                setAnnouncements(newAnns);
                saveAnnouncements(newAnns);
              }}
              className="p-3 neu-button text-indigo-600"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-6">
            {announcements.map((ann, index) => (
              <div
                key={ann.id}
                className="neu-inset p-6 rounded-3xl space-y-4 relative"
              >
                <button
                  onClick={() => {
                    const newAnns = announcements.filter((a) => a.id !== ann.id);
                    setAnnouncements(newAnns);
                    saveAnnouncements(newAnns);
                  }}
                  className="absolute top-6 right-6 p-2 text-red-500 hover:text-red-700 neu-button"
                >
                  <Trash2 size={16} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12">
                  <input
                    value={ann.title}
                    onChange={(e) => {
                      const newAnns = [...announcements];
                      newAnns[index].title = e.target.value;
                      setAnnouncements(newAnns);
                      saveAnnouncements(newAnns);
                    }}
                    className="w-full px-4 py-3 neu-input font-bold"
                    placeholder="Tajuk Makluman"
                  />
                  <input
                    type="date"
                    value={ann.date}
                    onChange={(e) => {
                      const newAnns = [...announcements];
                      newAnns[index].date = e.target.value;
                      setAnnouncements(newAnns);
                      saveAnnouncements(newAnns);
                    }}
                    className="w-full px-4 py-3 neu-input font-medium text-gray-600"
                  />
                </div>
                <textarea
                  value={ann.content}
                  onChange={(e) => {
                    const newAnns = [...announcements];
                    newAnns[index].content = e.target.value;
                    setAnnouncements(newAnns);
                    saveAnnouncements(newAnns);
                  }}
                  className="w-full px-4 py-3 neu-input min-h-[100px] font-medium text-gray-600 leading-relaxed"
                  placeholder="Kandungan makluman..."
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KeberadaanForm = ({ teachers, attendance }: { teachers: Teacher[], attendance: Attendance }) => {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [bidang, setBidang] = useState("");
  const [sebab, setSebab] = useState("");
  const [sebabProgram, setSebabProgram] = useState("");

  const [tempoh, setTempoh] = useState("sehari");
  const [tarikhMula, setTarikhMula] = useState("");
  const [tarikhTamat, setTarikhTamat] = useState("");

  const [masaMula, setMasaMula] = useState("");
  const [masaTamat, setMasaTamat] = useState("");
  const [tujuanKeluar, setTujuanKeluar] = useState("");

  const [lewat, setLewat] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedTeacher(name);
    const teacher = teachers.find((t) => t.name === name);
    setBidang(teacher ? teacher.bidang : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Get local date string for fallback
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const todayStr = new Date(today.getTime() - offset)
      .toISOString()
      .slice(0, 10);

    const payload = {
      nama: selectedTeacher,
      bidang: bidang,
      sebab: sebab,
      program: sebabProgram,
      tempoh: tempoh,
      tarikhMula: tarikhMula || todayStr,
      tarikhTamat: tarikhTamat || todayStr,
      masaMula: masaMula,
      masaTamat: masaTamat,
      tujuan: tujuanKeluar,
      lewat: lewat,
    };

    const GAS_URL =
      "https://script.google.com/macros/s/AKfycbwRCh28Sanh3iQ8QStluKGDC_FnIjhc_4cfB7xfFdoz-z0zJ7oZkQV-grYN5qJY_Hu47A/exec";

    if (GAS_URL) {
      try {
        await fetch(GAS_URL, {
          method: "POST",
          mode: "no-cors", // Required to avoid CORS issues with simple GAS deployments
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    } else {
      console.log("Simulasi hantaran (GAS URL tidak ditetapkan):", payload);
    }

    setIsSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setSelectedTeacher("");
      setBidang("");
      setSebab("");
      setSebabProgram("");
      setTempoh("sehari");
      setTarikhMula("");
      setTarikhTamat("");
      setMasaMula("");
      setMasaTamat("");
      setTujuanKeluar("");
      setLewat("");
    }, 3000);
  };

  return (
    <div className="space-y-8">
      {/* Statistics Table */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 neu-icon-wrapper rounded-xl text-violet-600">
            <BarChart3 size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Statistik Kehadiran Guru</h3>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 font-bold">Kategori</th>
                <th scope="col" className="px-6 py-3 text-center font-bold">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white border-b hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">Jumlah Guru</td>
                <td className="px-6 py-4 text-center font-bold">{attendance.total}</td>
              </tr>
              <tr className="bg-white border-b hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-emerald-600 whitespace-nowrap flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Hadir
                </td>
                <td className="px-6 py-4 text-center font-bold text-emerald-600">{attendance.present}</td>
              </tr>
              <tr className="bg-white hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-rose-600 whitespace-nowrap flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  Tidak Hadir / Urusan Luar
                </td>
                <td className="px-6 py-4 text-center font-bold text-rose-600">{attendance.absent}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 neu-icon-wrapper rounded-xl text-teal-500">
          <ClipboardList size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          Borang Keberadaan Guru
        </h2>
      </div>

      <div className="neu-glass p-8 max-w-3xl">
        <div className="mb-8 p-4 bg-teal-50 text-teal-800 rounded-xl text-sm border border-teal-100 neu-inset">
          <p className="font-bold mb-1">Makluman:</p>
          <p>
            Borang ini membolehkan guru memaklumkan ketidakhadiran, kelewatan,
            atau urusan luar. Data akan direkodkan untuk rujukan pentadbir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              1. Nama Guru
            </label>
            <select
              value={selectedTeacher}
              onChange={handleTeacherChange}
              required
              className="w-full px-4 py-3 neu-input font-medium text-gray-700"
            >
              <option value="">-- Pilih Nama Guru --</option>
              {teachers.map((t, i) => (
                <option key={i} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Bidang / Jabatan (Kesan Automatik)
            </label>
            <input
              type="text"
              value={bidang}
              readOnly
              placeholder="Akan diisi secara automatik"
              className="w-full px-4 py-3 neu-input font-medium text-gray-500 bg-gray-50 opacity-70"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              2. Sebab Tidak Hadir
            </label>
            <select
              value={sebab}
              onChange={(e) => setSebab(e.target.value)}
              className="w-full px-4 py-3 neu-input font-medium text-gray-700"
            >
              <option value="">-- Pilih Sebab (Jika Berkenaan) --</option>
              <option value="CUTI SAKIT (MC)">CUTI SAKIT (MC)</option>
              <option value="CUTI REHAT KHAS (CRK)">
                CUTI REHAT KHAS (CRK)
              </option>
              <option value="PROGRAM">PROGRAM (NYATAKAN)</option>
            </select>
          </div>

          <AnimatePresence>
            {sebab === "PROGRAM" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nyatakan Program
                  </label>
                  <input
                    type="text"
                    value={sebabProgram}
                    onChange={(e) => setSebabProgram(e.target.value)}
                    required
                    placeholder="Contoh: Kursus KSSR di PPD"
                    className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tempoh Tarikh (Hanya tunjuk jika sebab dipilih) */}
          <AnimatePresence>
            {sebab && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Tempoh Tarikh
                  </label>
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tempoh"
                        value="sehari"
                        checked={tempoh === "sehari"}
                        onChange={(e) => setTempoh(e.target.value)}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Sehari Sahaja
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tempoh"
                        value="lebih"
                        checked={tempoh === "lebih"}
                        onChange={(e) => setTempoh(e.target.value)}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Lebih Dari Sehari
                      </span>
                    </label>
                  </div>

                  {tempoh === "sehari" ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        Tarikh
                      </label>
                      <input
                        type="date"
                        value={tarikhMula}
                        onChange={(e) => setTarikhMula(e.target.value)}
                        required
                        className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                          Tarikh Mula
                        </label>
                        <input
                          type="date"
                          value={tarikhMula}
                          onChange={(e) => setTarikhMula(e.target.value)}
                          required
                          className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                          Tarikh Tamat
                        </label>
                        <input
                          type="date"
                          value={tarikhTamat}
                          onChange={(e) => setTarikhTamat(e.target.value)}
                          required
                          className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-4">
              3. Mohon Kebenaran Tinggal Pejabat
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Masa Mula
                </label>
                <input
                  type="time"
                  value={masaMula}
                  onChange={(e) => setMasaMula(e.target.value)}
                  className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Masa Tamat
                </label>
                <input
                  type="time"
                  value={masaTamat}
                  onChange={(e) => setMasaTamat(e.target.value)}
                  className="w-full px-4 py-3 neu-input font-medium text-gray-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Tujuan / Urusan
              </label>
              <input
                type="text"
                value={tujuanKeluar}
                onChange={(e) => setTujuanKeluar(e.target.value)}
                placeholder="Contoh: Urusan Bank / Klinik"
                className="w-full px-4 py-3 neu-input font-medium text-gray-700"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              4. Lewat Hadir (Nyatakan)
            </label>
            <input
              type="text"
              value={lewat}
              onChange={(e) => setLewat(e.target.value)}
              placeholder="Contoh: Hantar anak ke klinik"
              className="w-full px-4 py-3 neu-input font-medium text-gray-700"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !selectedTeacher}
              className="w-full py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Menghantar..." : "Hantar Borang Keberadaan"}
            </button>
          </div>

          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-green-50 text-green-700 rounded-xl text-center font-bold border border-green-200"
              >
                Borang berjaya dihantar!
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

const SenaraiMurid = ({ students, isLoading, error, onTransfer }: { students: Student[], isLoading: boolean, error: string, onTransfer: (id: string) => void }) => {
  const [filterTingkatan, setFilterTingkatan] = useState("");
  const [filterBidang, setFilterBidang] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const uniqueTingkatan = Array.from(new Set(students.map(s => s.tingkatan).filter(Boolean))).sort();
  const uniqueBidang = Array.from(new Set(students.map(s => s.bidang).filter(Boolean))).sort();

  const filteredStudents = students.filter(s => {
    const matchTingkatan = filterTingkatan ? s.tingkatan === filterTingkatan : true;
    const matchBidang = filterBidang ? s.bidang === filterBidang : true;
    const matchSearch = searchTerm ? s.nama.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return matchTingkatan && matchBidang && matchSearch;
  });

  // Statistics
  const statsByTingkatan = students.reduce((acc, curr) => {
    if (curr.tingkatan) {
      acc[curr.tingkatan] = (acc[curr.tingkatan] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statsByTingkatan)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const names = filteredStudents.map(s => s.nama).join('\n');
    navigator.clipboard.writeText(names);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 neu-icon-wrapper rounded-xl text-blue-500">
          <Users size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          Senarai Murid
        </h2>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
          <p className="mt-2 text-xs">Sila pastikan URL Google Sheet untuk data murid telah dikonfigurasi dengan betul dalam kod (cari GOOGLE_SHEET_CSV_URL_MURID).</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="neu-glass p-6 flex flex-col justify-center items-center text-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Users size={40} />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah Keseluruhan Murid</p>
          <p className="text-5xl font-black text-slate-800">{students.length}</p>
        </div>

        <div className="lg:col-span-2 neu-glass p-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Statistik Mengikut Tingkatan</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="neu-glass p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cari Nama</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 neu-input text-sm font-medium"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filter Tingkatan</label>
            <select 
              value={filterTingkatan} 
              onChange={e => setFilterTingkatan(e.target.value)}
              className="w-full px-4 py-2.5 neu-input text-sm font-medium"
            >
              <option value="">Semua Tingkatan</option>
              {uniqueTingkatan.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filter Bidang</label>
            <select 
              value={filterBidang} 
              onChange={e => setFilterBidang(e.target.value)}
              className="w-full px-4 py-2.5 neu-input text-sm font-medium"
            >
              <option value="">Semua Bidang</option>
              {uniqueBidang.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="neu-glass overflow-hidden">
        <div className="p-4 border-b border-white/20 flex justify-between items-center bg-white/30">
          <span className="text-sm font-bold text-slate-600">Menunjukkan {filteredStudents.length} murid</span>
          <button 
            onClick={handleCopyAll}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors"
          >
            {copiedId === 'all' ? <Check size={14} /> : <Copy size={14} />}
            {copiedId === 'all' ? 'Telah Disalin!' : 'Salin Semua Nama'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/40 bg-slate-50/50">
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Bil</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Daftar Murid</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Nama</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Tingkatan</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Kad Pengenalan</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Bidang</th>
                <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Memuat turun data...
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => (
                  <tr key={index} className="border-b border-white/20 hover:bg-white/40 transition-colors">
                    <td className="p-4 text-xs font-medium text-slate-500">{index + 1}</td>
                    <td className="p-4 text-xs font-medium text-slate-600">{student.daftarMurid}</td>
                    <td className="p-4 text-sm font-bold text-slate-800">{student.nama}</td>
                    <td className="p-4 text-xs font-bold text-indigo-600">
                      <span className="bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">{student.tingkatan}</span>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-600">{student.kadPengenalan}</td>
                    <td className="p-4 text-xs font-medium text-slate-600">{student.bidang}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleCopy(student.nama, `row-${index}`)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Salin Nama"
                        >
                          {copiedId === `row-${index}` ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Adakah anda pasti ingin memindahkan murid ${student.nama}?`)) {
                              onTransfer(student.kadPengenalan);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                          title="Pindah Murid"
                        >
                          <LogOut size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                    Tiada rekod murid dijumpai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [takwimEvents, setTakwimEvents] = useState<TakwimEvent[]>([]);

  const fetchTakwim = async () => {
    try {
      const res = await fetch("/api/takwim");
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setTakwimEvents(data);
        } else {
          // If local DB is empty, try fetching from Google Sheet
          fetchTakwimFromSheet();
        }
      }
    } catch (e) {
      console.error("Failed to fetch takwim:", e);
      fetchTakwimFromSheet();
    }
  };

  const fetchTakwimFromSheet = async () => {
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL_TAKWIM_READ);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) return;

          let rows = results.data as string[][];
          
          if (rows.length > 0 && rows[0].length === 1) {
            if (rows[0][0].includes('\t')) rows = rows.map(r => r[0].split('\t'));
            else if (rows[0][0].includes(';')) rows = rows.map(r => r[0].split(';'));
          }

          let headerIdx = -1;
          for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const row = rows[i].map(c => String(c).toLowerCase().trim());
            if (row.some(c => c === 'tarikh' || c === 'date' || c.includes('tarikh') || c.includes('tkh'))) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) headerIdx = 0;

          const normalize = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          const headers = rows[headerIdx].map(h => normalize(h));
          const dataRows = rows.slice(headerIdx + 1);

          const parsedEvents: TakwimEvent[] = [];
          
          dataRows.forEach((row, rowIdx) => {
            const dateIdx = headers.findIndex(h => h.includes('tarikh') || h.includes('date'));
            if (dateIdx === -1 || !row[dateIdx]) return;
            
            const rawDate = String(row[dateIdx]).trim();
            if (!rawDate || rawDate === "" || rawDate === "-") return;

            const isoDate = parseDateToISO(rawDate);
            if (!isoDate) return;

            const deptColumns = [
              { keywords: ['pengurusan', 'pentadbiran', 'admin'], label: 'Pengurusan', type: 'Lain-lain' },
              { keywords: ['kurikulum', 'akademik', 'akdmk'], label: 'Kurikulum', type: 'Program' },
              { keywords: ['hem', 'hal ehwal murid'], label: 'HEM', type: 'Program' },
              { keywords: ['kokurikulum', 'koko', 'sukan', 'ko-ku'], label: 'Kokurikulum', type: 'Program' },
              { keywords: ['kesenian', 'seni'], label: 'Kesenian', type: 'Program' },
              { keywords: ['aktiviti', 'perkara', 'acara', 'tajuk', 'program', 'keterangan', 'peristiwa', 'catatan'], label: 'Umum', type: 'Program' }
            ];

            deptColumns.forEach(dept => {
              const colIdx = headers.findIndex(h => dept.keywords.some(kw => h.includes(normalize(kw))));
              if (colIdx !== -1 && row[colIdx]) {
                const content = String(row[colIdx]).trim();
                if (!content || content === "" || content === "-" || content.toLowerCase() === "tiada" || content.toLowerCase() === "n/a") return;

                let finalType = dept.type;
                const lowerContent = content.toLowerCase();
                if (lowerContent.includes("cuti") || lowerContent.includes("perayaan") || lowerContent.includes("holiday")) finalType = "Cuti";
                else if (lowerContent.includes("peperiksaan") || lowerContent.includes("ujian") || lowerContent.includes("assessment") || lowerContent.includes("pentaksiran") || lowerContent.includes("exam")) finalType = "Peperiksaan";
                else if (lowerContent.includes("mesyuarat") || lowerContent.includes("taklimat") || lowerContent.includes("ladap") || lowerContent.includes("bengkel")) finalType = "Lain-lain";

                const isDuplicate = parsedEvents.some(e => e.date === isoDate && e.title === content);
                if (!isDuplicate) {
                  parsedEvents.push({
                    id: `sheet-${rowIdx}-${dept.label}-${Math.random().toString(36).substr(2, 5)}`,
                    title: content,
                    date: isoDate,
                    type: finalType as any,
                    description: `Jabatan: ${dept.label}`
                  });
                }
              }
            });
          });
          
          if (parsedEvents.length > 0) {
            setTakwimEvents(parsedEvents);
          }
        }
      });
    } catch (e) {
      console.error("Error fetching takwim from sheet:", e);
    }
  };

  // Load Takwim from Server
  useEffect(() => {
    fetchTakwim();
  }, []);

  const saveTakwim = async (events: TakwimEvent[]) => {
    setTakwimEvents(events);
    try {
      // 1. Save locally to database
      await fetch("/api/takwim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      // 2. Sync to Google Sheet if script URL is provided
      if (GOOGLE_SCRIPT_URL_TAKWIM) {
        try {
          // Use text/plain to avoid CORS preflight issues with GAS
          await fetch(GOOGLE_SCRIPT_URL_TAKWIM, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ events }),
          });
          console.log("Takwim sync request sent to Google Sheet");
        } catch (sheetError) {
          console.error("Error syncing takwim to Google Sheet:", sheetError);
        }
      }
    } catch (e) {
      console.error("Failed to save takwim:", e);
    }
  };
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const [showWargaSSEMJ, setShowWargaSSEMJ] = useState(false);
  const [activeApp, setActiveApp] = useState<WebLink | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State
  const [links, setLinks] = useState<WebLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [linksError, setLinksError] = useState("");
  const [teachersError, setTeachersError] = useState("");
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);

  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  const [announcements, setAnnouncements] = useState<Announcement[]>(
    INITIAL_ANNOUNCEMENTS,
  );
  const [stats, setStats] = useState<Stat>(INITIAL_STATS);
  const [attendance, setAttendance] = useState<Attendance>(INITIAL_ATTENDANCE);
  const [files, setFiles] = useState<PanitiaFile[]>(INITIAL_FILES);
  const [userLinks, setUserLinks] = useState<UserLink[]>([]);

  const fetchLinksFromSheet = async () => {
    setIsLoadingLinks(true);
    setLinksError("");
    try {
      Papa.parse(GOOGLE_SHEET_CSV_URL_LINKS, {
        download: true,
        header: true,
        complete: (results) => {
          const parsedLinks: WebLink[] = [];

          results.data.forEach((row: any, index) => {
            if (!row) return;

            // Create a case-insensitive row object
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });

            // Check if row has data (skip empty rows)
            if (Object.keys(lowerCaseRow).length > 0) {
              // Try to match column names flexibly
              const title =
                lowerCaseRow.tajuk ||
                lowerCaseRow.title ||
                lowerCaseRow.nama ||
                "";
              const url =
                lowerCaseRow.url ||
                lowerCaseRow.pautan ||
                lowerCaseRow.link ||
                "";
              const iconUrl =
                lowerCaseRow.logo ||
                lowerCaseRow.icon ||
                lowerCaseRow.ikon ||
                lowerCaseRow.iconurl ||
                "";

              if (title && url) {
                parsedLinks.push({
                  id: `sheet-${index}`,
                  title: title.trim(),
                  url: url.trim(),
                  iconUrl: iconUrl.trim(),
                });
              }
            }
          });

          if (parsedLinks.length > 0) {
            setLinks(parsedLinks);
          } else {
            setLinksError(
              'Tiada data pautan dijumpai atau format lajur tidak sepadan. Sila pastikan lajur "Tajuk", "URL", dan "Logo" wujud.',
            );
            setLinks(INITIAL_LINKS); // Fallback to initial links on error
          }
          setIsLoadingLinks(false);
        },
        error: (error) => {
          console.error("Error fetching links CSV:", error);
          setLinksError(
            'Gagal memuat turun data pautan dari Google Sheet. Pastikan Sheet telah ditetapkan kepada "Anyone with the link can view".',
          );
          setLinks(INITIAL_LINKS);
          setIsLoadingLinks(false);
        },
      });
    } catch (error) {
      console.error("Error fetching links:", error);
      setLinksError("Ralat sistem semasa memuat turun data pautan.");
      setLinks(INITIAL_LINKS);
      setIsLoadingLinks(false);
    }
  };

  const fetchTeachersFromSheet = async () => {
    setTeachersError("");
    try {
      // Add cache buster to ensure fresh data
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL_TEACHERS}&t=${new Date().getTime()}`,
      );
      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(
            `Gagal mengakses Google Sheet (Kod: 400). Kemungkinan besar GID tab tidak betul atau anda tidak mempunyai kebenaran. Sila sahkan GID dan tetapan perkongsian "Anyone with the link".`,
          );
        }
        throw new Error(
          `Gagal mengakses Google Sheet (Kod: ${response.status}). Sila pastikan tetapan perkongsian adalah "Anyone with the link".`,
        );
      }
      const csvText = await response.text();

      if (!csvText) {
        throw new Error("Fail Google Sheet kosong atau tidak dapat dibaca.");
      }

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const teacherNames: string[] = [];
          const teachersData: Teacher[] = [];
          results.data.forEach((row: any) => {
            if (!row) return;
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });

            const teacherName =
              lowerCaseRow["nama guru"] || lowerCaseRow["nama"];
            const teacherBidang =
              lowerCaseRow["bidang"] ||
              lowerCaseRow["jabatan"] ||
              lowerCaseRow["opsyen"] ||
              "Tiada Maklumat";
            const teacherEmail = lowerCaseRow["email"] || lowerCaseRow["e-mel"] || "";
            const teacherPhone = lowerCaseRow["no hp"] || lowerCaseRow["no. hp"] || lowerCaseRow["telefon"] || "";
            const teacherGrade = lowerCaseRow["gred"] || "";
            const teacherImage = lowerCaseRow["gambar"] || lowerCaseRow["image"] || lowerCaseRow["foto"] || "";
            const processedImage = getDirectImageUrl(teacherImage.trim());

            if (teacherName && teacherName.trim() !== "") {
              teacherNames.push(teacherName.trim());
              teachersData.push({
                name: teacherName.trim(),
                bidang: teacherBidang.trim(),
                email: teacherEmail.trim(),
                phone: teacherPhone.trim(),
                grade: teacherGrade.trim(),
                image: processedImage,
              });
            }
          });

          // Sort teachersData based on specific hierarchy
          const hierarchy = [
            "PENGETUA",
            "PENOLONG KANAN PENTADBIRAN",
            "PENOLONG KANAN HEM",
            "PENOLONG KANAN KOKURIKULUM",
            "PENOLONG KANAN SENI",
            "GKMP SAINS DAN MATEMATIK",
            "GKMP BAHASA",
            "GKMP SAINS KEMASYARAKATAN",
            "KETUA BIDANG SENI MUZIK",
            "KETUA BIDANG SENI TARI",
            "KETUA BIDANG SENI VISUAL"
          ];

          teachersData.sort((a, b) => {
            const bidangA = a.bidang.toUpperCase().trim();
            const bidangB = b.bidang.toUpperCase().trim();
            
            const indexA = hierarchy.indexOf(bidangA);
            const indexB = hierarchy.indexOf(bidangB);

            // If both are in hierarchy, sort by index
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB;
            }
            
            // If only A is in hierarchy, A comes first
            if (indexA !== -1) return -1;
            
            // If only B is in hierarchy, B comes first
            if (indexB !== -1) return 1;
            
            // If neither is in hierarchy, sort by Bidang then Name
            if (bidangA < bidangB) return -1;
            if (bidangA > bidangB) return 1;
            
            return a.name.localeCompare(b.name);
          });

          if (teacherNames.length > 0) {
            setTeachersList(teachersData);
            setStats((prev) => ({ ...prev, teachers: teacherNames.length }));
            setAttendance((prev) => {
              const newPresent = teacherNames.length - prev.absent;
              return {
                ...prev,
                total: teacherNames.length,
                present: newPresent >= 0 ? newPresent : 0,
              };
            });
          } else {
            setTeachersError(
              'Tiada nama guru dijumpai. Pastikan lajur "NAMA GURU" wujud dan mempunyai data.',
            );
          }
        },
        error: (error: any) => {
          console.error("Error parsing teachers CSV:", error);
          setTeachersError(
            `Gagal memproses data guru. Sila semak format CSV. Ralat: ${error.message}`,
          );
        },
      });
    } catch (error: any) {
      console.error("Error fetching teachers CSV:", error);
      setTeachersError(
        error.message || "Ralat tidak diketahui semasa memuat turun data guru.",
      );
    }
  };

  const fetchStudentsFromSheet = async () => {
    setIsLoadingStudents(true);
    setStudentsError("");
    try {
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL_MURID}&t=${new Date().getTime()}`);
      if (!response.ok) {
        throw new Error("Gagal mengakses Google Sheet Murid.");
      }
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const studentsData: Student[] = [];
          results.data.forEach((row: any) => {
            if (!row) return;
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });

            const daftarMurid = lowerCaseRow["daftar murid"] || "";
            const nama = lowerCaseRow["nama"] || lowerCaseRow["nama murid"] || "";
            const tingkatan = lowerCaseRow["tingkatan"] || lowerCaseRow["kelas"] || "";
            const kadPengenalan = lowerCaseRow["kad pengenalan"] || lowerCaseRow["kp"] || lowerCaseRow["ic"] || "";
            const bidang = lowerCaseRow["bidang"] || "";

            if (nama && nama.trim() !== "") {
              studentsData.push({
                daftarMurid: daftarMurid.trim(),
                nama: nama.trim(),
                tingkatan: tingkatan.trim(),
                kadPengenalan: kadPengenalan.trim(),
                bidang: bidang.trim(),
              });
            }
          });
          setStudentsList(studentsData);
          setStats((prev) => ({ ...prev, students: studentsData.length }));
          setIsLoadingStudents(false);
        },
        error: (error: any) => {
          setStudentsError(`Gagal memproses data murid: ${error.message}`);
          setIsLoadingStudents(false);
        }
      });
    } catch (error: any) {
      setStudentsError(error.message || "Ralat memuat turun data murid.");
      setIsLoadingStudents(false);
    }
  };

  const handleTransferStudent = (kadPengenalan: string) => {
    setStudentsList(prev => {
      const newList = prev.filter(s => s.kadPengenalan !== kadPengenalan);
      setStats(prevStats => ({ ...prevStats, students: newList.length }));
      return newList;
    });
  };

  const fetchKeberadaanFromSheet = async () => {
    try {
      // Add cache buster to ensure fresh data
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL_KEBERADAAN}&t=${new Date().getTime()}`,
      );
      if (!response.ok) {
        return;
      }
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const today = new Date();
          const offset = today.getTimezoneOffset() * 60000;
          const todayStr = new Date(today.getTime() - offset)
            .toISOString()
            .slice(0, 10);

          const absentList: AbsentDetail[] = [];

          results.data.forEach((row: any) => {
            const lowerRow: Record<string, string> = {};
            Object.keys(row).forEach((k) => {
              if (k) lowerRow[k.toLowerCase().trim()] = row[k];
            });

            const nama = lowerRow["nama guru"] || "";
            if (!nama) return;

            const bidangKey =
              Object.keys(lowerRow).find((k) => k.includes("bidang")) || "";
            const bidang = bidangKey ? lowerRow[bidangKey] : "";

            let tarikhMula = lowerRow["tarikh mula"] || "";
            let tarikhTamat = lowerRow["tarikh tamat"] || "";
            const tempoh = lowerRow["mode"] || lowerRow["tempoh"] || "";
            const timestamp = lowerRow["timestamp"] || lowerRow["masa"] || "";

            // Fallback to timestamp if no date was provided
            if (!tarikhMula && timestamp) {
              // Try to extract date from timestamp (usually "M/D/YYYY H:mm:ss" or similar)
              const datePart = timestamp.split(" ")[0];
              const isoDate = parseDateToISO(datePart);
              if (isoDate) {
                tarikhMula = isoDate;
                tarikhTamat = isoDate;
              }
            }

            // Fallback to today ONLY if absolutely no date info is available
            // This is risky for historical data but necessary for simple daily forms
            if (!tarikhMula) {
              tarikhMula = todayStr;
              tarikhTamat = todayStr;
            }

            let isAbsentToday = false;

            if (tempoh.toLowerCase() === "sehari" || !tempoh) {
              if (tarikhMula === todayStr) isAbsentToday = true;
            } else if (tempoh.toLowerCase() === "lebih") {
              if (tarikhMula <= todayStr && tarikhTamat >= todayStr)
                isAbsentToday = true;
            }

            if (isAbsentToday) {
              let reason = "";
              let duration = "";

              const sebabVal =
                lowerRow["sebab"] || lowerRow["sebab tidak hadir"] || "";
              const programVal =
                lowerRow["nama program"] || lowerRow["program"] || "";
              const tujuanVal =
                lowerRow["keluar pejabat"] ||
                lowerRow["tujuan keluar"] ||
                lowerRow["tujuan"] ||
                "";
              const lewatVal =
                lowerRow["lewat hadir"] || lowerRow["lewat"] || "";
              const masaMulaVal =
                lowerRow["masa mula"] || lowerRow["masa keluar"] || "";
              const masaTamatVal =
                lowerRow["masa tamat"] || lowerRow["masa masuk"] || "";
              const modeVal = tempoh;

              if (sebabVal) {
                reason = sebabVal;
                if (programVal) reason += ` (${programVal})`;
                duration =
                  modeVal.toLowerCase() === "sehari" || !modeVal
                    ? "Sehari"
                    : `${formatDate(tarikhMula)} hingga ${formatDate(tarikhTamat)}`;
              } else if (tujuanVal || (masaMulaVal && masaTamatVal)) {
                reason = tujuanVal ? `Keluar: ${tujuanVal}` : "Keluar Pejabat";
                duration =
                  masaMulaVal && masaTamatVal
                    ? `${formatTime(masaMulaVal)} - ${formatTime(masaTamatVal)}`
                    : "Hari ini";
              } else if (lewatVal) {
                reason = `Lewat: ${lewatVal}`;
                duration = "Hari ini";
              } else {
                reason = "Tidak Hadir / Keluar";
                duration = "Hari ini";
              }

              if (reason) {
                absentList.push({ name: nama, reason, duration, bidang });
              }
            }
          });

          setAttendance((prev) => {
            const newPresent = prev.total - absentList.length;
            return {
              ...prev,
              absent: absentList.length,
              present: newPresent >= 0 ? newPresent : 0,
              absentDetails: absentList,
            };
          });
        },
      });
    } catch (error) {
      console.error("Error fetching keberadaan:", error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setAnnouncements(data);
        }
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const fetchUserLinks = async () => {
    try {
      const res = await fetch("/api/user-links");
      if (res.ok) {
        const data = await res.json();
        setUserLinks(data);
      }
    } catch (error) {
      console.error("Error fetching user links:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        if (data && data.students) {
          setStats((prev) => ({ ...prev, students: data.students }));
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const saveAnnouncements = async (newAnns: Announcement[]) => {
    try {
      await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcements: newAnns }),
      });
    } catch (error) {
      console.error("Error saving announcements:", error);
    }
  };

  const saveStats = async (newStudents: number) => {
    try {
      await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: newStudents }),
      });
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  };

  const saveUserLink = async (link: UserLink) => {
    try {
      // 1. Save locally (mock)
      const res = await fetch("/api/user-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(link),
      });

      // 2. Send to Google Sheet (Share_Link tab)
      // Replace this URL with your deployed Google Apps Script Web App URL
      const GOOGLE_SCRIPT_URL = "YOUR_DEPLOYED_SCRIPT_URL_HERE"; 
      
      if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YOUR_DEPLOYED_SCRIPT_URL_HERE") {
        try {
          await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Important for GAS without CORS headers
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(link),
          });
          console.log("Data sent to Google Sheet successfully");
        } catch (sheetError) {
          console.error("Error sending to Google Sheet:", sheetError);
        }
      } else {
        console.warn("Google Script URL not set. Please update GOOGLE_SCRIPT_URL in src/App.tsx.");
      }

      if (res.ok) {
        fetchUserLinks();
      }
    } catch (error) {
      console.error("Error saving user link:", error);
    }
  };

  const deleteUserLink = async (id: string) => {
    try {
      const res = await fetch(`/api/user-links/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUserLinks();
      }
    } catch (error) {
      console.error("Error deleting user link:", error);
    }
  };

  useEffect(() => {
    fetchLinksFromSheet();
    fetchTeachersFromSheet();
    fetchStudentsFromSheet();
    fetchKeberadaanFromSheet();
    fetchAnnouncements();
    fetchStats();
    fetchUserLinks();
  }, []);

  const [showAbsentModal, setShowAbsentModal] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Utama", icon: LayoutDashboard },
    { id: "murid", label: "Murid", icon: Users },
    { id: "pautan", label: "Senarai Pautan", icon: Link },
    { id: "keberadaan", label: "Borang Keberadaan", icon: ClipboardList },
    // { id: "panitia", label: "Pengurusan Panitia", icon: FolderOpen },
    { id: "admin", label: "Admin", icon: Settings },
  ];

  return (
    <div className="min-h-screen font-sans text-slate-600 flex flex-col lg:flex-row relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      <AnimatePresence>
        {showAbsentModal && (
          <AttendanceDetailsModal
            attendance={attendance}
            onClose={() => setShowAbsentModal(false)}
          />
        )}
      </AnimatePresence>
      {/* Animated Background Blobs */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      <div className="bg-shape shape-3"></div>

      {/* Mobile Topbar */}
      <nav className="lg:hidden neu-glass-panel px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 p-1 flex items-center justify-center">
             <img
               src={getDirectImageUrl(
                 "https://drive.google.com/file/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u/view?usp=drive_link",
               )}
               alt="Logo"
               className="w-full h-full object-contain"
             />
          </div>
          <span className="font-bold text-slate-800 text-lg">S1STEN</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-[60px] z-40 bg-white border-b border-slate-200 shadow-xl lg:hidden"
          >
            <div className="p-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 neu-glass-panel fixed inset-y-0 left-0 z-40">
        <div className="flex flex-col items-center justify-center border-b border-white/40 py-8">
           <div className="flex flex-col items-center gap-3">
             <div className="w-32 h-32 rounded-3xl bg-blue-50 p-4 flex items-center justify-center mb-4 neu-pressed">
               <img
                 src={getDirectImageUrl(
                   "https://drive.google.com/file/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u/view?usp=drive_link",
                 )}
                 alt="Logo"
                 className="w-full h-full object-contain"
               />
             </div>
             <div className="text-center">
                <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                  S1STEN
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  SSEMJ 1 STOP CENTRE
                </p>
             </div>
           </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-bold text-sm ${
                activeTab === item.id
                  ? "neu-pressed text-indigo-600"
                  : "text-slate-500 hover:bg-white/40 hover:text-indigo-600"
              }`}
            >
              <item.icon size={20} className={activeTab === item.id ? "text-indigo-600" : "text-slate-400"} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/40 bg-white/10">
           <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                 <LiveClock />
                 <button
                   onClick={toggleTheme}
                   className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white/50 transition-all neu-button"
                   title={isDarkMode ? "Tukar ke Mod Cerah" : "Tukar ke Mod Gelap"}
                 >
                   {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                 </button>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Top Bar */}
        <header className="neu-glass-panel min-h-[80px] px-4 md:px-8 flex flex-col md:flex-row items-center justify-between sticky top-0 z-30 gap-4 py-3 md:py-0 transition-all">
           <div className="hidden md:block">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">Selamat Datang ke S1STEN</p>
           </div>

           <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3 md:gap-4 min-w-max px-1">
                 <div className="neu-inset px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 rounded-xl">
                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                       <Users size={16} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru</p>
                       <p className="text-sm font-bold text-slate-700">{stats.teachers}</p>
                    </div>
                 </div>
                 <div className="neu-inset px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 rounded-xl">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                       <GraduationCap size={16} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Murid</p>
                       <p className="text-sm font-bold text-slate-700">{stats.students}</p>
                    </div>
                 </div>
                 <div className="neu-inset px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 rounded-xl">
                    <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                       <UserCheck size={16} />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
                       <p className="text-sm font-bold text-slate-700">{attendance.present}</p>
                    </div>
                 </div>
                 <button 
                    onClick={() => setShowAbsentModal(true)}
                    className="neu-inset px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                 >
                    <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                       <UserX size={16} />
                    </div>
                    <div className="text-left">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiada</p>
                       <p className="text-sm font-bold text-slate-700">{attendance.absent}</p>
                    </div>
                 </button>
              </div>
           </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">
           {/* Welcome Title - Only show on dashboard */}
           {activeTab === 'dashboard' && (
             <div className="mb-10">
               <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                 SseMJ 1 STOP CENTRE
               </h1>
             </div>
           )}

           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
             >
               {activeTab === "dashboard" && (
                 <Dashboard
                   links={links}
                   isLoadingLinks={isLoadingLinks}
                   linksError={linksError}
                   announcements={announcements}
                   stats={stats}
                   attendance={attendance}
                   onOpenApp={(link) => {
                     window.open(link.url, "_blank", "noopener,noreferrer");
                   }}
                   teachersError={teachersError}
                   onOpenWarga={() => setShowWargaSSEMJ(true)}
                   takwimEvents={takwimEvents}
                   refreshTakwim={fetchTakwimFromSheet}
                 />
               )}
               {activeTab === "murid" && (
                 <SenaraiMurid 
                   students={studentsList} 
                   isLoading={isLoadingStudents} 
                   error={studentsError} 
                   onTransfer={handleTransferStudent}
                 />
               )}
               {activeTab === "pautan" && (
                 <SenaraiPautan
                   links={userLinks}
                   onSave={saveUserLink}
                   onDelete={deleteUserLink}
                 />
               )}
               {activeTab === "panitia" && (
                 <PengurusanPanitia files={files} setFiles={setFiles} />
               )}
               {activeTab === "keberadaan" && (
                 <KeberadaanForm teachers={teachersList} attendance={attendance} />
               )}
               {activeTab === "admin" && (
                 <AdminPanel
                   links={links}
                   setLinks={setLinks}
                   announcements={announcements}
                   setAnnouncements={setAnnouncements}
                   stats={stats}
                   setStats={setStats}
                   attendance={attendance}
                   setAttendance={setAttendance}
                   refreshLinks={fetchLinksFromSheet}
                   saveAnnouncements={saveAnnouncements}
                   saveStats={saveStats}
                   takwimEvents={takwimEvents}
                   saveTakwim={saveTakwim}
                 />
               )}
             </motion.div>
           </AnimatePresence>
        </main>
      </div>

      {/* Warga SSEMJ Modal */}
      <AnimatePresence>
        {showWargaSSEMJ && (
          <WargaSSEMJModal
            teachers={teachersList}
            onClose={() => setShowWargaSSEMJ(false)}
          />
        )}
      </AnimatePresence>

      {/* Fullscreen App Viewer */}
      <AnimatePresence>
        {activeApp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50"
          >
            <IframeViewer
              url={activeApp.url}
              title={activeApp.title}
              onClose={() => setActiveApp(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
