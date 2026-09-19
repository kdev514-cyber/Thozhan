"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        console.error("Supabase login error:", error);

        setErrorMessage(error.message);
        setLoading(false);

        return;
      }

      if (!data.session) {
        setErrorMessage(
          "Login succeeded but Supabase did not create a session."
        );

        setLoading(false);

        return;
      }

      console.log("Login successful:", data.user?.email);

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Unexpected login error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while signing in."
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex">

      {/* LEFT SIDE */}

      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-16 flex-col justify-between border-r border-slate-900">

        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-slate-950 to-cyan-500/10" />

        {/* Logo */}

        <div className="relative z-10 flex items-center gap-3">

          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <Mail size={22} />
          </div>

          <div>
            <h1 className="font-semibold text-xl">
              Thozhan
            </h1>

            <p className="text-xs text-slate-500">
              AI Companion
            </p>
          </div>

        </div>


        {/* Hero */}

        <div className="relative z-10 max-w-xl">

          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-400/20 px-4 py-2 rounded-full text-blue-300 text-sm mb-8">

            <Sparkles size={15} />

            Your intelligent personal companion

          </div>


          <h2 className="text-5xl xl:text-6xl font-semibold leading-tight tracking-tight">

            Your inbox,

            <span className="block text-blue-400">
              intelligently managed.
            </span>

          </h2>


          <p className="text-slate-400 text-lg mt-7 leading-relaxed max-w-lg">

            Read less. Know more. Thozhan summarises your emails,
            identifies what needs your attention and helps organise
            your meetings.

          </p>


          <div className="flex gap-8 mt-10 text-sm">

            <div>

              <p className="text-white font-medium">
                Smart summaries
              </p>

              <p className="text-slate-500 mt-1">
                Understand emails faster
              </p>

            </div>


            <div>

              <p className="text-white font-medium">
                Smart scheduling
              </p>

              <p className="text-slate-500 mt-1">
                Organise meetings effortlessly
              </p>

            </div>

          </div>

        </div>


        <p className="relative z-10 text-slate-600 text-sm">
          தோழன் · Your AI companion
        </p>

      </section>


      {/* RIGHT SIDE */}

      <section className="w-full lg:w-1/2 flex items-center justify-center p-6">

        <div className="w-full max-w-md">

          {/* Mobile Logo */}

          <div className="lg:hidden flex items-center gap-3 mb-12">

            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Mail size={20} />
            </div>

            <span className="font-semibold text-xl">
              Thozhan
            </span>

          </div>


          <p className="text-blue-400 text-sm font-medium mb-3">
            WELCOME BACK
          </p>


          <h2 className="text-3xl font-semibold tracking-tight">
            Sign in to Thozhan
          </h2>


          <p className="text-slate-400 mt-2 mb-9">
            Your inbox and AI assistant are waiting.
          </p>


          {/* LOGIN FORM */}

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            {/* EMAIL */}

            <div>

              <label
                htmlFor="email"
                className="text-sm text-slate-300"
              >
                Email address
              </label>


              <div className="relative mt-2">

                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />


                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div>

              <div className="flex justify-between">

                <label
                  htmlFor="password"
                  className="text-sm text-slate-300"
                >
                  Password
                </label>


                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Forgot password?
                </button>

              </div>


              <div className="relative mt-2">

                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />


                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3.5 pl-12 pr-12 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />


                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >

                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}

                </button>

              </div>

            </div>


            {/* ERROR MESSAGE */}

            {errorMessage && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">

                <p className="text-sm text-red-400">
                  {errorMessage}
                </p>

              </div>
            )}


            {/* SIGN IN */}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 transition"
            >

              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                  Signing in...
                </>
              ) : (
                <>
                  Sign in

                  <ArrowRight size={18} />
                </>
              )}

            </button>

          </form>


          {/* DIVIDER */}

          <div className="flex items-center gap-4 my-8">

            <div className="h-px bg-slate-800 flex-1" />

            <span className="text-xs text-slate-600">
              OR
            </span>

            <div className="h-px bg-slate-800 flex-1" />

          </div>


          {/* GOOGLE */}

          <button
            type="button"
            className="w-full border border-slate-800 bg-slate-900/50 hover:bg-slate-900 rounded-xl py-3.5 font-medium transition"
          >
            Continue with Google
          </button>


          {/* SIGN UP */}

          <p className="text-center text-slate-400 text-sm mt-8">

            New to Thozhan?{" "}

            <button
              type="button"
              onClick={() =>
                router.push("/signup")
              }
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Create an account
            </button>

          </p>

        </div>

      </section>

    </main>
  );
}