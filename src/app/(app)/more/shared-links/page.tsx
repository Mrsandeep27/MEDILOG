"use client";

import { toast } from "sonner";
import { Share2, Copy, Clock, Trash2, Ban } from "lucide-react";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useShareLinks } from "@/hooks/use-share-links";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";

export default function SharedLinksPage() {
  const { shareLinks, isLoading, revokeShareLink, deleteShareLink } =
    useShareLinks();

  const members = useLiveQuery(() => db.members.toArray(), []);
  const memberMap = Object.fromEntries(
    (members ?? []).map((m) => [m.id, m.name])
  );

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Shared Links" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Shared Links" showBack />

      <div className="p-4 space-y-3">
        {shareLinks.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No shared links"
            description="When you share records with doctors via QR code, your active links will appear here."
          />
        ) : (
          shareLinks.map((link) => {
            const expiresAt = new Date(link.expires_at);
            const isExpired = expiresAt < new Date();
            const hoursLeft = Math.max(
              0,
              Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
            );

            return (
              <Card key={link.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">
                          {memberMap[link.member_id] || "Unknown"}
                        </p>
                        <Badge
                          variant={isExpired ? "secondary" : "default"}
                          className="text-[10px]"
                        >
                          {isExpired ? "Expired" : "Active"}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        ...{link.token.slice(-16)}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {isExpired
                            ? `Expired ${expiresAt.toLocaleDateString("en-IN")}`
                            : `${hoursLeft}h remaining`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!isExpired && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() =>
                            copyToClipboard(
                              `${window.location.origin}/share/${link.token}`
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {!isExpired && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            try {
                              await revokeShareLink(link.id);
                              toast.success("Link revoked");
                            } catch { toast.error("Failed to revoke"); }
                          }}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={async () => {
                          try {
                            await deleteShareLink(link.id);
                            toast.success("Link deleted");
                          } catch { toast.error("Failed to delete"); }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
