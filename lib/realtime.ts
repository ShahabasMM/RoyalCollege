"use client";

import { supabase } from "@/lib/supabase";

export type RealtimeTable =
  | "attendance_sessions"
  | "attendance_records"
  | "announcements"
  | "online_classes"
  | "timetables"
  | "library_books"
  | "library_reservations"
  | "library_staff_loans"
  | "library_teachers"
  | "leave_requests"
  | "doubts"
  | "syllabus_courses"
  | "syllabus_subjects";

export function subscribeToRealtime(
  tables: readonly RealtimeTable[],
  onChange: () => void,
) {
  const channel = supabase.channel(
    `royal-college-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  for (const table of tables) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
      },
      () => {
        onChange();
      },
    );
  }

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(`Realtime connection error: ${status}`);
    }
  });

  return channel;
}

export async function unsubscribeRealtime(
  channel: ReturnType<typeof supabase.channel>,
) {
  await supabase.removeChannel(channel);
}
