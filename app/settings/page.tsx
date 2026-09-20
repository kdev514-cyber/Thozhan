"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThozhanLogo from "@/components/thozhan/ThozhanLogo";

import {
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Inbox,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Save,
  Settings,
  Sparkles,
  Star,
  User,
} from "lucide-react";

type UserSettings = {
  full_name: string;
  email: string;
  time_zone: string;
  notify_priority_email: boolean;
  notify_meeting_request: boolean;
  notify_task_deadline: boolean;
  notify_calendar_event: boolean;
};

type ConnectionState = {
  groq: boolean;
  gmail: boolean;
  calendar: boolean;
  gmailAddress: string;
  calendarAddress: string;
};

type HelpSection = "groq" | "gmail" | "calendar" | null;

const DEFAULTS: UserSettings = {
  full_name: "",
  email: "",
  time_zone: "Pacific/Auckland",
  notify_priority_email: true,
  notify_meeting_request: true,
  notify_task_deadline: true,
  notify_calendar_event: true,
};

const DEFAULT_CONNECTIONS: ConnectionState = {
  groq: false,
  gmail: false,
  calendar: false,
  gmailAddress: "",
  calendarAddress: "",
};

export default function SettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [connections, setConnections] =
    useState<ConnectionState>(DEFAULT_CONNECTIONS);

  const [loading, setLoading] = useState(true);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState<HelpSection>(null);

  const [saving, setSaving] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  async function getSession() {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/");
      return null;
    }

    return session;
  }

  async function loadPage() {
    try {
      setLoading(true);
      setConnectionsLoading(true);
      setError("");

      const session = await getSession();
      if (!session) return;

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      const settingsResponse = await fetch("/api/settings", {
        headers,
        cache: "no-store",
      });

      const settingsData = await settingsResponse.json();

      if (!settingsResponse.ok) {
        throw new Error(
          settingsData.detail ?? "Unable to load settings."
        );
      }

      setSettings({
        ...DEFAULTS,
        ...(settingsData.settings ?? {}),
      });

      const results = await Promise.allSettled([
        fetch("/api/groq/status", {
          headers,
          cache: "no-store",
        }),
        fetch("/api/gmail/status", {
          headers,
          cache: "no-store",
        }),
        fetch("/api/calendar/status", {
          headers,
          cache: "no-store",
        }),
      ]);

      const nextConnections = { ...DEFAULT_CONNECTIONS };

      if (results[0].status === "fulfilled") {
        try {
          const data = await results[0].value.json();
          nextConnections.groq =
            results[0].value.ok && Boolean(data.connected);
        } catch {
          nextConnections.groq = false;
        }
      }

      if (results[1].status === "fulfilled") {
        try {
          const data = await results[1].value.json();

          nextConnections.gmail =
            results[1].value.ok && Boolean(data.connected);

          nextConnections.gmailAddress =
            data.email ??
            data.gmail_address ??
            data.address ??
            "";
        } catch {
          nextConnections.gmail = false;
        }
      }

      if (results[2].status === "fulfilled") {
        try {
          const data = await results[2].value.json();

          nextConnections.calendar =
            results[2].value.ok && Boolean(data.connected);

          nextConnections.calendarAddress =
            data.email ??
            data.calendar_email ??
            data.address ??
            "";
        } catch {
          nextConnections.calendar = false;
        }
      }

      setConnections(nextConnections);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load settings."
      );
    } finally {
      setLoading(false);
      setConnectionsLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const session = await getSession();
      if (!session) return;

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: settings.full_name,
          time_zone: settings.time_zone,
          notify_priority_email: settings.notify_priority_email,
          notify_meeting_request: settings.notify_meeting_request,
          notify_task_deadline: settings.notify_task_deadline,
          notify_calendar_event: settings.notify_calendar_event,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ?? "Unable to save settings."
        );
      }

      setMessage(
        "Profile and notification preferences saved."
      );

      window.setTimeout(() => {
        setMessage("");
      }, 3500);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  async function connectCalendar() {
    try {
      setConnectingCalendar(true);
      setError("");

      const session = await getSession();
      if (!session) return;

      const response = await fetch(
        "/api/calendar/oauth/start",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to start Google Calendar connection."
        );
      }

      if (!data.authorization_url) {
        throw new Error(
          "Google Calendar authorization URL was not returned."
        );
      }

      window.location.href = data.authorization_url;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to connect Calendar."
      );

      setConnectingCalendar(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  function toggle(
    key: keyof Pick<
      UserSettings,
      | "notify_priority_email"
      | "notify_meeting_request"
      | "notify_task_deadline"
      | "notify_calendar_event"
    >
  ) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleHelp(section: Exclude<HelpSection, null>) {
    setHelpOpen((current) =>
      current === section ? null : section
    );
  }

  const connectedCount = [
    connections.groq,
    connections.gmail,
    connections.calendar,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#F7F7F5] text-zinc-900 flex">
      <aside className="hidden md:flex w-[236px] border-r border-zinc-200/80 bg-[#F7F7F5] flex-col px-4 py-5">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-3 px-2 mb-9 text-left"
        >
          <ThozhanLogo compact />

          <div>
            <h1 className="font-semibold tracking-[-0.01em]">
              Thozhan
            </h1>

            <p className="text-[10px] tracking-[0.14em] text-zinc-400 uppercase">
              Always with you
            </p>
          </div>
        </button>

        <nav className="space-y-1 flex-1">
          <SidebarItem
            icon={<Inbox />}
            label="Inbox"
            onClick={() => router.push("/dashboard")}
          />

          <SidebarItem
            icon={<Star />}
            label="Priority"
            onClick={() => router.push("/priority")}
          />

          <SidebarItem
            icon={<CheckSquare />}
            label="Tasks"
            onClick={() => router.push("/tasks")}
          />

          <SidebarItem
            icon={<CalendarDays />}
            label="Meetings"
            onClick={() => router.push("/meetings")}
          />

          <div className="border-t border-zinc-200/80 my-5" />

          <SidebarItem
            icon={<Sparkles />}
            label="AI Assistant"
            onClick={() => router.push("/dashboard")}
          />

          <SidebarItem
            icon={<Settings />}
            label="Settings"
            active
          />
        </nav>

        <div className="border-t border-zinc-200/80 pt-5">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <User size={16} />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {settings.full_name ||
                  settings.email.split("@")[0] ||
                  "User"}
              </p>

              <p className="text-xs text-zinc-400 truncate">
                {settings.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 text-zinc-500 hover:text-zinc-900 hover:bg-white rounded-xl px-3 py-2.5 transition text-sm"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        <header className="min-h-20 border-b border-zinc-200/80 flex items-center justify-between gap-4 px-5 sm:px-7 lg:px-10 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">
              Preferences
            </p>

            <h1 className="text-xl font-semibold tracking-[-0.02em] mt-1">
              Settings
            </h1>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}

            {saving ? "Saving..." : "Save changes"}
          </button>
        </header>

        <div className="px-5 py-8 sm:px-7 lg:px-10 lg:py-10 max-w-6xl mx-auto">
          {loading ? (
            <div className="min-h-[420px] flex items-center justify-center">
              <Loader2
                className="animate-spin text-[#5753C9]"
                size={28}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="bg-white border border-zinc-200/80 rounded-[24px] p-6 sm:p-7">
                <div className="max-w-2xl">
                  <p className="text-[#5753C9] text-xs font-semibold tracking-[0.14em] uppercase">
                    Profile
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] mt-2">
                    Your Thozhan profile
                  </h2>

                  <p className="text-zinc-500 mt-2 leading-6">
                    Manage how Thozhan knows you and which
                    timezone it uses when helping with your
                    schedule.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5 mt-7">
                  <Field label="Full name">
                    <input
                      value={settings.full_name}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                      className="w-full bg-[#F7F7F5] border border-zinc-200 focus:border-[#7773DD] focus:ring-4 focus:ring-[#5753C9]/5 outline-none rounded-xl px-4 py-3 text-sm transition"
                      placeholder="Your name"
                    />
                  </Field>

                  <Field label="Account email">
                    <input
                      value={settings.email}
                      disabled
                      className="w-full bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-500"
                    />
                  </Field>

                  <Field label="Timezone">
                    <select
                      value={settings.time_zone}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          time_zone: event.target.value,
                        }))
                      }
                      className="w-full bg-[#F7F7F5] border border-zinc-200 focus:border-[#7773DD] focus:ring-4 focus:ring-[#5753C9]/5 outline-none rounded-xl px-4 py-3 text-sm transition"
                    >
                      <option value="Pacific/Auckland">
                        Auckland · Pacific/Auckland
                      </option>
                      <option value="Australia/Sydney">
                        Sydney · Australia/Sydney
                      </option>
                      <option value="Asia/Kolkata">
                        India · Asia/Kolkata
                      </option>
                      <option value="Europe/London">
                        London · Europe/London
                      </option>
                      <option value="America/New_York">
                        New York · America/New_York
                      </option>
                      <option value="America/Los_Angeles">
                        Los Angeles · America/Los_Angeles
                      </option>
                    </select>
                  </Field>
                </div>
              </section>

              <section className="bg-white border border-zinc-200/80 rounded-[24px] p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#EEEEFA] text-[#5753C9] flex items-center justify-center shrink-0">
                    <Bell size={18} />
                  </div>

                  <div>
                    <p className="text-[#5753C9] text-xs font-semibold tracking-[0.14em] uppercase">
                      Notifications
                    </p>

                    <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] mt-1">
                      What should Thozhan alert you about?
                    </h2>

                    <p className="text-zinc-500 mt-2 leading-6">
                      Choose the events that deserve your
                      attention.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mt-7">
                  <ToggleCard
                    title="Priority emails"
                    description="Important or urgent email detected."
                    enabled={settings.notify_priority_email}
                    onClick={() =>
                      toggle("notify_priority_email")
                    }
                  />

                  <ToggleCard
                    title="Meeting requests"
                    description="A scheduling request is detected in Gmail."
                    enabled={settings.notify_meeting_request}
                    onClick={() =>
                      toggle("notify_meeting_request")
                    }
                  />

                  <ToggleCard
                    title="Task deadlines"
                    description="An extracted task has a deadline that needs attention."
                    enabled={settings.notify_task_deadline}
                    onClick={() =>
                      toggle("notify_task_deadline")
                    }
                  />

                  <ToggleCard
                    title="Calendar events"
                    description="Calendar-related reminders and scheduling updates."
                    enabled={settings.notify_calendar_event}
                    onClick={() =>
                      toggle("notify_calendar_event")
                    }
                  />
                </div>
              </section>

              <section className="bg-white border border-zinc-200/80 rounded-[24px] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setConnectionsOpen((current) => !current)
                  }
                  className="w-full text-left p-6 sm:p-7 hover:bg-zinc-50/70 transition"
                >
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#EEEEFA] text-[#5753C9] flex items-center justify-center shrink-0">
                        <Link2 size={18} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[#5753C9] text-xs font-semibold tracking-[0.14em] uppercase">
                            Connections
                          </p>

                          {!connectionsLoading && (
                            <span className="text-[11px] font-medium bg-zinc-100 text-zinc-500 rounded-full px-2 py-0.5">
                              {connectedCount}/3 connected
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] mt-1">
                          Connected services
                        </h2>

                        <p className="text-zinc-500 mt-2 leading-6">
                          AI, inbox and calendar configuration
                          stays hidden until you need it.
                        </p>
                      </div>
                    </div>

                    {connectionsOpen ? (
                      <ChevronDown
                        size={20}
                        className="text-zinc-400 shrink-0"
                      />
                    ) : (
                      <ChevronRight
                        size={20}
                        className="text-zinc-400 shrink-0"
                      />
                    )}
                  </div>
                </button>

                {connectionsOpen && (
                  <div className="border-t border-zinc-200/80 p-4 sm:p-5 bg-[#FAFAF8]">
                    {connectionsLoading ? (
                      <div className="py-10 flex justify-center">
                        <Loader2
                          size={22}
                          className="animate-spin text-[#5753C9]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <ConnectionCard
                          icon={<Bot size={18} />}
                          title="AI Engine"
                          description="Groq powers Thozhan's AI email analysis."
                          connected={connections.groq}
                          action={
                            connections.groq
                              ? "Configure"
                              : "Connect"
                          }
                          helpOpen={helpOpen === "groq"}
                          onHelp={() => toggleHelp("groq")}
                          onClick={() =>
                            router.push("/setup/ai")
                          }
                          help={
                            <SetupGuide
                              title="How to connect the AI engine"
                              steps={[
                                "Open the AI Engine setup using the Connect button.",
                                "Create or use your Groq account and obtain an API key.",
                                "Copy the API key into Thozhan's AI setup page.",
                                "Save the key. Thozhan will validate it before marking the AI engine as connected.",
                              ]}
                              note="Treat API keys like passwords. Do not share your key or place it in public code."
                            />
                          }
                        />

                        <ConnectionCard
                          icon={<Mail size={18} />}
                          title="Gmail"
                          description={
                            connections.gmailAddress ||
                            "Lets Thozhan read and analyse your inbox."
                          }
                          connected={connections.gmail}
                          action={
                            connections.gmail
                              ? "Configure"
                              : "Connect"
                          }
                          helpOpen={helpOpen === "gmail"}
                          onHelp={() => toggleHelp("gmail")}
                          onClick={() =>
                            router.push("/setup/gmail")
                          }
                          help={
                            <SetupGuide
                              title="How to connect Gmail"
                              steps={[
                                "Open Gmail setup using the Connect button.",
                                "Thozhan uses your Gmail address together with a Google App Password rather than your normal Google password.",
                                "If Google requires it, enable 2-Step Verification on your Google Account before creating an App Password.",
                                "Create an App Password in your Google Account security settings and enter it in Thozhan's Gmail setup page.",
                                "Thozhan will test the connection before showing Gmail as connected.",
                              ]}
                              note="Never enter your normal Google account password into Thozhan's Gmail App Password field."
                            />
                          }
                        />

                        <ConnectionCard
                          icon={<CalendarDays size={18} />}
                          title="Google Calendar"
                          description={
                            connections.calendarAddress ||
                            "Lets Thozhan check availability and schedule meetings."
                          }
                          connected={connections.calendar}
                          action={
                            connectingCalendar
                              ? "Connecting..."
                              : connections.calendar
                                ? "Reconnect"
                                : "Connect"
                          }
                          disabled={connectingCalendar}
                          helpOpen={helpOpen === "calendar"}
                          onHelp={() => toggleHelp("calendar")}
                          onClick={() =>
                            void connectCalendar()
                          }
                          help={
                            <SetupGuide
                              title="How to connect Google Calendar"
                              steps={[
                                "Click Connect to begin Google's authorization process.",
                                "Choose the Google account whose calendar you want Thozhan to use.",
                                "Review the permissions shown by Google.",
                                "Approve the requested Calendar access if you want Thozhan to check availability and create confirmed events.",
                                "Google will return you to Thozhan after authorization.",
                              ]}
                              note="Calendar event creation should only happen after you explicitly confirm the meeting inside Thozhan."
                            />
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {message && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-2xl px-4 py-3.5 text-sm text-emerald-700 flex items-center gap-2">
                  <Check size={16} />
                  {message}
                </div>
              )}

              {error && (
                <div className="border border-red-200 bg-red-50 rounded-2xl px-4 py-3.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="md:hidden pb-4">
                <div className="grid grid-cols-5 bg-white border border-zinc-200 rounded-2xl p-1">
                  <MobileNav
                    icon={<Inbox />}
                    label="Inbox"
                    onClick={() =>
                      router.push("/dashboard")
                    }
                  />

                  <MobileNav
                    icon={<Star />}
                    label="Priority"
                    onClick={() =>
                      router.push("/priority")
                    }
                  />

                  <MobileNav
                    icon={<CheckSquare />}
                    label="Tasks"
                    onClick={() =>
                      router.push("/tasks")
                    }
                  />

                  <MobileNav
                    icon={<CalendarDays />}
                    label="Meetings"
                    onClick={() =>
                      router.push("/meetings")
                    }
                  />

                  <MobileNav
                    icon={<Settings />}
                    label="Settings"
                    active
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-400 mb-2">
        {label}
      </span>

      {children}
    </label>
  );
}

function ToggleCard({
  title,
  description,
  enabled,
  onClick,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border border-zinc-200 bg-[#FAFAF8] hover:bg-white hover:border-zinc-300 rounded-2xl p-5 transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-zinc-900">
            {title}
          </p>

          <p className="text-sm text-zinc-500 mt-1 leading-5">
            {description}
          </p>
        </div>

        <div
          className={`w-11 h-6 rounded-full p-1 shrink-0 transition ${
            enabled ? "bg-[#5753C9]" : "bg-zinc-300"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </div>
      </div>
    </button>
  );
}

function ConnectionCard({
  icon,
  title,
  description,
  connected,
  action,
  onClick,
  helpOpen,
  onHelp,
  help,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  action: string;
  onClick: () => void;
  helpOpen: boolean;
  onHelp: () => void;
  help: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EEEEFA] text-[#5753C9] flex items-center justify-center shrink-0">
              {icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-zinc-900">
                  {title}
                </p>

                <ConnectionStatus connected={connected} />
              </div>

              <p className="text-sm text-zinc-500 mt-1 leading-5 break-all">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="shrink-0 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 px-4 py-2.5 text-sm font-medium transition"
          >
            {action}
          </button>
        </div>

        <button
          type="button"
          onClick={onHelp}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#5753C9] hover:text-[#4541B7] transition"
        >
          <CircleHelp size={15} />

          {helpOpen ? "Hide setup guide" : "How to connect"}

          {helpOpen ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
      </div>

      {helpOpen && (
        <div className="border-t border-zinc-200 bg-[#F7F7F5] p-5">
          {help}
        </div>
      )}
    </div>
  );
}

function ConnectionStatus({
  connected,
}: {
  connected: boolean;
}) {
  return connected ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[11px] font-medium">
      <CheckCircle2 size={12} />
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-500 px-2 py-1 text-[11px] font-medium">
      Not connected
    </span>
  );
}

function SetupGuide({
  title,
  steps,
  note,
}: {
  title: string;
  steps: string[];
  note?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-900">
        {title}
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li
            key={`${title}-${index}`}
            className="flex gap-3 text-sm text-zinc-600 leading-6"
          >
            <span className="w-6 h-6 rounded-full bg-white border border-zinc-200 text-[#5753C9] flex items-center justify-center shrink-0 text-xs font-semibold">
              {index + 1}
            </span>

            <span>{step}</span>
          </li>
        ))}
      </ol>

      {note && (
        <div className="mt-4 rounded-xl border border-[#5753C9]/10 bg-[#EEEEFA]/70 px-4 py-3 text-xs leading-5 text-zinc-600">
          <span className="font-semibold text-[#5753C9]">
            Good to know:
          </span>{" "}
          {note}
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
        active
          ? "bg-[#EEEEFA] text-[#5753C9] font-medium"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-white"
      }`}
    >
      <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">
        {icon}
      </span>

      {label}
    </button>
  );
}

function MobileNav({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] transition ${
        active
          ? "bg-[#EEEEFA] text-[#5753C9]"
          : "text-zinc-400"
      }`}
    >
      <span className="[&>svg]:w-[17px] [&>svg]:h-[17px]">
        {icon}
      </span>

      {label}
    </button>
  );
}
