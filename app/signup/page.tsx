"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">

          <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle
              className="text-green-400"
              size={30}
            />
          </div>

          <h1 className="text-3xl font-semibold mt-6">
            Check your email
          </h1>

          <p className="text-slate-400 mt-3 leading-relaxed">
            We sent a confirmation link to
          </p>

          <p className="text-white mt-1 font-medium">
            {email}
          </p>

          <p className="text-slate-500 text-sm mt-4">
            Confirm your email address before signing in to Thozhan.
          </p>

          <button
            onClick={() => router.push("/")}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-3.5 font-medium"
          >
            Back to sign in
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-10"
        >
          <ArrowLeft size={17} />
          Back to sign in
        </button>


        <div className="flex items-center gap-3 mb-10">

          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
            <Mail size={21} />
          </div>

          <div>
            <h1 className="font-semibold text-xl">
              Thozhan
            </h1>

            <p className="text-xs text-slate-500">
              Your AI companion
            </p>
          </div>

        </div>


        <p className="text-blue-400 text-sm font-medium">
          GET STARTED
        </p>

        <h2 className="text-3xl font-semibold mt-3">
          Create your account
        </h2>

        <p className="text-slate-400 mt-2 mb-8">
          Your intelligent inbox starts here.
        </p>


        <form
          onSubmit={handleSignup}
          className="space-y-4"
        >

          <Input
            icon={<User size={18} />}
            type="text"
            placeholder="Your name"
            value={name}
            setValue={setName}
          />

          <Input
            icon={<Mail size={18} />}
            type="email"
            placeholder="Email address"
            value={email}
            setValue={setEmail}
          />

          <Input
            icon={<Lock size={18} />}
            type="password"
            placeholder="Create password"
            value={password}
            setValue={setPassword}
          />

          <Input
            icon={<Lock size={18} />}
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            setValue={setConfirmPassword}
          />


          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-3">
              {error}
            </div>
          )}


          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 transition"
          >
            {loading
              ? "Creating account..."
              : "Create account"}

            {!loading && <ArrowRight size={18} />}
          </button>

        </form>


        <p className="text-center text-sm text-slate-400 mt-7">

          Already have an account?{" "}

          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:text-blue-300"
          >
            Sign in
          </button>

        </p>

      </div>

    </main>
  );
}


function Input({
  icon,
  type,
  placeholder,
  value,
  setValue,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div className="relative">

      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
        {icon}
      </span>

      <input
        required
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
      />

    </div>
  );
}