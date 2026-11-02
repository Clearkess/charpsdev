"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, Clock3Icon, InfoIcon, LoaderCircleIcon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, extractErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { queryKeys } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

type ResultState = "checking" | "success" | "failed" | "pending";

export default function PaymentCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ResultState>("checking");
  const [message, setMessage] = useState("We are securely confirming your payment with Paystack.");
  const [reference, setReference] = useState("");

  useEffect(() => {
    let cancelled = false;
    const runVerification = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentReference = params.get("reference")?.trim() || "";
      setReference(paymentReference);

      if (!paymentReference) {
        setState("failed");
        setMessage("We could not find a payment reference. Please check your wallet transactions before trying again.");
        return;
      }

      // Wait for Zustand's persisted session to hydrate before deciding whether
      // the customer needs to sign in again.
      const waitForSession = async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const auth = useAuthStore.getState();
          if (auth.hasHydrated) return auth.token;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return useAuthStore.getState().token;
      };

      const token = await waitForSession();
      if (cancelled) return;
      if (!token) {
        const next = `/payment/callback?reference=${encodeURIComponent(paymentReference)}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      try {
        const response = await api.get<{ success: boolean; message?: string }>(
          `/payment/verify/${encodeURIComponent(paymentReference)}`,
        );
        if (cancelled) return;
        if (response.data.success) {
          setState("success");
          setMessage(response.data.message || "Your wallet deposit has been confirmed.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.wallet }),
            queryClient.invalidateQueries({ queryKey: queryKeys.walletTransactions }),
          ]);
        } else {
          setState("pending");
          setMessage(response.data.message || "We could not confirm the payment yet. Check your transaction history before retrying.");
        }
      } catch (error) {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        setState(status === 422 ? "failed" : "pending");
        setMessage(extractErrorMessage(error, "We could not confirm this payment right now. Please check your wallet transactions before retrying."));
      }
    };

    void runVerification();
    return () => { cancelled = true; };
  }, [queryClient, router]);

  const Icon = state === "success" ? CheckCircle2Icon : state === "failed" ? XCircleIcon : state === "pending" ? Clock3Icon : LoaderCircleIcon;
  const heading = state === "success" ? "Payment successful" : state === "failed" ? "Payment not completed" : state === "pending" ? "Payment confirmation pending" : "Verifying your payment";
  const iconClass = state === "success" ? "text-emerald-600" : state === "failed" ? "text-destructive" : "text-primary";

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <Icon className={`mb-2 size-12 ${iconClass} ${state === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
          <CardTitle className="text-2xl">{heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          {reference ? (
            <div className="rounded-lg bg-muted p-3 text-left">
              <p className="text-xs text-muted-foreground">Payment reference</p>
              <p className="mt-1 break-all font-mono text-xs">{reference}</p>
            </div>
          ) : null}
          {state === "pending" ? (
            <p className="flex items-start gap-2 text-left text-xs text-muted-foreground"><InfoIcon className="mt-0.5 size-4 shrink-0" /> Do not make another deposit until you have checked your transaction history. A delayed confirmation may still complete.</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button render={<Link href="/wallet" />} className="w-full sm:w-auto">Go to wallet</Button>
            {state === "pending" || state === "failed" ? <Button variant="outline" onClick={() => window.location.reload()} className="w-full sm:w-auto">Check again</Button> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
    }
          
