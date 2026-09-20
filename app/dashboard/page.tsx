"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  User,
} from "lucide-react";

type ConnectionStatus = "loading" | "connected" | "not_connected" | "error";
type InboxStatus = "idle" | "loading" | "loaded" | "error";
type AssistantStatus = "idle" | "loading" | "success" | "error";
type PriorityLevel = "high" | "normal" | "low";

type GmailEmail = {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  date: string;
  body: string;
};

type AssistantResponse = {
  success: boolean;
  answer: string;
  tools_used: string[];
};

type PriorityEmail = {
  id: string;
  subject: string;
  sender: string;
  sender_email: string;
  date: string;
  priority: PriorityLevel;
  summary: string;
  action: string;
  deadline: string | null;
  reply_needed: boolean;
  reply_status: "yes" | "no" | "unclear";
  meeting: unknown | null;
  reason: string;
};

type EmailTask = {
  task_id: string;
  source_email_id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  deadline: string | null;
  requires_reply: boolean;
  status: "pending" | "completed";
};

type MeetingSuggestion = {
  email_id: string;
  subject: string;
  sender: string;
  sender_email: string;
  purpose: string;
  requested: boolean;
  proposed_start: string | null;
  proposed_end: string | null;
  duration_minutes: number | null;
  location: string | null;
  meeting_link: string | null;
  needs_response: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
};

type SyncResult = {
  success?: boolean;
  checked?: number;
  new_emails?: number;
  processed?: number;
  tasks_added?: number;
  remaining_new?: number;
  message?: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [groqStatus, setGroqStatus] = useState<ConnectionStatus>("loading");
  const [gmailStatus, setGmailStatus] = useState<ConnectionStatus>("loading");
  const [calendarStatus, setCalendarStatus] = useState<ConnectionStatus>("loading");
  const [gmailAddress, setGmailAddress] = useState("");

  const [inboxStatus, setInboxStatus] = useState<InboxStatus>("idle");
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [inboxError, setInboxError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [priorityEmails, setPriorityEmails] = useState<PriorityEmail[]>([]);
  const [tasks, setTasks] = useState<EmailTask[]>([]);
  const [meetings, setMeetings] = useState<MeetingSuggestion[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");

  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>("idle");
  const [assistantResponse, setAssistantResponse] = useState<AssistantResponse | null>(null);
  const [assistantError, setAssistantError] = useState("");

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getAccessToken = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/");
      return null;
    }

    return session.access_token;
  }, [router]);

  const loadInbox = useCallback(async (accessToken?: string) => {
    try {
      setInboxStatus("loading");
      setInboxError("");

      const token = accessToken ?? (await getAccessToken());
      if (!token) return;

      const response = await fetch("/api/gmail/emails", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to load Gmail inbox.");
      }

      setEmails(Array.isArray(data.emails) ? data.emails : []);
      setInboxStatus("loaded");
    } catch (error) {
      console.error("Inbox loading failed:", error);
      setInboxStatus("error");
      setInboxError(error instanceof Error ? error.message : "Unable to load Gmail inbox.");
    }
  }, [getAccessToken]);

  const loadIntelligence = useCallback(async (accessToken?: string) => {
    const token = accessToken ?? (await getAccessToken());
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    const [priorityResponse, tasksResponse, meetingsResponse] = await Promise.all([
      fetch("/api/priority", { headers, cache: "no-store" }),
      fetch("/api/tasks", { headers, cache: "no-store" }),
      fetch("/api/meetings", { headers, cache: "no-store" }),
    ]);

    const [priorityData, tasksData, meetingsData] = await Promise.all([
      priorityResponse.json(),
      tasksResponse.json(),
      meetingsResponse.json(),
    ]);

    if (priorityResponse.ok) {
      setPriorityEmails(Array.isArray(priorityData.emails) ? priorityData.emails : []);
    }
    if (tasksResponse.ok) {
      setTasks(Array.isArray(tasksData.tasks) ? tasksData.tasks : []);
    }
    if (meetingsResponse.ok) {
      setMeetings(Array.isArray(meetingsData.meetings) ? meetingsData.meetings : []);
    }
  }, [getAccessToken]);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.replace("/");
          return;
        }

        setEmail(user.email ?? "");
        setName(user.user_metadata?.name || user.email?.split("@")[0] || "there");

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.replace("/");
          return;
        }

        const accessToken = session.access_token;
        const headers = { Authorization: `Bearer ${accessToken}` };

        const [groqResponse, gmailResponse, calendarResponse] = await Promise.allSettled([
          fetch("/api/groq/status", { headers, cache: "no-store" }),
          fetch("/api/gmail/status", { headers, cache: "no-store" }),
          fetch("/api/calendar/status", { headers, cache: "no-store" }),
        ]);

        if (groqResponse.status === "fulfilled" && groqResponse.value.ok) {
          const data = await groqResponse.value.json();
          setGroqStatus(data.connected === true ? "connected" : "not_connected");
        } else {
          setGroqStatus("error");
        }

        let gmailConnected = false;
        if (gmailResponse.status === "fulfilled" && gmailResponse.value.ok) {
          const data = await gmailResponse.value.json();
          gmailConnected = data.connected === true;
          setGmailStatus(gmailConnected ? "connected" : "not_connected");
          setGmailAddress(data.email ?? data.gmail_address ?? "");
        } else {
          setGmailStatus("error");
        }

        if (calendarResponse.status === "fulfilled" && calendarResponse.value.ok) {
          const data = await calendarResponse.value.json();
          setCalendarStatus(data.connected === true ? "connected" : "not_connected");
        } else {
          setCalendarStatus("error");
        }

        const work: Promise<unknown>[] = [loadIntelligence(accessToken)];
        if (gmailConnected) work.push(loadInbox(accessToken));
        await Promise.allSettled(work);
      } catch (error) {
        console.error("Dashboard loading failed:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [loadInbox, loadIntelligence, router]);

  async function syncAndReload() {
    try {
      setIsSyncing(true);
      setSyncError("");
      setSyncMessage("Checking your inbox for new mail…");

      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 20 }),
      });

      const data = (await response.json()) as SyncResult & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to sync inbox.");
      }

      if ((data.processed ?? 0) > 0) {
        const taskText = (data.tasks_added ?? 0) > 0
          ? ` · ${data.tasks_added} task${data.tasks_added === 1 ? "" : "s"} added`
          : "";
        const remainingText = (data.remaining_new ?? 0) > 0
          ? ` · ${data.remaining_new} more waiting`
          : "";
        setSyncMessage(`${data.processed} new email${data.processed === 1 ? "" : "s"} analysed${taskText}${remainingText}`);
      } else {
        setSyncMessage(data.message || "Inbox is already up to date.");
      }

      await Promise.allSettled([
        loadInbox(token),
        loadIntelligence(token),
      ]);
    } catch (error) {
      console.error("Inbox sync failed:", error);
      setSyncMessage("");
      setSyncError(error instanceof Error ? error.message : "Unable to sync inbox.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function askThozhan() {
    const message = assistantMessage.trim();
    if (!message || groqStatus !== "connected" || gmailStatus !== "connected") return;

    try {
      setAssistantStatus("loading");
      setAssistantError("");
      setAssistantResponse(null);

      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Thozhan was unable to process your request.");
      }

      setAssistantResponse({
        success: data.success === true,
        answer: typeof data.answer === "string" ? data.answer : "",
        tools_used: Array.isArray(data.tools_used) ? data.tools_used : [],
      });
      setAssistantStatus("success");
      setAssistantMessage("");
    } catch (error) {
      console.error("Assistant request failed:", error);
      setAssistantStatus("error");
      setAssistantError(error instanceof Error ? error.message : "Thozhan was unable to process your request.");
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function formatEmailDate(value: string) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function createPreview(body: string) {
    if (!body) return "No text preview available.";
    const cleaned = body.replace(/\s+/g, " ").trim();
    return cleaned.length <= 180 ? cleaned : `${cleaned.slice(0, 180)}…`;
  }

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return emails;
    return emails.filter((message) =>
      [message.subject, message.sender_name, message.sender_email, message.body]
        .some((value) => (value || "").toLowerCase().includes(query))
    );
  }, [emails, searchQuery]);

  const highPriorityCount = priorityEmails.filter((item) => item.priority === "high").length;
  const pendingTaskCount = tasks.filter((task) => task.status !== "completed").length;
  const meetingCount = meetings.length;
  const allConnected = groqStatus === "connected" && gmailStatus === "connected" && calendarStatus === "connected";
  const firstName = name.trim().split(/\s+/)[0] || "there";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F7F5] text-[#18181B] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <ThozhanMark compact />
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Waking Thozhan…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] text-[#18181B] flex">
      <aside className="hidden lg:flex w-[236px] shrink-0 border-r border-black/[0.06] bg-[#FBFBF9] flex-col px-4 py-5 sticky top-0 h-screen">
        <button type="button" onClick={() => router.push("/dashboard")} className="flex items-center gap-3 px-2 text-left">
          <ThozhanMark />
          <div>
            <p className="font-semibold tracking-[-0.02em]">Thozhan</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Always with you</p>
          </div>
        </button>

        <nav className="mt-9 space-y-1">
          <SidebarItem icon={<Inbox />} label="Inbox" active onClick={() => router.push("/dashboard")} />
          <SidebarItem icon={<Star />} label="Priority" badge={highPriorityCount || undefined} onClick={() => router.push("/priority")} />
          <SidebarItem icon={<CheckSquare />} label="Tasks" badge={pendingTaskCount || undefined} onClick={() => router.push("/tasks")} />
          <SidebarItem icon={<CalendarDays />} label="Meetings" badge={meetingCount || undefined} onClick={() => router.push("/meetings")} />
        </nav>

        <div className="my-5 border-t border-black/[0.06]" />

        <nav className="space-y-1">
          <SidebarItem icon={<Sparkles />} label="Ask Thozhan" onClick={() => document.getElementById("ask-thozhan")?.scrollIntoView({ behavior: "smooth" })} />
          <SidebarItem icon={<Settings />} label="Settings" onClick={() => router.push("/settings")} />
        </nav>

        <div className="mt-auto pt-5 border-t border-black/[0.06]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#ECECF8] text-[#5753C9] flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-[11px] text-zinc-400 truncate">{email}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-black/[0.035] hover:text-zinc-900 transition">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-[72px] border-b border-black/[0.06] bg-[#F7F7F5]/90 backdrop-blur-xl flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-10">
          <div className="flex lg:hidden items-center gap-2.5">
            <ThozhanMark compact />
            <span className="font-semibold">Thozhan</span>
          </div>

          <div className="hidden lg:flex items-center relative w-full max-w-[430px]">
            <Search size={16} className="absolute left-4 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your inbox"
              className="w-full h-10 rounded-full border border-black/[0.07] bg-white/75 pl-10 pr-4 text-sm outline-none transition focus:border-[#6B67D8]/40 focus:ring-4 focus:ring-[#6B67D8]/[0.07] placeholder:text-zinc-400"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowNotifications((value) => !value); setShowProfileMenu(false); }}
              className="relative w-10 h-10 rounded-full border border-black/[0.07] bg-white/70 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-white transition"
            >
              <Bell size={17} />
              {emails.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#6662D9]" />}
            </button>

            <button
              type="button"
              onClick={() => { setShowProfileMenu((value) => !value); setShowNotifications(false); }}
              className="w-10 h-10 rounded-full bg-[#ECECF8] text-[#5753C9] flex items-center justify-center hover:bg-[#E4E4F5] transition"
            >
              <User size={17} />
            </button>

            {showNotifications && (
              <div className="absolute right-11 top-12 w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl border border-black/[0.08] bg-white shadow-[0_18px_55px_rgba(24,24,27,0.12)] p-2">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">Recent mail</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Your latest Gmail messages</p>
                </div>
                <div className="max-h-80 overflow-auto">
                  {emails.slice(0, 5).map((message) => (
                    <div key={message.id} className="rounded-xl px-3 py-3 hover:bg-[#F7F7F5]">
                      <p className="text-xs text-zinc-400 truncate">{message.sender_name || message.sender_email}</p>
                      <p className="text-sm font-medium mt-1 truncate">{message.subject}</p>
                    </div>
                  ))}
                  {emails.length === 0 && <p className="px-3 py-5 text-sm text-zinc-400">No recent messages.</p>}
                </div>
              </div>
            )}

            {showProfileMenu && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl border border-black/[0.08] bg-white shadow-[0_18px_55px_rgba(24,24,27,0.12)] p-2">
                <div className="px-3 py-2 border-b border-black/[0.06] mb-1">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{email}</p>
                </div>
                <button type="button" onClick={() => router.push("/settings")} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-[#F7F7F5] transition">
                  <Settings size={15} /> Settings
                </button>
                <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-500 hover:bg-[#F7F7F5] hover:text-zinc-900 transition">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-10 py-7 lg:py-10">
          <section className="relative overflow-hidden rounded-[30px] border border-black/[0.06] bg-white min-h-[310px] shadow-[0_18px_55px_rgba(24,24,27,0.045)]">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -right-16 -top-28 w-[420px] h-[420px] rounded-full border border-[#706BDA]/10" />
              <div className="absolute right-3 -top-8 w-[300px] h-[300px] rounded-full border border-[#706BDA]/10 rotate-12" />
              <div className="absolute right-24 top-16 w-2 h-2 rounded-full bg-[#706BDA]/30" />
              <div className="absolute right-64 top-9 w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <div className="absolute right-48 bottom-12 w-1 h-1 rounded-full bg-[#706BDA]/40" />
              <div className="absolute -right-20 bottom-[-170px] w-[390px] h-[390px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#EEEAFE_0%,#D9D8F6_35%,#A8A5E4_68%,#7773D5_100%)] opacity-85 shadow-[inset_-28px_-30px_60px_rgba(63,57,150,0.16)]" />
              <div className="absolute right-[138px] top-[92px] rotate-[-9deg] hidden md:flex w-20 h-14 rounded-2xl bg-white border border-[#706BDA]/15 shadow-[0_14px_35px_rgba(74,69,165,0.13)] items-center justify-center text-[#625ED1]">
                <Mail size={25} strokeWidth={1.6} />
              </div>
              <div className="absolute right-[170px] top-[72px] hidden md:block text-[11px] font-semibold text-[#625ED1]/50">த</div>
            </div>

            <div className="relative z-10 p-6 sm:p-8 lg:p-10 max-w-[780px]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#5F5BCB]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6B67D8]" /> Thozhan · Always with you
                </span>
                {allConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 size={12} /> Ready
                  </span>
                )}
              </div>

              <h1 className="mt-5 text-[34px] sm:text-[44px] lg:text-[52px] leading-[1.04] tracking-[-0.045em] font-semibold max-w-[650px]">
                Good to see you, {firstName}.
              </h1>
              <p className="mt-4 text-zinc-500 text-[15px] sm:text-base leading-7 max-w-[590px]">
                Your inbox, actions and meetings — quietly organised in one place.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById("ask-thozhan")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1E1E22] text-white px-5 py-3 text-sm font-medium hover:bg-black transition"
                >
                  <Sparkles size={15} /> Ask Thozhan
                </button>
                <button
                  type="button"
                  onClick={() => void syncAndReload()}
                  disabled={isSyncing || gmailStatus !== "connected" || groqStatus !== "connected"}
                  className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:border-[#6B67D8]/30 hover:text-[#5F5BCB] disabled:opacity-50 transition"
                >
                  <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing…" : "Sync inbox"}
                </button>
              </div>
            </div>
          </section>

          {(syncMessage || syncError) && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 flex items-start gap-3 text-sm ${syncError ? "border-red-200 bg-red-50 text-red-700" : "border-[#DCDCF2] bg-[#F1F1FA] text-[#514DB9]"}`}>
              {syncError ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : isSyncing ? <Loader2 size={17} className="animate-spin mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
              <span>{syncError || syncMessage}</span>
            </div>
          )}

          {!allConnected && (
            <section className="mt-5 grid md:grid-cols-3 gap-3">
              <ConnectionMiniCard title="AI engine" status={groqStatus} action="Configure" onClick={() => router.push("/setup/ai")} />
              <ConnectionMiniCard title="Gmail" status={gmailStatus} detail={gmailAddress} action="Connect" onClick={() => router.push("/setup/gmail")} />
              <ConnectionMiniCard title="Calendar" status={calendarStatus} action="Open meetings" onClick={() => router.push("/meetings")} />
            </section>
          )}

          <section className="mt-6 grid md:grid-cols-3 gap-4">
            <SummaryCard
              eyebrow="Priority"
              value={highPriorityCount}
              label={highPriorityCount === 1 ? "email needs attention" : "emails need attention"}
              icon={<Star size={18} />}
              onClick={() => router.push("/priority")}
            />
            <SummaryCard
              eyebrow="Tasks"
              value={pendingTaskCount}
              label={pendingTaskCount === 1 ? "open action" : "open actions"}
              icon={<CheckSquare size={18} />}
              onClick={() => router.push("/tasks")}
            />
            <SummaryCard
              eyebrow="Meetings"
              value={meetingCount}
              label={meetingCount === 1 ? "detected request" : "detected requests"}
              icon={<CalendarDays size={18} />}
              onClick={() => router.push("/meetings")}
            />
          </section>

          <section id="ask-thozhan" className="mt-6 rounded-[26px] border border-black/[0.06] bg-[#202024] text-white overflow-hidden shadow-[0_18px_55px_rgba(24,24,27,0.06)]">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.08] flex items-center justify-center text-[#C9C7FF]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">Ask Thozhan</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Ask naturally about your inbox.</p>
                </div>
              </div>

              {assistantStatus === "success" && assistantResponse && (
                <div className="mt-5 rounded-2xl bg-white/[0.055] border border-white/[0.07] p-4 sm:p-5">
                  <p className="text-sm leading-7 text-zinc-200 whitespace-pre-wrap">{assistantResponse.answer}</p>
                  {assistantResponse.tools_used.length > 0 && (
                    <p className="mt-4 pt-3 border-t border-white/[0.07] text-[11px] text-zinc-500">
                      Tools used: {assistantResponse.tools_used.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {assistantStatus === "error" && (
                <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-200 flex gap-3">
                  <AlertCircle size={17} className="shrink-0 mt-0.5" /> {assistantError}
                </div>
              )}

              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-sm">
                <input
                  value={assistantMessage}
                  onChange={(event) => setAssistantMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && assistantStatus !== "loading") {
                      event.preventDefault();
                      void askThozhan();
                    }
                  }}
                  disabled={groqStatus !== "connected" || gmailStatus !== "connected" || assistantStatus === "loading"}
                  placeholder={
                    groqStatus !== "connected"
                      ? "Connect your AI engine to use Thozhan"
                      : gmailStatus !== "connected"
                        ? "Connect Gmail to ask about your inbox"
                        : assistantStatus === "loading"
                          ? "Thozhan is thinking…"
                          : "What needs my attention today?"
                  }
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-zinc-900 placeholder:text-zinc-400 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => void askThozhan()}
                  disabled={!assistantMessage.trim() || groqStatus !== "connected" || gmailStatus !== "connected" || assistantStatus === "loading"}
                  className="w-10 h-10 shrink-0 rounded-xl bg-[#6965D7] text-white flex items-center justify-center hover:bg-[#5C58C9] disabled:bg-zinc-200 disabled:text-zinc-400 transition"
                >
                  {assistantStatus === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[26px] border border-black/[0.06] bg-white overflow-hidden shadow-[0_18px_55px_rgba(24,24,27,0.035)]">
            <div className="px-5 sm:px-6 py-5 border-b border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Inbox size={17} className="text-[#625ED1]" />
                  <h2 className="font-semibold tracking-[-0.02em]">Intelligent inbox</h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Your latest Gmail messages, ready for Thozhan.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="lg:hidden relative flex-1 sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    className="w-full h-9 rounded-full bg-[#F7F7F5] pl-9 pr-3 text-xs outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void syncAndReload()}
                  disabled={isSyncing || gmailStatus !== "connected" || groqStatus !== "connected"}
                  className="h-9 inline-flex items-center gap-2 rounded-full border border-black/[0.07] px-3.5 text-xs font-medium text-zinc-600 hover:text-[#5F5BCB] hover:border-[#6B67D8]/30 disabled:opacity-50 transition"
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Syncing" : "Sync"}
                </button>
              </div>
            </div>

            {gmailStatus === "not_connected" && (
              <EmptyState icon={<Mail size={21} />} title="Connect Gmail to see your inbox" description="Once Gmail is connected, Thozhan can read your latest messages and organise what matters." button="Connect Gmail" onClick={() => router.push("/setup/gmail")} />
            )}

            {gmailStatus === "error" && (
              <EmptyState icon={<AlertCircle size={21} />} title="Gmail connection unavailable" description="Thozhan could not check your Gmail connection. Make sure the backend is available and try again." button="Try again" onClick={() => window.location.reload()} />
            )}

            {gmailStatus === "connected" && inboxStatus === "loading" && (
              <div className="min-h-56 flex items-center justify-center text-sm text-zinc-400 gap-3">
                <Loader2 size={18} className="animate-spin text-[#625ED1]" /> Reading your inbox…
              </div>
            )}

            {gmailStatus === "connected" && inboxStatus === "error" && (
              <EmptyState icon={<AlertCircle size={21} />} title="Unable to read your inbox" description={inboxError} button="Try again" onClick={() => void loadInbox()} />
            )}

            {gmailStatus === "connected" && inboxStatus === "loaded" && filteredEmails.length === 0 && (
              <EmptyState icon={<Inbox size={21} />} title={searchQuery ? "No matching emails" : "Your inbox is quiet"} description={searchQuery ? "Try another sender, subject or keyword." : "No recent Gmail messages were found."} />
            )}

            {gmailStatus === "connected" && inboxStatus === "loaded" && filteredEmails.length > 0 && (
              <div className="divide-y divide-black/[0.055]">
                {filteredEmails.map((message) => (
                  <article key={message.id} className="px-5 sm:px-6 py-5 hover:bg-[#FAFAF8] transition">
                    <div className="flex gap-4">
                      <div className="hidden sm:flex w-10 h-10 shrink-0 rounded-2xl bg-[#F0F0F8] text-[#625ED1] items-center justify-center">
                        <Mail size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{message.sender_name || message.sender_email || "Unknown sender"}</p>
                            {message.sender_name && message.sender_email && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{message.sender_email}</p>}
                          </div>
                          <time className="text-[11px] text-zinc-400 shrink-0">{formatEmailDate(message.date)}</time>
                        </div>
                        <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">{message.subject || "(No subject)"}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-zinc-500">{createPreview(message.body)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-6 rounded-[26px] overflow-hidden bg-[#24242A] text-white relative min-h-[150px]">
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_80%_25%,rgba(116,111,218,0.45),transparent_24%),radial-gradient(circle_at_90%_90%,rgba(84,79,175,0.28),transparent_28%)]" />
            <div className="absolute right-12 top-7 w-1.5 h-1.5 rounded-full bg-white/50" />
            <div className="absolute right-28 bottom-8 w-1 h-1 rounded-full bg-white/30" />
            <div className="relative z-10 p-6 sm:p-7 flex items-center justify-between gap-6">
              <div>
                <p className="text-[11px] tracking-[0.18em] uppercase text-[#C8C6FF] font-semibold">Thozhan</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold tracking-[-0.03em]">A calmer inbox. A more intentional you.</h2>
                <p className="mt-2 text-sm text-zinc-400">Mail comes in. Thozhan helps you see what matters.</p>
              </div>
              <div className="hidden sm:block"><ThozhanMark dark /></div>
            </div>
          </div>
        </div>

        <nav className="lg:hidden sticky bottom-0 z-30 border-t border-black/[0.07] bg-[#FBFBF9]/95 backdrop-blur-xl grid grid-cols-4 px-2 py-2">
          <MobileNav icon={<Inbox />} label="Inbox" active onClick={() => router.push("/dashboard")} />
          <MobileNav icon={<Star />} label="Priority" onClick={() => router.push("/priority")} />
          <MobileNav icon={<CheckSquare />} label="Tasks" onClick={() => router.push("/tasks")} />
          <MobileNav icon={<CalendarDays />} label="Meetings" onClick={() => router.push("/meetings")} />
        </nav>
      </section>
    </main>
  );
}

function ThozhanMark({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <div className={`relative ${compact ? "w-9 h-9" : "w-11 h-11"} shrink-0`} aria-label="Thozhan">
      <div className={`absolute inset-[2px] rounded-full border ${dark ? "border-white/20" : "border-[#706BDA]/25"}`} />
      <div className={`absolute left-0 top-1/2 w-full h-[1px] ${dark ? "bg-white/15" : "bg-[#706BDA]/15"} rotate-[-28deg]`} />
      <div className={`absolute -right-[1px] top-[7px] w-2 h-2 rounded-full ${dark ? "bg-[#C9C7FF]" : "bg-[#6965D7]"} shadow-[0_0_0_3px_rgba(105,101,215,0.10)]`} />
      <div className={`absolute inset-[7px] rounded-[11px] flex items-center justify-center font-semibold ${compact ? "text-[14px]" : "text-[17px]"} ${dark ? "bg-white text-[#5753C9]" : "bg-[#ECECF8] text-[#5753C9]"}`}>
        த
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, badge, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-[#ECECF8] text-[#504CB8] font-medium" : "text-zinc-500 hover:bg-black/[0.035] hover:text-zinc-900"}`}>
      <span className="[&>svg]:w-[17px] [&>svg]:h-[17px]">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center ${active ? "bg-white text-[#504CB8]" : "bg-zinc-100 text-zinc-500"}`}>{badge}</span>}
    </button>
  );
}

function MobileNav({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] ${active ? "text-[#5753C9]" : "text-zinc-400"}`}>
      <span className="[&>svg]:w-[17px] [&>svg]:h-[17px]">{icon}</span>{label}
    </button>
  );
}

function SummaryCard({ eyebrow, value, label, icon, onClick }: { eyebrow: string; value: number; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group text-left rounded-[24px] border border-black/[0.06] bg-white p-5 sm:p-6 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(24,24,27,0.06)] transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[#F0F0F8] text-[#625ED1] flex items-center justify-center">{icon}</div>
        <ChevronRight size={17} className="text-zinc-300 group-hover:text-[#625ED1] group-hover:translate-x-0.5 transition" />
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{eyebrow}</p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-[-0.04em]">{value}</span>
        <span className="text-sm text-zinc-500 pb-1">{label}</span>
      </div>
    </button>
  );
}

function ConnectionMiniCard({ title, status, detail, action, onClick }: { title: string; status: ConnectionStatus; detail?: string; action: string; onClick: () => void }) {
  const connected = status === "connected";
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-500" : status === "loading" ? "bg-zinc-300" : status === "error" ? "bg-red-400" : "bg-amber-400"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{connected ? detail || "Connected" : status === "loading" ? "Checking…" : status === "error" ? "Connection error" : "Not connected"}</p>
      </div>
      {!connected && <button type="button" onClick={onClick} className="text-xs font-medium text-[#5F5BCB] hover:text-[#4743A9]">{action}</button>}
    </div>
  );
}

function EmptyState({ icon, title, description, button, onClick }: { icon: React.ReactNode; title: string; description: string; button?: string; onClick?: () => void }) {
  return (
    <div className="min-h-60 flex items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <div className="w-11 h-11 rounded-2xl bg-[#F0F0F8] text-[#625ED1] flex items-center justify-center mx-auto">{icon}</div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        {button && onClick && (
          <button type="button" onClick={onClick} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1E1E22] text-white px-4 py-2.5 text-sm font-medium hover:bg-black transition">
            {button} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
