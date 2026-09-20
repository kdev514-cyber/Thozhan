"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ConnectionState =
  | "checking"
  | "not_connected"
  | "connecting"
  | "connected"
  | "error";

export default function GmailSetupPage() {
  const router = useRouter();

  const [gmailAddress, setGmailAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [status, setStatus] =
    useState<ConnectionState>("checking");

  const [message, setMessage] = useState("");

  const [connectedEmail, setConnectedEmail] =
    useState<string | null>(null);

  // =====================================================
  // CHECK EXISTING GMAIL CONNECTION
  // =====================================================

  useEffect(() => {
    async function checkConnection() {
      try {
        const supabase = createClient();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/");
          return;
        }

        const response = await fetch("/api/gmail/status", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(
            data.detail ??
              "Unable to check Gmail connection."
          );
          return;
        }

        if (data.connected) {
          setStatus("connected");
          setConnectedEmail(data.email ?? null);
          setMessage("Gmail is connected to Thozhan.");
        } else {
          setStatus("not_connected");
        }
      } catch (error) {
        console.error("Gmail status error:", error);

        setStatus("error");
        setMessage(
          "Unable to communicate with the Thozhan backend."
        );
      }
    }

    void checkConnection();
  }, [router]);

  // =====================================================
  // CONNECT GMAIL
  // =====================================================

  async function handleConnect(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    const email = gmailAddress.trim();

    // Google displays App Passwords with spaces.
    // Remove spaces before sending it to the backend.
    const password = appPassword.replace(/\s/g, "");

    if (!email) {
      setStatus("error");
      setMessage("Enter your Gmail address.");
      return;
    }

    if (!password) {
      setStatus("error");
      setMessage("Enter your Gmail App Password.");
      return;
    }

    try {
      setStatus("connecting");

      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      const response = await fetch("/api/gmail/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          app_password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(
          data.detail ??
            "Unable to connect Gmail. Check your Gmail address and App Password."
        );
        return;
      }

      // Remove password from browser state after connection.
      setAppPassword("");

      setConnectedEmail(data.email ?? email);
      setStatus("connected");
      setMessage("Gmail connected successfully.");
    } catch (error) {
      console.error("Gmail connection error:", error);

      setStatus("error");
      setMessage(
        "Unable to communicate with the Thozhan backend."
      );
    }
  }

  // =====================================================
  // CONNECT DIFFERENT ACCOUNT
  // =====================================================

  function connectDifferentAccount() {
    setStatus("not_connected");
    setMessage("");
    setGmailAddress(connectedEmail ?? "");
    setAppPassword("");
    setShowPassword(false);
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Mail size={19} />
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

      <section className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <p className="text-sm font-semibold text-blue-600">
          STEP 2 OF 3 · EMAIL
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Connect your Gmail
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Give Thozhan secure read-only access to your inbox so
          it can summarize emails, identify priorities, extract
          tasks and detect meeting requests.
        </p>

        {/* MAIN CARD */}

        <div className="mt-9 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* CHECKING */}

          {status === "checking" && (
            <div className="flex min-h-56 items-center justify-center">
              <div className="text-center">
                <Loader2
                  size={26}
                  className="mx-auto animate-spin text-blue-600"
                />

                <p className="mt-4 text-sm text-slate-600">
                  Checking Gmail connection...
                </p>
              </div>
            </div>
          )}

          {/* CONNECTED */}

          {status === "connected" && (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <CheckCircle2 size={23} />
              </div>

              <h2 className="mt-5 text-2xl font-semibold">
                Gmail connected
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Thozhan can securely access your inbox.
              </p>

              {connectedEmail && (
                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Connected account
                  </p>

                  <p className="mt-1 font-medium text-slate-900">
                    {connectedEmail}
                  </p>
                </div>
              )}

              <div className="mt-7 space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push("/dashboard")
                  }
                  className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-medium text-white transition hover:bg-blue-500"
                >
                  Continue to Dashboard
                </button>

                <button
                  type="button"
                  onClick={connectDifferentAccount}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Connect a different Gmail account
                </button>
              </div>

              <div className="mt-7 flex gap-3 border-t border-slate-200 pt-6">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-green-600"
                />

                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Connection secured
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your Gmail credential is stored encrypted by
                    the Thozhan backend.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CONNECTION FORM */}

          {status !== "checking" &&
            status !== "connected" && (
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Mail size={22} />
                </div>

                <h2 className="mt-5 text-2xl font-semibold">
                  Gmail connection
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Thozhan uses a Google App Password for the
                  current Gmail integration. Do not enter your
                  normal Google account password.
                </p>

                {/* APP PASSWORD GUIDE */}

                <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <div className="flex items-start gap-3">
                    <LockKeyhole
                      size={20}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        Create a Google App Password
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        You need an App Password instead of your
                        normal Google password.
                      </p>

                      <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                        <li>
                          <span className="font-semibold text-slate-900">
                            1.
                          </span>{" "}
                          Enable 2-Step Verification on your
                          Google account.
                        </li>

                        <li>
                          <span className="font-semibold text-slate-900">
                            2.
                          </span>{" "}
                          Open Google App Passwords.
                        </li>

                        <li>
                          <span className="font-semibold text-slate-900">
                            3.
                          </span>{" "}
                          Create an App Password named{" "}
                          <span className="font-semibold text-slate-900">
                            Thozhan
                          </span>
                          .
                        </li>

                        <li>
                          <span className="font-semibold text-slate-900">
                            4.
                          </span>{" "}
                          Copy the generated 16-character
                          password.
                        </li>

                        <li>
                          <span className="font-semibold text-slate-900">
                            5.
                          </span>{" "}
                          Paste that password into Thozhan below.
                        </li>
                      </ol>

                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Get Google App Password
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>

                {/* FORM */}

                <form
                  onSubmit={handleConnect}
                  className="mt-8 space-y-5"
                >
                  {/* EMAIL */}

                  <div>
                    <label
                      htmlFor="gmailAddress"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Gmail address
                    </label>

                    <input
                      id="gmailAddress"
                      type="email"
                      autoComplete="email"
                      value={gmailAddress}
                      onChange={(event) => {
                        setGmailAddress(
                          event.target.value
                        );

                        if (status === "error") {
                          setStatus("not_connected");
                          setMessage("");
                        }
                      }}
                      placeholder="you@gmail.com"
                      disabled={
                        status === "connecting"
                      }
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>

                  {/* APP PASSWORD */}

                  <div>
                    <label
                      htmlFor="appPassword"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Gmail App Password
                    </label>

                    <div className="relative">
                      <input
                        id="appPassword"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        autoComplete="off"
                        value={appPassword}
                        onChange={(event) => {
                          setAppPassword(
                            event.target.value
                          );

                          if (status === "error") {
                            setStatus(
                              "not_connected"
                            );
                            setMessage("");
                          }
                        }}
                        placeholder="16-character App Password"
                        disabled={
                          status === "connecting"
                        }
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-12 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current
                          )
                        }
                        aria-label={
                          showPassword
                            ? "Hide App Password"
                            : "Show App Password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Google may display the password with
                      spaces. Thozhan removes those spaces
                      automatically.
                    </p>
                  </div>

                  {/* ERROR */}

                  {status === "error" &&
                    message && (
                      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                        <XCircle
                          size={18}
                          className="mt-0.5 shrink-0 text-red-600"
                        />

                        <div>
                          <p className="text-sm font-medium text-red-700">
                            Connection failed
                          </p>

                          <p className="mt-1 text-sm leading-6 text-red-600">
                            {message}
                          </p>
                        </div>
                      </div>
                    )}

                  {/* CONNECT BUTTON */}

                  <button
                    type="submit"
                    disabled={
                      status === "connecting"
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "connecting" ? (
                      <>
                        <Loader2
                          size={18}
                          className="animate-spin"
                        />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        Connect Gmail
                      </>
                    )}
                  </button>
                </form>

                {/* SECURITY */}

                <div className="mt-8 flex gap-3 border-t border-slate-200 pt-6">
                  <ShieldCheck
                    size={19}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Encrypted credential storage
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Your App Password is sent to the
                      Thozhan backend, verified against
                      Gmail and stored encrypted. The
                      password is not displayed back to
                      the browser after connection.
                    </p>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* FOOTER NOTE */}

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          Thozhan&apos;s current Gmail integration uses
          read-only inbox access. It does not delete or modify
          your emails.
        </p>
      </section>
    </main>
  );
}
