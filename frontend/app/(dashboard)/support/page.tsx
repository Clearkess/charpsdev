"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  ClipboardListIcon,
  LifeBuoyIcon,
  MailIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicSettingsQuery } from "@/hooks/queries/usePublicSettingsQuery";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How do I fund my wallet?",
    answer:
      "Go to Wallet, enter an amount, and follow the prompt to complete payment. Your balance updates automatically once payment is confirmed.",
  },
  {
    question: "Why was my order refunded?",
    answer:
      "Orders (including virtual number rentals) are automatically refunded to your wallet if the service provider can't fulfill the request — you're never charged without receiving value.",
  },
  {
    question: "How do I check the status of an order?",
    answer:
      "Open Orders from the sidebar or bottom navigation to see every order's current status, and tap into an order for more detail.",
  },
  {
    question: "I didn't receive an SMS code for my virtual number. What now?",
    answer:
      "Open the order on the Virtual Numbers page and tap Refresh to poll for a new code. If the rental expires without a code, it's automatically refunded to your wallet.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {question}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? <p className="mt-2 text-sm text-muted-foreground">{answer}</p> : null}
    </div>
  );
}

/**
 * Drawer/sidebar "Support" destination requested alongside the mobile-nav
 * UI polish pass. Self-contained (no backend ticketing system exists yet):
 * a mailto CTA using the admin-editable support_email setting, quick links
 * to the two most common self-service destinations (Orders/Wallet), and a
 * short static FAQ. Keeps this shippable without inventing a support-ticket
 * feature that wasn't asked for.
 */
export default function SupportPage() {
  const publicSettings = usePublicSettingsQuery();
  const supportEmail = publicSettings.data?.support_email;

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-bold">Support</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoyIcon className="size-4" aria-hidden="true" />
            Contact us
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Have a question or ran into an issue? Reach out and we&apos;ll get back to you.
          </p>
          {publicSettings.isPending ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Button
              render={<a href={supportEmail ? `mailto:${supportEmail}` : undefined} />}
              disabled={!supportEmail}
            >
              <MailIcon data-icon="inline-start" aria-hidden="true" />
              {supportEmail ?? "Support email unavailable"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="/orders" prefetch={false} />}>
              <ClipboardListIcon data-icon="inline-start" aria-hidden="true" />
              Track an order
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/wallet" prefetch={false} />}>
              <WalletIcon data-icon="inline-start" aria-hidden="true" />
              Wallet & payments
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent>
          {faqs.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
