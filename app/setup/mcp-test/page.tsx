"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";

type TestStatus =
  | "idle"
  | "testing"
  | "success"
  | "error";

export default function MCPTestPage() {
  const router = useRouter();

  const [status, setStatus] =
    useState<TestStatus>("idle");

  const [result, setResult] =
    useState<unknown>(null);

  const [error, setError] =
    useState("");

  async function testMCP() {
    setStatus("testing");
    setError("");
    setResult(null);

    try {
      // Get the existing logged-in Supabase session
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

      // Call the FastAPI MCP test endpoint
      const response = await fetch(
        "http://localhost:8000/api/mcp/gmail/test",
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },

          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ??
            `Backend returned HTTP ${response.status}`
        );
      }

      setResult(data);
      setStatus("success");

    } catch (err) {
      console.error(
        "MCP test failed:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Unknown MCP test error."
        );
      }

      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Back button */}

        <button
          type="button"
          onClick={() =>
            router.push("/dashboard")
          }
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>


        {/* Heading */}

        <div className="mt-10">

          <p className="text-sm font-medium text-blue-400">
            THOZHAN DEVELOPMENT
          </p>

          <h1 className="text-3xl font-semibold mt-2">
            Gmail MCP Test
          </h1>

          <p className="text-slate-400 mt-3 max-w-2xl leading-7">
            Test whether Thozhan can securely
            access Gmail through the new MCP
            tool system.
          </p>

        </div>


        {/* Test card */}

        <div className="mt-10 border border-slate-800 bg-slate-900/40 rounded-2xl p-6">

          <div className="flex items-start justify-between gap-6">

            <div>

              <h2 className="font-semibold">
                Gmail MCP Connection
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                This will request your latest
                three Gmail messages through
                MCP.
              </p>

            </div>


            {status === "success" && (
              <CheckCircle2
                size={24}
                className="text-green-400"
              />
            )}


            {status === "error" && (
              <XCircle
                size={24}
                className="text-red-400"
              />
            )}

          </div>


          <button
            type="button"
            onClick={testMCP}
            disabled={status === "testing"}
            className="mt-6 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 px-5 py-3 rounded-xl text-sm font-medium transition"
          >

            {status === "testing" ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                />

                Testing MCP...
              </>
            ) : (
              <>
                <Play size={16} />
                Test Gmail MCP
              </>
            )}

          </button>

        </div>


        {/* Success result */}

        {status === "success" && (

          <div className="mt-6 border border-green-500/20 bg-green-500/[0.04] rounded-2xl p-6">

            <div className="flex items-center gap-2 text-green-400">

              <CheckCircle2 size={18} />

              <h2 className="font-medium">
                MCP test successful
              </h2>

            </div>


            <p className="text-sm text-slate-400 mt-3">
              Gmail data successfully travelled
              through the Thozhan MCP pipeline.
            </p>


            <pre className="mt-5 bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-xs text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(
                result,
                null,
                2
              )}
            </pre>

          </div>
        )}


        {/* Error result */}

        {status === "error" && (

          <div className="mt-6 border border-red-500/20 bg-red-500/[0.04] rounded-2xl p-6">

            <div className="flex items-center gap-2 text-red-400">

              <XCircle size={18} />

              <h2 className="font-medium">
                MCP test failed
              </h2>

            </div>


            <p className="text-sm text-slate-400 mt-3">
              {error}
            </p>

          </div>
        )}

      </div>

    </main>
  );
}