"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  createClient,
} from "@/lib/supabase/client";
import {
  AlertCircle,
  CalendarDays,
  CheckSquare,
  Clock3,
  ExternalLink,
  CalendarPlus,
  CheckCircle2,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  User,
  Video,
} from "lucide-react";

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

type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  html_link: string;
  hangout_link: string;
};

export default function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsLoading />}>
      <MeetingsContent />
    </Suspense>
  );
}

function MeetingsLoading() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2
          size={26}
          className="animate-spin text-blue-400 mx-auto"
        />
        <p className="text-slate-400 mt-4">
          Loading Thozhan...
        </p>
      </div>
    </main>
  );
}

function MeetingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [calendarConnected, setCalendarConnected] =
    useState(false);
  const [calendarEmail, setCalendarEmail] =
    useState("");
  const [meetings, setMeetings] =
    useState<MeetingSuggestion[]>([]);
  const [events, setEvents] =
    useState<CalendarEvent[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [connecting, setConnecting] =
    useState(false);
  const [error, setError] =
    useState("");

  const getSession = useCallback(
    async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return null;
      }

      setName(
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "there"
      );
      setEmail(user.email ?? "");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return null;
      }

      return session;
    },
    [router]
  );

  const loadPage = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const session = await getSession();

        if (!session) {
          return;
        }

        const headers = {
          Authorization:
            `Bearer ${session.access_token}`,
        };

        const statusResponse =
          await fetch(
            "/api/calendar/status",
            {
              headers,
              cache: "no-store",
            }
          );

        const statusData =
          await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(
            statusData.detail ||
            "Unable to load Calendar status."
          );
        }

        const connected =
          statusData.connected === true;

        setCalendarConnected(
          connected
        );
        setCalendarEmail(
          statusData.google_email || ""
        );

        const meetingsResponse =
          await fetch(
            "/api/meetings",
            {
              headers,
              cache: "no-store",
            }
          );

        const meetingsData =
          await meetingsResponse.json();

        if (!meetingsResponse.ok) {
          throw new Error(
            meetingsData.detail ||
            "Unable to analyse meeting emails."
          );
        }

        setMeetings(
          Array.isArray(
            meetingsData.meetings
          )
            ? meetingsData.meetings
            : []
        );

        if (connected) {
          const eventsResponse =
            await fetch(
              "/api/calendar/events",
              {
                headers,
                cache: "no-store",
              }
            );

          const eventsData =
            await eventsResponse.json();

          if (eventsResponse.ok) {
            setEvents(
              Array.isArray(
                eventsData.events
              )
                ? eventsData.events
                : []
            );
          }
        } else {
          setEvents([]);
        }

      } catch (caught) {
        console.error(caught);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load Meetings."
        );
      } finally {
        setLoading(false);
      }
    },
    [getSession]
  );


  const [checkingMeetingKey, setCheckingMeetingKey] =
    useState<string | null>(null);
  const [schedulingMeetingKey, setSchedulingMeetingKey] =
    useState<string | null>(null);
  const [meetingAvailability, setMeetingAvailability] =
    useState<Record<string, boolean>>({});
  const [meetingActionMessage, setMeetingActionMessage] =
    useState<Record<string, string>>({});

  function meetingKey(meeting: MeetingSuggestion) {
    return `${meeting.email_id}-${meeting.purpose}`;
  }

  async function getAccessToken() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/");
      return null;
    }

    return session.access_token;
  }

  async function checkMeetingAvailability(meeting: MeetingSuggestion) {
    const key = meetingKey(meeting);

    if (!meeting.proposed_start || !meeting.proposed_end) {
      setMeetingActionMessage((current) => ({
        ...current,
        [key]: "This email does not contain a complete start and end time.",
      }));
      return;
    }

    try {
      setCheckingMeetingKey(key);
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(
        "/api/calendar/availability",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            time_min: meeting.proposed_start,
            time_max: meeting.proposed_end,
            time_zone: "Pacific/Auckland",
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to check availability.");
      }

      const isFree =
        data.available === true ||
        data.is_available === true ||
        data.free === true;

      setMeetingAvailability((current) => ({
        ...current,
        [key]: isFree,
      }));

      setMeetingActionMessage((current) => ({
        ...current,
        [key]: isFree
          ? "You are free at this time. You can schedule it now."
          : "Your calendar is busy at this time.",
      }));
    } catch (err) {
      setMeetingActionMessage((current) => ({
        ...current,
        [key]:
          err instanceof Error
            ? err.message
            : "Unable to check availability.",
      }));
    } finally {
      setCheckingMeetingKey(null);
    }
  }

  async function scheduleMeeting(meeting: MeetingSuggestion) {
    const key = meetingKey(meeting);

    if (!meeting.proposed_start || !meeting.proposed_end) {
      return;
    }

    const confirmed = window.confirm(
      `Create "${meeting.purpose || meeting.subject}" in Google Calendar?`
    );

    if (!confirmed) return;

    try {
      setSchedulingMeetingKey(key);
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const attendees =
        meeting.sender_email &&
        meeting.sender_email.includes("@")
          ? [meeting.sender_email]
          : [];

      const response = await fetch(
        "/api/calendar/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: meeting.purpose || meeting.subject || "Meeting",
            start: meeting.proposed_start,
            end: meeting.proposed_end,
            time_zone: "Pacific/Auckland",
            description: `Created by Thozhan from email: ${meeting.subject}`,
            location: meeting.location || "",
            attendees,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 409) {
        setMeetingAvailability((current) => ({
          ...current,
          [key]: false,
        }));
        throw new Error(
          data.detail ?? "Your calendar is busy at this time."
        );
      }

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to create calendar event.");
      }

      setMeetingActionMessage((current) => ({
        ...current,
        [key]: "Meeting scheduled in Google Calendar.",
      }));

      await loadPage();
    } catch (err) {
      setMeetingActionMessage((current) => ({
        ...current,
        [key]:
          err instanceof Error
            ? err.message
            : "Unable to schedule meeting.",
      }));
    } finally {
      setSchedulingMeetingKey(null);
    }
  }

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const calendar =
      searchParams.get("calendar");

    if (
      calendar === "connected"
    ) {
      setCalendarConnected(true);
    }
  }, [searchParams]);

  async function connectCalendar() {
    try {
      setConnecting(true);
      setError("");

      const session =
        await getSession();

      if (!session) {
        return;
      }

      const response =
        await fetch(
          "/api/calendar/oauth/start",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to start Google Calendar connection."
        );
      }

      window.location.href =
        data.authorization_url;

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to connect Calendar."
      );
      setConnecting(false);
    }
  }

  async function handleLogout() {
    const supabase =
      createClient();

    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function formatDate(
    value?: string
  ) {
    if (!value) {
      return "Time not specified";
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return value;
    }

    return parsed.toLocaleString(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex">

      <aside className="hidden md:flex w-64 border-r border-slate-800/80 bg-slate-950 flex-col p-5">
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard")
          }
          className="flex items-center gap-3 mb-10 text-left"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Mail size={20} />
          </div>
          <div>
            <h1 className="font-semibold">
              Thozhan
            </h1>
            <p className="text-xs text-slate-500">
              AI Companion
            </p>
          </div>
        </button>

        <nav className="space-y-1 flex-1">
          <SidebarItem
            icon={<Inbox />}
            label="Inbox"
            onClick={() =>
              router.push("/dashboard")
            }
          />
          <SidebarItem
            icon={<Star />}
            label="Priority"
            onClick={() =>
              router.push("/priority")
            }
          />
          <SidebarItem
            icon={<CheckSquare />}
            label="Tasks"
            onClick={() =>
              router.push("/tasks")
            }
          />
          <SidebarItem
            icon={<CalendarDays />}
            label="Meetings"
            active
          />

          <div className="border-t border-slate-800 my-5" />

          <SidebarItem
            icon={<Sparkles />}
            label="AI Assistant"
            onClick={() =>
              router.push("/dashboard")
            }
          />
          <SidebarItem
            icon={<Settings />}
            label="Settings" onClick={() => router.push("/settings")} />
        </nav>

        <div className="border-t border-slate-800 pt-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center">
              <User size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {email}
              </p>
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
            <p className="text-sm text-slate-500">
              Thozhan Intelligence
            </p>
            <h1 className="font-semibold">
              Meetings
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadPage()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 border border-slate-800 hover:border-blue-500 bg-slate-900/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-6">

            <div>
              <p className="text-blue-400 text-sm font-medium">
                MEETING INTELLIGENCE
              </p>
              <h2 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">
                Meetings from your inbox
              </h2>
              <p className="text-slate-400 mt-2 max-w-2xl">
                Thozhan detects scheduling requests in Gmail
                and keeps them beside your upcoming calendar.
                Calendar events are only created after you
                explicitly confirm them.
              </p>
            </div>

            <div className="border border-slate-800 bg-slate-900/35 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  calendarConnected
                    ? "bg-green-500/10 text-green-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}>
                  <CalendarDays size={19} />
                </div>

                <div className="flex-1">
                  <p className="font-medium">
                    Google Calendar
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {calendarConnected
                      ? `Connected${calendarEmail ? ` · ${calendarEmail}` : ""}`
                      : "Not connected"}
                  </p>
                </div>
              </div>

              {!calendarConnected && (
                <button
                  type="button"
                  onClick={
                    connectCalendar
                  }
                  disabled={
                    connecting
                  }
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl py-2.5 text-sm font-medium transition"
                >
                  {connecting
                    ? "Opening Google..."
                    : "Connect Google Calendar"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-6 border border-red-500/20 bg-red-500/[0.04] rounded-2xl p-5 flex gap-3">
              <AlertCircle
                className="text-red-400 shrink-0"
                size={20}
              />
              <p className="text-sm text-slate-300">
                {error}
              </p>
            </div>
          )}

          {loading ? (
            <div className="mt-10 border border-slate-800 bg-slate-900/30 rounded-2xl min-h-64 flex items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={26}
                  className="animate-spin text-blue-400 mx-auto"
                />
                <p className="text-slate-300 mt-4">
                  Thozhan is checking emails and calendar...
                </p>
              </div>
            </div>
          ) : (
            <div className="grid xl:grid-cols-2 gap-8 mt-10">

              <section>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">
                    Email meeting requests
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {meetings.length} detected from recent email.
                  </p>
                </div>

                <div className="space-y-4">
                  {meetings.length === 0 ? (
                    <EmptyCard
                      text="No clear meeting requests were detected in the recent emails."
                    />
                  ) : (
                    meetings.map(
                      (meeting) => (
                        <article
                          key={`${meeting.email_id}-${meeting.purpose}`}
                          className="border border-slate-800 bg-slate-900/35 rounded-2xl p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <span className="text-[11px] uppercase tracking-wide text-blue-400">
                                {meeting.confidence} confidence
                              </span>
                              <h4 className="font-semibold mt-2">
                                {meeting.purpose ||
                                  meeting.subject}
                              </h4>
                              <p className="text-sm text-slate-500 mt-1">
                                {meeting.sender ||
                                  meeting.sender_email}
                              </p>
                            </div>

                            {meeting.needs_response && (
                              <span className="text-[11px] border border-amber-500/20 bg-amber-500/10 text-amber-400 rounded-full px-2.5 py-1">
                                Response needed
                              </span>
                            )}
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 mt-5">
                            <Info
                              icon={<Clock3 />}
                              label="Proposed time"
                              value={
                                meeting.proposed_start
                                  ? formatDate(
                                      meeting.proposed_start
                                    )
                                  : "Not clearly specified"
                              }
                            />
                            <Info
                              icon={<MapPin />}
                              label="Location"
                              value={
                                meeting.location ||
                                "Not specified"
                              }
                            />
                          </div>

                          {meeting.meeting_link && (
                            <a
                              href={meeting.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                            >
                              <Video size={15} />
                              Meeting link
                              <ExternalLink size={13} />
                            </a>
                          )}

                          {calendarConnected &&
                            meeting.proposed_start &&
                            meeting.proposed_end && (
                            <div className="mt-5 pt-4 border-t border-slate-800">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void checkMeetingAvailability(meeting)
                                  }
                                  disabled={
                                    checkingMeetingKey === meetingKey(meeting)
                                  }
                                  className="inline-flex items-center gap-2 border border-slate-700 hover:border-blue-500 rounded-xl px-3.5 py-2 text-sm transition disabled:opacity-50"
                                >
                                  {checkingMeetingKey === meetingKey(meeting) ? (
                                    <Loader2 size={15} className="animate-spin" />
                                  ) : (
                                    <CalendarDays size={15} />
                                  )}
                                  Check availability
                                </button>

                                {meetingAvailability[meetingKey(meeting)] === true && (
                                  <button
                                    type="button"
                                    onClick={() => void scheduleMeeting(meeting)}
                                    disabled={
                                      schedulingMeetingKey === meetingKey(meeting)
                                    }
                                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50"
                                  >
                                    {schedulingMeetingKey === meetingKey(meeting) ? (
                                      <Loader2 size={15} className="animate-spin" />
                                    ) : (
                                      <CalendarPlus size={15} />
                                    )}
                                    Schedule meeting
                                  </button>
                                )}
                              </div>

                              {meetingActionMessage[meetingKey(meeting)] && (
                                <p
                                  className={`text-xs mt-3 flex items-center gap-2 ${
                                    meetingAvailability[meetingKey(meeting)] === true
                                      ? "text-green-400"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {meetingAvailability[meetingKey(meeting)] === true && (
                                    <CheckCircle2 size={13} />
                                  )}
                                  {meetingActionMessage[meetingKey(meeting)]}
                                </p>
                              )}
                            </div>
                          )}

                          {meeting.reason && (
                            <p className="text-xs text-slate-500 leading-5 mt-4 pt-4 border-t border-slate-800">
                              {meeting.reason}
                            </p>
                          )}
                        </article>
                      )
                    )
                  )}
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">
                    Upcoming calendar
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Next events from your primary Google Calendar.
                  </p>
                </div>

                <div className="space-y-4">
                  {!calendarConnected ? (
                    <EmptyCard
                      text="Connect Google Calendar to see upcoming events and check availability."
                    />
                  ) : events.length === 0 ? (
                    <EmptyCard
                      text="No upcoming calendar events were found."
                    />
                  ) : (
                    events.map(
                      (event) => (
                        <article
                          key={event.id}
                          className="border border-slate-800 bg-slate-900/35 rounded-2xl p-5"
                        >
                          <h4 className="font-semibold">
                            {event.summary}
                          </h4>

                          <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                            <Clock3 size={15} />
                            {formatDate(
                              event.start.dateTime ||
                              event.start.date
                            )}
                          </div>

                          {event.location && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                              <MapPin size={15} />
                              {event.location}
                            </div>
                          )}

                          {event.html_link && (
                            <a
                              href={event.html_link}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                            >
                              Open in Google Calendar
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </article>
                      )
                    )
                  )}
                </div>
              </section>

            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyCard({
  text,
}: {
  text: string;
}) {
  return (
    <div className="border border-slate-800 bg-slate-900/25 rounded-2xl p-7 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="[&>svg]:w-[14px] [&>svg]:h-[14px]">
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-sm text-slate-300 mt-2">
        {value}
      </p>
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
        active
          ? "bg-blue-600/10 text-blue-400"
          : "text-slate-400 hover:text-white hover:bg-slate-900"
      }`}
    >
      <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">
        {icon}
      </span>
      {label}
    </button>
  );
}
