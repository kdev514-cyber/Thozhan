"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  CalendarDays,
  Check,
  CheckSquare,
  Inbox,
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

const DEFAULTS: UserSettings = {
  full_name: "",
  email: "",
  time_zone: "Pacific/Auckland",
  notify_priority_email: true,
  notify_meeting_request: true,
  notify_task_deadline: true,
  notify_calendar_event: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSettings();
  }, []);

  async function getSession() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/");
      return null;
    }
    return session;
  }

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");
      const session = await getSession();
      if (!session) return;

      const response = await fetch("http://localhost:8000/api/settings", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to load settings.");
      }

      setSettings({
        ...DEFAULTS,
        ...(data.settings ?? {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");
      setError("");
      const session = await getSession();
      if (!session) return;

      const response = await fetch("http://localhost:8000/api/settings", {
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
        throw new Error(data.detail ?? "Unable to save settings.");
      }

      setMessage("Profile and notification preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function toggle(key: keyof Pick<
    UserSettings,
    | "notify_priority_email"
    | "notify_meeting_request"
    | "notify_task_deadline"
    | "notify_calendar_event"
  >) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex">
      <aside className="hidden md:flex w-64 border-r border-slate-800/80 bg-slate-950 flex-col p-5">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-3 mb-10 text-left"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="font-semibold">Thozhan</h1>
            <p className="text-xs text-slate-500">AI Companion</p>
          </div>
        </button>

        <nav className="space-y-1 flex-1">
          <SidebarItem icon={<Inbox />} label="Inbox" onClick={() => router.push("/dashboard")} />
          <SidebarItem icon={<Star />} label="Priority" onClick={() => router.push("/priority")} />
          <SidebarItem icon={<CheckSquare />} label="Tasks" onClick={() => router.push("/tasks")} />
          <SidebarItem icon={<CalendarDays />} label="Meetings" onClick={() => router.push("/meetings")} />
          <div className="border-t border-slate-800 my-5" />
          <SidebarItem icon={<Sparkles />} label="AI Assistant" onClick={() => router.push("/dashboard")} />
          <SidebarItem icon={<Settings />} label="Settings" active />
        </nav>

        <div className="border-t border-slate-800 pt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center">
              <User size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {settings.full_name || settings.email.split("@")[0] || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">{settings.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg p-2.5 transition text-sm"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        <header className="min-h-20 border-b border-slate-800/80 flex items-center justify-between gap-4 px-6 lg:px-10 py-4">
          <div>
            <p className="text-sm text-slate-500">Thozhan Preferences</p>
            <h1 className="font-semibold">Settings</h1>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </header>

        <div className="p-6 lg:p-10 max-w-5xl mx-auto">
          {loading ? (
            <div className="min-h-72 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-400" size={28} />
            </div>
          ) : (
            <div className="space-y-8">
              <section>
                <p className="text-blue-400 text-sm font-medium">PROFILE</p>
                <h2 className="text-3xl font-semibold mt-2">Your Thozhan profile</h2>
                <p className="text-slate-400 mt-2">
                  Control how your name appears and which timezone Thozhan uses for scheduling.
                </p>

                <div className="grid md:grid-cols-2 gap-5 mt-6">
                  <Field label="Full name">
                    <input
                      value={settings.full_name}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
                      placeholder="Your name"
                    />
                  </Field>

                  <Field label="Account email">
                    <input
                      value={settings.email}
                      disabled
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-500"
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
                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
                    >
                      <option value="Pacific/Auckland">Auckland · Pacific/Auckland</option>
                      <option value="Australia/Sydney">Sydney · Australia/Sydney</option>
                      <option value="Asia/Kolkata">India · Asia/Kolkata</option>
                      <option value="Europe/London">London · Europe/London</option>
                      <option value="America/New_York">New York · America/New_York</option>
                      <option value="America/Los_Angeles">Los Angeles · America/Los_Angeles</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section className="border-t border-slate-800 pt-8">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Bell size={19} />
                  </div>
                  <div>
                    <p className="text-blue-400 text-sm font-medium">NOTIFICATIONS</p>
                    <h2 className="text-2xl font-semibold mt-1">What should Thozhan alert you about?</h2>
                    <p className="text-slate-400 mt-2">
                      These preferences are stored now and can drive in-app, email, or push delivery as those channels are added.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <ToggleCard
                    title="Priority emails"
                    description="Important or urgent email detected."
                    enabled={settings.notify_priority_email}
                    onClick={() => toggle("notify_priority_email")}
                  />
                  <ToggleCard
                    title="Meeting requests"
                    description="A scheduling request is detected in Gmail."
                    enabled={settings.notify_meeting_request}
                    onClick={() => toggle("notify_meeting_request")}
                  />
                  <ToggleCard
                    title="Task deadlines"
                    description="An extracted task has a deadline that needs attention."
                    enabled={settings.notify_task_deadline}
                    onClick={() => toggle("notify_task_deadline")}
                  />
                  <ToggleCard
                    title="Calendar events"
                    description="Calendar-related reminders and scheduling updates."
                    enabled={settings.notify_calendar_event}
                    onClick={() => toggle("notify_calendar_event")}
                  />
                </div>
              </section>

              {message && (
                <div className="border border-green-500/20 bg-green-500/[0.06] rounded-xl p-4 text-sm text-green-300 flex items-center gap-2">
                  <Check size={16} />
                  {message}
                </div>
              )}

              {error && (
                <div className="border border-red-500/20 bg-red-500/[0.06] rounded-xl p-4 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="block text-xs uppercase tracking-wide text-slate-500 mb-2">{label}</span>
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
      className="text-left border border-slate-800 bg-slate-900/35 hover:border-slate-700 rounded-2xl p-5 transition"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <div
          className={`w-11 h-6 rounded-full p-1 transition ${
            enabled ? "bg-blue-600" : "bg-slate-700"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </div>
      </div>
    </button>
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
        active
          ? "bg-blue-600/10 text-blue-400"
          : "text-slate-400 hover:text-white hover:bg-slate-900"
      }`}
    >
      <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">{icon}</span>
      {label}
    </button>
  );
}
