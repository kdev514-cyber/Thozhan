"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ConnectionState =
  | "checking"
  | "not_connected"
  | "connecting"
  | "connected"
  | "error";

export default function GmailSetupPage() {
  const router = useRouter();

  const [gmailAddress, setGmailAddress] =
    useState("");

  const [appPassword, setAppPassword] =
    useState("");

  const [status, setStatus] =
    useState<ConnectionState>("checking");

  const [message, setMessage] =
    useState("");

  const [connectedEmail, setConnectedEmail] =
    useState<string | null>(null);


  // =====================================================
  // CHECK EXISTING GMAIL CONNECTION
  // =====================================================

  useEffect(() => {
    const checkConnection = async () => {
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
          "/api/gmail/status",
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          setStatus("error");
          setMessage(
            "Unable to check Gmail connection."
          );
          return;
        }

        const data = await response.json();

        if (data.connected) {
          setStatus("connected");

          setConnectedEmail(
            data.email ?? null
          );

          setMessage(
            "Gmail is connected to Thozhan."
          );
        } else {
          setStatus("not_connected");
        }
      } catch (error) {
        console.error(
          "Gmail status error:",
          error
        );

        setStatus("error");

        setMessage(
          "Unable to communicate with the Thozhan backend."
        );
      }
    };

    checkConnection();
  }, [router]);


  // =====================================================
  // CONNECT GMAIL
  // =====================================================

  const handleConnect = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setMessage("");

    if (!gmailAddress.trim()) {
      setStatus("error");
      setMessage(
        "Enter your Gmail address."
      );
      return;
    }

    if (!appPassword.trim()) {
      setStatus("error");
      setMessage(
        "Enter your Gmail App Password."
      );
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

      const response = await fetch(
        "/api/gmail/connect",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            email:
              gmailAddress.trim(),

            app_password:
              appPassword.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");

        setMessage(
          data.detail ??
            "Unable to connect Gmail."
        );

        return;
      }

      // Remove password from React state
      // immediately after successful connection.

      setAppPassword("");

      setConnectedEmail(
        data.email ??
          gmailAddress.trim()
      );

      setStatus("connected");

      setMessage(
        "Gmail connected successfully."
      );
    } catch (error) {
      console.error(
        "Gmail connection error:",
        error
      );

      setStatus("error");

      setMessage(
        "Unable to communicate with the Thozhan backend."
      );
    }
  };


  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">

        <div className="w-full max-w-xl">

          {/* BRAND */}

          <div className="mb-8 text-center">
            <button
              onClick={() =>
                router.push("/dashboard")
              }
              className="mb-6 text-sm text-slate-400 transition hover:text-white"
            >
              ← Back to dashboard
            </button>

            <h1 className="text-4xl font-semibold tracking-tight">
              Thozhan
            </h1>

            <p className="mt-2 text-sm text-blue-400">
              Your AI companion
            </p>
          </div>


          {/* CARD */}

          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-blue-950/20">

            <div className="mb-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M4 6h16v12H4z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path
                    d="m4 7 8 6 8-6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold">
                Connect Gmail
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Connect your Gmail inbox so Thozhan
                can securely read your emails and
                later help you summarize, prioritize,
                and respond to them.
              </p>
            </div>


            {/* CHECKING */}

            {status === "checking" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
                Checking Gmail connection...
              </div>
            )}


            {/* CONNECTED */}

            {status === "connected" && (
              <div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">

                  <div className="flex items-start gap-3">

                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      ✓
                    </div>

                    <div>
                      <p className="font-medium text-emerald-300">
                        Gmail connected
                      </p>

                      {connectedEmail && (
                        <p className="mt-1 text-sm text-slate-300">
                          {connectedEmail}
                        </p>
                      )}

                      <p className="mt-2 text-sm text-slate-400">
                        Thozhan can now access your
                        inbox through the backend.
                      </p>
                    </div>

                  </div>
                </div>


                <button
                  onClick={() =>
                    router.push("/dashboard")
                  }
                  className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-500"
                >
                  Return to dashboard
                </button>


                <button
                  onClick={() => {
                    setStatus(
                      "not_connected"
                    );

                    setMessage("");

                    setGmailAddress(
                      connectedEmail ?? ""
                    );
                  }}
                  className="mt-3 w-full rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900"
                >
                  Connect a different Gmail account
                </button>
              </div>
            )}


            {/* FORM */}

            {status !== "checking" &&
              status !== "connected" && (

              <form
                onSubmit={handleConnect}
                className="space-y-5"
              >

                {/* GMAIL */}

                <div>
                  <label
                    htmlFor="gmailAddress"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Gmail address
                  </label>

                  <input
                    id="gmailAddress"
                    type="email"
                    autoComplete="email"
                    value={gmailAddress}
                    onChange={(event) =>
                      setGmailAddress(
                        event.target.value
                      )
                    }
                    placeholder="you@gmail.com"
                    disabled={
                      status ===
                      "connecting"
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>


                {/* APP PASSWORD */}

                <div>
                  <label
                    htmlFor="appPassword"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Gmail App Password
                  </label>

                  <input
                    id="appPassword"
                    type="password"
                    autoComplete="off"
                    value={appPassword}
                    onChange={(event) =>
                      setAppPassword(
                        event.target.value
                      )
                    }
                    placeholder="Enter your Google App Password"
                    disabled={
                      status ===
                      "connecting"
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Use the App Password you created
                    for Thozhan, not your normal
                    Google password.
                  </p>
                </div>


                {/* ERROR */}

                {status === "error" &&
                  message && (

                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {message}
                  </div>
                )}


                {/* CONNECT BUTTON */}

                <button
                  type="submit"
                  disabled={
                    status ===
                    "connecting"
                  }
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status ===
                  "connecting"
                    ? "Connecting..."
                    : "Connect Gmail"}
                </button>

              </form>
            )}


            {/* SECURITY */}

            <div className="mt-8 border-t border-slate-800 pt-6">

              <div className="flex gap-3">

                <div className="mt-0.5 text-blue-400">
                  🔒
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Encrypted credential storage
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your App Password is sent to
                    the Thozhan backend, verified
                    against Gmail, encrypted with
                    your server-side encryption key,
                    and then stored as ciphertext.
                  </p>
                </div>

              </div>

            </div>

          </div>


          {/* MVP NOTE */}

          <p className="mt-6 text-center text-xs leading-5 text-slate-600">
            Thozhan&apos;s current Gmail MVP uses
            read-only inbox access. Sending,
            deleting, and modifying email will be
            added separately.
          </p>

        </div>
      </div>
    </main>
  );
}