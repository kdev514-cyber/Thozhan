"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";


type ConnectionStatus =
  | "idle"
  | "checking"
  | "success"
  | "error";


export default function AISetupPage() {
  const router = useRouter();

  const [pageLoading, setPageLoading] =
    useState(true);

  const [apiKey, setApiKey] =
    useState("");

  const [showKey, setShowKey] =
    useState(false);

  const [status, setStatus] =
    useState<ConnectionStatus>(
      "idle"
    );

  const [message, setMessage] =
    useState("");


  useEffect(() => {
    async function checkAuthentication() {
      const supabase =
        createClient();

      const {
        data: {
          user,
        },
        error,
      } =
        await supabase.auth.getUser();


      if (
        error ||
        !user
      ) {
        router.replace("/");
        return;
      }


      setPageLoading(false);
    }


    checkAuthentication();

  }, [router]);


  async function handleConnect(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedKey =
      apiKey.trim();


    if (!trimmedKey) {
      setStatus("error");

      setMessage(
        "Please enter your Groq API key."
      );

      return;
    }


    setStatus("checking");
    setMessage("");


    try {
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
        setStatus("error");

        setMessage(
          "Your login session has expired. Please sign in again."
        );

        return;
      }


      const response =
        await fetch(
          "/api/groq/connect",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body: JSON.stringify({
              api_key: trimmedKey,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        setStatus("error");

        setMessage(
          data.detail ||
            "Unable to connect Groq."
        );

        return;
      }


      setStatus("success");

      setMessage(
        "Groq is connected and securely saved for your Thozhan account."
      );


      // Remove key from React state
      // after successful storage.

      setApiKey("");


    } catch (error) {
      console.error(
        "Groq connection error:",
        error
      );


      setStatus("error");

      setMessage(
        "Could not reach the Thozhan backend. Make sure FastAPI is running."
      );
    }
  }


  if (pageLoading) {
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


  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* BACKGROUND */}

      <div className="fixed inset-0 pointer-events-none overflow-hidden">

        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/10 blur-[150px]" />

      </div>


      {/* HEADER */}

      <header className="relative z-10 border-b border-slate-800">

        <div className="max-w-5xl mx-auto h-20 px-6 flex items-center justify-between">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
          >

            <ArrowLeft
              size={18}
            />

            Dashboard

          </button>


          <div className="flex items-center gap-3">

            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">

              <BrainCircuit
                size={20}
              />

            </div>


            <div>

              <p className="font-semibold">
                Thozhan
              </p>

              <p className="text-xs text-slate-500">
                AI Companion
              </p>

            </div>

          </div>

        </div>

      </header>


      {/* CONTENT */}

      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">

        <p className="text-blue-400 text-sm font-medium">
          STEP 1 OF 3 · AI ENGINE
        </p>


        <h1 className="text-4xl font-semibold tracking-tight mt-3">
          Connect your AI engine
        </h1>


        <p className="text-slate-400 text-lg leading-relaxed mt-4">

          Connect your personal Groq API
          key to give Thozhan its AI
          capabilities.

        </p>


        {/* GROQ CARD */}

        <div className="mt-10 border border-slate-800 bg-slate-900/50 rounded-2xl p-7">


          <div className="flex items-center gap-4">

            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">

              <KeyRound
                size={22}
                className="text-blue-400"
              />

            </div>


            <div>

              <h2 className="text-xl font-semibold">
                Groq API Key
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Connect your personal Groq account.
              </p>

            </div>

          </div>


          <form
            onSubmit={
              handleConnect
            }
            className="mt-8"
          >

            <label
              htmlFor="groq-api-key"
              className="text-sm text-slate-300"
            >
              API Key
            </label>


            <div className="relative mt-2">

              <KeyRound
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />


              <input
                id="groq-api-key"
                type={
                  showKey
                    ? "text"
                    : "password"
                }
                value={apiKey}
                onChange={(
                  event
                ) => {
                  setApiKey(
                    event.target.value
                  );

                  if (
                    status !==
                    "checking"
                  ) {
                    setStatus(
                      "idle"
                    );

                    setMessage("");
                  }
                }}
                placeholder="gsk_..."
                autoComplete="off"
                spellCheck={
                  false
                }
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 pl-12 pr-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm transition"
              />


              <button
                type="button"
                onClick={() =>
                  setShowKey(
                    (current) =>
                      !current
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
              >

                {showKey ? (
                  <EyeOff
                    size={18}
                  />
                ) : (
                  <Eye
                    size={18}
                  />
                )}

              </button>

            </div>


            {/* SUCCESS */}

            {status ===
              "success" && (
              <div className="mt-5 border border-green-500/20 bg-green-500/10 rounded-xl p-4 flex items-start gap-3">

                <CheckCircle2
                  size={19}
                  className="text-green-400 shrink-0 mt-0.5"
                />


                <div>

                  <p className="text-sm font-medium text-green-300">
                    AI Engine connected
                  </p>

                  <p className="text-sm text-green-400/80 mt-1">
                    {message}
                  </p>

                </div>

              </div>
            )}


            {/* ERROR */}

            {status ===
              "error" && (
              <div className="mt-5 border border-red-500/20 bg-red-500/10 rounded-xl p-4 flex items-start gap-3">

                <XCircle
                  size={19}
                  className="text-red-400 shrink-0 mt-0.5"
                />


                <div>

                  <p className="text-sm font-medium text-red-300">
                    Connection failed
                  </p>

                  <p className="text-sm text-red-400/80 mt-1">
                    {message}
                  </p>

                </div>

              </div>
            )}


            <button
              type="submit"
              disabled={
                status ===
                "checking"
              }
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 transition"
            >

              {status ===
              "checking" ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                  Validating and saving...
                </>
              ) : (
                <>
                  <ShieldCheck
                    size={18}
                  />

                  Connect Groq
                </>
              )}

            </button>

          </form>

        </div>


        {/* SECURITY */}

        <div className="mt-6 border border-slate-800 rounded-xl p-5 flex gap-4">

          <ShieldCheck
            size={20}
            className="text-blue-400 shrink-0"
          />


          <div>

            <p className="text-sm font-medium">
              Encrypted storage
            </p>

            <p className="text-sm text-slate-500 leading-relaxed mt-1">

              Thozhan validates your key
              through the backend and encrypts
              it before storing it. The stored
              key is never displayed back to
              the browser.

            </p>

          </div>

        </div>


        {status ===
          "success" && (
          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="mt-6 w-full border border-slate-700 hover:border-blue-500 hover:text-blue-400 rounded-xl py-3.5 font-medium transition"
          >
            Continue to Dashboard
          </button>
        )}

      </section>

    </main>
  );
}