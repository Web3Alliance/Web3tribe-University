"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { initiateW3trPurchaseAction } from "@/lib/actions/w3tr-purchase";
import { W3TR_BUNDLES, W3TR_DISCLAIMER } from "@/lib/w3tr-bundles";

export function BuyW3trBundles() {
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  function handleBuy(bundleKey: string) {
    setLoadingKey(bundleKey);
    initiateW3trPurchaseAction(bundleKey).then((res) => {
      if (res.error) {
        toast.error(res.error);
        setLoadingKey(null);
      } else if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {W3TR_BUNDLES.map((bundle) => (
          <Card key={bundle.key} className="relative">
            {bundle.badge && (
              <Badge variant="accent" className="absolute -top-2 right-3">
                {bundle.badge}
              </Badge>
            )}
            <CardContent className="space-y-2 p-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">{bundle.label}</p>
              <p className="text-2xl font-bold text-primary">{bundle.w3trAmount} W3TR</p>
              <p className="text-sm text-muted-foreground">₦{bundle.amountNaira.toLocaleString()}</p>
              <Button
                className="w-full"
                variant="outline"
                disabled={loadingKey === bundle.key}
                onClick={() => handleBuy(bundle.key)}
              >
                {loadingKey === bundle.key ? "Redirecting…" : "Buy"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
        <p>{W3TR_DISCLAIMER}</p>
      </div>
    </div>
  );
}