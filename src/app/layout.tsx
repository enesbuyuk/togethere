import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthContext from "@/context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Togethere — Watch Together",
  description: "Watch YouTube videos with your friends at the same time. Real-time sync and chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-bg-dark text-white overflow-x-hidden min-h-screen`}>
        <div className="fixed inset-0 -z-10  blur-[80px]">
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-40 animate-orb-move bg-orb-red -top-[100px] -right-[100px]"></div>
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-40 animate-orb-move bg-orb-blue -bottom-[150px] -left-[150px]"></div>
          <div className="absolute w-[300px] h-[300px] rounded-full opacity-40 animate-orb-move bg-orb-purple top-[50%] right-[20%] [animation-delay:-5s]"></div>
        </div>
        <AuthContext>
          {children}
        </AuthContext>
      </body>
    </html>
  );
}
