"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { MemberCard } from "@/components/family/member-card";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useMembers } from "@/hooks/use-members";
import { useLocale } from "@/lib/i18n/use-locale";

export default function FamilyPage() {
  const { members, isLoading } = useMembers();
  const { t } = useLocale();

  return (
    <div>
      <AppHeader
        title={t("family.title")}
        rightAction={
          <Link href="/family/add">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("family.add")}
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-3">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("family.no_members")}
            description={t("family.no_members_desc")}
            actionLabel={t("family.add_member")}
            onAction={() => (window.location.href = "/family/add")}
          />
        ) : (
          members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))
        )}
      </div>
    </div>
  );
}
