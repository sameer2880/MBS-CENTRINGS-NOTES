import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, RefreshCw, Film } from "lucide-react";

const REELS_URL = "https://mbsndcl.vercel.app/reelmanagent";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "Reel Management — M.B.S Centring Works" },
      { name: "description", content: "Manage reels for M.B.S Centring Works." },
      { property: "og:title", content: "Reel Management — M.B.S Centring Works" },
      { property: "og:description", content: "Manage and control your reels from one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reels,
});

function Reels() {
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold leading-tight">Reel Management</h2>
            <p className="text-xs text-muted-foreground">Connected to mbsndcl.vercel.app</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Reload
          </Button>
          <Button size="sm" asChild>
            <a href={REELS_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Open full app
            </a>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <iframe
            key={key}
            src={REELS_URL}
            title="Reel Management"
            className="w-full h-[calc(100vh-14rem)] min-h-[480px] border-0 bg-background"
            allow="camera; microphone; clipboard-write; fullscreen"
          />
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        If the panel stays blank, the reel app blocks embedding — use “Open full app”.
      </p>
    </div>
  );
}
