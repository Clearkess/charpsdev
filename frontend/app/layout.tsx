import type { Metadata } from "next";
import "@/app/globals.css";
import AppProviders from "@/components/providers/AppProviders";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Recovered frontend skeleton for the CharpsDev marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
