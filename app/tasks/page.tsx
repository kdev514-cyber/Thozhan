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


type TaskPriority =
  | "high"
  | "normal"
  | "low";


type EmailTask = {
  task_id: string;
  source_email_id: string;
  title: string;
  description: string;
  source_subject: string;
  source_sender: string;
  source_sender_email: string;
  source_date: string;
  priority: TaskPriority;
  deadline: string | null;
  requires_reply: boolean;
  status: "pending" | "completed";
  reason: string;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};


type TasksResponse = {
  success: boolean;
  count: number;
  tasks: EmailTask[];
};


type PageStatus =
  | "loading"
  | "loaded"
  | "error";


export default function TasksPage() {
  const router = useRouter();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [status, setStatus] =
    useState<PageStatus>(
      "loading"
    );

  const [tasks, setTasks] =
    useState<EmailTask[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [updatingTaskId, setUpdatingTaskId] =
    useState<string | null>(null);


  const loadTasks = useCallback(
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
            "/api/tasks",
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
              "Unable to extract tasks from your inbox."
          );
        }

        const parsed =
          data as TasksResponse;

        setTasks(
          Array.isArray(
            parsed.tasks
          )
            ? parsed.tasks
            : []
        );

        setStatus(
          "loaded"
        );

      } catch (error) {
        console.error(
          "Tasks loading failed:",
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
            "Unable to extract tasks from your inbox."
          );
        }
      }
    },
    [router]
  );


  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);


  async function toggleTaskStatus(
    task: EmailTask
  ) {
    try {
      setUpdatingTaskId(
        task.task_id
      );

      const supabase =
        createClient();

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      const nextStatus =
        task.status === "completed"
          ? "pending"
          : "completed";

      const response =
        await fetch(
          `/api/tasks/${task.task_id}/status`,
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              status: nextStatus,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ??
            "Unable to update task."
        );
      }

      const updatedTask =
        data.task as EmailTask;

      setTasks(
        (currentTasks) =>
          currentTasks.map(
            (currentTask) =>
              currentTask.task_id ===
              updatedTask.task_id
                ? updatedTask
                : currentTask
          )
      );

    } catch (error) {
      console.error(
        "Task status update failed:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update task."
      );
    } finally {
      setUpdatingTaskId(
        null
      );
    }
  }


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

      await loadTasks();
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


  function formatSourceDate(
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


  const highTasks =
    tasks.filter(
      (task) =>
        task.priority === "high"
    );

  const normalTasks =
    tasks.filter(
      (task) =>
        task.priority === "normal"
    );

  const lowTasks =
    tasks.filter(
      (task) =>
        task.priority === "low"
    );

  const replyTasks =
    tasks.filter(
      (task) =>
        task.requires_reply
    );

  const pendingTasks =
    tasks.filter(
      (task) =>
        task.status !== "completed"
    );

  const completedTasks =
    tasks.filter(
      (task) =>
        task.status === "completed"
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
            onClick={() =>
              router.push(
                "/priority"
              )
            }
          />

          <SidebarItem
            icon={
              <CheckSquare />
            }
            label="Tasks"
            active
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
              Tasks
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

            Sync new mail
          </button>

        </header>


        <div className="p-6 lg:p-10 max-w-7xl mx-auto">

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">

            <div>
              <p className="text-blue-400 text-sm font-medium">
                AI TASK EXTRACTION
              </p>

              <h2 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">
                Your email action list
              </h2>

              <p className="text-slate-400 mt-2 max-w-2xl">
                Thozhan turns concrete actions in your latest
                emails into a focused task list without treating
                every notification as work.
              </p>
            </div>


            {status === "loaded" && (
              <div className="flex flex-wrap gap-2">

                <CountBadge
                  label="Pending"
                  count={
                    pendingTasks.length
                  }
                />

                <CountBadge
                  label="Completed"
                  count={
                    completedTasks.length
                  }
                />

                <CountBadge
                  label="High"
                  count={
                    highTasks.length
                  }
                />

                <CountBadge
                  label="Replies"
                  count={
                    replyTasks.length
                  }
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
                  Thozhan is extracting tasks from your emails...
                </p>

                <p className="text-xs text-slate-600 mt-2">
                  Only concrete actions will become tasks.
                </p>

              </div>

            </div>
          )}


          {status === "error" && (
            <div className="mt-10 border border-red-500/20 bg-red-500/[0.04] rounded-2xl p-8">

              <AlertCircle
                size={30}
                className="text-red-400"
              />

              <h3 className="text-lg font-medium mt-4">
                Unable to load tasks
              </h3>

              <p className="text-sm text-slate-500 mt-2 max-w-xl">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadTasks()
                }
                className="mt-5 inline-flex items-center gap-2 border border-slate-700 hover:border-blue-500 rounded-xl px-4 py-2.5 text-sm transition"
              >
                <RefreshCw
                  size={15}
                />

                Try again
              </button>

            </div>
          )}


          {status === "loaded" &&
            tasks.length === 0 && (

            <div className="mt-10 border border-slate-800 bg-slate-900/30 rounded-2xl min-h-64 flex items-center justify-center p-8">

              <div className="text-center max-w-md">

                <CheckCircle2
                  size={32}
                  className="text-green-400 mx-auto"
                />

                <h3 className="font-medium mt-4">
                  No clear tasks found
                </h3>

                <p className="text-sm text-slate-500 mt-2 leading-6">
                  Thozhan did not find a concrete action for you
                  in the latest emails it analysed.
                </p>

              </div>

            </div>
          )}


          {status === "loaded" &&
            tasks.length > 0 && (

            <div className="mt-10 space-y-10">

              <TaskSection
                title="High priority"
                description="Concrete tasks with clear urgency or time sensitivity."
                tasks={
                  highTasks.filter(
                    (task) =>
                      task.status !== "completed"
                  )
                }
                formatSourceDate={
                  formatSourceDate
                }
                onToggle={
                  toggleTaskStatus
                }
                updatingTaskId={
                  updatingTaskId
                }
              />

              <TaskSection
                title="Normal priority"
                description="Actions that need attention without clear immediate urgency."
                tasks={
                  normalTasks.filter(
                    (task) =>
                      task.status !== "completed"
                  )
                }
                formatSourceDate={
                  formatSourceDate
                }
                onToggle={
                  toggleTaskStatus
                }
                updatingTaskId={
                  updatingTaskId
                }
              />

              <TaskSection
                title="Low priority"
                description="Optional or lower-impact actions found in your inbox."
                tasks={
                  lowTasks.filter(
                    (task) =>
                      task.status !== "completed"
                  )
                }
                formatSourceDate={
                  formatSourceDate
                }
                onToggle={
                  toggleTaskStatus
                }
                updatingTaskId={
                  updatingTaskId
                }
              />

              <TaskSection
                title="Completed"
                description="Tasks you have already finished. You can reopen any task."
                tasks={
                  completedTasks
                }
                formatSourceDate={
                  formatSourceDate
                }
                onToggle={
                  toggleTaskStatus
                }
                updatingTaskId={
                  updatingTaskId
                }
              />

            </div>
          )}

        </div>

      </section>

    </main>
  );
}


function TaskSection({
  title,
  description,
  tasks,
  formatSourceDate,
  onToggle,
  updatingTaskId,
}: {
  title: string;
  description: string;
  tasks: EmailTask[];
  formatSourceDate: (
    value: string
  ) => string;
  onToggle: (
    task: EmailTask
  ) => Promise<void>;
  updatingTaskId: string | null;
}) {
  if (
    tasks.length === 0
  ) {
    return null;
  }

  return (
    <section>

      <div className="flex items-end justify-between gap-4 mb-4">

        <div>
          <h3 className="text-xl font-semibold">
            {title}
          </h3>

          <p className="text-sm text-slate-500 mt-1">
            {description}
          </p>
        </div>

        <span className="text-xs text-slate-600">
          {tasks.length}{" "}
          {tasks.length === 1
            ? "task"
            : "tasks"}
        </span>

      </div>


      <div className="grid xl:grid-cols-2 gap-5">

        {tasks.map(
          (task) => (

          <TaskCard
            key={
              task.task_id
            }
            task={
              task
            }
            formatSourceDate={
              formatSourceDate
            }
            onToggle={
              onToggle
            }
            updating={
              updatingTaskId ===
              task.task_id
            }
          />

        ))}

      </div>

    </section>
  );
}


function TaskCard({
  task,
  formatSourceDate,
  onToggle,
  updating,
}: {
  task: EmailTask;
  formatSourceDate: (
    value: string
  ) => string;
  onToggle: (
    task: EmailTask
  ) => Promise<void>;
  updating: boolean;
}) {
  return (
    <article className="border border-slate-800 bg-slate-900/35 rounded-2xl p-5 hover:border-slate-700 transition">

      <div className="flex items-start gap-4">

        <button
          type="button"
          onClick={() =>
            void onToggle(task)
          }
          disabled={
            updating
          }
          aria-label={
            task.status === "completed"
              ? "Mark task as pending"
              : "Mark task as completed"
          }
          className={`w-10 h-10 shrink-0 border rounded-xl flex items-center justify-center transition disabled:opacity-50 ${
            task.status === "completed"
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-slate-700 bg-slate-950 text-slate-500 hover:border-blue-500 hover:text-blue-400"
          }`}
        >
          {updating ? (
            <Loader2
              size={18}
              className="animate-spin"
            />
          ) : task.status === "completed" ? (
            <CheckCircle2
              size={19}
            />
          ) : (
            <CheckSquare
              size={18}
            />
          )}
        </button>


        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <PriorityBadge
              priority={
                task.priority
              }
            />

            {task.requires_reply && (
              <span className="inline-flex items-center gap-1.5 border border-blue-500/20 bg-blue-500/10 text-blue-400 rounded-full px-2.5 py-1 text-[11px] font-medium">
                <MessageSquareReply
                  size={11}
                />
                Reply needed
              </span>
            )}

          </div>


          <h4
            className={`font-semibold mt-3 ${
              task.status === "completed"
                ? "text-slate-500 line-through"
                : "text-slate-100"
            }`}
          >
            {task.title}
          </h4>


          {task.description && (
            <p className="text-sm text-slate-400 leading-6 mt-2">
              {task.description}
            </p>
          )}

        </div>

      </div>


      <div className="grid sm:grid-cols-2 gap-3 mt-5">

        <InfoBox
          icon={
            <Clock3 />
          }
          label="Deadline"
          value={
            task.deadline ||
            "None stated"
          }
        />

        <InfoBox
          icon={
            <Mail />
          }
          label="Source"
          value={
            task.source_sender ||
            task.source_sender_email ||
            "Unknown sender"
          }
        />

      </div>


      <div className="mt-4 border border-slate-800/80 bg-slate-950/40 rounded-xl p-4">

        <p className="text-[11px] uppercase tracking-wide text-slate-600">
          Source email
        </p>

        <p className="text-sm text-slate-300 mt-2">
          {task.source_subject ||
            "(No subject)"}
        </p>

        {task.source_date && (
          <p className="text-xs text-slate-600 mt-1">
            {formatSourceDate(
              task.source_date
            )}
          </p>
        )}

      </div>


      {task.reason && (
        <div className="mt-4 pt-4 border-t border-slate-800">

          <p className="text-[11px] uppercase tracking-wide text-slate-600">
            Why this is a task
          </p>

          <p className="text-xs text-slate-500 leading-5 mt-2">
            {task.reason}
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
  priority: TaskPriority;
}) {
  const styles =
    priority === "high"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : priority === "normal"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <span
      className={`inline-flex items-center border rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${styles}`}
    >
      {priority}
    </span>
  );
}


function CountBadge({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <span className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-2 text-xs text-slate-400">
      {label}:{" "}
      <strong className="text-slate-200">
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
