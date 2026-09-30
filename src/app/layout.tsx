import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Game Mining",
  description:
    "Find evidence of a potential recruiting-video need and prioritize qualified leads for sports video editing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <div className="min-h-screen lg:pl-60">
          <Sidebar />
          <main className="py-8 sm:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}