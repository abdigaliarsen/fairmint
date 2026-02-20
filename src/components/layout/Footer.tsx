import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="size-4 text-emerald-600" />
          <span>TokenTrust &mdash; Powered by FairScale</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Not financial advice. Always DYOR.
        </p>
      </div>
    </footer>
  );
}
