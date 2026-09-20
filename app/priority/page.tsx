"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Inbox,
  Loader2,
  LogOut,
  Mail,
  MessageSquareReply,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  User,
} from "lucide-react";


type PriorityLevel =
  | "high"
  | "normal"
  | "low";


type ReplyStatus =
  | "yes"
  | "no"
  | "unclear";


type MeetingInfo = {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
  action: string;
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
  reply_status: ReplyStatus;
  meeting: MeetingInfo | null;
  reason: string;
};


type PriorityResponse = {
  success: boolean;
  count: number;
  emails: PriorityEmail[];
};


type PageStatus =
  | "loading"
  | "loaded"
  | "error";


export default function PriorityPage() {
  const router = useRouter();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [status, setStatus] =
    useState<PageStatus>(
      "loading"
    );

  const [priorityEmails, setPriorityEmails] =
    useState<PriorityEmail[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");


  const loadPriority = useCallback(
    async () => {
      try {
        setStatus(
          "loading"
        );

        setErrorMessage("");

        const supabase =
          createClient();

        const {
          data: {
            user,
          },
          error: userError,
        } =
          await supabase.auth.getUser();


        if (
          userError ||
          !user
        ) {
          router.replace("/");
          return;
        }


        setEmail(
          user.email ?? ""
        );


        setName(
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there"
        );


        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();


        if (
          sessionError ||
          !session
        ) {
          router.replace("/");
          return;
        }


        const response =
          await fetch(
            "/api/priority",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache: "no-store",
            }
          );


        const data =
          await response.json();


        if (!response.ok) {
          throw new Error(
            data.detail ??
              "Unable to analyse your priority inbox."
          );
        }


        const parsed =
          data as PriorityResponse;


        setPriorityEmails(
          Array.isArray(
            parsed.emails
          )
            ? parsed.emails
            : []
        );


        setStatus(
          "loaded"
        );

      } catch (error) {
        console.error(
          "Priority inbox loading failed:",
          error
        );


        setStatus(
          "error"
        );


        if (
          error instanceof Error
        ) {
          setErrorMessage(
            error.message
          );
        } else {
          setErrorMessage(
            "Unable to analyse your priority inbox."
          );
        }
      }
    },
    [router]
  );


  useEffect(() => {
    void loadPriority();
  }, [loadPriority]);


  async function syncAndReload() {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      const response = await fetch(
        "/api/sync",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: 20 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Unable to sync inbox.");
      }

      await loadPriority();
    } catch (error) {
      console.error("Inbox sync failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to sync inbox.");
    }
  }


  async function handleLogout() {
    const supabase =
      createClient();

    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }


  function formatEmailDate(
    value: string
  ) {
    if (!value) {
      return "";
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


  const highEmails =
    priorityEmails.filter(
      (item) =>
        item.priority === "high"
    );

  const normalEmails =
    priorityEmails.filter(
      (item) =>
        item.priority === "normal"
    );

  const lowEmails =
    priorityEmails.filter(
      (item) =>
        item.priority === "low"
    );


  return (
    <main className="min-h-screen bg-slate-950 text-white flex">

      <aside className="hidden md:flex w-64 border-r border-slate-800/80 bg-slate-950 flex-col p-5">

        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          className="flex items-center gap-3 mb-10 text-left"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Mail
              size={20}
            />
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
            icon={
              <Inbox />
            }
            label="Inbox"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          />

          <SidebarItem
            icon={
              <Star />
            }
            label="Priority"
            active
          />

          <SidebarItem
            icon={
              <CheckSquare />
            }
            label="Tasks"
            onClick={() =>
              router.push(
                "/tasks"
              )
            }
          />

          <SidebarItem
            icon={
              <CalendarDays />
            }
            label="Meetings"
            onClick={() =>
              router.push(
                "/meetings"
              )
            }
          />


          <div className="border-t border-slate-800 my-5" />


          <SidebarItem
            icon={
              <Sparkles />
            }
            label="AI Assistant"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          />

          <SidebarItem
            icon={
              <Settings />
            }
            label="Settings" onClick={() => router.push("/settings")} />

        </nav>


        <div className="border-t border-slate-800 pt-5">

          <div className="flex items-center gap-3 mb-4">

            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center">
              <User
                size={17}
              />
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
            onClick={
              handleLogout
            }
            className="w-full flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg p-2.5 transition text-sm"
          >
            <LogOut
              size={17}
            />

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
              Priority Inbox
            </h1>
          </div>


          <button
            type="button"
            onClick={() =>
              void syncAndReload()
            }
            disabled={
              status === "loading"
            }
            className="inline-flex items-center gap-2 border border-slate-800 hover:border-blue-500 bg-slate-900/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                status === "loading"
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh analysis
          </button>

        </header>


        <div className="p-6 lg:p-10 max-w-7xl mx-auto">

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>
              <p className="text-blue-400 text-sm font-medium">
                AI PRIORITY ANALYSIS
              </p>

              <h2 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">
                What needs your attention
              </h2>

              <p className="text-slate-400 mt-2 max-w-2xl">
                Thozhan analyses your latest Gmail messages
                for actions, deadlines, replies and meetings.
              </p>
            </div>


            {status === "loaded" && (
              <div className="flex flex-wrap gap-2">

                <CountBadge
                  label="High"
                  count={
                    highEmails.length
                  }
                  kind="high"
                />

                <CountBadge
                  label="Normal"
                  count={
                    normalEmails.length
                  }
                  kind="normal"
                />

                <CountBadge
                  label="Low"
                  count={
                    lowEmails.length
                  }
                  kind="low"
                />

              </div>
            )}

          </div>


          {status === "loading" && (
            <div className="mt-10 border border-slate-800 bg-slate-900/30 rounded-2xl min-h-72 flex items-center justify-center">

              <div className="text-center">

                <Loader2
                  size={26}
                  className="animate-spin text-blue-400 mx-auto"
                />

                <p className="text-slate-300 mt-4">
                  Thozhan is analysing your latest emails...
                </p>

                <p className="text-xs text-slate-600 mt-2">
                  Reading Gmail through your MCP tools.
                </p>

              </div>

            </div>
          )}


          {status === "error" && (
            <div className="mt-10 border border-red-500/20 bg-red-500/[0.04] rounded-2xl p-8">

              <div className="max-w-xl">

                <AlertCircle
                  size={30}
                  className="text-red-400"
                />

                <h3 className="text-lg font-medium mt-4">
                  Priority analysis unavailable
                </h3>

                <p className="text-sm text-slate-500 mt-2">
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadPriority()
                  }
                  className="mt-5 inline-flex items-center gap-2 border border-slate-700 hover:border-blue-500 rounded-xl px-4 py-2.5 text-sm transition"
                >
                  <RefreshCw
                    size={15}
                  />

                  Try again
                </button>

              </div>

            </div>
          )}


          {status === "loaded" &&
            priorityEmails.length === 0 && (

            <div className="mt-10 border border-slate-800 bg-slate-900/30 rounded-2xl min-h-64 flex items-center justify-center p-8">

              <div className="text-center">

                <CheckCircle2
                  size={30}
                  className="text-green-400 mx-auto"
                />

                <h3 className="font-medium mt-4">
                  Nothing to analyse
                </h3>

                <p className="text-sm text-slate-500 mt-2">
                  Thozhan did not receive any recent
                  Gmail messages to classify.
                </p>

              </div>

            </div>
          )}


          {status === "loaded" &&
            priorityEmails.length > 0 && (

            <div className="mt-10 space-y-10">

              <PrioritySection
                title="High priority"
                description="Messages with clear evidence of time-sensitive or important action."
                emails={
                  highEmails
                }
                kind="high"
                formatEmailDate={
                  formatEmailDate
                }
              />

              <PrioritySection
                title="Normal priority"
                description="Useful messages that matter but are not clearly urgent."
                emails={
                  normalEmails
                }
                kind="normal"
                formatEmailDate={
                  formatEmailDate
                }
              />

              <PrioritySection
                title="Low priority"
                description="Informational, promotional or low-action messages."
                emails={
                  lowEmails
                }
                kind="low"
                formatEmailDate={
                  formatEmailDate
                }
              />

            </div>
          )}

        </div>

      </section>

    </main>
  );
}


function PrioritySection({
  title,
  description,
  emails,
  kind,
  formatEmailDate,
}: {
  title: string;
  description: string;
  emails: PriorityEmail[];
  kind: PriorityLevel;
  formatEmailDate: (
    value: string
  ) => string;
}) {
  if (
    emails.length === 0
  ) {
    return null;
  }


  return (
    <section>

      <div className="flex items-end justify-between gap-4 mb-4">

        <div>
          <div className="flex items-center gap-2">

            <PriorityDot
              kind={
                kind
              }
            />

            <h3 className="text-xl font-semibold">
              {title}
            </h3>

          </div>

          <p className="text-sm text-slate-500 mt-1">
            {description}
          </p>
        </div>


        <span className="text-xs text-slate-600">
          {emails.length}{" "}
          {emails.length === 1
            ? "message"
            : "messages"}
        </span>

      </div>


      <div className="grid xl:grid-cols-2 gap-5">

        {emails.map(
          (message) => (

          <PriorityCard
            key={
              message.id
            }
            message={
              message
            }
            formatEmailDate={
              formatEmailDate
            }
          />

        ))}

      </div>

    </section>
  );
}


function PriorityCard({
  message,
  formatEmailDate,
}: {
  message: PriorityEmail;
  formatEmailDate: (
    value: string
  ) => string;
}) {
  return (
    <article className="border border-slate-800 bg-slate-900/35 rounded-2xl p-5 hover:border-slate-700 transition">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <PriorityBadge
            priority={
              message.priority
            }
          />

          <h4 className="font-semibold text-slate-100 mt-3">
            {message.subject}
          </h4>

          <p className="text-sm text-slate-500 mt-1 truncate">
            {message.sender ||
              message.sender_email ||
              "Unknown sender"}
          </p>

        </div>


        <p className="text-xs text-slate-600 shrink-0">
          {formatEmailDate(
            message.date
          )}
        </p>

      </div>


      <p className="text-sm text-slate-300 leading-6 mt-5">
        {message.summary}
      </p>


      <div className="mt-5 grid sm:grid-cols-2 gap-3">

        <InfoBox
          icon={
            <CheckSquare />
          }
          label="Action"
          value={
            message.action ||
            "None clearly stated"
          }
        />

        <InfoBox
          icon={
            <Clock3 />
          }
          label="Deadline"
          value={
            message.deadline ||
            "None stated"
          }
        />

        <InfoBox
          icon={
            <MessageSquareReply />
          }
          label="Reply"
          value={
            message.reply_status === "yes"
              ? "Reply needed"
              : message.reply_status === "no"
              ? "No reply needed"
              : "Unclear"
          }
        />

        <InfoBox
          icon={
            <CalendarDays />
          }
          label="Meeting"
          value={
            message.meeting
              ? formatMeeting(
                  message.meeting
                )
              : "No meeting identified"
          }
        />

      </div>


      {message.reason && (
        <div className="mt-5 pt-4 border-t border-slate-800">

          <p className="text-[11px] uppercase tracking-wider text-slate-600">
            Why Thozhan classified it this way
          </p>

          <p className="text-xs text-slate-500 leading-5 mt-2">
            {message.reason}
          </p>

        </div>
      )}

    </article>
  );
}


function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-slate-800/80 bg-slate-950/50 rounded-xl p-3">

      <div className="flex items-center gap-2 text-slate-500">

        <span className="[&>svg]:w-[14px] [&>svg]:h-[14px]">
          {icon}
        </span>

        <span className="text-[11px] uppercase tracking-wide">
          {label}
        </span>

      </div>

      <p className="text-sm text-slate-300 mt-2 leading-5">
        {value}
      </p>

    </div>
  );
}


function PriorityBadge({
  priority,
}: {
  priority: PriorityLevel;
}) {
  const styles =
    priority === "high"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : priority === "normal"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-slate-800 text-slate-400 border-slate-700";


  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${styles}`}
    >
      <PriorityDot
        kind={
          priority
        }
      />

      {priority}
    </span>
  );
}


function PriorityDot({
  kind,
}: {
  kind: PriorityLevel;
}) {
  const styles =
    kind === "high"
      ? "bg-red-400"
      : kind === "normal"
      ? "bg-amber-400"
      : "bg-slate-500";


  return (
    <span
      className={`w-2 h-2 rounded-full ${styles}`}
    />
  );
}


function CountBadge({
  label,
  count,
  kind,
}: {
  label: string;
  count: number;
  kind: PriorityLevel;
}) {
  const styles =
    kind === "high"
      ? "border-red-500/20 bg-red-500/[0.05] text-red-400"
      : kind === "normal"
      ? "border-amber-500/20 bg-amber-500/[0.05] text-amber-400"
      : "border-slate-700 bg-slate-900 text-slate-400";


  return (
    <span
      className={`border rounded-xl px-3 py-2 text-xs ${styles}`}
    >
      {label}:{" "}
      <strong>
        {count}
      </strong>
    </span>
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
      onClick={
        onClick
      }
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


function formatMeeting(
  meeting: MeetingInfo
) {
  const details = [
    meeting.title,
    meeting.date,
    meeting.time,
    meeting.location,
  ].filter(Boolean);


  if (
    meeting.action
  ) {
    details.push(
      meeting.action
    );
  }


  return (
    details.join(" • ") ||
    "Meeting identified"
  );
}
