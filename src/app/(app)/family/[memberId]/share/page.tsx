"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Share2, Copy, Clock, Link2, QrCode } from "lucide-react";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMember } from "@/hooks/use-members";
import { useShareLinks } from "@/hooks/use-share-links";
import { SHARE_LINK_OPTIONS_HOURS } from "@/constants/config";

const EXPIRY_LABELS: Record<number, string> = {
  1: "1 hour",
  6: "6 hours",
  24: "24 hours",
  72: "3 days",
  168: "7 days",
};

export default function SharePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const { member, isLoading: memberLoading } = useMember(memberId);
  const { shareLinks, createShareLink, revokeShareLink } =
    useShareLinks(memberId);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isCreating, setIsCreating] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  if (memberLoading) {
    return (
      <div>
        <AppHeader title="Share" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const link = await createShareLink(memberId, null, expiryHours);
      const shareUrl = `${window.location.origin}/share/${link.token}`;
      setQrUrl(shareUrl);
      toast.success("Share link created!");
    } catch (err) {
      toast.error("Failed to create share link");
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    copyToClipboard(url);
  };

  const activeLinks = shareLinks.filter(
    (l) => l.is_active && new Date(l.expires_at) > new Date()
  );

  return (
    <div>
      <AppHeader title={`Share ${member?.name || ""}'s Records`} showBack />

      <div className="p-4 space-y-4">
        {/* Generate QR */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Generate Share Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a secure link that lets a doctor view{" "}
              {member?.name || "this member"}&apos;s health records in their browser
              — no login required.
            </p>

            <div className="flex items-center gap-3">
              <Select
                value={String(expiryHours)}
                onValueChange={(v) => setExpiryHours(Number(v))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_LINK_OPTIONS_HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      Expires in {EXPIRY_LABELS[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating..." : "Generate"}
              </Button>
            </div>

            {/* QR Code display */}
            {qrUrl && (
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg border">
                <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      QR Code Generated
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(qrUrl)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `${member?.name}'s Health Records`,
                          url: qrUrl,
                        });
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Links */}
        {activeLinks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Active Links ({activeLinks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeLinks.map((link) => {
                const expiresAt = new Date(link.expires_at);
                const hoursLeft = Math.max(
                  0,
                  Math.round(
                    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
                  )
                );

                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-mono truncate max-w-[180px]">
                        ...{link.token.slice(-12)}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {hoursLeft > 0
                            ? `${hoursLeft}h remaining`
                            : "Expired"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => copyLink(link.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          revokeShareLink(link.id);
                          toast.success("Link revoked");
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
