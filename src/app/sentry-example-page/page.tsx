"use client";

import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SentryExamplePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <Card>
        <CardHeader>
          <CardTitle>Sentry Test Page</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Click the button below to send a test error to Sentry.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              Sentry.startSpan(
                { name: "Example Frontend Span", op: "test" },
                () => {
                  throw new Error("Sentry Frontend Test Error");
                }
              );
            }}
          >
            Throw Test Error
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
