"use client";

import {
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
  Mail,
  Inbox,
  Star,
  CheckSquare,
  CalendarDays,
  Settings,
  Sparkles,
  LogOut,
  BrainCircuit,
  MailCheck,
  CalendarCheck,
  ArrowRight,
  Loader2,
  User,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
} from "lucide-react";


type ConnectionStatus =
  | "loading"
  | "connected"
  | "not_connected"
  | "error";


type InboxStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "error";


type GmailEmail = {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  date: string;
  body: string;
};


type AssistantStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";


type AssistantResponse = {
  success: boolean;
  answer: string;
  tools_used: string[];
};


export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [groqStatus, setGroqStatus] =
    useState<ConnectionStatus>(
      "loading"
    );

  const [gmailStatus, setGmailStatus] =
    useState<ConnectionStatus>(
      "loading"
    );

  const [gmailAddress, setGmailAddress] =
    useState("");

  const [inboxStatus, setInboxStatus] =
    useState<InboxStatus>(
      "idle"
    );

  const [emails, setEmails] =
    useState<GmailEmail[]>([]);

  const [inboxError, setInboxError] =
    useState("");


  const [assistantMessage, setAssistantMessage] =
    useState("");


  const [assistantStatus, setAssistantStatus] =
    useState<AssistantStatus>(
      "idle"
    );


  const [assistantResponse, setAssistantResponse] =
    useState<AssistantResponse | null>(
      null
    );


  const [assistantError, setAssistantError] =
    useState("");


  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    async function loadDashboard() {
      const supabase =
        createClient();

      try {
        // -----------------------------------------
        // 1. Check logged-in user
        // -----------------------------------------

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


        const userName =
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there";


        setName(
          userName
        );


        // -----------------------------------------
        // 2. Get current Supabase session
        // -----------------------------------------

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
          setGroqStatus(
            "error"
          );

          setGmailStatus(
            "error"
          );

          setLoading(false);

          return;
        }


        const accessToken =
          session.access_token;


        // -----------------------------------------
        // 3. Check Groq status
        // -----------------------------------------

        try {
          const response =
            await fetch(
              "http://localhost:8000/api/groq/status",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              }
            );


          if (!response.ok) {
            throw new Error(
              `Backend returned HTTP ${response.status}`
            );
          }


          const data =
            await response.json();


          if (
            data.connected === true
          ) {
            setGroqStatus(
              "connected"
            );
          } else {
            setGroqStatus(
              "not_connected"
            );
          }

        } catch (error) {
          console.error(
            "Groq status check failed:",
            error
          );

          setGroqStatus(
            "error"
          );
        }


        // -----------------------------------------
        // 4. Check Gmail status
        // -----------------------------------------

        let gmailIsConnected =
          false;


        try {
          const response =
            await fetch(
              "http://localhost:8000/api/gmail/status",
              {
                method: "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              }
            );


          if (!response.ok) {
            throw new Error(
              `Backend returned HTTP ${response.status}`
            );
          }


          const data =
            await response.json();


          if (
            data.connected === true
          ) {
            gmailIsConnected =
              true;

            setGmailStatus(
              "connected"
            );

            setGmailAddress(
              data.email ?? ""
            );

          } else {
            setGmailStatus(
              "not_connected"
            );
          }

        } catch (error) {
          console.error(
            "Gmail status check failed:",
            error
          );

          setGmailStatus(
            "error"
          );
        }


        // -----------------------------------------
        // 5. Load inbox if Gmail connected
        // -----------------------------------------

        if (
          gmailIsConnected
        ) {
          await loadInbox(
            accessToken
          );
        }


        setLoading(false);

      } catch (error) {
        console.error(
          "Dashboard loading failed:",
          error
        );

        router.replace("/");
      }
    }


    loadDashboard();

  }, [router]);


  // =====================================================
  // LOAD INBOX
  // =====================================================

  async function loadInbox(
    accessToken?: string
  ) {
    try {
      setInboxStatus(
        "loading"
      );

      setInboxError("");


      let token =
        accessToken;


      if (!token) {
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


        token =
          session.access_token;
      }


      const response =
        await fetch(
          "http://localhost:8000/api/gmail/emails",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache: "no-store",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ??
            "Unable to load Gmail inbox."
        );
      }


      setEmails(
        Array.isArray(
          data.emails
        )
          ? data.emails
          : []
      );


      setInboxStatus(
        "loaded"
      );

    } catch (error) {
      console.error(
        "Inbox loading failed:",
        error
      );


      setInboxStatus(
        "error"
      );


      if (
        error instanceof Error
      ) {
        setInboxError(
          error.message
        );
      } else {
        setInboxError(
          "Unable to load Gmail inbox."
        );
      }
    }
  }


  // =====================================================
  // ASK THOZHAN
  // =====================================================

  async function askThozhan() {
    const message =
      assistantMessage.trim();


    if (!message) {
      return;
    }


    if (
      groqStatus !== "connected" ||
      gmailStatus !== "connected"
    ) {
      return;
    }


    try {
      setAssistantStatus(
        "loading"
      );

      setAssistantError("");

      setAssistantResponse(
        null
      );


      const supabase =
        createClient();


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
          "http://localhost:8000/api/assistant/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              message,
            }),

            cache: "no-store",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ??
            "Thozhan was unable to process your request."
        );
      }


      setAssistantResponse({
        success:
          data.success === true,

        answer:
          typeof data.answer ===
          "string"
            ? data.answer
            : "",

        tools_used:
          Array.isArray(
            data.tools_used
          )
            ? data.tools_used
            : [],
      });


      setAssistantStatus(
        "success"
      );


      setAssistantMessage("");

    } catch (error) {
      console.error(
        "Assistant request failed:",
        error
      );


      setAssistantStatus(
        "error"
      );


      if (
        error instanceof Error
      ) {
        setAssistantError(
          error.message
        );
      } else {
        setAssistantError(
          "Thozhan was unable to process your request."
        );
      }
    }
  }


  function handleAssistantKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        assistantStatus !==
          "loading"
      ) {
        void askThozhan();
      }
    }
  }


  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    const supabase =
      createClient();

    await supabase.auth.signOut();

    router.replace("/");
    router.refresh();
  }


  // =====================================================
  // FORMAT EMAIL DATE
  // =====================================================

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


  // =====================================================
  // CREATE EMAIL PREVIEW
  // =====================================================

  function createPreview(
    body: string
  ) {
    if (!body) {
      return "No text preview available.";
    }


    const cleaned =
      body
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    if (
      cleaned.length <= 220
    ) {
      return cleaned;
    }


    return (
      cleaned.slice(
        0,
        220
      ) + "..."
    );
  }


  // =====================================================
  // LOADING SCREEN
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        <div className="flex items-center gap-3 text-slate-400">

          <Loader2
            size={22}
            className="animate-spin text-blue-400"
          />

          Loading Thozhan...

        </div>

      </main>
    );
  }


  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-950 text-white flex">


      {/* =========================================
          SIDEBAR
      ========================================= */}

      <aside className="hidden md:flex w-64 border-r border-slate-800/80 bg-slate-950 flex-col p-5">


        <div className="flex items-center gap-3 mb-10">

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

        </div>


        <nav className="space-y-1 flex-1">

          <SidebarItem
            icon={
              <Inbox />
            }
            label="Inbox"
            active
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
          />

          <SidebarItem
            icon={
              <Settings />
            }
            label="Settings"
          />

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


      {/* =========================================
          MAIN
      ========================================= */}

      <section className="flex-1 min-w-0">


        {/* HEADER */}

        <header className="h-20 border-b border-slate-800/80 flex items-center justify-between px-6 lg:px-10">


          <div className="md:hidden flex items-center gap-2">

            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">

              <Mail
                size={18}
              />

            </div>

            <span className="font-semibold">
              Thozhan
            </span>

          </div>


          <div className="hidden md:flex items-center relative w-80">

            <Search
              size={17}
              className="absolute left-4 text-slate-500"
            />

            <input
              disabled
              placeholder="Search your inbox..."
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-slate-600"
            />

          </div>


          <div className="flex items-center gap-3">

            <button
              type="button"
              className="w-10 h-10 border border-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition"
            >

              <Bell
                size={18}
              />

            </button>


            <div className="w-9 h-9 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center">

              <User
                size={17}
              />

            </div>

          </div>

        </header>


        {/* DASHBOARD CONTENT */}

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">


          <div>

            <p className="text-blue-400 text-sm font-medium">
              AI EMAIL WORKSPACE
            </p>


            <h2 className="text-3xl lg:text-4xl font-semibold mt-2 tracking-tight">
              Welcome, {name}
            </h2>


            <p className="text-slate-400 mt-2">

              Thozhan can now securely connect
              your services and help manage
              your inbox.

            </p>

          </div>


          {/* =====================================
              CONNECTION CARDS
          ===================================== */}

          <div className="grid lg:grid-cols-3 gap-5 mt-9">


            {/* AI ENGINE */}

            <ConnectionCard
              icon={
                <BrainCircuit />
              }
              title="AI Engine"
              description={
                groqStatus ===
                "connected"
                  ? "Groq is connected and ready to power Thozhan."
                  : groqStatus ===
                    "error"
                  ? "Thozhan could not check your Groq connection."
                  : "Connect your personal Groq API key to power Thozhan."
              }
              buttonText={
                groqStatus ===
                "connected"
                  ? "Manage Groq"
                  : "Configure Groq"
              }
              number="01"
              status={
                groqStatus
              }
              onClick={() =>
                router.push(
                  "/setup/ai"
                )
              }
            />


            {/* GMAIL */}

            <ConnectionCard
              icon={
                <MailCheck />
              }
              title="Gmail"
              description={
                gmailStatus ===
                "connected"
                  ? gmailAddress
                    ? `Connected as ${gmailAddress}`
                    : "Gmail is connected and ready."
                  : gmailStatus ===
                    "error"
                  ? "Thozhan could not check your Gmail connection."
                  : "Connect Gmail so Thozhan can securely retrieve your emails."
              }
              buttonText={
                gmailStatus ===
                "connected"
                  ? "Manage Gmail"
                  : "Connect Gmail"
              }
              number="02"
              status={
                gmailStatus
              }
              onClick={() =>
                router.push(
                  "/setup/gmail"
                )
              }
            />


            {/* CALENDAR */}

            <ConnectionCard
              icon={
                <CalendarCheck />
              }
              title="Calendar"
              description="Connect Google Calendar to manage appointments and meetings."
              buttonText="Connect Calendar"
              number="03"
              status="not_connected"
            />

          </div>


          {/* =====================================
              INBOX
          ===================================== */}

          <div className="mt-10">


            <div className="flex items-center justify-between gap-4 mb-5">

              <div>

                <h3 className="text-xl font-semibold">
                  Your Inbox
                </h3>


                <p className="text-sm text-slate-500 mt-1">

                  {gmailStatus ===
                  "connected"
                    ? "Your latest Gmail messages."
                    : "Important emails and AI insights will appear here."}

                </p>

              </div>


              {gmailStatus ===
                "connected" && (

                <button
                  type="button"
                  onClick={() =>
                    loadInbox()
                  }
                  disabled={
                    inboxStatus ===
                    "loading"
                  }
                  className="flex items-center gap-2 border border-slate-800 hover:border-slate-700 bg-slate-900/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
                >

                  <RefreshCw
                    size={15}
                    className={
                      inboxStatus ===
                      "loading"
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh

                </button>
              )}

            </div>


            {/* GMAIL NOT CONNECTED */}

            {gmailStatus ===
              "not_connected" && (

              <div className="border border-slate-800 bg-slate-900/30 rounded-2xl min-h-72 flex items-center justify-center p-8">


                <div className="text-center max-w-md">

                  <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto">

                    <Inbox
                      size={24}
                      className="text-blue-400"
                    />

                  </div>


                  <h4 className="text-lg font-medium mt-5">
                    Connect Gmail to see your inbox
                  </h4>


                  <p className="text-slate-500 text-sm mt-2 leading-relaxed">

                    Once Gmail is connected,
                    Thozhan will securely retrieve
                    your emails and help you
                    understand what needs your
                    attention.

                  </p>


                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/setup/gmail"
                      )
                    }
                    className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl text-sm font-medium transition"
                  >

                    Connect Gmail

                    <ArrowRight
                      size={16}
                    />

                  </button>

                </div>

              </div>
            )}


            {/* GMAIL STATUS ERROR */}

            {gmailStatus ===
              "error" && (

              <div className="border border-red-500/20 bg-red-500/[0.04] rounded-2xl min-h-52 flex items-center justify-center p-8">

                <div className="text-center max-w-md">

                  <AlertCircle
                    size={30}
                    className="text-red-400 mx-auto"
                  />

                  <h4 className="text-lg font-medium mt-4">
                    Gmail connection unavailable
                  </h4>

                  <p className="text-sm text-slate-500 mt-2">
                    Make sure the Thozhan FastAPI
                    backend is running and try
                    refreshing the page.
                  </p>

                </div>

              </div>
            )}


            {/* INBOX LOADING */}

            {gmailStatus ===
              "connected" &&
              inboxStatus ===
                "loading" && (

              <div className="border border-slate-800 bg-slate-900/30 rounded-2xl min-h-72 flex items-center justify-center">

                <div className="flex items-center gap-3 text-slate-400">

                  <Loader2
                    size={20}
                    className="animate-spin text-blue-400"
                  />

                  Reading your Gmail inbox...

                </div>

              </div>
            )}


            {/* INBOX ERROR */}

            {gmailStatus ===
              "connected" &&
              inboxStatus ===
                "error" && (

              <div className="border border-red-500/20 bg-red-500/[0.04] rounded-2xl min-h-52 flex items-center justify-center p-8">

                <div className="text-center max-w-lg">

                  <AlertCircle
                    size={30}
                    className="text-red-400 mx-auto"
                  />

                  <h4 className="text-lg font-medium mt-4">
                    Unable to read your inbox
                  </h4>

                  <p className="text-sm text-slate-500 mt-2">
                    {inboxError}
                  </p>


                  <button
                    type="button"
                    onClick={() =>
                      loadInbox()
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


            {/* EMPTY INBOX */}

            {gmailStatus ===
              "connected" &&
              inboxStatus ===
                "loaded" &&
              emails.length ===
                0 && (

              <div className="border border-slate-800 bg-slate-900/30 rounded-2xl min-h-60 flex items-center justify-center p-8">

                <div className="text-center">

                  <Inbox
                    size={28}
                    className="text-slate-500 mx-auto"
                  />

                  <h4 className="font-medium mt-4">
                    No emails found
                  </h4>

                  <p className="text-sm text-slate-500 mt-2">
                    Thozhan did not find any
                    messages in your Gmail inbox.
                  </p>

                </div>

              </div>
            )}


            {/* EMAIL LIST */}

            {gmailStatus ===
              "connected" &&
              inboxStatus ===
                "loaded" &&
              emails.length >
                0 && (

              <div className="border border-slate-800 bg-slate-900/20 rounded-2xl overflow-hidden">

                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">

                  <div className="flex items-center gap-2">

                    <Inbox
                      size={17}
                      className="text-blue-400"
                    />

                    <span className="text-sm font-medium">
                      Latest emails
                    </span>

                  </div>


                  <span className="text-xs text-slate-500">
                    {emails.length} messages
                  </span>

                </div>


                <div className="divide-y divide-slate-800/80">

                  {emails.map(
                    (message) => (

                    <div
                      key={
                        message.id
                      }
                      className="p-5 hover:bg-slate-900/60 transition"
                    >

                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">


                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            <div className="w-8 h-8 shrink-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">

                              <Mail
                                size={14}
                              />

                            </div>


                            <div className="min-w-0">

                              <p className="text-sm font-medium truncate">

                                {message.sender_name ||
                                  message.sender_email ||
                                  "Unknown sender"}

                              </p>


                              {message.sender_name &&
                                message.sender_email && (

                                <p className="text-xs text-slate-600 truncate">
                                  {message.sender_email}
                                </p>
                              )}

                            </div>

                          </div>

                        </div>


                        <p className="text-xs text-slate-600 shrink-0 lg:pt-1">
                          {formatEmailDate(
                            message.date
                          )}
                        </p>

                      </div>


                      <h4 className="font-medium mt-4 text-slate-100">
                        {message.subject}
                      </h4>


                      <p className="text-sm text-slate-500 mt-2 leading-6">
                        {createPreview(
                          message.body
                        )}
                      </p>

                    </div>
                  ))}

                </div>

              </div>
            )}

          </div>


          {/* =====================================
              AI ASSISTANT
          ===================================== */}

          <div className="mt-6">


            {assistantStatus ===
              "success" &&
              assistantResponse && (

              <div className="mb-4 border border-blue-500/20 bg-blue-500/[0.04] rounded-2xl p-5">

                <div className="flex items-center gap-2 text-blue-400">

                  <Sparkles
                    size={17}
                  />

                  <h3 className="text-sm font-medium">
                    Thozhan
                  </h3>

                </div>


                <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {assistantResponse.answer}
                </div>


                {assistantResponse
                  .tools_used
                  .length > 0 && (

                  <div className="mt-5 pt-4 border-t border-slate-800">

                    <p className="text-xs text-slate-600">
                      MCP tools used:{" "}
                      {assistantResponse
                        .tools_used
                        .join(", ")}
                    </p>

                  </div>
                )}

              </div>
            )}


            {assistantStatus ===
              "error" && (

              <div className="mb-4 border border-red-500/20 bg-red-500/[0.04] rounded-2xl p-4">

                <div className="flex items-start gap-3">

                  <AlertCircle
                    size={18}
                    className="text-red-400 mt-0.5 shrink-0"
                  />

                  <div>

                    <p className="text-sm font-medium text-red-400">
                      Thozhan could not answer
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      {assistantError}
                    </p>

                  </div>

                </div>

              </div>
            )}


            <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-4">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 shrink-0 bg-blue-500/10 rounded-xl flex items-center justify-center">

                  {assistantStatus ===
                    "loading" ? (

                    <Loader2
                      size={19}
                      className="text-blue-400 animate-spin"
                    />

                  ) : (

                    <Sparkles
                      size={19}
                      className="text-blue-400"
                    />
                  )}

                </div>


                <input
                  value={
                    assistantMessage
                  }
                  onChange={(event) =>
                    setAssistantMessage(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleAssistantKeyDown
                  }
                  disabled={
                    groqStatus !==
                      "connected" ||
                    gmailStatus !==
                      "connected" ||
                    assistantStatus ===
                      "loading"
                  }
                  placeholder={
                    groqStatus !==
                    "connected"
                      ? "Connect your AI engine to start using Thozhan..."
                      : gmailStatus !==
                        "connected"
                      ? "Connect Gmail to start asking Thozhan about your inbox..."
                      : assistantStatus ===
                        "loading"
                      ? "Thozhan is thinking..."
                      : "Ask Thozhan about your inbox..."
                  }
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-slate-600 disabled:cursor-not-allowed"
                />


                <button
                  type="button"
                  onClick={() =>
                    void askThozhan()
                  }
                  disabled={
                    !assistantMessage.trim() ||
                    groqStatus !==
                      "connected" ||
                    gmailStatus !==
                      "connected" ||
                    assistantStatus ===
                      "loading"
                  }
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2 rounded-lg text-sm font-medium transition"
                >

                  {assistantStatus ===
                    "loading" ? (

                    <>
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                      Thinking
                    </>

                  ) : (

                    <>
                      <Send
                        size={15}
                      />
                      Ask
                    </>
                  )}

                </button>

              </div>


              {groqStatus ===
                "connected" &&
                gmailStatus ===
                  "connected" && (

                <p className="text-xs text-slate-600 mt-3 ml-[52px]">
                  Press Enter to send. Thozhan can use your Gmail MCP tools when needed.
                </p>
              )}

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}


/* =============================================
   SIDEBAR ITEM
============================================= */

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


/* =============================================
   CONNECTION CARD
============================================= */

function ConnectionCard({
  icon,
  title,
  description,
  buttonText,
  number,
  status,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  number: string;

  status:
    | "loading"
    | "connected"
    | "not_connected"
    | "error";

  onClick?: () => void;
}) {


  const isConnected =
    status === "connected";


  return (
    <div
      className={`border rounded-2xl p-6 transition ${
        isConnected
          ? "border-green-500/20 bg-green-500/[0.03]"
          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
      }`}
    >


      <div className="flex items-start justify-between">


        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center [&>svg]:w-5 ${
            isConnected
              ? "bg-green-500/10 text-green-400"
              : "bg-blue-500/10 text-blue-400"
          }`}
        >
          {icon}
        </div>


        <span className="text-xs text-slate-600">
          {number}
        </span>

      </div>


      <div className="flex items-center gap-2 mt-5">


        <h3 className="font-semibold">
          {title}
        </h3>


        {status ===
          "loading" && (

          <span className="flex items-center gap-1 text-[11px] bg-slate-800 text-slate-400 px-2 py-1 rounded-full">

            <Loader2
              size={11}
              className="animate-spin"
            />

            Checking

          </span>
        )}


        {status ===
          "connected" && (

          <span className="flex items-center gap-1 text-[11px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full">

            <CheckCircle2
              size={11}
            />

            Connected

          </span>
        )}


        {status ===
          "not_connected" && (

          <span className="text-[11px] bg-slate-800 text-slate-500 px-2 py-1 rounded-full">

            Not connected

          </span>
        )}


        {status ===
          "error" && (

          <span className="flex items-center gap-1 text-[11px] bg-red-500/10 text-red-400 px-2 py-1 rounded-full">

            <AlertCircle
              size={11}
            />

            Error

          </span>
        )}

      </div>


      <p className="text-sm text-slate-500 mt-2 leading-relaxed min-h-10">
        {description}
      </p>


      <button
        type="button"
        onClick={
          onClick
        }
        className={`mt-6 w-full border rounded-xl py-2.5 text-sm transition ${
          isConnected
            ? "border-green-500/20 text-green-400 hover:bg-green-500/10"
            : "border-slate-700 hover:border-blue-500 hover:text-blue-400"
        }`}
      >

        {buttonText}

      </button>

    </div>
  );
}

