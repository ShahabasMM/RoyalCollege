"use client";

import {
  Activity,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Library,
  Megaphone,
  Settings,
  Users,
  Video,
  UserRoundPlus,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  Plus,
  Clock3,
  CircleAlert,
  ArrowLeft,
  Eye,
  Pencil,
  RotateCcw,
} from "lucide-react";

const icons: Record<string, React.ElementType> = {
  activity: Activity,
  book: BookOpen,
  calendar: CalendarDays,
  check: CheckCircle2,
  clipboard: ClipboardCheck,
  download: Download,
  file: FileText,
  graduation: GraduationCap,
  help: HelpCircle,
  library: Library,
  megaphone: Megaphone,
  settings: Settings,
  users: Users,
  video: Video,
  leave: UserRoundPlus,
  bell: Bell,
  search: Search,
  menu: Menu,
  close: X,
  arrow: ChevronRight,
  plus: Plus,
  clock: Clock3,
  alert: CircleAlert,
  arrowLeft: ArrowLeft,
  eye: Eye,
  edit: Pencil,
  reset: RotateCcw,
};

export default function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Component = icons[name] ?? Activity;

  return <Component size={size} strokeWidth={1.9} />;
}
