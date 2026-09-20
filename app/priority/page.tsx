"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThozhanLogo from "@/components/thozhan/ThozhanLogo";

import {
  AlertCircle,
  ArrowRight,
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

type PriorityLevel = "high" | "normal" | "low";
type ReplyStatus = "yes" | "no" | "unclear";
type PageStatus = "loading" | "loaded" | "error";

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

type SyncResult = {
  success?: boolean;
  checked?: number;
  new_emails?: number;
  processed?: number;
  tasks_added?: number;
  remaining_new?: number;
  message?: string;
};

type FilterType =
  | "all"
  | "high"
  | "normal"
  | "low"
  | "reply";

export default function PriorityPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [status, setStatus] =
    useState<PageStatus>("loading");

  const [priorityEmails, setPriorityEmails] =
    useState<PriorityEmail[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [isSyncing, setIsSyncing] =
    useState(false);

  const [syncMessage, setSyncMessage] =
    useState("");

  const [syncError, setSyncError] =
    useState("");

  const getAccessToken = useCallback(
    async () => {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return null;
      }

      return session.access_token;
    },
    [router]
  );

  const loadPriority = useCallback(
    async (
      accessToken?: string,
      showLoading = true
    ) => {
      try {
        if (showLoading) {
          setStatus("loading");
        }

        setErrorMessage("");

        const token =
          accessToken ??
          (await getAccessToken());

        if (!token) {
          return;
        }

        const response = await fetch(
          "/api/priority",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ??
              "Unable to load priority emails."
          );
        }

        const parsed =
          data as PriorityResponse;

        setPriorityEmails(
          Array.isArray(parsed.emails)
            ? parsed.emails
            : []
        );

        setStatus("loaded");
      } catch (error) {
        console.error(
          "Priority loading failed:",
          error
        );

        setStatus("error");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load priority emails."
        );
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    async function initialisePage() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/");
          return;
        }

        setEmail(user.email ?? "");

        setName(
          user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "there"
        );

        const {
          data: { session },
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

        await loadPriority(
          session.access_token
        );
      } catch (error) {
        console.error(
          "Priority page initialization failed:",
          error
        );

        setStatus("error");
        setErrorMessage(
          "Unable to open your priority inbox."
        );
      }
    }

    void initialisePage();
  }, [loadPriority, router]);

  async function syncAndReload() {
    if (isSyncing) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncMessage("");
      setSyncError("");

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        "/api/sync",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            limit: 20,
          }),
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as
          SyncResult & {
            detail?: string;
          };

      if (!response.ok) {
        throw new Error(
          data.detail ??
            "Unable to sync your inbox."
        );
      }

      await loadPriority(
        token,
        false
      );

      const processed =
        Number(data.processed ?? 0);

      const tasksAdded =
        Number(data.tasks_added ?? 0);

      const remaining =
        Number(data.remaining_new ?? 0);

      if (processed > 0) {
        let message =
          `${processed} new email${
            processed === 1 ? "" : "s"
          } analysed`;

        if (tasksAdded > 0) {
          message +=
            ` · ${tasksAdded} task${
              tasksAdded === 1
                ? ""
                : "s"
            } added`;
        }

        if (remaining > 0) {
          message +=
            ` · ${remaining} still waiting`;
        }

        setSyncMessage(message);
      } else {
        setSyncMessage(
          data.message ||
            "Inbox is already up to date."
        );
      }
    } catch (error) {
      console.error(
        "Priority sync failed:",
        error
      );

      setSyncError(
        error instanceof Error
          ? error.message
          : "Unable to sync your inbox."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }

  const highCount = useMemo(
    () =>
      priorityEmails.filter(
        (item) =>
          item.priority === "high"
      ).length,
    [priorityEmails]
  );

  const normalCount = useMemo(
    () =>
      priorityEmails.filter(
        (item) =>
          item.priority === "normal"
      ).length,
    [priorityEmails]
  );

  const lowCount = useMemo(
    () =>
      priorityEmails.filter(
        (item) =>
          item.priority === "low"
      ).length,
    [priorityEmails]
  );

  const replyCount = useMemo(
    () =>
      priorityEmails.filter(
        (item) =>
          item.reply_needed ||
          item.reply_status === "yes"
      ).length,
    [priorityEmails]
  );

  const filteredEmails =
    useMemo(() => {
      if (filter === "all") {
        return priorityEmails;
      }

      if (filter === "reply") {
        return priorityEmails.filter(
          (item) =>
            item.reply_needed ||
            item.reply_status === "yes"
        );
      }

      return priorityEmails.filter(
        (item) =>
          item.priority === filter
      );
    }, [filter, priorityEmails]);

  if (
    status === "loading" &&
    priorityEmails.length === 0
  ) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] flex items-center justify-center text-[#18181b]">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Loader2
            size={20}
            className="animate-spin text-[#5b5bd6]"
          />
          Opening your priority inbox...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#18181b] md:flex">
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[224px] flex-col border-r border-black/[0.06] bg-[#f1f0ed] px-4 py-5">
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard")
          }
          className="flex items-center gap-3 rounded-2xl px-2 py-2 text-left"
        >
          <ThozhanLogo />

          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              Thozhan
            </p>

            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.17em] text-zinc-400">
              Always with you
            </p>
          </div>
        </button>

        <nav className="mt-9 space-y-1">
          <SidebarItem
            icon={<Inbox />}
            label="Inbox"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          />

          <SidebarItem
            icon={<Star />}
            label="Priority"
            active
          />

          <SidebarItem
            icon={<CheckSquare />}
            label="Tasks"
            onClick={() =>
              router.push("/tasks")
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

          <div className="my-5 h-px bg-black/[0.06]" />

          <SidebarItem
            icon={<Sparkles />}
            label="AI Assistant"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          />

          <SidebarItem
            icon={<Settings />}
            label="Settings"
            onClick={() =>
              router.push(
                "/settings"
              )
            }
          />
        </nav>

        <div className="mt-auto">
          <div className="mb-3 rounded-2xl border border-black/[0.06] bg-white/60 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ecebff] text-[#5b5bd6]">
                <User size={15} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-800">
                  {name}
                </p>

                <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                  {email}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-zinc-500 transition hover:bg-black/[0.04] hover:text-zinc-900"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 md:ml-[224px]">
        <MobileHeader
          onHome={() =>
            router.push(
              "/dashboard"
            )
          }
        />

        <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-6 sm:px-7 md:px-9 lg:px-12 lg:pt-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#5b5bd6]/10 bg-[#efefff] px-3 py-1.5 text-[11px] font-medium text-[#5b5bd6]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5b5bd6]" />
                Thozhan intelligence
              </div>

              <h1 className="max-w-2xl text-[34px] font-semibold tracking-[-0.045em] text-zinc-950 sm:text-[40px]">
                What needs your attention.
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                Thozhan sorts your inbox by
                importance, highlights actions
                and keeps reply requests from
                getting lost.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void syncAndReload()
              }
              disabled={isSyncing}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw
                  size={16}
                />
              )}

              {isSyncing
                ? "Analysing inbox..."
                : "Sync inbox"}
            </button>
          </div>

          {(syncMessage ||
            syncError) && (
            <div
              className={`mt-5 flex max-w-2xl items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
                syncError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[#5b5bd6]/10 bg-[#efefff] text-[#5050b8]"
              }`}
            >
              {syncError ? (
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0"
                />
              )}

              <span>
                {syncError ||
                  syncMessage}
              </span>
            </div>
          )}

          <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="High priority"
              value={highCount}
              caption="Needs attention"
              icon={<Star />}
              accent="high"
              onClick={() =>
                setFilter("high")
              }
              active={
                filter === "high"
              }
            />

            <StatCard
              label="Needs reply"
              value={replyCount}
              caption="Waiting on you"
              icon={
                <MessageSquareReply />
              }
              accent="purple"
              onClick={() =>
                setFilter("reply")
              }
              active={
                filter === "reply"
              }
            />

            <StatCard
              label="Normal"
              value={normalCount}
              caption="Worth reviewing"
              icon={<Inbox />}
              accent="neutral"
              onClick={() =>
                setFilter("normal")
              }
              active={
                filter === "normal"
              }
            />

            <StatCard
              label="Low priority"
              value={lowCount}
              caption="Can wait"
              icon={
                <CheckCircle2 />
              }
              accent="neutral"
              onClick={() =>
                setFilter("low")
              }
              active={
                filter === "low"
              }
            />
          </section>

          <section className="mt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Priority inbox
                </p>

                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-zinc-900">
                  {filter === "all"
                    ? "Everything Thozhan analysed"
                    : filter ===
                        "reply"
                      ? "Emails needing a reply"
                      : `${
                          filter
                            .charAt(0)
                            .toUpperCase() +
                          filter.slice(
                            1
                          )
                        } priority`}
                </h2>
              </div>

              <div className="flex flex-wrap gap-1.5 rounded-xl border border-black/[0.06] bg-white p-1">
                <FilterButton
                  label="All"
                  active={
                    filter === "all"
                  }
                  onClick={() =>
                    setFilter("all")
                  }
                />

                <FilterButton
                  label="High"
                  active={
                    filter === "high"
                  }
                  onClick={() =>
                    setFilter("high")
                  }
                />

                <FilterButton
                  label="Normal"
                  active={
                    filter ===
                    "normal"
                  }
                  onClick={() =>
                    setFilter(
                      "normal"
                    )
                  }
                />

                <FilterButton
                  label="Low"
                  active={
                    filter === "low"
                  }
                  onClick={() =>
                    setFilter("low")
                  }
                />

                <FilterButton
                  label="Reply"
                  active={
                    filter ===
                    "reply"
                  }
                  onClick={() =>
                    setFilter("reply")
                  }
                />
              </div>
            </div>

            {status === "error" && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-7">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={20}
                    className="mt-0.5 shrink-0 text-red-500"
                  />

                  <div>
                    <h3 className="font-medium text-red-900">
                      Unable to load
                      priority inbox
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-red-700">
                      {errorMessage}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        void loadPriority()
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-50"
                    >
                      <RefreshCw
                        size={14}
                      />
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {status === "loaded" &&
              filteredEmails.length ===
                0 && (
                <div className="mt-5 flex min-h-[260px] items-center justify-center rounded-[24px] border border-black/[0.06] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="max-w-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#efefff] text-[#5b5bd6]">
                      <Star
                        size={21}
                      />
                    </div>

                    <h3 className="mt-4 font-semibold text-zinc-900">
                      Nothing here
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {filter ===
                      "all"
                        ? "Thozhan has not analysed any emails yet. Sync your inbox to get started."
                        : "No emails match this filter right now."}
                    </p>

                    {filter !==
                      "all" && (
                      <button
                        type="button"
                        onClick={() =>
                          setFilter(
                            "all"
                          )
                        }
                        className="mt-4 text-sm font-medium text-[#5b5bd6]"
                      >
                        Show all emails
                      </button>
                    )}
                  </div>
                </div>
              )}

            {status === "loaded" &&
              filteredEmails.length >
                0 && (
                <div className="mt-5 space-y-3">
                  {filteredEmails.map(
                    (item) => (
                      <PriorityCard
                        key={item.id}
                        item={item}
                      />
                    )
                  )}
                </div>
              )}
          </section>
        </div>
      </section>
    </main>
  );
}

function PriorityCard({
  item,
}: {
  item: PriorityEmail;
}) {
  const priority =
    getPriorityAppearance(
      item.priority
    );

  return (
    <article className="group overflow-hidden rounded-[22px] border border-black/[0.065] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.025)] transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_35px_rgba(24,24,27,0.06)]">
      <div className="flex">
        <div
          className={`w-[3px] shrink-0 ${priority.bar}`}
        />

        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] ${priority.badge}`}
                >
                  {item.priority}
                </span>

                {(item.reply_needed ||
                  item.reply_status ===
                    "yes") && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#efefff] px-2.5 py-1 text-[10px] font-medium text-[#5b5bd6]">
                    <MessageSquareReply
                      size={11}
                    />
                    Reply
                  </span>
                )}

                {item.meeting && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-600">
                    <CalendarDays
                      size={11}
                    />
                    Meeting
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-[17px] font-semibold leading-6 tracking-[-0.02em] text-zinc-950">
                {item.subject ||
                  "(No subject)"}
              </h3>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                <span className="font-medium text-zinc-600">
                  {item.sender ||
                    item.sender_email ||
                    "Unknown sender"}
                </span>

                {item.sender &&
                  item.sender_email && (
                    <>
                      <span>·</span>
                      <span>
                        {
                          item.sender_email
                        }
                      </span>
                    </>
                  )}

                {item.date && (
                  <>
                    <span>·</span>
                    <span>
                      {formatDate(
                        item.date
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${priority.icon}`}
              >
                <Star
                  size={16}
                />
              </div>
            </div>
          </div>

          {item.summary && (
            <p className="mt-5 max-w-4xl text-sm leading-6 text-zinc-600">
              {item.summary}
            </p>
          )}

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {item.action &&
              item.action.toLowerCase() !==
                "no action required" && (
                <InfoBox
                  icon={
                    <CheckSquare />
                  }
                  label="Your action"
                  value={item.action}
                />
              )}

            {item.deadline && (
              <InfoBox
                icon={<Clock3 />}
                label="Deadline"
                value={formatDate(
                  item.deadline
                )}
              />
            )}
          </div>

          {item.meeting && (
            <div className="mt-3 rounded-2xl bg-[#f8f8f7] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#5b5bd6] shadow-sm">
                  <CalendarDays
                    size={15}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    Meeting detected
                  </p>

                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {item.meeting
                      .title ||
                      item.subject}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    {item.meeting
                      .date && (
                      <span>
                        {
                          item
                            .meeting
                            .date
                        }
                      </span>
                    )}

                    {item.meeting
                      .time && (
                      <span>
                        {
                          item
                            .meeting
                            .time
                        }
                      </span>
                    )}

                    {item.meeting
                      .location && (
                      <span>
                        {
                          item
                            .meeting
                            .location
                        }
                      </span>
                    )}
                  </div>

                  {item.meeting
                    .action && (
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      {
                        item.meeting
                          .action
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {item.reason && (
            <div className="mt-5 border-t border-black/[0.055] pt-4">
              <p className="text-xs leading-5 text-zinc-400">
                <span className="font-medium text-zinc-500">
                  Why Thozhan
                  classified it:
                </span>{" "}
                {item.reason}
              </p>
            </div>
          )}
        </div>
      </div>
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
    <div className="rounded-2xl bg-[#f8f8f7] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm [&>svg]:h-[15px] [&>svg]:w-[15px]">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {label}
          </p>

          <p className="mt-1 text-sm leading-5 text-zinc-700">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  caption: string;
  icon: React.ReactNode;
  accent:
    | "high"
    | "purple"
    | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  const iconStyle =
    accent === "high"
      ? "bg-red-50 text-red-500"
      : accent === "purple"
        ? "bg-[#efefff] text-[#5b5bd6]"
        : "bg-zinc-100 text-zinc-500";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border bg-white p-5 text-left transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_30px_rgba(24,24,27,0.05)] ${
        active
          ? "border-[#5b5bd6]/30 ring-2 ring-[#5b5bd6]/5"
          : "border-black/[0.06]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">
            {label}
          </p>

          <p className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-zinc-950">
            {value}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-[16px] [&>svg]:w-[16px] ${iconStyle}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-1 text-[11px] text-zinc-400">
        {caption}
      </p>
    </button>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-zinc-950 text-white"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      {label}
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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
        active
          ? "bg-white text-zinc-950 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          : "text-zinc-500 hover:bg-white/60 hover:text-zinc-900"
      }`}
    >
      <span
        className={`[&>svg]:h-[17px] [&>svg]:w-[17px] ${
          active
            ? "text-[#5b5bd6]"
            : ""
        }`}
      >
        {icon}
      </span>

      {label}
    </button>
  );
}

function MobileHeader({
  onHome,
}: {
  onHome: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/[0.06] bg-[#f7f7f5]/90 px-5 backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={onHome}
        className="flex items-center gap-2.5"
      >
        <ThozhanLogo />

        <div className="text-left">
          <p className="text-sm font-semibold">
            Thozhan
          </p>

          <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            Priority
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={onHome}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.06] bg-white text-zinc-600"
        aria-label="Go to inbox"
      >
        <Mail size={16} />
      </button>
    </header>
  );
}

function getPriorityAppearance(
  priority: PriorityLevel
) {
  if (priority === "high") {
    return {
      bar: "bg-red-400",
      badge:
        "bg-red-50 text-red-600",
      icon:
        "bg-red-50 text-red-500",
    };
  }

  if (priority === "normal") {
    return {
      bar: "bg-[#7777dd]",
      badge:
        "bg-[#efefff] text-[#5b5bd6]",
      icon:
        "bg-[#efefff] text-[#5b5bd6]",
    };
  }

  return {
    bar: "bg-zinc-300",
    badge:
      "bg-zinc-100 text-zinc-500",
    icon:
      "bg-zinc-100 text-zinc-500",
  };
}

function formatDate(
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
