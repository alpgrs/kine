import { createFileRoute } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";

export const Route = createFileRoute("/offline")({ component: OfflinePage });

function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Hors ligne</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vérifiez votre connexion et réessayez.
        </p>
      </div>
    </div>
  );
}
