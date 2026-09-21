import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Thozhan",
    template: "%s | Thozhan",
  },

  description:
    "Thozhan is your personal AI companion for email, priorities, tasks and meetings.",

  applicationName: "Thozhan",

icons: {
  icon: [
    {
      url: "/thozhan-favicon.png",
      type: "image/png",
      sizes: "32x32",
    },
  ],
  shortcut: "/thozhan-favicon.png",
  apple: "/thozhan-logo.png",
},
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}