"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabase";
import { subscribeToRealtime, unsubscribeRealtime } from "@/lib/realtime";
import Icon from "./Icon";

import { hasPermission, type AppUser } from "@/lib/permissions";

/* =========================================================
   TYPES
========================================================= */

type LibraryBook = {
  id: string;

  bookCode: string;

  title: string;

  author: string;

  isbn: string;

  category: string;

  course: string;

  semester: number | null;

  totalCopies: number;

  availableCopies: number;

  description: string;

  shelfLocation: string;

  status: "ACTIVE" | "INACTIVE";

  createdAt: string;
};

type LibraryReservation = {
  id: string;

  bookId: string;

  studentId: string;

  reservedAt: string | null;

  pickupDeadline: string | null;

  issuedAt: string | null;

  dueDate: string | null;

  returnedAt: string | null;

  status: string;

  studentName: string;

  registerNo: string;

  course: string;

  semester: number | null;

  bookTitle: string;

  bookCode: string;
};

type LibraryTeacher = {
  id: string;
  name: string;
  activeLoans: number;
};

type LibraryStaffLoan = {
  id: string;
  staffName: string;
  bookId: string;
  bookTitle: string;
  bookCode: string;
  issuedAt: string | null;
  dueDate: string | null;
  returnedAt: string | null;
  status: string;
};

type Tab = "books" | "reservations" | "issued" | "staffLoans";

/* =========================================================
   HELPERS
========================================================= */

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function numberValue(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function semesterValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const raw = String(value).trim().toLowerCase();

  const match = raw.match(/\b([1-8])\b/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "ST";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Library({
  onBack,
  user,
}: {
  onBack: () => void;

  user: AppUser;
}) {
  /* =======================================================
     PERMISSIONS
  ======================================================= */

  const canView = hasPermission(user, "library.view");

  const canIssue = hasPermission(user, "library.issue");

  const canReturn = hasPermission(user, "library.return");

  const canManage = hasPermission(user, "library.manage");

  /* =======================================================
     STATE
  ======================================================= */

  const [books, setBooks] = useState<LibraryBook[]>([]);

  const [reservations, setReservations] = useState<LibraryReservation[]>([]);

  const [staffLoans, setStaffLoans] = useState<LibraryStaffLoan[]>([]);

  const [teachers, setTeachers] = useState<LibraryTeacher[]>([]);

  const [teacherName, setTeacherName] = useState("");

  const [teacherModalOpen, setTeacherModalOpen] = useState(false);

  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [staffName, setStaffName] = useState("");

  const [staffBookId, setStaffBookId] = useState("");

  const [staffDueDate, setStaffDueDate] = useState("");

  const [staffModalOpen, setStaffModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("books");

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);

  const [importing, setImporting] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* =======================================================
     MESSAGE HELPERS
  ======================================================= */

  function showError(message: string) {
    setError(message);
    setSuccess("");
  }

  function showSuccess(message: string) {
    setSuccess(message);
    setError("");
  }

  /* =======================================================
     LOAD BOOKS
  ======================================================= */

  async function loadBooks() {
    const { data, error } = await supabase
      .from("library_books")
      .select(
        `
            id,
            book_code,
            title,
            author,
            isbn,
            category,
            course,
            semester,
            total_copies,
            available_copies,
            description,
            shelf_location,
            status,
            created_at
          `,
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    const mapped: LibraryBook[] = (data ?? []).map((row: any) => ({
      id: String(row.id ?? ""),

      bookCode: String(row.book_code ?? ""),

      title: String(row.title ?? ""),

      author: String(row.author ?? ""),

      isbn: String(row.isbn ?? ""),

      category: String(row.category ?? ""),

      course: String(row.course ?? ""),

      semester: row.semester == null ? null : Number(row.semester),

      totalCopies: Number(row.total_copies ?? 0),

      availableCopies: Number(row.available_copies ?? 0),

      description: String(row.description ?? ""),

      shelfLocation: String(row.shelf_location ?? ""),

      status:
        String(row.status ?? "ACTIVE").toUpperCase() === "INACTIVE"
          ? "INACTIVE"
          : "ACTIVE",

      createdAt: String(row.created_at ?? ""),
    }));

    setBooks(mapped);
  }

  /* =======================================================
     LOAD RESERVATIONS
     
     IMPORTANT:
     Uses the RPC so student + book details
     come together correctly.
  ======================================================= */

  async function loadReservations() {
    const { data, error } = await supabase.rpc("get_library_reservations");

    if (error) {
      throw error;
    }

    const mapped: LibraryReservation[] = (data ?? []).map((row: any) => ({
      id: String(row.id ?? ""),

      bookId: String(row.book_id ?? ""),

      studentId: String(row.student_id ?? ""),

      reservedAt: row.reserved_at ?? null,

      pickupDeadline: row.pickup_deadline ?? null,

      issuedAt: row.issued_at ?? null,

      dueDate: row.due_date ?? null,

      returnedAt: row.returned_at ?? null,

      status: String(row.status ?? "RESERVED").toUpperCase(),

      studentName: String(row.student_name ?? "Unknown Student"),

      registerNo: String(row.reg_no ?? ""),

      course: String(row.course ?? ""),

      semester: row.semester == null ? null : Number(row.semester),

      bookTitle: String(row.book_title ?? "Unknown Book"),

      bookCode: String(row.book_code ?? ""),
    }));

    setReservations(mapped);
  }

  /* =======================================================
     LOAD TEACHERS
  ======================================================= */

  async function loadTeachers(
    currentStaffLoans: LibraryStaffLoan[] = staffLoans,
  ) {
    const { data, error } = await supabase
      .from("library_teachers")
      .select("id,name")
      .order("name");

    if (error) {
      throw error;
    }

    const loanCounts = new Map<string, number>();

    for (const loan of currentStaffLoans) {
      if (loan.status === "ISSUED") {
        const key = loan.staffName.trim().toLowerCase();

        loanCounts.set(key, (loanCounts.get(key) ?? 0) + 1);
      }
    }

    setTeachers(
      (data ?? []).map((row: any) => {
        const name = String(row.name ?? "").trim();

        return {
          id: String(row.id ?? ""),
          name,
          activeLoans: loanCounts.get(name.toLowerCase()) ?? 0,
        };
      }),
    );
  }

  /* =======================================================
     LOAD STAFF LOANS
  ======================================================= */

  async function loadStaffLoans(): Promise<LibraryStaffLoan[]> {
    const { data, error } = await supabase.rpc("get_library_staff_loans");

    if (error) {
      throw error;
    }

    const mapped: LibraryStaffLoan[] = (data ?? []).map((row: any) => ({
      id: String(row.id ?? ""),
      staffName: String(row.staff_name ?? "Unknown Staff"),
      bookId: String(row.book_id ?? ""),
      bookTitle: String(row.book_title ?? "Unknown Book"),
      bookCode: String(row.book_code ?? ""),
      issuedAt: row.issued_at ?? null,
      dueDate: row.due_date ?? null,
      returnedAt: row.returned_at ?? null,
      status: String(row.status ?? "ISSUED").toUpperCase(),
    }));

    setStaffLoans(mapped);

    // Return the fresh data so loadLibrary() does not accidentally
    // pass void to loadTeachers().
    return mapped;
  }

  /* =======================================================
     LOAD EVERYTHING
  ======================================================= */

  async function loadLibrary(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    try {
      setError("");

      const [, , freshStaffLoans] = await Promise.all([
        loadBooks(),
        loadReservations(),
        loadStaffLoans(),
      ]);

      await loadTeachers(freshStaffLoans);
    } catch (err: any) {
      console.error("LIBRARY LOAD ERROR:", err);

      showError(err?.message ?? "Unable to load library.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    loadLibrary();
  }, [canView]);

  useEffect(() => {
    if (!canView) {
      return;
    }

    const channel = subscribeToRealtime(
      [
        "library_books",
        "library_reservations",
        "library_staff_loans",
        "library_teachers",
      ],
      () => {
        void loadLibrary(false);
      },
    );

    return () => {
      void unsubscribeRealtime(channel);
    };
  }, [canView]);

  /* =======================================================
     IMPORT BOOKS
  ======================================================= */

  async function handleImportBooks(event: React.ChangeEvent<HTMLInputElement>) {
    if (!canManage) {
      showError("You do not have permission to manage the library.");

      return;
    }

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);

    setError("");

    setSuccess("");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      if (!workbook.SheetNames.length) {
        throw new Error("No worksheet found.");
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      }) as Record<string, unknown>[];

      if (!rows.length) {
        throw new Error("The Excel file is empty.");
      }

      const insertRows = rows.map((row) => {
        const total = Math.max(0, numberValue(row["Total Copies"], 0));

        let available = numberValue(row["Available Copies"], total);

        available = Math.max(0, Math.min(total, available));

        return {
          book_code: stringValue(row["Book Code"]),

          title: stringValue(row["Title"]),

          author: stringValue(row["Author"]),

          isbn: stringValue(row["ISBN"]),

          category: stringValue(row["Category"]),

          course: stringValue(row["Course"]),

          semester: semesterValue(row["Semester"]),

          total_copies: total,

          available_copies: available,

          description: stringValue(row["Description"]),

          shelf_location: stringValue(row["Shelf Location"]),

          status: "ACTIVE",
        };
      });

      const invalid = insertRows.some((row) => !row.book_code || !row.title);

      if (invalid) {
        throw new Error("Every book must have Book Code and Title.");
      }

      const batchSize = 100;

      for (let i = 0; i < insertRows.length; i += batchSize) {
        const batch = insertRows.slice(i, i + batchSize);

        const { error } = await supabase.from("library_books").insert(batch);

        if (error) {
          throw error;
        }
      }

      showSuccess(
        `${insertRows.length} book${
          insertRows.length === 1 ? "" : "s"
        } imported successfully.`,
      );

      await loadBooks();
    } catch (err: any) {
      console.error("BOOK IMPORT ERROR:", err);

      showError(err?.message ?? "Unable to import books.");
    } finally {
      setImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  /* =======================================================
     TEACHER MANAGEMENT
  ======================================================= */

  function openTeacherModal() {
    if (!canIssue && !canManage) {
      showError("You do not have permission to manage teachers.");
      return;
    }

    setTeacherName("");
    setError("");
    setSuccess("");
    setTeacherModalOpen(true);
  }

  async function handleAddTeacher() {
    if (!canIssue && !canManage) {
      showError("You do not have permission to manage teachers.");
      return;
    }

    const name = teacherName.trim();

    if (!name) {
      showError("Teacher name is required.");
      return;
    }

    const exists = teachers.some(
      (teacher) => teacher.name.trim().toLowerCase() === name.toLowerCase(),
    );

    if (exists) {
      showError("This teacher is already added.");
      return;
    }

    setProcessingId("teacher:add");
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase
        .from("library_teachers")
        .insert({ name });

      if (error) throw error;

      setTeacherModalOpen(false);
      await loadLibrary(false);
      showSuccess(`${name} added to library teachers.`);
    } catch (err: any) {
      console.error("ADD TEACHER ERROR:", err);
      showError(err?.message ?? "Unable to add teacher.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteTeacher(teacher: LibraryTeacher) {
    if (!canManage) {
      showError("You do not have permission to manage teachers.");
      return;
    }

    if (teacher.activeLoans > 0) {
      showError(
        `${teacher.name} still has ${teacher.activeLoans} active book(s). Return them before removing this teacher.`,
      );
      return;
    }

    if (!window.confirm(`Remove ${teacher.name} from library teachers?`)) {
      return;
    }

    setProcessingId(`teacher:${teacher.id}`);

    try {
      const { error } = await supabase
        .from("library_teachers")
        .delete()
        .eq("id", teacher.id);

      if (error) throw error;

      await loadLibrary(false);
      showSuccess(`${teacher.name} removed.`);
    } catch (err: any) {
      console.error("DELETE TEACHER ERROR:", err);
      showError(err?.message ?? "Unable to remove teacher.");
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     STAFF ISSUE MODAL
  ======================================================= */

  function openStaffIssueModal() {
    if (!canIssue) {
      showError("You do not have permission to issue books.");
      return;
    }

    setSelectedTeacherId(teachers.length > 0 ? teachers[0].id : "");
    setStaffName(teachers.length > 0 ? teachers[0].name : "");
    setStaffBookId("");
    setStaffDueDate("");
    setError("");
    setSuccess("");
    setStaffModalOpen(true);
  }

  /* =======================================================
     ISSUE BOOK TO STAFF
  ======================================================= */

  async function handleStaffIssue() {
    if (!canIssue) {
      showError("You do not have permission to issue books.");
      return;
    }

    const selectedTeacher = teachers.find(
      (teacher) => teacher.id === selectedTeacherId,
    );

    const name = selectedTeacher?.name.trim() ?? staffName.trim();

    if (!name) {
      showError("Please select a teacher.");
      return;
    }

    if (teachers.length === 0) {
      showError("Add at least one teacher before issuing a book.");
      return;
    }

    if (!selectedTeacherId) {
      showError("Please select a teacher.");
      return;
    }

    if (!staffBookId) {
      showError("Please select a book.");
      return;
    }

    if (processingId) {
      return;
    }

    const book = books.find((item) => item.id === staffBookId);

    if (!book) {
      showError("Selected book was not found.");
      return;
    }

    if (book.availableCopies <= 0) {
      showError("No available copies for this book.");
      return;
    }

    setProcessingId(`staff:${staffBookId}`);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc(
        "issue_library_book_to_staff",
        {
          p_staff_name: name,
          p_book_id: staffBookId,
          p_due_date: staffDueDate || null,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error("Staff book issue was not completed.");
      }

      setStaffModalOpen(false);
      await loadLibrary(false);
      setActiveTab("staffLoans");

      showSuccess(`"${book.title}" issued to ${name}.`);
    } catch (err: any) {
      console.error("STAFF BOOK ISSUE ERROR:", err);

      showError(err?.message ?? "Unable to issue book to staff.");
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     RETURN STAFF BOOK
  ======================================================= */

  async function handleStaffReturn(loan: LibraryStaffLoan) {
    if (!canReturn) {
      showError("You do not have permission to return books.");
      return;
    }

    if (processingId) {
      return;
    }

    const confirmed = window.confirm(
      `Mark "${loan.bookTitle}" returned by ${loan.staffName}?`,
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(loan.id);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc("return_library_staff_book", {
        p_loan_id: loan.id,
      });

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error("Staff book return was not completed.");
      }

      await loadLibrary(false);
      setActiveTab("staffLoans");

      showSuccess(
        `"${loan.bookTitle}" returned by ${loan.staffName}. The book is available again.`,
      );
    } catch (err: any) {
      console.error("STAFF BOOK RETURN ERROR:", err);

      showError(err?.message ?? "Unable to return staff book.");
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     ISSUE BOOK
     
     RESERVED -> ISSUED
  ======================================================= */

  async function handleIssue(reservation: LibraryReservation) {
    if (!canIssue) {
      showError("You do not have permission to issue books.");

      return;
    }

    if (processingId) {
      return;
    }

    const confirmed = window.confirm(
      `Issue "${reservation.bookTitle}" to ${reservation.studentName}?`,
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(reservation.id);

    setError("");

    setSuccess("");

    try {
      const { data, error } = await supabase.rpc("issue_library_book", {
        p_reservation_id: reservation.id,

        p_due_date: null,
      });

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error("Book issue was not completed.");
      }

      /*
       * Refresh BOTH:
       *
       * Books
       * Reservations
       * Issued count
       * Available copies
       */

      await loadLibrary(false);

      /*
       * Automatically open
       * Issued tab.
       */

      setActiveTab("issued");

      showSuccess(
        `${reservation.bookTitle} issued to ${reservation.studentName}.`,
      );
    } catch (err: any) {
      console.error("ISSUE BOOK ERROR:", err);

      showError(err?.message ?? "Unable to issue book.");
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     RETURN BOOK
     
     ISSUED -> RETURNED
  ======================================================= */

  async function handleReturn(reservation: LibraryReservation) {
    if (!canReturn) {
      showError("You do not have permission to return books.");

      return;
    }

    if (processingId) {
      return;
    }

    const confirmed = window.confirm(
      `Mark "${reservation.bookTitle}" returned by ${reservation.studentName}?`,
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(reservation.id);

    setError("");

    setSuccess("");

    try {
      const { data, error } = await supabase.rpc("return_library_book", {
        p_reservation_id: reservation.id,
      });

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error("Book return was not completed.");
      }

      /*
       * Refresh:
       *
       * reservation status
       * issued count
       * available copies
       * book list
       */

      await loadLibrary(false);

      /*
       * Go back to Books
       * because returned book
       * is available there.
       */

      setActiveTab("books");

      showSuccess(
        `${reservation.bookTitle} returned successfully. The book is available again.`,
      );
    } catch (err: any) {
      console.error("RETURN BOOK ERROR:", err);

      showError(err?.message ?? "Unable to return book.");
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     STATS
  ======================================================= */

  const totalCopies = books.reduce((sum, book) => sum + book.totalCopies, 0);

  const availableCopies = books.reduce(
    (sum, book) => sum + book.availableCopies,
    0,
  );

  const reservedCount = reservations.filter(
    (item) => String(item.status).toUpperCase() === "RESERVED",
  ).length;

  const issuedCount = reservations.filter(
    (item) => String(item.status).toUpperCase() === "ISSUED",
  ).length;

  const staffIssuedCount = staffLoans.filter(
    (item) => item.status === "ISSUED",
  ).length;

  /* =======================================================
     CATEGORIES
  ======================================================= */

  const categories = useMemo(() => {
    const values = books.map((book) => book.category).filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [books]);

  /* =======================================================
     FILTERED BOOKS
  ======================================================= */

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.bookCode.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.course.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "ALL" || book.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [books, search, categoryFilter]);

  /* =======================================================
     FILTERED RESERVATIONS
  ======================================================= */

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return reservations.filter((item) => {
      if (!q) {
        return true;
      }

      return (
        item.studentName.toLowerCase().includes(q) ||
        item.bookTitle.toLowerCase().includes(q) ||
        item.bookCode.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q)
      );
    });
  }, [reservations, search]);

  /* =======================================================
     FILTERED STAFF LOANS
  ======================================================= */

  const filteredStaffLoans = useMemo(() => {
    const q = search.trim().toLowerCase();

    return staffLoans.filter((item) => {
      if (!q) {
        return true;
      }

      return (
        item.staffName.toLowerCase().includes(q) ||
        item.bookTitle.toLowerCase().includes(q) ||
        item.bookCode.toLowerCase().includes(q)
      );
    });
  }, [staffLoans, search]);

  /* =======================================================
     ACCESS DENIED
  ======================================================= */

  if (!canView) {
    return (
      <div className="libraryPage">
        <section className="libraryHeader">
          <div className="libraryHeaderLeft">
            <button
              type="button"
              className="libraryBackButton"
              onClick={onBack}
            >
              <span className="libraryBackArrow">←</span>
              Back
            </button>
          </div>
        </section>

        <div
          style={{
            minHeight: "55vh",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            padding: "32px",
          }}
        >
          <div
            style={{
              width: "100%",

              maxWidth: "460px",

              textAlign: "center",

              padding: "42px 28px",

              border: "1px solid #e5e7eb",

              borderRadius: "18px",

              background: "#ffffff",

              boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
            }}
          >
            <div
              style={{
                width: "58px",

                height: "58px",

                margin: "0 auto 18px",

                borderRadius: "50%",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                background: "#f3f4f6",

                color: "#64748b",
              }}
            >
              <Icon name="lock" size={25} />
            </div>

            <h2
              style={{
                margin: "0 0 8px",

                fontSize: "20px",

                fontWeight: 700,

                color: "#111827",
              }}
            >
              Library Access Restricted
            </h2>

            <p
              style={{
                margin: "0 0 22px",

                fontSize: "14px",

                lineHeight: 1.6,

                color: "#6b7280",
              }}
            >
              You don't have permission to view the college library.
            </p>

            <button
              type="button"
              onClick={onBack}
              style={{
                border: "none",

                borderRadius: "10px",

                padding: "11px 18px",

                background: "#111827",

                color: "#ffffff",

                fontWeight: 600,

                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="libraryPage">
      {/* ===================================================
          HEADER
          =================================================== */}

      <section className="libraryHeader">
        <div className="libraryHeaderLeft">
          <button type="button" className="libraryBackButton" onClick={onBack}>
            <span className="libraryBackArrow">←</span>
            Back
          </button>

          <div className="libraryKicker">
            <Icon name="book" size={16} />
            COLLEGE LIBRARY
          </div>

          <h1>Library Management</h1>

          <p>Manage books, reservations, issued books and returns.</p>
        </div>

        <div className="libraryHeaderActions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={handleImportBooks}
          />

          {canManage && (
            <button
              type="button"
              className="libraryPrimaryButton"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="upload" size={16} />

              {importing ? "Importing..." : "Import Books"}
            </button>
          )}
        </div>
      </section>

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {error && (
        <div className="libraryMessage libraryMessageError">
          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="libraryMessage libraryMessageSuccess">
          <span>{success}</span>

          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      {/* ===================================================
          STATS
      =================================================== */}

      <section className="libraryStatsGrid">
        {/* TOTAL */}

        <div className="libraryStatCard">
          <div className="libraryStatIcon">
            <Icon name="book" size={21} />
          </div>

          <div className="libraryStatContent">
            <span>Total Copies</span>

            <strong>{loading ? "—" : totalCopies.toLocaleString()}</strong>

            <small>Across all books</small>
          </div>
        </div>

        {/* AVAILABLE */}

        <div className="libraryStatCard">
          <div className="libraryStatIcon">
            <Icon name="check" size={21} />
          </div>

          <div className="libraryStatContent">
            <span>Available</span>

            <strong>{loading ? "—" : availableCopies.toLocaleString()}</strong>

            <small>Copies available</small>
          </div>
        </div>

        {/* RESERVED */}

        <div className="libraryStatCard">
          <div className="libraryStatIcon">
            <Icon name="clock" size={21} />
          </div>

          <div className="libraryStatContent">
            <span>Reserved</span>

            <strong>{loading ? "—" : reservedCount.toLocaleString()}</strong>

            <small>Waiting for pickup</small>
          </div>
        </div>

        {/* ISSUED */}

        <div className="libraryStatCard">
          <div className="libraryStatIcon">
            <Icon name="book" size={21} />
          </div>

          <div className="libraryStatContent">
            <span>Issued</span>

            <strong>{loading ? "—" : issuedCount.toLocaleString()}</strong>

            <small>Currently issued</small>
          </div>
        </div>
      </section>

      {/* ===================================================
          TABS
      =================================================== */}

      <div className="libraryTabs">
        <button
          type="button"
          className={activeTab === "books" ? "active" : ""}
          onClick={() => {
            setActiveTab("books");

            setSearch("");
          }}
        >
          <Icon name="book" size={15} />
          Books
          <span className="libraryTabCount">{books.length}</span>
        </button>

        <button
          type="button"
          className={activeTab === "reservations" ? "active" : ""}
          onClick={() => {
            setActiveTab("reservations");

            setSearch("");
          }}
        >
          <Icon name="clock" size={15} />
          Reservations
          <span className="libraryTabCount">{reservedCount}</span>
        </button>

        <button
          type="button"
          className={activeTab === "issued" ? "active" : ""}
          onClick={() => {
            setActiveTab("issued");

            setSearch("");
          }}
        >
          <Icon name="book" size={15} />
          Issued
          <span className="libraryTabCount">{issuedCount}</span>
        </button>

        <button
          type="button"
          className={activeTab === "staffLoans" ? "active" : ""}
          onClick={() => {
            setActiveTab("staffLoans");
            setSearch("");
          }}
        >
          <Icon name="users" size={15} />
          Staff Loans
          <span className="libraryTabCount">{staffIssuedCount}</span>
        </button>
      </div>

      {/* ===================================================
          BOOKS TAB
      =================================================== */}

      {activeTab === "books" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>Library Books</h2>

              <p>Browse and manage available library books.</p>
            </div>
          </div>

          {/* FILTERS */}

          <div className="libraryFilters">
            <div className="librarySearch">
              <Icon name="search" size={16} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search books, authors, course or book code..."
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">All Categories</option>

              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* TABLE */}

          <div className="libraryTableWrap">
            <table className="libraryTable">
              <thead>
                <tr>
                  <th>BOOK</th>

                  <th>AUTHOR</th>

                  <th>COURSE</th>

                  <th>SEMESTER</th>

                  <th>CATEGORY</th>

                  <th>COPIES</th>

                  <th>STATUS</th>

                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",

                        padding: "40px",
                      }}
                    >
                      Loading books...
                    </td>
                  </tr>
                ) : filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="libraryEmpty">
                        <Icon name="book" size={30} />

                        <h3>No books found</h3>

                        <p>No books match your search or filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => (
                    <tr key={book.id}>
                      <td>
                        <div className="libraryBookCell">
                          <strong>{book.title}</strong>

                          <span>{book.bookCode}</span>
                        </div>
                      </td>

                      <td>{book.author || "—"}</td>

                      <td>{book.course || "—"}</td>

                      <td>
                        {book.semester ? `Semester ${book.semester}` : "—"}
                      </td>

                      <td>{book.category || "—"}</td>

                      <td>
                        <span
                          className={
                            book.availableCopies > 0
                              ? "libraryCopyAvailable"
                              : "libraryCopyEmpty"
                          }
                        >
                          {book.availableCopies}/{book.totalCopies}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            book.status === "ACTIVE"
                              ? "libraryStatus returned"
                              : "libraryStatus cancelled"
                          }
                        >
                          {book.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="libraryViewButton"
                          onClick={() => setSelectedBook(book)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================
          RESERVATIONS TAB
      =================================================== */}

      {activeTab === "reservations" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>Book Reservations</h2>

              <p>Students who have reserved books.</p>
            </div>
          </div>

          <div className="libraryFilters">
            <div className="librarySearch">
              <Icon name="search" size={16} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or book..."
              />
            </div>
          </div>

          <div className="libraryReservationList">
            {loading ? (
              <div className="libraryEmpty">Loading reservations...</div>
            ) : (
              (() => {
                const pending = filteredReservations.filter(
                  (item) => String(item.status).toUpperCase() === "RESERVED",
                );

                if (pending.length === 0) {
                  return (
                    <div className="libraryEmpty">
                      <Icon name="clock" size={30} />

                      <h3>No reservations</h3>

                      <p>There are currently no pending book reservations.</p>
                    </div>
                  );
                }

                return pending.map((reservation) => (
                  <div className="libraryReservationCard" key={reservation.id}>
                    <div className="libraryReservationMain">
                      <div className="libraryStudentAvatar">
                        {getInitials(reservation.studentName)}
                      </div>

                      <div>
                        <h3>{reservation.studentName}</h3>

                        <p>
                          {reservation.course || "Student"}

                          {reservation.semester
                            ? ` • Semester ${reservation.semester}`
                            : ""}
                        </p>

                        {reservation.registerNo && (
                          <small>Reg No: {reservation.registerNo}</small>
                        )}
                      </div>
                    </div>

                    <div className="libraryReservationBook">
                      <span>BOOK</span>

                      <strong>{reservation.bookTitle}</strong>

                      <small>{reservation.bookCode}</small>
                    </div>

                    <div className="libraryReservationTime">
                      <span>RESERVED</span>

                      <strong>{formatDateTime(reservation.reservedAt)}</strong>

                      <small>
                        Pickup before{" "}
                        {formatDateTime(reservation.pickupDeadline)}
                      </small>
                    </div>

                    <div className="libraryReservationStatus">
                      <span className="libraryStatus reserved">RESERVED</span>

                      {canIssue && (
                        <button
                          type="button"
                          className="libraryIssueButton"
                          disabled={processingId === reservation.id}
                          onClick={() => handleIssue(reservation)}
                        >
                          {processingId === reservation.id
                            ? "Processing..."
                            : "Mark Issued"}
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </section>
      )}

      {/* ===================================================
          ISSUED TAB
      =================================================== */}

      {activeTab === "issued" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>Issued Books</h2>

              <p>Books currently issued to students.</p>
            </div>
          </div>

          <div className="libraryFilters">
            <div className="librarySearch">
              <Icon name="search" size={16} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or book..."
              />
            </div>
          </div>

          <div className="libraryReservationList">
            {loading ? (
              <div className="libraryEmpty">Loading issued books...</div>
            ) : (
              (() => {
                const issued = filteredReservations.filter(
                  (item) => String(item.status).toUpperCase() === "ISSUED",
                );

                if (issued.length === 0) {
                  return (
                    <div className="libraryEmpty">
                      <Icon name="book" size={30} />

                      <h3>No issued books</h3>

                      <p>No books are currently issued to students.</p>
                    </div>
                  );
                }

                return issued.map((reservation) => (
                  <div className="libraryReservationCard" key={reservation.id}>
                    <div className="libraryReservationMain">
                      <div className="libraryStudentAvatar">
                        {getInitials(reservation.studentName)}
                      </div>

                      <div>
                        <h3>{reservation.studentName}</h3>

                        <p>
                          {reservation.course || "Student"}

                          {reservation.semester
                            ? ` • Semester ${reservation.semester}`
                            : ""}
                        </p>

                        {reservation.registerNo && (
                          <small>Reg No: {reservation.registerNo}</small>
                        )}
                      </div>
                    </div>

                    <div className="libraryReservationBook">
                      <span>BOOK</span>

                      <strong>{reservation.bookTitle}</strong>

                      <small>{reservation.bookCode}</small>
                    </div>

                    <div className="libraryReservationTime">
                      <span>ISSUED</span>

                      <strong>{formatDateTime(reservation.issuedAt)}</strong>

                      <small>Due {formatDate(reservation.dueDate)}</small>
                    </div>

                    <div className="libraryReservationStatus">
                      <span className="libraryStatus issued">ISSUED</span>

                      {canReturn && (
                        <button
                          type="button"
                          className="libraryReturnButton"
                          disabled={processingId === reservation.id}
                          onClick={() => handleReturn(reservation)}
                        >
                          {processingId === reservation.id
                            ? "Processing..."
                            : "Mark Returned"}
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </section>
      )}

      {/* ===================================================
          STAFF LOANS TAB
      =================================================== */}

      {activeTab === "staffLoans" && (
        <section className="libraryPanel libraryStaffLoansPanel">
          {/* STAFF LOANS HEADER */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              padding: "2px 0 14px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "5px",
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eef2ff",
                    color: "#4f46e5",
                  }}
                >
                  <Icon name="users" size={19} />
                </div>

                <div>
                  <h2
                    style={{
                      margin: 0,
                      color: "#111827",
                      fontSize: "20px",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Staff Loans
                  </h2>

                  <p
                    style={{
                      margin: "3px 0 0",
                      color: "#64748b",
                      fontSize: "12px",
                    }}
                  >
                    Manage books issued to faculty and staff.
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {(canIssue || canManage) && (
                <button
                  type="button"
                  onClick={openTeacherModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "11px",
                    padding: "10px 14px",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: "11px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="users" size={14} />
                  Add Teacher
                </button>
              )}

              {canIssue && (
                <button
                  type="button"
                  onClick={openStaffIssueModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    border: "none",
                    borderRadius: "11px",
                    padding: "11px 16px",
                    background: "#111827",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 5px 14px rgba(15,23,42,0.12)",
                  }}
                >
                  <Icon name="plus" size={15} />
                  Issue Book
                </button>
              )}
            </div>
          </div>

          {/* STAFF LOAN SUMMARY */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#64748b",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                <Icon name="book" size={14} />
                ACTIVE LOANS
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  color: "#111827",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                {staffLoans.filter((loan) => loan.status === "ISSUED").length}
              </strong>

              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                }}
              >
                Books currently with staff
              </span>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#64748b",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                <Icon name="users" size={14} />
                STAFF MEMBERS
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  color: "#111827",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                {
                  new Set(
                    staffLoans
                      .filter((loan) => loan.status === "ISSUED")
                      .map((loan) => loan.staffName.trim().toLowerCase()),
                  ).size
                }
              </strong>

              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                }}
              >
                With active books
              </span>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#64748b",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                <Icon name="check" size={14} />
                RETURNED
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: "7px",
                  color: "#111827",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                {staffLoans.filter((loan) => loan.status === "RETURNED").length}
              </strong>

              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "9px",
                }}
              >
                Completed staff loans
              </span>
            </div>
          </div>

          {/* TEACHER LIST */}
          <div
            style={{
              marginBottom: "16px",
              padding: "12px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "8px",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#111827",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  Library Teachers
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: "3px",
                    color: "#94a3b8",
                    fontSize: "9px",
                  }}
                >
                  Select from these teachers when issuing books.
                </span>
              </div>

              <span
                style={{
                  padding: "5px 8px",
                  borderRadius: "7px",
                  background: "#f1f5f9",
                  color: "#475569",
                  fontSize: "8px",
                  fontWeight: 900,
                }}
              >
                {teachers.length} ADDED
              </span>
            </div>

            {teachers.length === 0 ? (
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  color: "#64748b",
                  fontSize: "10px",
                }}
              >
                No teachers added yet. Use "Add Teacher" to create the list.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "7px",
                  flexWrap: "wrap",
                }}
              >
                {teachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "7px 9px",
                      borderRadius: "9px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "7px",
                        background: "#eef2ff",
                        color: "#4f46e5",
                        fontSize: "8px",
                        fontWeight: 900,
                      }}
                    >
                      {getInitials(teacher.name)}
                    </span>

                    <span
                      style={{
                        color: "#334155",
                        fontSize: "9px",
                        fontWeight: 800,
                      }}
                    >
                      {teacher.name}
                    </span>

                    <span
                      style={{
                        padding: "3px 5px",
                        borderRadius: "5px",
                        background:
                          teacher.activeLoans >= 5 ? "#fff1f2" : "#f1f5f9",
                        color: teacher.activeLoans >= 5 ? "#be123c" : "#64748b",
                        fontSize: "7px",
                        fontWeight: 900,
                      }}
                    >
                      {teacher.activeLoans}/5
                    </span>

                    {canManage && teacher.activeLoans === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(teacher)}
                        style={{
                          width: "20px",
                          height: "20px",
                          border: "none",
                          borderRadius: "6px",
                          background: "#fff1f2",
                          color: "#dc2626",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        title="Remove teacher"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SEARCH */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 11px",
              marginBottom: "11px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              maxWidth: "520px",
            }}
          >
            <Icon name="search" size={16} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff, book or code..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#111827",
                fontSize: "12px",
              }}
            />
          </div>

          {/* STAFF LOANS */}
          {loading ? (
            <div
              style={{
                minHeight: "180px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              Loading staff loans...
            </div>
          ) : filteredStaffLoans.length === 0 ? (
            <div
              style={{
                minHeight: "220px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                textAlign: "center",
                background: "#ffffff",
                border: "1px dashed #cbd5e1",
                borderRadius: "16px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f1f5f9",
                  color: "#64748b",
                  marginBottom: "12px",
                }}
              >
                <Icon name="book" size={23} />
              </div>

              <h3
                style={{
                  margin: "0 0 5px",
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 800,
                }}
              >
                No staff loans
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "11px",
                }}
              >
                No books are currently issued to faculty or staff.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {filteredStaffLoans.map((loan) => {
                const issued = loan.status === "ISSUED";

                return (
                  <article
                    key={loan.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(190px, 1.15fr) minmax(180px, 1fr) minmax(130px, .7fr) auto",
                      gap: "16px",
                      alignItems: "center",
                      padding: "12px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "15px",
                      boxShadow: "0 3px 12px rgba(15,23,42,0.035)",
                    }}
                  >
                    {/* STAFF */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "11px",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          width: "42px",
                          height: "42px",
                          borderRadius: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#eef2ff",
                          color: "#4f46e5",
                          fontSize: "12px",
                          fontWeight: 900,
                        }}
                      >
                        {getInitials(loan.staffName)}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#111827",
                            fontSize: "13px",
                            fontWeight: 800,
                          }}
                        >
                          {loan.staffName}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "3px",
                            color: "#64748b",
                            fontSize: "10px",
                          }}
                        >
                          Faculty / Staff
                        </span>

                        <span
                          style={{
                            display: "block",
                            marginTop: "3px",
                            color: "#94a3b8",
                            fontSize: "9px",
                          }}
                        >
                          Issued {formatDateTime(loan.issuedAt)}
                        </span>
                      </div>
                    </div>

                    {/* BOOK */}
                    <div
                      style={{
                        minWidth: 0,
                        paddingLeft: "14px",
                        borderLeft: "1px solid #f1f5f9",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#94a3b8",
                          fontSize: "8px",
                          fontWeight: 900,
                          letterSpacing: ".08em",
                          marginBottom: "5px",
                        }}
                      >
                        BOOK
                      </span>

                      <strong
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "#1e293b",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {loan.bookTitle}
                      </strong>

                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          color: "#64748b",
                          fontSize: "9px",
                        }}
                      >
                        {loan.bookCode || "No book code"}
                      </span>
                    </div>

                    {/* DUE */}
                    <div
                      style={{
                        paddingLeft: "14px",
                        borderLeft: "1px solid #f1f5f9",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#94a3b8",
                          fontSize: "8px",
                          fontWeight: 900,
                          letterSpacing: ".08em",
                          marginBottom: "5px",
                        }}
                      >
                        DUE DATE
                      </span>

                      <strong
                        style={{
                          display: "block",
                          color: issued ? "#111827" : "#64748b",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        {formatDate(loan.dueDate)}
                      </strong>

                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          color: "#94a3b8",
                          fontSize: "9px",
                        }}
                      >
                        {loan.returnedAt
                          ? `Returned ${formatDateTime(loan.returnedAt)}`
                          : issued
                            ? "Currently with staff"
                            : "Loan completed"}
                      </span>
                    </div>

                    {/* ACTION */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "8px",
                        minWidth: "105px",
                      }}
                    >
                      <span
                        style={{
                          padding: "6px 9px",
                          borderRadius: "8px",
                          background: issued ? "#eff6ff" : "#f0fdf4",
                          color: issued ? "#2563eb" : "#15803d",
                          fontSize: "8px",
                          fontWeight: 900,
                        }}
                      >
                        {issued ? "ISSUED" : "RETURNED"}
                      </span>

                      {issued && canReturn && (
                        <button
                          type="button"
                          disabled={processingId === loan.id}
                          onClick={() => handleStaffReturn(loan)}
                          style={{
                            border: "1px solid #fecaca",
                            borderRadius: "9px",
                            padding: "8px 10px",
                            background: "#fffafa",
                            color: "#dc2626",
                            fontSize: "9px",
                            fontWeight: 800,
                            cursor:
                              processingId === loan.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: processingId === loan.id ? 0.6 : 1,
                          }}
                        >
                          {processingId === loan.id ? "..." : "Return"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===================================================
          ADD TEACHER MODAL
      =================================================== */}

      {teacherModalOpen && (
        <div
          className="libraryModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTeacherModalOpen(false);
            }
          }}
        >
          <div
            className="libraryModal"
            style={{
              width: "min(440px, calc(100vw - 32px))",
              borderRadius: "18px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px",
                background: "#111827",
                color: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      marginBottom: "7px",
                      padding: "5px 8px",
                      borderRadius: "7px",
                      background: "rgba(255,255,255,.1)",
                      fontSize: "8px",
                      fontWeight: 900,
                      letterSpacing: ".08em",
                    }}
                  >
                    LIBRARY STAFF
                  </span>

                  <h2
                    style={{
                      margin: 0,
                      fontSize: "19px",
                      fontWeight: 900,
                    }}
                  >
                    Add Teacher
                  </h2>

                  <p
                    style={{
                      margin: "5px 0 0",
                      color: "#cbd5e1",
                      fontSize: "10px",
                    }}
                  >
                    Add a teacher once and select them when issuing books.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setTeacherModalOpen(false)}
                  style={{
                    width: "30px",
                    height: "30px",
                    border: "none",
                    borderRadius: "9px",
                    background: "rgba(255,255,255,.1)",
                    color: "#fff",
                    fontSize: "20px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: "20px", background: "#fff" }}>
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  marginBottom: "18px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "10px",
                    fontWeight: 900,
                  }}
                >
                  TEACHER NAME
                </span>

                <input
                  value={teacherName}
                  onChange={(event) => setTeacherName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleAddTeacher();
                    }
                  }}
                  placeholder="Enter teacher name"
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid #dbe3ec",
                    borderRadius: "10px",
                    outline: "none",
                    color: "#111827",
                    background: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setTeacherModalOpen(false)}
                  style={{
                    height: "40px",
                    padding: "0 15px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    background: "#fff",
                    color: "#475569",
                    fontSize: "10px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={processingId === "teacher:add"}
                  onClick={() => void handleAddTeacher()}
                  style={{
                    height: "40px",
                    padding: "0 17px",
                    border: "none",
                    borderRadius: "10px",
                    background: "#111827",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 800,
                    cursor:
                      processingId === "teacher:add"
                        ? "not-allowed"
                        : "pointer",
                    opacity: processingId === "teacher:add" ? 0.6 : 1,
                  }}
                >
                  {processingId === "teacher:add" ? "Adding..." : "Add Teacher"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          STAFF ISSUE MODAL
      =================================================== */}

      {staffModalOpen && (
        <div
          className="libraryModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStaffModalOpen(false);
            }
          }}
        >
          <div
            className="libraryModal"
            style={{
              width: "min(520px, calc(100vw - 32px))",
              borderRadius: "18px",
              overflow: "hidden",
            }}
          >
            {/* MODAL HEADER */}
            <div
              style={{
                padding: "20px 20px 17px",
                background: "#111827",
                color: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      marginBottom: "7px",
                      padding: "5px 8px",
                      borderRadius: "7px",
                      background: "rgba(255,255,255,.1)",
                      fontSize: "8px",
                      fontWeight: 900,
                      letterSpacing: ".08em",
                    }}
                  >
                    <Icon name="users" size={11} />
                    STAFF LIBRARY
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: 900,
                    }}
                  >
                    Issue a Book
                  </h2>

                  <p
                    style={{
                      margin: "5px 0 0",
                      color: "#cbd5e1",
                      fontSize: "10px",
                    }}
                  >
                    Maximum 5 active books per staff member.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  style={{
                    width: "30px",
                    height: "30px",
                    border: "none",
                    borderRadius: "9px",
                    background: "rgba(255,255,255,.1)",
                    color: "#ffffff",
                    fontSize: "20px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* FORM */}
            <div
              style={{
                padding: "20px",
                background: "#ffffff",
              }}
            >
              {/* TEACHER */}
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  marginBottom: "15px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "10px",
                    fontWeight: 900,
                  }}
                >
                  TEACHER
                </span>

                <select
                  value={selectedTeacherId}
                  onChange={(event) => {
                    const id = event.target.value;

                    const teacher = teachers.find((item) => item.id === id);

                    setSelectedTeacherId(id);

                    setStaffName(teacher?.name ?? "");
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid #dbe3ec",
                    borderRadius: "10px",
                    outline: "none",
                    color: "#111827",
                    background: "#f8fafc",
                    fontSize: "11px",
                  }}
                >
                  <option value="">Select teacher</option>

                  {teachers.map((teacher) => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                      disabled={teacher.activeLoans >= 5}
                    >
                      {teacher.name} — {teacher.activeLoans}/5 books
                      {teacher.activeLoans >= 5 ? " (Limit reached)" : ""}
                    </option>
                  ))}
                </select>

                {selectedTeacherId && (
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "8px",
                    }}
                  >
                    {teachers.find(
                      (teacher) => teacher.id === selectedTeacherId,
                    )?.activeLoans ?? 0}
                    /5 active books
                  </span>
                )}
              </label>

              {/* BOOK */}
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  marginBottom: "15px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "10px",
                    fontWeight: 900,
                  }}
                >
                  BOOK
                </span>

                <select
                  value={staffBookId}
                  onChange={(event) => setStaffBookId(event.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid #dbe3ec",
                    borderRadius: "10px",
                    outline: "none",
                    color: "#111827",
                    background: "#f8fafc",
                    fontSize: "11px",
                  }}
                >
                  <option value="">Select an available book</option>

                  {books
                    .filter(
                      (book) =>
                        book.status === "ACTIVE" && book.availableCopies > 0,
                    )
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} — {book.availableCopies} available
                      </option>
                    ))}
                </select>
              </label>

              {/* DUE DATE */}
              <label
                style={{
                  display: "grid",
                  gap: "7px",
                  marginBottom: "17px",
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontSize: "10px",
                    fontWeight: 900,
                  }}
                >
                  DUE DATE
                </span>

                <input
                  type="date"
                  value={staffDueDate}
                  onChange={(event) => setStaffDueDate(event.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "44px",
                    padding: "0 12px",
                    border: "1px solid #dbe3ec",
                    borderRadius: "10px",
                    outline: "none",
                    color: "#111827",
                    background: "#f8fafc",
                    fontSize: "11px",
                  }}
                />
              </label>

              {/* INFO */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "11px",
                  marginBottom: "18px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #eef2f7",
                }}
              >
                <Icon name="info" size={15} />

                <span
                  style={{
                    color: "#64748b",
                    fontSize: "9px",
                    lineHeight: 1.45,
                  }}
                >
                  The book will be marked as issued and one available copy will
                  be deducted automatically.
                </span>
              </div>

              {/* FOOTER */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  style={{
                    height: "40px",
                    padding: "0 15px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "10px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={processingId !== null}
                  onClick={handleStaffIssue}
                  style={{
                    height: "40px",
                    padding: "0 17px",
                    border: "none",
                    borderRadius: "10px",
                    background: "#111827",
                    color: "#ffffff",
                    fontSize: "10px",
                    fontWeight: 800,
                    cursor: processingId !== null ? "not-allowed" : "pointer",
                    opacity: processingId !== null ? 0.6 : 1,
                  }}
                >
                  {processingId !== null ? "Issuing..." : "Issue Book"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          BOOK DETAILS MODAL
      =================================================== */}

      {selectedBook && (
        <div
          className="libraryModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBook(null);
            }
          }}
        >
          <div className="libraryModal">
            <div className="libraryModalHeader">
              <div>
                <span>BOOK DETAILS</span>

                <h2>{selectedBook.title}</h2>

                <p>{selectedBook.bookCode}</p>
              </div>

              <button
                type="button"
                className="libraryModalClose"
                onClick={() => setSelectedBook(null)}
              >
                ×
              </button>
            </div>

            <div className="libraryBookDetailsGrid">
              <div>
                <span>Author</span>

                <strong>{selectedBook.author || "—"}</strong>
              </div>

              <div>
                <span>ISBN</span>

                <strong>{selectedBook.isbn || "—"}</strong>
              </div>

              <div>
                <span>Course</span>

                <strong>{selectedBook.course || "—"}</strong>
              </div>

              <div>
                <span>Semester</span>

                <strong>
                  {selectedBook.semester
                    ? `Semester ${selectedBook.semester}`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Category</span>

                <strong>{selectedBook.category || "—"}</strong>
              </div>

              <div>
                <span>Shelf</span>

                <strong>{selectedBook.shelfLocation || "—"}</strong>
              </div>

              <div>
                <span>Total Copies</span>

                <strong>{selectedBook.totalCopies}</strong>
              </div>

              <div>
                <span>Available Copies</span>

                <strong>{selectedBook.availableCopies}</strong>
              </div>
            </div>

            {selectedBook.description && (
              <div className="libraryDescription">
                <span>Description</span>

                <p>{selectedBook.description}</p>
              </div>
            )}

            <div className="libraryModalFooter">
              <button
                type="button"
                className="librarySecondaryButton"
                onClick={() => setSelectedBook(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          STAFF LOANS COMPACT SPACING
          Scoped only to the Staff Loans panel.
      =================================================== */}
      <style jsx global>{`
        .libraryStaffLoansPanel {
          padding: 16px !important;
        }

        .libraryStaffLoansPanel .libraryReservationList {
          padding: 0 !important;
          gap: 8px !important;
        }

        .libraryStaffLoansPanel .libraryFilters {
          margin-top: 0 !important;
        }

        .libraryStaffLoansPanel article {
          min-height: 0 !important;
        }

        @media (max-width: 900px) {
          .libraryStaffLoansPanel {
            padding: 14px !important;
          }

          .libraryStaffLoansPanel article {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .libraryStaffLoansPanel article > div {
            padding-left: 0 !important;
            border-left: none !important;
          }

          .libraryStaffLoansPanel article > div:last-child {
            justify-content: flex-start !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 560px) {
          .libraryStaffLoansPanel {
            padding: 12px !important;
          }

          .libraryStaffLoansPanel .libraryStaffLoansHeader {
            padding-bottom: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}
