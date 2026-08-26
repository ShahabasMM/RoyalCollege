"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabase";
import Icon from "./Icon";

import {
  hasPermission,
  type AppUser,
} from "@/lib/permissions";

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

  returnedAt: string | null;

  status: string;

  studentName: string;

  registerNo: string;

  course: string;

  semester: number | null;

  bookTitle: string;

  bookCode: string;
};

type Tab =
  | "books"
  | "reservations"
  | "issued";

/* =========================================================
   HELPERS
========================================================= */

function stringValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function numberValue(
  value: unknown,
  fallback = 0,
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function semesterValue(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function getInitials(
  name: string,
): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
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

  const canViewLibrary =
    hasPermission(
      user,
      "library.view",
    );

  const canReserve =
    hasPermission(
      user,
      "library.reserve",
    );

  const canIssue =
    hasPermission(
      user,
      "library.issue",
    );

  const canReturn =
    hasPermission(
      user,
      "library.return",
    );

  const canManage =
    hasPermission(
      user,
      "library.manage",
    );

  /* =======================================================
     STATE
  ======================================================= */

  const [books, setBooks] =
    useState<LibraryBook[]>([]);

  const [reservations, setReservations] =
    useState<LibraryReservation[]>([]);

  const [activeTab, setActiveTab] =
    useState<Tab>("books");

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [importing, setImporting] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [selectedBook, setSelectedBook] =
    useState<LibraryBook | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  /* =======================================================
     LOAD BOOKS
  ======================================================= */

  async function loadBooks() {
    try {
      const {
        data,
        error,
      } = await supabase
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

      const mapped: LibraryBook[] =
        (data ?? []).map(
          (row: any) => ({
            id: row.id,

            bookCode:
              row.book_code ?? "",

            title:
              row.title ?? "",

            author:
              row.author ?? "",

            isbn:
              row.isbn ?? "",

            category:
              row.category ?? "",

            course:
              row.course ?? "",

            semester:
              row.semester === null ||
              row.semester === undefined
                ? null
                : Number(
                    row.semester,
                  ),

            totalCopies:
              Number(
                row.total_copies ??
                  0,
              ),

            availableCopies:
              Number(
                row.available_copies ??
                  0,
              ),

            description:
              row.description ?? "",

            shelfLocation:
              row.shelf_location ??
              "",

            status:
              row.status ===
              "INACTIVE"
                ? "INACTIVE"
                : "ACTIVE",

            createdAt:
              row.created_at ?? "",
          }),
        );

      setBooks(mapped);
    } catch (err: any) {
      console.error(
        "LIBRARY BOOKS ERROR:",
        err,
      );

      throw new Error(
        err?.message ??
          "Unable to load library books.",
      );
    }
  }

  /* =======================================================
     LOAD RESERVATIONS
  ======================================================= */

  async function loadReservations() {
    try {
      const {
        data: reservationData,
        error: reservationError,
      } = await supabase
        .from(
          "library_reservations",
        )
        .select(
          `
            id,
            book_id,
            student_id,
            reserved_at,
            pickup_deadline,
            issued_at,
            returned_at,
            status
          `,
        )
        .order("reserved_at", {
          ascending: false,
        });

      if (reservationError) {
        throw reservationError;
      }

      const rawReservations =
        reservationData ?? [];

      if (
        rawReservations.length ===
        0
      ) {
        setReservations([]);
        return;
      }

      /* ================================================
         BOOK IDS
      ================================================ */

      const bookIds =
        Array.from(
          new Set(
            rawReservations
              .map(
                (item: any) =>
                  item.book_id,
              )
              .filter(Boolean),
          ),
        );

      /* ================================================
         STUDENT IDS
      ================================================ */

      const studentIds =
        Array.from(
          new Set(
            rawReservations
              .map(
                (item: any) =>
                  item.student_id,
              )
              .filter(Boolean),
          ),
        );

      /* ================================================
         BOOKS
      ================================================ */

      let reservationBooks: any[] =
        [];

      if (
        bookIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("library_books")
          .select(
            `
              id,
              book_code,
              title
            `,
          )
          .in(
            "id",
            bookIds,
          );

        if (error) {
          throw error;
        }

        reservationBooks =
          data ?? [];
      }

      /* ================================================
         STUDENTS
         
         register_no intentionally omitted.
      ================================================ */

      let reservationStudents:
        any[] = [];

      if (
        studentIds.length > 0
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("students")
          .select(
            `
              id,
              name,
              course,
              semester
            `,
          )
          .in(
            "id",
            studentIds,
          );

        if (error) {
          throw error;
        }

        reservationStudents =
          data ?? [];
      }

      /* ================================================
         MAPS
      ================================================ */

      const bookMap =
        new Map<
          string,
          any
        >();

      reservationBooks.forEach(
        (book) => {
          bookMap.set(
            book.id,
            book,
          );
        },
      );

      const studentMap =
        new Map<
          string,
          any
        >();

      reservationStudents.forEach(
        (student) => {
          studentMap.set(
            student.id,
            student,
          );
        },
      );

      /* ================================================
         BUILD
      ================================================ */

      const mapped: LibraryReservation[] =
        rawReservations.map(
          (row: any) => {
            const book =
              bookMap.get(
                row.book_id,
              );

            const student =
              studentMap.get(
                row.student_id,
              );

            return {
              id: row.id,

              bookId:
                row.book_id ?? "",

              studentId:
                row.student_id ?? "",

              reservedAt:
                row.reserved_at ??
                null,

              pickupDeadline:
                row.pickup_deadline ??
                null,

              issuedAt:
                row.issued_at ??
                null,

              returnedAt:
                row.returned_at ??
                null,

              status:
                row.status ??
                "RESERVED",

              studentName:
                student?.name ??
                "Unknown Student",

              registerNo: "",

              course:
                student?.course ??
                "",

              semester:
                student?.semester ===
                  null ||
                student?.semester ===
                  undefined
                  ? null
                  : Number(
                      student.semester,
                    ),

              bookTitle:
                book?.title ??
                "Unknown Book",

              bookCode:
                book?.book_code ??
                "",
            };
          },
        );

      setReservations(mapped);
    } catch (err: any) {
      console.error(
        "LIBRARY RESERVATIONS ERROR:",
        err,
      );

      throw new Error(
        err?.message ??
          "Unable to load reservations.",
      );
    }
  }

  /* =======================================================
     LOAD EVERYTHING
  ======================================================= */

  async function loadLibrary() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadBooks(),
        loadReservations(),
      ]);
    } catch (err: any) {
      console.error(
        "LIBRARY LOAD ERROR:",
        err,
      );

      setError(
        err?.message ??
          "Unable to load library data.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (!canViewLibrary) {
      setLoading(false);
      return;
    }

    loadLibrary();
  }, [canViewLibrary]);

  /* =======================================================
     IMPORT BOOKS
     
     library.manage required
  ======================================================= */

  async function handleImportBooks(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!canManage) {
      setError(
        "You do not have permission to manage the library.",
      );

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }

      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);

    setError("");

    setSuccess("");

    try {
      /* ================================================
         READ EXCEL
      ================================================ */

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: "array",
        });

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            defval: "",
          },
        ) as Record<
          string,
          unknown
        >[];

      if (
        rows.length === 0
      ) {
        throw new Error(
          "The Excel file is empty.",
        );
      }

      /* ================================================
         PREPARE
      ================================================ */

      const insertRows =
        rows.map((row) => {
          const totalCopies =
            numberValue(
              row[
                "Total Copies"
              ],
              0,
            );

          let availableCopies =
            numberValue(
              row[
                "Available Copies"
              ],
              totalCopies,
            );

          if (
            availableCopies <
            0
          ) {
            availableCopies = 0;
          }

          if (
            availableCopies >
            totalCopies
          ) {
            availableCopies =
              totalCopies;
          }

          return {
            book_code:
              stringValue(
                row[
                  "Book Code"
                ],
              ),

            title:
              stringValue(
                row["Title"],
              ),

            author:
              stringValue(
                row["Author"],
              ),

            isbn:
              stringValue(
                row["ISBN"],
              ),

            category:
              stringValue(
                row["Category"],
              ),

            course:
              stringValue(
                row["Course"],
              ),

            semester:
              semesterValue(
                row[
                  "Semester"
                ],
              ),

            total_copies:
              totalCopies,

            available_copies:
              availableCopies,

            description:
              stringValue(
                row[
                  "Description"
                ],
              ),

            shelf_location:
              stringValue(
                row[
                  "Shelf Location"
                ],
              ),

            status:
              "ACTIVE",
          };
        });

      /* ================================================
         VALIDATE
      ================================================ */

      const invalidRows =
        insertRows.filter(
          (row) =>
            !row.book_code ||
            !row.title,
        );

      if (
        invalidRows.length > 0
      ) {
        throw new Error(
          "Every book must have Book Code and Title.",
        );
      }

      /* ================================================
         INSERT BATCHES
      ================================================ */

      const batchSize = 100;

      for (
        let i = 0;
        i < insertRows.length;
        i += batchSize
      ) {
        const batch =
          insertRows.slice(
            i,
            i + batchSize,
          );

        const {
          error,
        } = await supabase
          .from(
            "library_books",
          )
          .insert(batch);

        if (error) {
          throw error;
        }
      }

      /* ================================================
         SUCCESS
      ================================================ */

      setSuccess(
        `${insertRows.length} book${
          insertRows.length ===
          1
            ? ""
            : "s"
        } imported successfully.`,
      );

      await loadBooks();
    } catch (err: any) {
      console.error(
        "BOOK IMPORT ERROR:",
        err,
      );

      setError(
        err?.message ??
          "Unable to import books.",
      );
    } finally {
      setImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  /* =======================================================
     ISSUE BOOK
     
     library.issue required
  ======================================================= */

  async function handleIssue(
    reservation: LibraryReservation,
  ) {
    if (!canIssue) {
      setError(
        "You do not have permission to issue books.",
      );

      return;
    }

    if (processingId) {
      return;
    }

    setProcessingId(
      reservation.id,
    );

    setError("");

    setSuccess("");

    try {
      /* ================================================
         GET BOOK
      ================================================ */

      const {
        data: book,
        error: bookError,
      } = await supabase
        .from(
          "library_books",
        )
        .select(
          `
            id,
            available_copies
          `,
        )
        .eq(
          "id",
          reservation.bookId,
        )
        .single();

      if (bookError) {
        throw bookError;
      }

      const available =
        Number(
          book.available_copies ??
            0,
        );

      if (
        available <= 0
      ) {
        throw new Error(
          "No available copy for this book.",
        );
      }

      /* ================================================
         UPDATE RESERVATION
      ================================================ */

      const now =
        new Date().toISOString();

      const {
        error:
          reservationError,
      } = await supabase
        .from(
          "library_reservations",
        )
        .update({
          status: "ISSUED",

          issued_at: now,
        })
        .eq(
          "id",
          reservation.id,
        );

      if (
        reservationError
      ) {
        throw reservationError;
      }

      /* ================================================
         DECREASE COPIES
      ================================================ */

      const {
        error:
          bookUpdateError,
      } = await supabase
        .from(
          "library_books",
        )
        .update({
          available_copies:
            available - 1,
        })
        .eq(
          "id",
          reservation.bookId,
        );

      if (
        bookUpdateError
      ) {
        throw bookUpdateError;
      }

      setSuccess(
        `${reservation.bookTitle} issued to ${reservation.studentName}.`,
      );

      await loadLibrary();
    } catch (err: any) {
      console.error(
        "ISSUE BOOK ERROR:",
        err,
      );

      setError(
        err?.message ??
          "Unable to issue book.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     RETURN BOOK
     
     library.return required
  ======================================================= */

  async function handleReturn(
    reservation: LibraryReservation,
  ) {
    if (!canReturn) {
      setError(
        "You do not have permission to return books.",
      );

      return;
    }

    if (processingId) {
      return;
    }

    setProcessingId(
      reservation.id,
    );

    setError("");

    setSuccess("");

    try {
      /* ================================================
         GET BOOK
      ================================================ */

      const {
        data: book,
        error: bookError,
      } = await supabase
        .from(
          "library_books",
        )
        .select(
          `
            id,
            total_copies,
            available_copies
          `,
        )
        .eq(
          "id",
          reservation.bookId,
        )
        .single();

      if (bookError) {
        throw bookError;
      }

      const available =
        Number(
          book.available_copies ??
            0,
        );

      const total =
        Number(
          book.total_copies ??
            0,
        );

      const newAvailable =
        Math.min(
          total,
          available + 1,
        );

      /* ================================================
         UPDATE RESERVATION
      ================================================ */

      const {
        error:
          reservationError,
      } = await supabase
        .from(
          "library_reservations",
        )
        .update({
          status: "RETURNED",

          returned_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reservation.id,
        );

      if (
        reservationError
      ) {
        throw reservationError;
      }

      /* ================================================
         UPDATE BOOK
      ================================================ */

      const {
        error:
          bookUpdateError,
      } = await supabase
        .from(
          "library_books",
        )
        .update({
          available_copies:
            newAvailable,
        })
        .eq(
          "id",
          reservation.bookId,
        );

      if (
        bookUpdateError
      ) {
        throw bookUpdateError;
      }

      setSuccess(
        `${reservation.bookTitle} returned successfully.`,
      );

      await loadLibrary();
    } catch (err: any) {
      console.error(
        "RETURN BOOK ERROR:",
        err,
      );

      setError(
        err?.message ??
          "Unable to return book.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =======================================================
     STATS
  ======================================================= */

  const totalCopies =
    books.reduce(
      (total, book) =>
        total +
        book.totalCopies,
      0,
    );

  const availableCopies =
    books.reduce(
      (total, book) =>
        total +
        book.availableCopies,
      0,
    );

  const reservedCount =
    reservations.filter(
      (item) =>
        String(
          item.status,
        ).toUpperCase() ===
        "RESERVED",
    ).length;

  const issuedCount =
    reservations.filter(
      (item) =>
        String(
          item.status,
        ).toUpperCase() ===
        "ISSUED",
    ).length;

  /* =======================================================
     CATEGORIES
  ======================================================= */

  const categories =
    useMemo(() => {
      const values =
        books
          .map(
            (book) =>
              book.category,
          )
          .filter(Boolean);

      return Array.from(
        new Set(values),
      ).sort();
    }, [books]);

  /* =======================================================
     FILTERED BOOKS
  ======================================================= */

  const filteredBooks =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return books.filter(
        (book) => {
          const matchesSearch =
            !query ||
            book.title
              .toLowerCase()
              .includes(query) ||
            book.author
              .toLowerCase()
              .includes(query) ||
            book.bookCode
              .toLowerCase()
              .includes(query) ||
            book.isbn
              .toLowerCase()
              .includes(query);

          const matchesCategory =
            categoryFilter ===
              "ALL" ||
            book.category ===
              categoryFilter;

          return (
            matchesSearch &&
            matchesCategory
          );
        },
      );
    }, [
      books,
      search,
      categoryFilter,
    ]);

  /* =======================================================
     FILTERED RESERVATIONS
  ======================================================= */

  const filteredReservations =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return reservations.filter(
        (item) => {
          if (!query) {
            return true;
          }

          return (
            item.studentName
              .toLowerCase()
              .includes(query) ||
            item.bookTitle
              .toLowerCase()
              .includes(query) ||
            item.bookCode
              .toLowerCase()
              .includes(query) ||
            item.course
              .toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      reservations,
      search,
    ]);

  /* =======================================================
     ACCESS DENIED
  ======================================================= */

  if (!canViewLibrary) {
    return (
      <div className="libraryPage">
        <section className="libraryHeader">
          <div className="libraryHeaderLeft">
            <button
              type="button"
              className="libraryBackButton"
              onClick={onBack}
            >
              <span className="libraryBackArrow">
                ←
              </span>

              Back
            </button>
          </div>
        </section>

        <div
          style={{
            minHeight:
              "55vh",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding:
              "32px",
          }}
        >
          <div
            style={{
              width:
                "100%",

              maxWidth:
                "460px",

              textAlign:
                "center",

              padding:
                "42px 28px",

              border:
                "1px solid #e5e7eb",

              borderRadius:
                "18px",

              background:
                "#ffffff",

              boxShadow:
                "0 10px 30px rgba(15,23,42,0.06)",
            }}
          >
            <div
              style={{
                width:
                  "58px",

                height:
                  "58px",

                margin:
                  "0 auto 18px",

                borderRadius:
                  "50%",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                background:
                  "#f3f4f6",

                color:
                  "#64748b",
              }}
            >
              <Icon
                name="lock"
                size={25}
              />
            </div>

            <h2
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  "20px",

                fontWeight:
                  700,

                color:
                  "#111827",
              }}
            >
              Library Access Restricted
            </h2>

            <p
              style={{
                margin:
                  "0 0 22px",

                fontSize:
                  "14px",

                lineHeight:
                  1.6,

                color:
                  "#6b7280",
              }}
            >
              You don't have permission
              to view the college library.
            </p>

            <button
              type="button"
              onClick={onBack}
              style={{
                border:
                  "none",

                borderRadius:
                  "10px",

                padding:
                  "11px 18px",

                background:
                  "#111827",

                color:
                  "#ffffff",

                fontWeight:
                  600,

                cursor:
                  "pointer",
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
     RENDER
  ======================================================= */

  return (
    <div className="libraryPage">

      {/* ===================================================
          HEADER
      =================================================== */}

      <section className="libraryHeader">

        <div className="libraryHeaderLeft">

          <button
            type="button"
            className="libraryBackButton"
            onClick={onBack}
          >
            <span className="libraryBackArrow">
              ←
            </span>

            Back
          </button>

          <div className="libraryKicker">
            <Icon
              name="book"
              size={16}
            />

            COLLEGE LIBRARY
          </div>

          <h1>
            Library Management
          </h1>

          <p>
            Manage books, reservations,
            issued books and returns.
          </p>

        </div>

        <div className="libraryHeaderActions">

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{
              display:
                "none",
            }}
            onChange={
              handleImportBooks
            }
          />

          {/* ================================================
              MANAGE PERMISSION
          ================================================ */}

          {canManage && (
            <button
              type="button"
              className="libraryPrimaryButton"
              disabled={
                importing
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <Icon
                name="upload"
                size={16}
              />

              {importing
                ? "Importing..."
                : "Import Books"}
            </button>
          )}

        </div>
      </section>

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {error && (
        <div className="libraryMessage libraryMessageError">

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>
      )}

      {success && (
        <div className="libraryMessage libraryMessageSuccess">

          <span>
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            ×
          </button>

        </div>
      )}

      {/* ===================================================
          STATS
      =================================================== */}

      <section className="libraryStatsGrid">

        <div className="libraryStatCard">

          <div className="libraryStatIcon">
            <Icon
              name="book"
              size={21}
            />
          </div>

          <div className="libraryStatContent">

            <span>
              Total Copies
            </span>

            <strong>
              {loading
                ? "—"
                : totalCopies.toLocaleString()}
            </strong>

            <small>
              Across all books
            </small>

          </div>
        </div>

        <div className="libraryStatCard">

          <div className="libraryStatIcon">
            <Icon
              name="check"
              size={21}
            />
          </div>

          <div className="libraryStatContent">

            <span>
              Available
            </span>

            <strong>
              {loading
                ? "—"
                : availableCopies.toLocaleString()}
            </strong>

            <small>
              Copies available
            </small>

          </div>
        </div>

        <div className="libraryStatCard">

          <div className="libraryStatIcon">
            <Icon
              name="clock"
              size={21}
            />
          </div>

          <div className="libraryStatContent">

            <span>
              Reserved
            </span>

            <strong>
              {loading
                ? "—"
                : reservedCount.toLocaleString()}
            </strong>

            <small>
              Waiting for pickup
            </small>

          </div>
        </div>

        <div className="libraryStatCard">

          <div className="libraryStatIcon">
            <Icon
              name="book"
              size={21}
            />
          </div>

          <div className="libraryStatContent">

            <span>
              Issued
            </span>

            <strong>
              {loading
                ? "—"
                : issuedCount.toLocaleString()}
            </strong>

            <small>
              Currently issued
            </small>

          </div>
        </div>

      </section>

      {/* ===================================================
          TABS
      =================================================== */}

      <div className="libraryTabs">

        <button
          type="button"
          className={
            activeTab ===
            "books"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "books",
            )
          }
        >
          <Icon
            name="book"
            size={15}
          />

          Books

          <span className="libraryTabCount">
            {books.length}
          </span>
        </button>

        <button
          type="button"
          className={
            activeTab ===
            "reservations"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "reservations",
            )
          }
        >
          <Icon
            name="clock"
            size={15}
          />

          Reservations

          <span className="libraryTabCount">
            {reservedCount}
          </span>
        </button>

        <button
          type="button"
          className={
            activeTab ===
            "issued"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "issued",
            )
          }
        >
          <Icon
            name="book"
            size={15}
          />

          Issued

          <span className="libraryTabCount">
            {issuedCount}
          </span>
        </button>

      </div>

      {/* ===================================================
          BOOKS
      =================================================== */}

      {activeTab ===
        "books" && (
        <section className="libraryPanel">

          <div className="libraryPanelHeader">

            <div>

              <h2>
                Library Books
              </h2>

              <p>
                Browse and manage available
                library books.
              </p>

            </div>

          </div>

          <div className="libraryFilters">

            <div className="librarySearch">

              <Icon
                name="search"
                size={16}
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search books, authors or book code..."
              />

            </div>

            <select
              value={
                categoryFilter
              }
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                All Categories
              </option>

              {categories.map(
                (
                  category,
                ) => (
                  <option
                    key={
                      category
                    }
                    value={
                      category
                    }
                  >
                    {category}
                  </option>
                ),
              )}

            </select>

          </div>

          <div className="libraryTableWrap">

            <table className="libraryTable">

              <thead>

                <tr>

                  <th>
                    BOOK
                  </th>

                  <th>
                    AUTHOR
                  </th>

                  <th>
                    COURSE
                  </th>

                  <th>
                    SEMESTER
                  </th>

                  <th>
                    CATEGORY
                  </th>

                  <th>
                    COPIES
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    ACTION
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign:
                          "center",
                        padding:
                          "40px",
                      }}
                    >
                      Loading books...
                    </td>
                  </tr>
                ) : filteredBooks.length ===
                  0 ? (
                  <tr>

                    <td colSpan={8}>

                      <div className="libraryEmpty">

                        <Icon
                          name="book"
                          size={30}
                        />

                        <h3>
                          No books found
                        </h3>

                        <p>
                          Import books using
                          the Excel import button.
                        </p>

                      </div>

                    </td>

                  </tr>
                ) : (
                  filteredBooks.map(
                    (book) => (
                      <tr
                        key={
                          book.id
                        }
                      >

                        <td>

                          <div className="libraryBookCell">

                            <strong>
                              {
                                book.title
                              }
                            </strong>

                            <span>
                              {
                                book.bookCode
                              }
                            </span>

                          </div>

                        </td>

                        <td>
                          {
                            book.author ||
                            "—"
                          }
                        </td>

                        <td>
                          {
                            book.course ||
                            "—"
                          }
                        </td>

                        <td>
                          {book.semester
                            ? `Semester ${book.semester}`
                            : "—"}
                        </td>

                        <td>
                          {
                            book.category ||
                            "—"
                          }
                        </td>

                        <td>

                          <span
                            className={
                              book.availableCopies >
                              0
                                ? "libraryCopyAvailable"
                                : "libraryCopyEmpty"
                            }
                          >
                            {
                              book.availableCopies
                            }
                            /
                            {
                              book.totalCopies
                            }
                          </span>

                        </td>

                        <td>

                          <span
                            className={
                              book.status ===
                              "ACTIVE"
                                ? "libraryStatus returned"
                                : "libraryStatus cancelled"
                            }
                          >
                            {
                              book.status
                            }
                          </span>

                        </td>

                        <td>

                          <button
                            type="button"
                            className="libraryViewButton"
                            onClick={() =>
                              setSelectedBook(
                                book,
                              )
                            }
                          >
                            View
                          </button>

                        </td>

                      </tr>
                    ),
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>
      )}

      {/* ===================================================
          RESERVATIONS
      =================================================== */}

      {activeTab ===
        "reservations" && (
        <section className="libraryPanel">

          <div className="libraryPanelHeader">

            <div>

              <h2>
                Book Reservations
              </h2>

              <p>
                Students who have reserved
                books.
              </p>

            </div>

          </div>

          <div className="libraryFilters">

            <div className="librarySearch">

              <Icon
                name="search"
                size={16}
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search student or book..."
              />

            </div>

          </div>

          <div className="libraryReservationList">

            {loading ? (
              <div className="libraryEmpty">
                Loading reservations...
              </div>
            ) : filteredReservations.filter(
                (item) =>
                  String(
                    item.status,
                  ).toUpperCase() ===
                  "RESERVED",
              ).length ===
              0 ? (
              <div className="libraryEmpty">

                <Icon
                  name="clock"
                  size={30}
                />

                <h3>
                  No reservations
                </h3>

                <p>
                  There are currently no
                  pending book reservations.
                </p>

              </div>
            ) : (
              filteredReservations
                .filter(
                  (item) =>
                    String(
                      item.status,
                    ).toUpperCase() ===
                    "RESERVED",
                )
                .map(
                  (
                    reservation,
                  ) => (
                    <div
                      className="libraryReservationCard"
                      key={
                        reservation.id
                      }
                    >

                      <div className="libraryReservationMain">

                        <div className="libraryStudentAvatar">
                          {
                            getInitials(
                              reservation.studentName,
                            )
                          }
                        </div>

                        <div>

                          <h3>
                            {
                              reservation.studentName
                            }
                          </h3>

                          <p>

                            {
                              reservation.course ||
                              "Student"
                            }

                            {reservation.semester
                              ? ` • Semester ${reservation.semester}`
                              : ""}

                          </p>

                        </div>

                      </div>

                      <div className="libraryReservationBook">

                        <span>
                          BOOK
                        </span>

                        <strong>
                          {
                            reservation.bookTitle
                          }
                        </strong>

                        <small>
                          {
                            reservation.bookCode
                          }
                        </small>

                      </div>

                      <div className="libraryReservationTime">

                        <span>
                          RESERVED
                        </span>

                        <strong>
                          {
                            formatDateTime(
                              reservation.reservedAt,
                            )
                          }
                        </strong>

                        <small>
                          Pickup before{" "}
                          {
                            formatDateTime(
                              reservation.pickupDeadline,
                            )
                          }
                        </small>

                      </div>

                      <div className="libraryReservationStatus">

                        <span className="libraryStatus reserved">
                          RESERVED
                        </span>

                        {/* =================================
                            ISSUE PERMISSION
                        ================================= */}

                        {canIssue && (
                          <button
                            type="button"
                            className="libraryIssueButton"
                            disabled={
                              processingId ===
                              reservation.id
                            }
                            onClick={() =>
                              handleIssue(
                                reservation,
                              )
                            }
                          >
                            {processingId ===
                            reservation.id
                              ? "Processing..."
                              : "Mark Issued"}
                          </button>
                        )}

                      </div>

                    </div>
                  ),
                )
            )}

          </div>

        </section>
      )}

      {/* ===================================================
          ISSUED
      =================================================== */}

      {activeTab ===
        "issued" && (
        <section className="libraryPanel">

          <div className="libraryPanelHeader">

            <div>

              <h2>
                Issued Books
              </h2>

              <p>
                Books currently issued
                to students.
              </p>

            </div>

          </div>

          <div className="libraryFilters">

            <div className="librarySearch">

              <Icon
                name="search"
                size={16}
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search student or book..."
              />

            </div>

          </div>

          <div className="libraryReservationList">

            {loading ? (
              <div className="libraryEmpty">
                Loading issued books...
              </div>
            ) : filteredReservations.filter(
                (item) =>
                  String(
                    item.status,
                  ).toUpperCase() ===
                  "ISSUED",
              ).length ===
              0 ? (
              <div className="libraryEmpty">

                <Icon
                  name="book"
                  size={30}
                />

                <h3>
                  No issued books
                </h3>

                <p>
                  No books are currently
                  issued to students.
                </p>

              </div>
            ) : (
              filteredReservations
                .filter(
                  (item) =>
                    String(
                      item.status,
                    ).toUpperCase() ===
                    "ISSUED",
                )
                .map(
                  (
                    reservation,
                  ) => (
                    <div
                      className="libraryReservationCard"
                      key={
                        reservation.id
                      }
                    >

                      <div className="libraryReservationMain">

                        <div className="libraryStudentAvatar">
                          {
                            getInitials(
                              reservation.studentName,
                            )
                          }
                        </div>

                        <div>

                          <h3>
                            {
                              reservation.studentName
                            }
                          </h3>

                          <p>

                            {
                              reservation.course ||
                              "Student"
                            }

                            {reservation.semester
                              ? ` • Semester ${reservation.semester}`
                              : ""}

                          </p>

                        </div>

                      </div>

                      <div className="libraryReservationBook">

                        <span>
                          BOOK
                        </span>

                        <strong>
                          {
                            reservation.bookTitle
                          }
                        </strong>

                        <small>
                          {
                            reservation.bookCode
                          }
                        </small>

                      </div>

                      <div className="libraryReservationTime">

                        <span>
                          ISSUED
                        </span>

                        <strong>
                          {
                            formatDateTime(
                              reservation.issuedAt,
                            )
                          }
                        </strong>

                        <small>
                          Reserved{" "}
                          {
                            formatDate(
                              reservation.reservedAt,
                            )
                          }
                        </small>

                      </div>

                      <div className="libraryReservationStatus">

                        <span className="libraryStatus issued">
                          ISSUED
                        </span>

                        {/* =================================
                            RETURN PERMISSION
                        ================================= */}

                        {canReturn && (
                          <button
                            type="button"
                            className="libraryReturnButton"
                            disabled={
                              processingId ===
                              reservation.id
                            }
                            onClick={() =>
                              handleReturn(
                                reservation,
                              )
                            }
                          >
                            {processingId ===
                            reservation.id
                              ? "Processing..."
                              : "Mark Returned"}
                          </button>
                        )}

                      </div>

                    </div>
                  ),
                )
            )}

          </div>

        </section>
      )}

      {/* ===================================================
          BOOK DETAILS MODAL
      =================================================== */}

      {selectedBook && (
        <div
          className="libraryModalOverlay"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedBook(
                null,
              );
            }
          }}
        >

          <div className="libraryModal">

            <div className="libraryModalHeader">

              <div>

                <span>
                  BOOK DETAILS
                </span>

                <h2>
                  {
                    selectedBook.title
                  }
                </h2>

                <p>
                  {
                    selectedBook.bookCode
                  }
                </p>

              </div>

              <button
                type="button"
                className="libraryModalClose"
                onClick={() =>
                  setSelectedBook(
                    null,
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="libraryBookDetailsGrid">

              <div>
                <span>
                  Author
                </span>

                <strong>
                  {
                    selectedBook.author ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  ISBN
                </span>

                <strong>
                  {
                    selectedBook.isbn ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Course
                </span>

                <strong>
                  {
                    selectedBook.course ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Semester
                </span>

                <strong>
                  {selectedBook.semester
                    ? `Semester ${selectedBook.semester}`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>
                  Category
                </span>

                <strong>
                  {
                    selectedBook.category ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Shelf
                </span>

                <strong>
                  {
                    selectedBook.shelfLocation ||
                    "—"
                  }
                </strong>
              </div>

              <div>
                <span>
                  Total Copies
                </span>

                <strong>
                  {
                    selectedBook.totalCopies
                  }
                </strong>
              </div>

              <div>
                <span>
                  Available Copies
                </span>

                <strong>
                  {
                    selectedBook.availableCopies
                  }
                </strong>
              </div>

            </div>

            {selectedBook.description && (
              <div className="libraryDescription">

                <span>
                  Description
                </span>

                <p>
                  {
                    selectedBook.description
                  }
                </p>

              </div>
            )}

            <div className="libraryModalFooter">

              <button
                type="button"
                className="librarySecondaryButton"
                onClick={() =>
                  setSelectedBook(
                    null,
                  )
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}