/* 
  LIBRARY — FACULTY INTEGRATION
  --------------------------------
  Admin / Library:
    - Books
    - Reservations
    - Issued
    - Staff Books
    - Issue Book only (faculty comes from Faculty module)

  Faculty:
    - Books
    - My Books
    - No reservations / issued management / issue controls

  Faculty identity is auth.users.id -> staff_profiles.auth_user_id.
  Passwords are never stored in this component or in faculty_profiles.
*/

"use client";

/* LIBRARY FINAL V12 — staff_profiles as the single Faculty source of truth */

/* LIBRARY FINAL V7 — faculty-integrated flow + larger staff books tab + clean table */

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/lib/supabase";
import { subscribeToRealtime, unsubscribeRealtime } from "@/lib/realtime";
import Icon from "./Icon";
import { hasPermission, type AppUser } from "@/lib/permissions";

type LibraryBook = {
  id: string;
  bookCode: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  price: number;
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

type FacultyOption = {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  status: string;
};

type LibraryStaffLoan = {
  id: string;
  facultyId: string;
  staffName: string;
  bookId: string;
  bookTitle: string;
  bookCode: string;
  issuedAt: string | null;
  dueDate: string | null;
  returnedAt: string | null;
  status: string;
};

type AdminTab = "books" | "reservations" | "issued" | "staffBooks";
type FacultyTab = "books" | "myBooks";

function stringValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function numberValue(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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
  return parts.length
    ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("")
    : "FC";
}

export default function Library({
  onBack,
  user,
}: {
  onBack: () => void;
  user: AppUser;
}) {
  const isFaculty = user.role === "FACULTY";
  const canView = hasPermission(user, "library.view");
  const canIssue = !isFaculty && hasPermission(user, "library.issue");
  const canReturn = !isFaculty && hasPermission(user, "library.return");
  const canManage = !isFaculty && hasPermission(user, "library.manage");

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [reservations, setReservations] = useState<LibraryReservation[]>([]);
  const [staffLoans, setStaffLoans] = useState<LibraryStaffLoan[]>([]);
  const [facultyOptions, setFacultyOptions] = useState<FacultyOption[]>([]);

  const [adminTab, setAdminTab] = useState<AdminTab>("books");
  const [facultyTab, setFacultyTab] = useState<FacultyTab>("books");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedStaffTeacherId, setSelectedStaffTeacherId] = useState("");
  const [staffBookId, setStaffBookId] = useState("");
  const [staffDueDate, setStaffDueDate] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = isFaculty ? facultyTab : adminTab;

  function showError(message: string) {
    setError(message);
    setSuccess("");
  }

  function showSuccess(message: string) {
    setSuccess(message);
    setError("");
  }

  async function loadBooks() {
    const { data, error } = await supabase
      .from("library_books")
      .select(
        "id,book_code,title,author,isbn,category,price,total_copies,available_copies,description,shelf_location,status,created_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    setBooks(
      (data ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        bookCode: String(row.book_code ?? ""),
        title: String(row.title ?? ""),
        author: String(row.author ?? ""),
        isbn: String(row.isbn ?? ""),
        category: String(row.category ?? ""),
        price: Number(row.price ?? 0),
        totalCopies: Number(row.total_copies ?? 0),
        availableCopies: Number(row.available_copies ?? 0),
        description: String(row.description ?? ""),
        shelfLocation: String(row.shelf_location ?? ""),
        status:
          String(row.status ?? "ACTIVE").toUpperCase() === "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE",
        createdAt: String(row.created_at ?? ""),
      })),
    );
  }

  async function loadReservations() {
    if (isFaculty) return;

    const { data, error } = await supabase.rpc("get_library_reservations");
    if (error) throw error;

    setReservations(
      (data ?? []).map((row: any) => ({
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
      })),
    );
  }

  async function loadStaffLoans() {
    const rpcName = isFaculty
      ? "get_my_library_books"
      : "get_library_staff_loans";

    const { data, error } = await supabase.rpc(rpcName);
    if (error) throw error;

    setStaffLoans(
      (data ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        facultyId: String(row.faculty_id ?? ""),
        staffName: String(row.staff_name ?? "Unknown Faculty"),
        bookId: String(row.book_id ?? ""),
        bookTitle: String(row.book_title ?? "Unknown Book"),
        bookCode: String(row.book_code ?? ""),
        issuedAt: row.issued_at ?? null,
        dueDate: row.due_date ?? null,
        returnedAt: row.returned_at ?? null,
        status: String(row.status ?? "ISSUED").toUpperCase(),
      })),
    );
  }

  async function loadFacultyOptions() {
    if (isFaculty) return;

    /*
      Faculty & Staff is the single source of truth.
      Do NOT read faculty_profiles here.

      The RPC returns active FACULTY rows from staff_profiles, which is
      also the table used by the login system and by
      issue_library_book_to_faculty().
    */
    const { data, error } = await supabase.rpc(
      "get_library_faculty_options",
    );

    if (error) throw error;

    setFacultyOptions(
      (data ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        authUserId: String(row.auth_user_id ?? ""),
        name: String(row.name ?? ""),
        email: String(row.email ?? ""),
        employeeId: String(row.employee_id ?? ""),
        department: String(row.department ?? ""),
        status: String(row.status ?? "Active"),
      })),
    );
  }

  async function loadLibrary(showLoader = true) {
    if (showLoader) setLoading(true);

    try {
      setError("");

      if (isFaculty) {
        await Promise.all([loadBooks(), loadStaffLoans()]);
      } else {
        await Promise.all([
          loadBooks(),
          loadReservations(),
          loadStaffLoans(),
          loadFacultyOptions(),
        ]);
      }
    } catch (err: any) {
      console.error("LIBRARY LOAD ERROR", err);
      showError(err?.message ?? "Unable to load library.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadLibrary();
    // user role / permission changes should reload the correct mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, isFaculty, user.id]);

  useEffect(() => {
    if (!canView) return;

    const channel = subscribeToRealtime(
      ["library_books", "library_reservations", "library_staff_loans"],
      () => void loadLibrary(false),
    );

    return () => {
      void unsubscribeRealtime(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, isFaculty]);

  async function handleImportBooks(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!canManage) {
      showError("You do not have permission to manage library books.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (!workbook.SheetNames.length) {
        throw new Error("No worksheet found.");
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      }) as Record<string, unknown>[];

      if (!rows.length) throw new Error("The Excel file is empty.");

      const insertRows = rows.map((row) => {
        const total = Math.max(0, numberValue(row["Total Copies"], 0));
        const available = Math.max(
          0,
          Math.min(
            total,
            numberValue(row["Available Copies"], total),
          ),
        );

        return {
          book_code: stringValue(row["Book Code"]),
          title: stringValue(row["Title"]),
          author: stringValue(row["Author"]),
          isbn: stringValue(row["ISBN"]),
          category: stringValue(row["Category"]),
          price: Math.max(0, numberValue(row["Price"], 0)),
          total_copies: total,
          available_copies: available,
          description: stringValue(row["Description"]),
          shelf_location: stringValue(row["Shelf Location"]),
          status: "ACTIVE",
        };
      });

      if (insertRows.some((row) => !row.book_code || !row.title)) {
        throw new Error("Every book must have Book Code and Title.");
      }

      for (let i = 0; i < insertRows.length; i += 100) {
        const { error } = await supabase
          .from("library_books")
          .insert(insertRows.slice(i, i + 100));
        if (error) throw error;
      }

      await loadBooks();
      showSuccess(`${insertRows.length} book(s) imported successfully.`);
    } catch (err: any) {
      console.error("BOOK IMPORT ERROR", err);
      showError(err?.message ?? "Unable to import books.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleExportBooksPdf() {
    if (!books.length) {
      showError("There are no books to export.");
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("College Library - Books", 14, 15);

      autoTable(doc, {
        startY: 22,
        head: [[
          "Code",
          "Book",
          "Author",
          "ISBN",
          "Category",
          "Price",
          "Copies",
          "Available",
          "Shelf",
          "Status",
        ]],
        body: books.map((book) => [
          book.bookCode || "—",
          book.title || "—",
          book.author || "—",
          book.isbn || "—",
          book.category || "—",
          `₹${book.price.toFixed(2)}`,
          String(book.totalCopies),
          String(book.availableCopies),
          book.shelfLocation || "—",
          book.status,
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fontStyle: "bold" },
        theme: "grid",
        margin: { left: 10, right: 10 },
      });

      doc.save(`library-books-${new Date().toISOString().slice(0, 10)}.pdf`);
      showSuccess("Library books exported successfully.");
    } catch (err: any) {
      console.error("EXPORT ERROR", err);
      showError(err?.message ?? "Unable to export books.");
    }
  }

  function openIssueModal() {
    if (!canIssue) {
      showError("You do not have permission to issue books.");
      return;
    }

    setSelectedFacultyId(facultyOptions[0]?.id ?? "");
    setStaffBookId("");
    setStaffDueDate("");
    setError("");
    setSuccess("");
    setStaffModalOpen(true);
  }

  async function handleIssueToFaculty() {
    if (!canIssue) return;

    const faculty = facultyOptions.find(
      (item) => item.id === selectedFacultyId,
    );

    if (!faculty) {
      showError("Please select a faculty member.");
      return;
    }

    if (!staffBookId) {
      showError("Please select a book.");
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

    setProcessingId("issue-faculty");
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc(
        "issue_library_book_to_faculty",
        {
          p_faculty_id: faculty.id,
          p_book_id: staffBookId,
          p_due_date: staffDueDate || null,
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message ?? "Book issue was not completed.");
      }

      setStaffModalOpen(false);
      await loadLibrary(false);
      setAdminTab("staffBooks");
      showSuccess(`"${book.title}" issued to ${faculty.name}.`);
    } catch (err: any) {
      console.error("FACULTY BOOK ISSUE ERROR", err);
      showError(err?.message ?? "Unable to issue book.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReturnStaffBook(loan: LibraryStaffLoan) {
    if (isFaculty) {
      showError("Faculty cannot return books from the admin controls.");
      return;
    }

    if (!canReturn) {
      showError("You do not have permission to return books.");
      return;
    }

    if (!window.confirm(`Mark "${loan.bookTitle}" as returned?`)) return;

    setProcessingId(loan.id);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc(
        "return_library_staff_book",
        { p_loan_id: loan.id },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message ?? "Book return was not completed.");
      }

      await loadLibrary(false);
      showSuccess(`"${loan.bookTitle}" returned successfully.`);
    } catch (err: any) {
      console.error("STAFF RETURN ERROR", err);
      showError(err?.message ?? "Unable to return book.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleIssueStudentBook(reservation: LibraryReservation) {
    if (!canIssue) {
      showError("You do not have permission to issue books.");
      return;
    }

    if (!window.confirm(
      `Issue "${reservation.bookTitle}" to ${reservation.studentName}?`,
    )) {
      return;
    }

    setProcessingId(reservation.id);
    try {
      const { data, error } = await supabase.rpc("issue_library_book", {
        p_reservation_id: reservation.id,
        p_due_date: null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Book issue was not completed.");
      await loadLibrary(false);
      setAdminTab("issued");
      showSuccess(
        `${reservation.bookTitle} issued to ${reservation.studentName}.`,
      );
    } catch (err: any) {
      showError(err?.message ?? "Unable to issue book.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReturnStudentBook(reservation: LibraryReservation) {
    if (!canReturn) {
      showError("You do not have permission to return books.");
      return;
    }

    if (!window.confirm(
      `Mark "${reservation.bookTitle}" returned by ${reservation.studentName}?`,
    )) {
      return;
    }

    setProcessingId(reservation.id);
    try {
      const { data, error } = await supabase.rpc("return_library_book", {
        p_reservation_id: reservation.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Book return was not completed.");
      await loadLibrary(false);
      setAdminTab("books");
      showSuccess(`${reservation.bookTitle} returned successfully.`);
    } catch (err: any) {
      showError(err?.message ?? "Unable to return book.");
    } finally {
      setProcessingId(null);
    }
  }

  const categories = useMemo(
    () =>
      Array.from(
        new Set(books.map((book) => book.category).filter(Boolean)),
      ).sort(),
    [books],
  );

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.bookCode.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "ALL" || book.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [books, search, categoryFilter]);

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter(
      (item) =>
        !q ||
        item.studentName.toLowerCase().includes(q) ||
        item.bookTitle.toLowerCase().includes(q) ||
        item.bookCode.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q),
    );
  }, [reservations, search]);

  const myBooks = useMemo(
    () =>
      staffLoans.filter(
        (loan) => loan.facultyId === user.id,
      ),
    [staffLoans, user.id],
  );

  const filteredMyBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myBooks.filter(
      (loan) =>
        !q ||
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.bookCode.toLowerCase().includes(q),
    );
  }, [myBooks, search]);

  const selectedTeacher = useMemo(
    () =>
      facultyOptions.find(
        (faculty) => faculty.id === selectedStaffTeacherId,
      ) ?? null,
    [facultyOptions, selectedStaffTeacherId],
  );

  const teacherFilteredLoans = useMemo(() => {
    if (!selectedTeacher) return [];

    const selectedName = selectedTeacher.name.trim().toLowerCase();

    return staffLoans.filter((loan) => {
      const facultyIdMatches =
        Boolean(loan.facultyId) &&
        loan.facultyId === selectedTeacher.id;

      /*
       * Legacy library loans may have been created before the
       * faculty_id column was linked to staff_profiles. Those rows
       * still contain staff_name, so keep them visible for the
       * matching Faculty & Staff account.
       */
      const legacyNameMatches =
        !loan.facultyId &&
        loan.staffName.trim().toLowerCase() === selectedName;

      return facultyIdMatches || legacyNameMatches;
    });
  }, [staffLoans, selectedTeacher]);

  const filteredStaffLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teacherFilteredLoans.filter(
      (loan) =>
        !q ||
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.bookCode.toLowerCase().includes(q),
    );
  }, [teacherFilteredLoans, search]);

  const reservedCount = reservations.filter(
    (item) => item.status === "RESERVED",
  ).length;

  const issuedCount = reservations.filter(
    (item) => item.status === "ISSUED",
  ).length;

  const staffIssuedCount = staffLoans.filter(
    (item) => item.status === "ISSUED",
  ).length;

  const totalCopies = books.reduce(
    (sum, book) => sum + book.totalCopies,
    0,
  );

  const availableCopies = books.reduce(
    (sum, book) => sum + book.availableCopies,
    0,
  );

  if (!canView) {
    return (
      <div className="libraryPage">
        <section className="libraryHeader">
          <button
            type="button"
            className="libraryBackButton"
            onClick={onBack}
          >
            <span className="libraryBackArrow">←</span>
            Back
          </button>
        </section>

        <div className="libraryAccessDenied">
          <div className="libraryAccessIcon">
            <Icon name="lock" size={24} />
          </div>
          <h2>Library Access Restricted</h2>
          <p>
            Library access is not enabled for this account.
          </p>
          <button type="button" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`libraryPage ${isFaculty ? "libraryFacultyMode" : ""}`}>
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

          <div className="libraryKicker">
            <Icon name="book" size={16} />
            COLLEGE LIBRARY
          </div>

          <h1>{isFaculty ? "Library" : "Library Management"}</h1>

          <p>
            {isFaculty
              ? "Browse library books and track the books issued to you."
              : "Manage books, reservations, student issues and faculty book loans."}
          </p>
        </div>

        {!isFaculty && (
          <div className="libraryHeaderActions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={handleImportBooks}
            />

            <button
              type="button"
              className="libraryExportButton"
              onClick={handleExportBooksPdf}
              disabled={loading || books.length === 0}
            >
              <Icon name="download" size={16} />
              Export PDF
            </button>

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
        )}
      </section>

      {error && (
        <div className="libraryMessage libraryMessageError">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}

      {success && (
        <div className="libraryMessage libraryMessageSuccess">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>×</button>
        </div>
      )}

      {!isFaculty && (
        <section className="libraryStatsGrid">
          <div className="libraryStatCard">
            <div className="libraryStatIcon">
              <Icon name="book" size={21} />
            </div>
            <div className="libraryStatContent">
              <span>Total Copies</span>
              <strong>{loading ? "—" : totalCopies}</strong>
              <small>Across all books</small>
            </div>
          </div>

          <div className="libraryStatCard">
            <div className="libraryStatIcon">
              <Icon name="check" size={21} />
            </div>
            <div className="libraryStatContent">
              <span>Available</span>
              <strong>{loading ? "—" : availableCopies}</strong>
              <small>Copies available</small>
            </div>
          </div>

          <div className="libraryStatCard">
            <div className="libraryStatIcon">
              <Icon name="clock" size={21} />
            </div>
            <div className="libraryStatContent">
              <span>Reserved</span>
              <strong>{loading ? "—" : reservedCount}</strong>
              <small>Waiting for pickup</small>
            </div>
          </div>

          <div className="libraryStatCard">
            <div className="libraryStatIcon">
              <Icon name="book" size={21} />
            </div>
            <div className="libraryStatContent">
              <span>Faculty Books</span>
              <strong>{loading ? "—" : staffIssuedCount}</strong>
              <small>Currently with faculty</small>
            </div>
          </div>
        </section>
      )}

      <div className="libraryTabs">
        {isFaculty ? (
          <>
            <button
              type="button"
              className={facultyTab === "books" ? "active" : ""}
              onClick={() => {
                setFacultyTab("books");
                setSearch("");
              }}
            >
              <Icon name="book" size={15} />
              Books
              <span className="libraryTabCount">{books.length}</span>
            </button>

            <button
              type="button"
              className={facultyTab === "myBooks" ? "active" : ""}
              onClick={() => {
                setFacultyTab("myBooks");
                setSearch("");
              }}
            >
              <Icon name="book" size={15} />
              My Books
              <span className="libraryTabCount">{myBooks.length}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={adminTab === "books" ? "active" : ""}
              onClick={() => {
                setAdminTab("books");
                setSearch("");
              }}
            >
              <Icon name="book" size={15} />
              Books
              <span className="libraryTabCount">{books.length}</span>
            </button>

            <button
              type="button"
              className={adminTab === "reservations" ? "active" : ""}
              onClick={() => {
                setAdminTab("reservations");
                setSearch("");
              }}
            >
              <Icon name="clock" size={15} />
              Reservations
              <span className="libraryTabCount">{reservedCount}</span>
            </button>

            <button
              type="button"
              className={adminTab === "issued" ? "active" : ""}
              onClick={() => {
                setAdminTab("issued");
                setSearch("");
              }}
            >
              <Icon name="book" size={15} />
              Issued
              <span className="libraryTabCount">{issuedCount}</span>
            </button>

            <button
              type="button"
              className={adminTab === "staffBooks" ? "active" : ""}
              onClick={() => {
                setAdminTab("staffBooks");
                setSearch("");
              }}
            >
              <Icon name="users" size={15} />
              Staff Books
              <span className="libraryTabCount">{staffIssuedCount}</span>
            </button>
          </>
        )}
      </div>

      {/* =====================================================
          BOOKS
      ===================================================== */}
      {activeTab === "books" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>{isFaculty ? "Library Books" : "Library Books"}</h2>
              <p>
                {isFaculty
                  ? "Browse books currently available in the library."
                  : "Browse and manage the college library collection."}
              </p>
            </div>
          </div>

          <div className="libraryFilters">
            <div className="librarySearch">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search books, authors or book code..."
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

          <div className="libraryTableWrap">
            <table className="libraryTable">
              <thead>
                <tr>
                  <th>BOOK</th>
                  <th>AUTHOR</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>COPIES</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="libraryEmpty">Loading books...</div>
                    </td>
                  </tr>
                ) : filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
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
                      <td>{book.category || "—"}</td>
                      <td>₹{book.price.toFixed(2)}</td>
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

      {/* =====================================================
          FACULTY — MY BOOKS
      ===================================================== */}
      {isFaculty && facultyTab === "myBooks" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>My Books</h2>
              <p>Books currently issued to your faculty account.</p>
            </div>
          </div>

          <div className="libraryFilters">
            <div className="librarySearch">
              <Icon name="search" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search my books..."
              />
            </div>
          </div>

          {loading ? (
            <div className="libraryEmpty">Loading your books...</div>
          ) : filteredMyBooks.length === 0 ? (
            <div className="libraryEmpty">
              <Icon name="book" size={30} />
              <h3>No books issued</h3>
              <p>You do not currently have any library books.</p>
            </div>
          ) : (
            <div className="facultyMyBooksList">
              {filteredMyBooks.map((loan) => (
                <article className="facultyMyBookRow" key={loan.id}>
                  <div className="facultyMyBookIcon">
                    <Icon name="book" size={17} />
                  </div>

                  <div className="facultyMyBookMain">
                    <strong>{loan.bookTitle}</strong>
                    <span>{loan.bookCode || "No book code"}</span>
                  </div>

                  <div>
                    <small>ISSUED</small>
                    <strong>{formatDateTime(loan.issuedAt)}</strong>
                  </div>

                  <div>
                    <small>DUE DATE</small>
                    <strong>{formatDate(loan.dueDate)}</strong>
                  </div>

                  <span
                    className={`facultyMyBookStatus ${
                      String(loan.status).toUpperCase() === "ISSUED"
                        ? "issued"
                        : String(loan.status).toUpperCase() === "RETURNED"
                          ? "returned"
                          : "other"
                    }`}
                  >
                    {String(loan.status).toUpperCase()}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          RESERVATIONS — ADMIN ONLY
      ===================================================== */}
      {!isFaculty && adminTab === "reservations" && (
        <section className="libraryPanel">
          <div className="libraryPanelHeader">
            <div>
              <h2>Book Reservations</h2>
              <p>Student reservations waiting for issue.</p>
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
                  (item) => item.status === "RESERVED",
                );

                if (!pending.length) {
                  return (
                    <div className="libraryEmpty">
                      <Icon name="clock" size={30} />
                      <h3>No reservations</h3>
                      <p>There are no pending book reservations.</p>
                    </div>
                  );
                }

                return pending.map((reservation) => (
                  <div
                    className="libraryReservationCard"
                    key={reservation.id}
                  >
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
                      <strong>
                        {formatDateTime(reservation.reservedAt)}
                      </strong>
                      <small>
                        Pickup before{" "}
                        {formatDateTime(reservation.pickupDeadline)}
                      </small>
                    </div>

                    <div className="libraryReservationStatus">
                      <span className="libraryStatus reserved">
                        RESERVED
                      </span>
                      {canIssue && (
                        <button
                          type="button"
                          className="libraryIssueButton"
                          disabled={processingId === reservation.id}
                          onClick={() =>
                            void handleIssueStudentBook(reservation)
                          }
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

      {/* =====================================================
          ISSUED — ADMIN ONLY
      ===================================================== */}
      {!isFaculty && adminTab === "issued" && (
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
                  (item) => item.status === "ISSUED",
                );

                if (!issued.length) {
                  return (
                    <div className="libraryEmpty">
                      <Icon name="book" size={30} />
                      <h3>No issued books</h3>
                      <p>No books are currently issued to students.</p>
                    </div>
                  );
                }

                return issued.map((reservation) => (
                  <div
                    className="libraryReservationCard"
                    key={reservation.id}
                  >
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
                      <strong>
                        {formatDateTime(reservation.issuedAt)}
                      </strong>
                      <small>
                        Due {formatDate(reservation.dueDate)}
                      </small>
                    </div>

                    <div className="libraryReservationStatus">
                      <span className="libraryStatus issued">ISSUED</span>
                      {canReturn && (
                        <button
                          type="button"
                          className="libraryReturnButton"
                          disabled={processingId === reservation.id}
                          onClick={() =>
                            void handleReturnStudentBook(reservation)
                          }
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

      {/* =====================================================
          STAFF BOOKS — ADMIN ONLY
      ===================================================== */}
      {!isFaculty && adminTab === "staffBooks" && (
        <section className="libraryPanel libraryStaffBooksPanel">
          <div className="libraryPanelHeader libraryStaffBooksHeader">
            <div>
              <span className="staffBooksEyebrow">FACULTY LIBRARY</span>
              <h2>Staff Books</h2>
              <p>
                Select a faculty member to view the books issued to them.
              </p>
            </div>

            {canIssue && (
              <button
                type="button"
                className="libraryPrimaryButton staffIssueButton"
                onClick={openIssueModal}
              >
                <Icon name="plus" size={16} />
                Issue Book
              </button>
            )}
          </div>

          <div className="staffTeacherSelector">
            <div className="staffTeacherSelectorLabel">
              <Icon name="users" size={16} />
              <div>
                <strong>Faculty</strong>
                <span>Select a teacher to view their books</span>
              </div>
            </div>

            <div className="staffTeacherSelectWrap">
              <select
                className="staffTeacherSelect"
                value={selectedStaffTeacherId}
                onChange={(event) => {
                  setSelectedStaffTeacherId(event.target.value);
                  setSearch("");
                }}
              >
                <option value="">Select faculty member</option>
                {facultyOptions.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedStaffTeacherId ? (
            <div className="libraryEmpty staffTeacherEmpty">
              <Icon name="users" size={34} />
              <h3>Select a faculty member</h3>
              <p>
                Choose a teacher from the dropdown above to view their issued
                and returned book records.
              </p>
            </div>
          ) : (
            <>
              <div className="staffBooksToolbar">
                <div className="staffBooksCurrentTeacher">
                  <span>BOOKS OF</span>
                  <strong>{selectedTeacher?.name ?? "Selected Faculty"}</strong>
                </div>

                <div className="librarySearch staffBooksSearch">
                  <Icon name="search" size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search book or code..."
                  />
                </div>

                <div className="staffBooksCount">
                  <strong>{filteredStaffLoans.length}</strong>
                  <span>records</span>
                </div>
              </div>

              {loading ? (
                <div className="libraryEmpty staffBooksEmpty">
                  <Icon name="users" size={30} />
                  <h3>Loading faculty books...</h3>
                </div>
              ) : filteredStaffLoans.length === 0 ? (
                <div className="libraryEmpty staffBooksEmpty">
                  <Icon name="book" size={32} />
                  <h3>No book records</h3>
                  <p>
                    This faculty member has no books matching your search.
                  </p>
                </div>
              ) : (
                <div className="libraryStaffTable staffBooksTable">
                  <div className="libraryStaffTableHeader">
                    <span>BOOK</span>
                    <span>ISSUED</span>
                    <span>DUE DATE</span>
                    <span>STATUS</span>
                    <span>ACTION</span>
                  </div>

                  {filteredStaffLoans.map((loan) => (
                    <div
                      className="libraryStaffTableRow"
                      key={loan.id}
                    >
                      <div className="staffBookCell">
                        <strong>{loan.bookTitle}</strong>
                        <small>{loan.bookCode || "No book code"}</small>
                      </div>

                      <div>
                        <strong>{formatDateTime(loan.issuedAt)}</strong>
                      </div>

                      <div>
                        <strong>{formatDate(loan.dueDate)}</strong>
                      </div>

                      <div>
                        <span
                          className={
                            loan.status === "ISSUED"
                              ? "libraryStaffStatus issued"
                              : "libraryStaffStatus returned"
                          }
                        >
                          <i />
                          {loan.status}
                        </span>
                      </div>

                      <div className="staffActionCell">
                        {loan.status === "ISSUED" && canReturn ? (
                          <button
                            type="button"
                            className="libraryReturnButton staffReturnButton"
                            disabled={processingId === loan.id}
                            onClick={() =>
                              void handleReturnStaffBook(loan)
                            }
                          >
                            {processingId === loan.id
                              ? "Returning..."
                              : "Return"}
                          </button>
                        ) : (
                          <span className="staffNoAction">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* =====================================================
          ISSUE BOOK MODAL
      ===================================================== */}
      {!isFaculty && staffModalOpen && (
        <div
          className="libraryModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setStaffModalOpen(false);
            }
          }}
        >
          <div className="libraryModal libraryIssueModal">
            <div className="libraryModalHeader">
              <div>
                <span>FACULTY LIBRARY</span>
                <h2>Issue Book</h2>
                <p>
                  Select a faculty member already created in Faculty & Staff.
                </p>
              </div>

              <button
                type="button"
                className="libraryModalClose"
                onClick={() => setStaffModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="libraryIssueForm">
              <label>
                <span>FACULTY</span>
                <select
                  value={selectedFacultyId}
                  onChange={(event) =>
                    setSelectedFacultyId(event.target.value)
                  }
                >
                  <option value="">Select faculty</option>
                  {facultyOptions.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name} — {faculty.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>BOOK</span>
                <select
                  value={staffBookId}
                  onChange={(event) =>
                    setStaffBookId(event.target.value)
                  }
                >
                  <option value="">Select available book</option>
                  {books
                    .filter(
                      (book) =>
                        book.status === "ACTIVE" &&
                        book.availableCopies > 0,
                    )
                    .map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} — {book.availableCopies} available
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>DUE DATE</span>
                <input
                  type="date"
                  value={staffDueDate}
                  onChange={(event) =>
                    setStaffDueDate(event.target.value)
                  }
                />
              </label>

              <div className="libraryIssueInfo">
                <Icon name="info" size={15} />
                <span>
                  The selected faculty account will automatically see this
                  book inside <strong>My Books</strong> after issue.
                </span>
              </div>

              <div className="libraryModalFooter">
                <button
                  type="button"
                  className="librarySecondaryButton"
                  onClick={() => setStaffModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="libraryPrimaryButton"
                  disabled={processingId === "issue-faculty"}
                  onClick={() => void handleIssueToFaculty()}
                >
                  {processingId === "issue-faculty"
                    ? "Issuing..."
                    : "Issue Book"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          BOOK DETAILS
      ===================================================== */}
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
                <span>Category</span>
                <strong>{selectedBook.category || "—"}</strong>
              </div>
              <div>
                <span>Price</span>
                <strong>₹{selectedBook.price.toFixed(2)}</strong>
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

      <style jsx global>{`
        .libraryExportButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 39px;
          padding: 0 14px;
          border: 1px solid #17365d;
          border-radius: 10px;
          background: #17365d;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(23,54,93,.14);
        }

        .libraryExportButton:hover:not(:disabled) {
          background: #0f2948;
        }

        .libraryExportButton:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .libraryFacultyMode .libraryHeader {
          margin-bottom: 15px;
        }

        .libraryAccessDenied {
          min-height: 55vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 30px;
        }

        .libraryAccessIcon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #f3f5f8;
          color: #64748b;
        }

        .libraryAccessDenied h2 {
          margin: 15px 0 5px;
          color: #142033;
          font-size: 20px;
          font-weight: 900;
        }

        .libraryAccessDenied p {
          margin: 0 0 16px;
          color: #7c8797;
          font-size: 11px;
        }

        .libraryAccessDenied button {
          border: 0;
          border-radius: 9px;
          padding: 10px 15px;
          background: #17365d;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .facultyMyBooksList {
          display: grid;
          gap: 7px;
        }

        .facultyMyBookRow {
          display: grid;
          grid-template-columns: 36px minmax(220px, 1.5fr) minmax(150px, 1fr) minmax(120px, .8fr) 80px;
          align-items: center;
          gap: 12px;
          min-height: 60px;
          padding: 8px 11px;
          border: 1px solid #e1e7ee;
          border-radius: 11px;
          background: #fff;
        }

        .facultyMyBookIcon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #edf2f7;
          color: #17365d;
        }

        .facultyMyBookMain {
          min-width: 0;
        }

        .facultyMyBookMain strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #182337;
          font-size: 10px;
          font-weight: 900;
        }

        .facultyMyBookMain span {
          display: block;
          margin-top: 3px;
          color: #98a3b1;
          font-size: 7px;
        }

        .facultyMyBookRow > div:not(.facultyMyBookMain):not(.facultyMyBookIcon) {
          min-width: 0;
        }

        .facultyMyBookRow small {
          display: block;
          color: #9aa5b3;
          font-size: 5px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .facultyMyBookRow > div > strong {
          display: block;
          margin-top: 4px;
          color: #475569;
          font-size: 7px;
          font-weight: 800;
        }

        .facultyMyBookStatus {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 7px;
          border-radius: 7px;
          background: #eef4fa;
          color: #17365d;
          font-size: 6px;
          font-weight: 900;
        }

        .libraryStaffTable {
          width: 100%;
          overflow: hidden;
          border: 1px solid #e1e7ee;
          border-radius: 12px;
          background: #fff;
        }

        .libraryStaffTableHeader,
        .libraryStaffTableRow {
          display: grid;
          grid-template-columns: minmax(150px, 1fr) minmax(190px, 1.4fr) minmax(120px, .9fr) minmax(90px, .7fr) 80px 80px;
          align-items: center;
          gap: 10px;
        }

        .libraryStaffTableHeader {
          min-height: 31px;
          padding: 0 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e8edf2;
        }

        .libraryStaffTableHeader span {
          color: #98a3b1;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: .09em;
        }

        .libraryStaffTableRow {
          min-height: 59px;
          padding: 7px 12px;
          border-bottom: 1px solid #edf1f5;
        }

        .libraryStaffTableRow:last-child {
          border-bottom: 0;
        }

        .libraryStaffTableRow > div {
          min-width: 0;
          color: #475569;
          font-size: 7px;
        }

        .libraryStaffTableRow strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #263448;
          font-size: 8px;
          font-weight: 850;
        }

        .libraryStaffTableRow small {
          display: block;
          margin-top: 3px;
          color: #9aa5b3;
          font-size: 6px;
        }

        .libraryStaffStatus {
          display: inline-flex;
          padding: 5px 7px;
          border-radius: 7px;
          font-size: 6px;
          font-weight: 900;
        }

        .libraryStaffStatus.issued {
          background: #eef4fa;
          color: #17365d;
        }

        .libraryStaffStatus.returned {
          background: #effaf3;
          color: #15803d;
        }

        .libraryIssueModal {
          width: min(520px, calc(100vw - 32px));
        }

        .libraryIssueForm {
          display: grid;
          gap: 14px;
          padding: 20px;
        }

        .libraryIssueForm label {
          display: grid;
          gap: 7px;
        }

        .libraryIssueForm label > span {
          color: #334155;
          font-size: 9px;
          font-weight: 900;
        }

        .libraryIssueForm select,
        .libraryIssueForm input {
          width: 100%;
          box-sizing: border-box;
          height: 43px;
          padding: 0 11px;
          border: 1px solid #dbe3ec;
          border-radius: 9px;
          outline: none;
          background: #f8fafc;
          color: #172033;
          font-size: 10px;
        }

        .libraryIssueForm select:focus,
        .libraryIssueForm input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139,92,246,.07);
        }

        .libraryIssueInfo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border: 1px solid #eee9fb;
          border-radius: 9px;
          background: #faf8ff;
          color: #756b89;
          font-size: 8px;
          line-height: 1.45;
        }

        @media (max-width: 850px) {
          .facultyMyBookRow {
            grid-template-columns: 34px 1fr;
            gap: 8px;
          }

          .facultyMyBookRow > div:not(.facultyMyBookMain):not(.facultyMyBookIcon),
          .facultyMyBookStatus {
            grid-column: 2;
          }

          .libraryStaffTableHeader {
            display: none;
          }

          .libraryStaffTableRow {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 10px;
          }

          .libraryStaffTableRow > div:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 600px) {
          .libraryTabs {
            overflow-x: auto;
          }

          .libraryStaffTableRow {
            grid-template-columns: 1fr;
          }

          .libraryStaffTableRow > div:last-child {
            grid-column: auto;
          }
        }

        /* =====================================================
           LIBRARY V7 FINAL VISUAL OVERRIDES
           ===================================================== */

        .libraryTabs {
          display: flex !important;
          align-items: center !important;
          gap: 5px !important;
          min-height: 54px !important;
          padding: 5px !important;
          overflow-x: auto !important;
          scrollbar-width: none !important;
          border: 1px solid #e0e6ee !important;
          border-radius: 14px !important;
          background: #f7f9fc !important;
        }

        .libraryTabs::-webkit-scrollbar {
          display: none;
        }

        .libraryTabs > button {
          min-height: 43px !important;
          padding: 0 16px !important;
          border-radius: 10px !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          white-space: nowrap !important;
        }

        .libraryTabs > button.active {
          background: #fff !important;
          border: 1px solid #e1e6ed !important;
          color: #172033 !important;
          box-shadow: 0 3px 10px rgba(15,23,42,.08) !important;
        }

        .libraryTabs > button:last-child.active {
          color: #5b3aa1 !important;
        }

        .libraryTabCount {
          min-width: 21px !important;
          height: 21px !important;
          padding: 0 6px !important;
          border-radius: 6px !important;
          background: #f0eaff !important;
          color: #7c4fe8 !important;
          font-size: 7px !important;
          font-weight: 900 !important;
        }

        .libraryStaffBooksPanel {
          overflow: hidden !important;
        }

        .libraryStaffBooksHeader {
          padding: 22px !important;
          border-bottom: 1px solid #edf1f5 !important;
        }

        .staffBooksEyebrow {
          display: block;
          margin-bottom: 5px;
          color: #8b5cf6;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .libraryStaffBooksHeader h2 {
          margin: 0 !important;
          color: #142033 !important;
          font-size: 21px !important;
          line-height: 1.15 !important;
          font-weight: 900 !important;
        }

        .libraryStaffBooksHeader p {
          margin-top: 6px !important;
          color: #7d8999 !important;
          font-size: 10px !important;
        }

        .staffIssueButton {
          min-height: 43px !important;
          padding: 0 16px !important;
          border-radius: 10px !important;
          background: #17365d !important;
          border-color: #17365d !important;
          font-size: 10px !important;
        }

        .staffBooksToolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 22px;
          background: #fbfcfe;
          border-bottom: 1px solid #edf1f5;
        }

        .staffBooksSearch {
          width: min(500px, 100%) !important;
          min-height: 42px !important;
          border-radius: 10px !important;
        }

        .staffBooksSearch input {
          font-size: 10px !important;
        }

        .staffBooksCount {
          display: inline-flex;
          align-items: baseline;
          gap: 5px;
          padding: 8px 11px;
          border: 1px solid #e4e9ef;
          border-radius: 9px;
          background: #fff;
        }

        .staffBooksCount strong {
          color: #17365d;
          font-size: 14px;
          font-weight: 900;
        }

        .staffBooksCount span {
          color: #929dac;
          font-size: 7px;
          font-weight: 800;
        }

        .staffBooksTable {
          border: 0 !important;
          border-radius: 0 !important;
        }

        .staffBooksTable .libraryStaffTableHeader,
        .staffBooksTable .libraryStaffTableRow {
          grid-template-columns:
            minmax(175px, 1fr)
            minmax(220px, 1.45fr)
            minmax(125px, .9fr)
            minmax(105px, .75fr)
            105px
            95px !important;
          gap: 15px !important;
          padding-left: 22px !important;
          padding-right: 22px !important;
        }

        .staffBooksTable .libraryStaffTableHeader {
          min-height: 38px !important;
        }

        .staffBooksTable .libraryStaffTableHeader span {
          font-size: 7px !important;
        }

        .staffBooksTable .libraryStaffTableRow {
          min-height: 72px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        .staffBooksTable .libraryStaffTableRow > div {
          font-size: 8px !important;
        }

        .staffBooksTable .libraryStaffTableRow strong {
          font-size: 9px !important;
        }

        .staffBooksTable .libraryStaffTableRow small {
          font-size: 7px !important;
        }

        .staffFacultyCell {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .staffFacultyAvatar {
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f0eaff;
          color: #7544df;
          font-size: 8px;
          font-weight: 900;
        }

        .staffFacultyCell strong {
          max-width: 150px;
        }

        .staffBookCell {
          min-width: 0;
        }

        .libraryStaffStatus {
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          padding: 6px 8px !important;
          border-radius: 7px !important;
          font-size: 7px !important;
        }

        .libraryStaffStatus i {
          width: 5px;
          height: 5px;
          display: inline-block;
          border-radius: 50%;
        }

        .libraryStaffStatus.issued i {
          background: #17365d;
        }

        .libraryStaffStatus.returned i {
          background: #22c55e;
        }

        .staffActionCell {
          display: flex;
          justify-content: flex-end;
        }

        .staffReturnButton {
          min-width: 76px !important;
          min-height: 32px !important;
          border-radius: 8px !important;
          font-size: 7px !important;
          background: #17365d !important;
          border-color: #17365d !important;
        }

        .staffNoAction {
          color: #aab3be;
          font-size: 10px;
        }

        .staffBooksEmpty {
          min-height: 210px !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #fff !important;
        }

        @media (max-width: 850px) {
          .libraryTabs > button {
            min-height: 39px !important;
            padding: 0 12px !important;
          }

          .staffBooksToolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .staffBooksSearch {
            width: 100% !important;
          }

          .staffBooksCount {
            align-self: flex-start;
          }

          .staffBooksTable .libraryStaffTableHeader {
            display: none;
          }

          .staffBooksTable .libraryStaffTableRow {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            padding: 12px 14px !important;
          }

          .staffFacultyCell,
          .staffBookCell {
            grid-column: 1 / -1;
          }

          .staffBooksTable .libraryStaffTableRow > div:last-child {
            grid-column: 1 / -1;
          }

          .staffActionCell {
            justify-content: stretch;
          }

          .staffReturnButton {
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .libraryTabs {
            min-height: 47px !important;
          }

          .libraryTabs > button {
            min-height: 36px !important;
            padding: 0 10px !important;
            font-size: 8px !important;
          }

          .libraryStaffBooksHeader {
            padding: 17px !important;
          }

          .libraryStaffBooksHeader h2 {
            font-size: 18px !important;
          }
        }


        /* =====================================================
           LIBRARY V9 — LARGER TABLES + MY BOOKS STATUS
           ===================================================== */

        /* Main tabs */
        .libraryTabs {
          min-height: 62px !important;
          padding: 7px !important;
          gap: 7px !important;
          border-radius: 15px !important;
        }

        .libraryTabs > button {
          min-height: 50px !important;
          padding: 0 20px !important;
          gap: 8px !important;
          border-radius: 11px !important;
          font-size: 11px !important;
        }

        .libraryTabCount {
          min-width: 24px !important;
          height: 24px !important;
          padding: 0 7px !important;
          border-radius: 7px !important;
          font-size: 8px !important;
        }

        /* Staff Books */
        .libraryStaffBooksHeader {
          padding: 28px !important;
        }

        .libraryStaffBooksHeader h2 {
          font-size: 23px !important;
        }

        .libraryStaffBooksHeader p {
          font-size: 11px !important;
        }

        .staffIssueButton {
          min-height: 48px !important;
          padding: 0 20px !important;
          font-size: 11px !important;
        }

        .staffBooksToolbar {
          padding: 18px 28px !important;
          gap: 16px !important;
        }

        .staffBooksSearch {
          min-height: 50px !important;
          width: min(560px, 100%) !important;
        }

        .staffBooksSearch input {
          font-size: 11px !important;
        }

        .staffBooksTable .libraryStaffTableHeader,
        .staffBooksTable .libraryStaffTableRow {
          grid-template-columns:
            minmax(215px, 1fr)
            minmax(285px, 1.45fr)
            minmax(165px, .9fr)
            minmax(135px, .75fr)
            120px
            108px !important;
          gap: 20px !important;
          padding-left: 28px !important;
          padding-right: 28px !important;
        }

        .staffBooksTable .libraryStaffTableHeader {
          min-height: 47px !important;
        }

        .staffBooksTable .libraryStaffTableHeader span {
          font-size: 8px !important;
        }

        .staffBooksTable .libraryStaffTableRow {
          min-height: 90px !important;
          padding-top: 14px !important;
          padding-bottom: 14px !important;
        }

        .staffBooksTable .libraryStaffTableRow > div {
          font-size: 9px !important;
        }

        .staffBooksTable .libraryStaffTableRow strong {
          font-size: 11px !important;
        }

        .staffBooksTable .libraryStaffTableRow small {
          font-size: 8px !important;
          margin-top: 5px !important;
        }

        .staffFacultyCell {
          gap: 12px !important;
        }

        .staffFacultyAvatar {
          width: 44px !important;
          height: 44px !important;
          flex-basis: 44px !important;
          border-radius: 11px !important;
          font-size: 10px !important;
        }

        .libraryStaffStatus {
          padding: 8px 11px !important;
          border-radius: 9px !important;
          font-size: 8px !important;
        }

        .staffReturnButton {
          min-width: 88px !important;
          min-height: 38px !important;
          font-size: 8px !important;
        }

        /* =====================================================
           FACULTY — MY BOOKS
           ===================================================== */

        .facultyMyBooksList {
          gap: 10px !important;
        }

        .facultyMyBookRow {
          grid-template-columns:
            48px
            minmax(285px, 1.6fr)
            minmax(190px, 1fr)
            minmax(155px, .85fr)
            125px !important;
          min-height: 86px !important;
          padding: 14px 18px !important;
          gap: 17px !important;
          border-radius: 13px !important;
          border-color: #dce4ec !important;
          box-shadow: 0 2px 8px rgba(15,23,42,.035) !important;
        }

        .facultyMyBookIcon {
          width: 46px !important;
          height: 46px !important;
          border-radius: 11px !important;
        }

        .facultyMyBookIcon svg {
          width: 21px !important;
          height: 21px !important;
        }

        .facultyMyBookMain strong {
          font-size: 12px !important;
          line-height: 1.35 !important;
        }

        .facultyMyBookMain span {
          margin-top: 5px !important;
          font-size: 8px !important;
        }

        .facultyMyBookRow small {
          font-size: 8px !important;
          letter-spacing: .08em !important;
        }

        .facultyMyBookRow > div > strong {
          margin-top: 5px !important;
          font-size: 9px !important;
        }

        .facultyMyBookStatus {
          min-width: 92px !important;
          min-height: 34px !important;
          padding: 0 12px !important;
          border-radius: 9px !important;
          font-size: 8px !important;
          font-weight: 950 !important;
          letter-spacing: .02em !important;
        }

        /* Issued = green */
        .facultyMyBookStatus.issued {
          background: #ecfdf3 !important;
          border: 1px solid #bbf7d0 !important;
          color: #15803d !important;
        }

        /* Returned = red */
        .facultyMyBookStatus.returned {
          background: #fff1f2 !important;
          border: 1px solid #fecdd3 !important;
          color: #dc2626 !important;
        }

        .facultyMyBookStatus.other {
          background: #f1f5f9 !important;
          border: 1px solid #e2e8f0 !important;
          color: #475569 !important;
        }

        /* My Books search */
        .facultyMyBooksList + * {
          min-height: 0;
        }

        @media (max-width: 850px) {
          .libraryTabs {
            min-height: 54px !important;
          }

          .libraryTabs > button {
            min-height: 44px !important;
            padding: 0 15px !important;
          }

          .staffBooksTable .libraryStaffTableRow {
            min-height: 100px !important;
            padding: 15px 18px !important;
          }

          .facultyMyBookRow {
            grid-template-columns: 46px 1fr !important;
            min-height: 92px !important;
            gap: 12px !important;
          }

          .facultyMyBookRow > div:not(.facultyMyBookMain):not(.facultyMyBookIcon),
          .facultyMyBookStatus {
            grid-column: 2 !important;
          }

          .facultyMyBookStatus {
            justify-self: start;
          }
        }

        @media (max-width: 600px) {
          .libraryTabs {
            min-height: 50px !important;
          }

          .libraryTabs > button {
            min-height: 40px !important;
            padding: 0 12px !important;
            font-size: 9px !important;
          }

          .staffBooksTable .libraryStaffTableRow {
            min-height: 0 !important;
          }

          .facultyMyBookRow {
            grid-template-columns: 42px 1fr !important;
            min-height: 100px !important;
            padding: 15px !important;
          }

          .facultyMyBookIcon {
            width: 42px !important;
            height: 42px !important;
          }
        }


        /* =====================================================
           V10 — TEACHER DROPDOWN + LARGER BOOK DETAILS
           ===================================================== */

        .staffTeacherSelector {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px 28px;
          background: #fbfcfe;
          border-bottom: 1px solid #e7edf3;
        }

        .staffTeacherSelectorLabel {
          display: flex;
          align-items: center;
          gap: 11px;
          color: #17365d;
        }

        .staffTeacherSelectorLabel > svg {
          flex: 0 0 auto;
        }

        .staffTeacherSelectorLabel div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .staffTeacherSelectorLabel strong {
          color: #172033;
          font-size: 11px;
          font-weight: 900;
        }

        .staffTeacherSelectorLabel span {
          color: #8b97a6;
          font-size: 8px;
        }

        .staffTeacherSelectWrap {
          width: min(390px, 100%);
        }

        .staffTeacherSelect {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #dce4ec;
          border-radius: 10px;
          background: #fff;
          color: #172033;
          font-size: 10px;
          font-weight: 800;
          outline: none;
          cursor: pointer;
        }

        .staffTeacherSelect:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139,92,246,.10);
        }

        .staffSelectedTeacher {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin: 16px 28px 0;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          background: #fff;
        }

        .staffSelectedTeacher > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .staffSelectedTeacher span:first-child {
          color: #8b97a6;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .1em;
        }

        .staffSelectedTeacher strong {
          color: #172033;
          font-size: 12px;
          font-weight: 900;
        }

        .staffSelectedTeacherCount {
          padding: 7px 10px;
          border-radius: 8px;
          background: #ecfdf3;
          color: #15803d;
          font-size: 8px;
          font-weight: 900;
        }

        .staffTeacherEmpty {
          min-height: 260px !important;
          border: 0 !important;
          background: #fff !important;
        }

        /* Five-column Staff Books table after removing repeated faculty name. */
        .staffBooksTable .libraryStaffTableHeader,
        .staffBooksTable .libraryStaffTableRow {
          grid-template-columns:
            minmax(300px, 1.8fr)
            minmax(180px, 1fr)
            minmax(150px, .85fr)
            125px
            110px !important;
          gap: 22px !important;
          padding-left: 28px !important;
          padding-right: 28px !important;
        }

        .staffBooksTable .libraryStaffTableRow {
          min-height: 92px !important;
        }

        .staffBooksTable .staffBookCell strong {
          font-size: 12px !important;
          line-height: 1.4 !important;
        }

        .staffBooksTable .staffBookCell small {
          font-size: 8px !important;
          margin-top: 5px !important;
        }

        .staffBooksTable .libraryStaffTableRow > div > strong {
          font-size: 9px !important;
        }

        /* Make Return button readable — white text on navy. */
        .staffBooksTable .staffReturnButton {
          min-width: 92px !important;
          min-height: 40px !important;
          padding: 0 14px !important;
          border: 1px solid #17365d !important;
          border-radius: 9px !important;
          background: #17365d !important;
          color: #ffffff !important;
          font-size: 9px !important;
          font-weight: 900 !important;
          box-shadow: 0 4px 10px rgba(23,54,93,.12) !important;
        }

        .staffBooksTable .staffReturnButton:hover {
          background: #102b4d !important;
          border-color: #102b4d !important;
        }

        .staffBooksTable .staffReturnButton:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        /* My Books: requested +6px book title size. */
        .facultyMyBookMain strong {
          font-size: 18px !important;
          line-height: 1.25 !important;
          font-weight: 900 !important;
        }

        .facultyMyBookMain span {
          font-size: 10px !important;
          margin-top: 6px !important;
        }

        .facultyMyBookRow {
          min-height: 94px !important;
          padding: 15px 19px !important;
          gap: 18px !important;
        }

        .facultyMyBookIcon {
          width: 48px !important;
          height: 48px !important;
        }

        @media (max-width: 850px) {
          .staffTeacherSelector {
            align-items: stretch;
            flex-direction: column;
            padding: 16px 18px;
          }

          .staffTeacherSelectWrap {
            width: 100%;
          }

          .staffSelectedTeacher {
            margin-left: 18px;
            margin-right: 18px;
          }

          .staffBooksTable .libraryStaffTableHeader {
            display: none;
          }

          .staffBooksTable .libraryStaffTableRow {
            grid-template-columns: 1fr 1fr !important;
            min-height: 0 !important;
            gap: 12px !important;
            padding: 16px 18px !important;
          }

          .staffBooksTable .staffBookCell {
            grid-column: 1 / -1;
          }

          .staffBooksTable .staffActionCell {
            grid-column: 1 / -1;
            justify-content: stretch;
          }

          .staffBooksTable .staffReturnButton {
            width: 100%;
          }

          .facultyMyBookMain strong {
            font-size: 18px !important;
          }
        }

        @media (max-width: 600px) {
          .staffSelectedTeacher {
            margin-left: 14px;
            margin-right: 14px;
          }

          .facultyMyBookMain strong {
            font-size: 18px !important;
          }

          .facultyMyBookRow {
            min-height: 104px !important;
          }
        }


        /* =====================================================
           V11 — CLEAN TEACHER SELECTOR / LEGACY LOAN MATCH
           ===================================================== */

        .staffBooksToolbar {
          align-items: center !important;
        }

        .staffBooksCurrentTeacher {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
          min-width: 155px;
          padding-right: 4px;
        }

        .staffBooksCurrentTeacher span {
          color: #8b97a6;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .1em;
        }

        .staffBooksCurrentTeacher strong {
          color: #172033;
          font-size: 11px;
          font-weight: 900;
        }

        .staffBooksToolbar .staffBooksSearch {
          flex: 1 1 auto;
          margin-left: auto;
        }

        /* Keep the return action clearly readable. */
        .staffBooksTable .staffReturnButton {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #ffffff !important;
          background: #17365d !important;
          border-color: #17365d !important;
          font-size: 9px !important;
          font-weight: 900 !important;
          text-shadow: none !important;
        }

        @media (max-width: 850px) {
          .staffBooksToolbar {
            align-items: stretch !important;
          }

          .staffBooksCurrentTeacher {
            min-width: 0;
            padding-right: 0;
          }

          .staffBooksToolbar .staffBooksSearch {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
