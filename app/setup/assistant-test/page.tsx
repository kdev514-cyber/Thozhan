"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";

type Status =
  | "idle"
  | "loading"
  | "success"
  | "error";

type AssistantResponse = {
  success: boolean;
  answer: string;
  tools_used: string[];
};

export default function AssistantTestPage() {
  const router = useRouter();

  const [message, setMessage] = useState(
    "What are my latest 3 emails? Give me a short summary."
  );

  const [status, setStatus] =
    useState<Status>("idle");

  const [response, setResponse] =
    useState<AssistantResponse | null>(null);

  const [error, setError] =
    useState("");

  async function sendMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      setError("Enter a message first.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setResponse(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "You are not logged in to Thozhan."
        );
      }

      const result = await fetch(
        "http://localhost:8000/api/assistant/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            message: cleanMessage,
          }),

          cache: "no-store",
        }
      );

      const data = await result.json();

      if (!result.ok) {
        throw new Error(
          data.detail ??
            `Backend returned HTTP ${result.status}`
        );
      }

      setResponse(data);
      setStatus("success");

    } catch (err) {
      console.error(
        "Assistant test failed:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Unknown assistant error."
        );
      }

      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      <div className="mx-auto max-w-4xl px-6 py-12">

        <button
          type="button"
          onClick={() =>
            router.push("/dashboard")
          }
          className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>

        <div className="mt-10">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Bot size={22} />
            </div>

            <div>
              <p className="text-sm font-medium text-blue-400">
                THOZHAN DEVELOPMENT
              </p>

              <h1 className="text-3xl font-semibold">
                AI Assistant Test
              </h1>
            </div>

          </div>

          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            Ask Thozhan a question. Groq can decide
            whether it needs to use your Gmail MCP
            tools before answering.
          </p>

        </div>

        <form
          onSubmit={sendMessage}
          className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
        >

          <label
            htmlFor="message"
            className="text-sm font-medium text-slate-300"
          >
            Message
          </label>

          <textarea
            id="message"
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            rows={5}
            disabled={status === "loading"}
            className="mt-3 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 disabled:opacity-60"
            placeholder="Ask Thozhan about your inbox..."
          />

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium transition hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500"
          >

            {status === "loading" ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Thozhan is thinking...
              </>
            ) : (
              <>
                <Send size={16} />
                Ask Thozhan
              </>
            )}

          </button>

        </form>

        {status === "success" && response && (

          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-6">

            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 size={18} />

              <h2 className="font-medium">
                Thozhan responded
              </h2>
            </div>

            <div className="mt-5 whitespace-pre-wrap leading-7 text-slate-200">
              {response.answer}
            </div>

            <div className="mt-6 border-t border-slate-800 pt-4">

              <p className="text-xs uppercase tracking-wider text-slate-500">
                MCP tools used
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {response.tools_used.length > 0
                  ? response.tools_used.join(", ")
                  : "No tools required"}
              </p>

            </div>

          </div>
        )}

        {status === "error" && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">

            <div className="flex items-center gap-2 text-red-400">
              <XCircle size={18} />

              <h2 className="font-medium">
                Assistant test failed
              </h2>
            </div>

            <p className="mt-3 text-sm text-slate-400">
              {error}
            </p>

          </div>
        )}

      </div>

    </main>
  );
}