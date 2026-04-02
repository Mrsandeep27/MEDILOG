"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/app-header";
import { RecordCard } from "@/components/records/record-card";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useRecords } from "@/hooks/use-records";
import { useMembers } from "@/hooks/use-members";
import { useFamilyStore } from "@/stores/family-store";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import type { RecordType } from "@/lib/db/schema";
import { useLocale } from "@/lib/i18n/use-locale";

export default function RecordsPage() {
  const router = useRouter();
  const { selectedMemberId } = useFamilyStore();
  const { records, isLoading, searchRecords } = useRecords(selectedMemberId || undefined);
  const { members } = useMembers();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all");
  const [searchResults, setSearchResults] = useState<typeof records | null>(null);
  const { t } = useLocale();

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

  const filteredRecords = (searchResults || records).filter(
    (r) => typeFilter === "all" || r.type === typeFilter
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length > 1) {
      debounceRef.current = setTimeout(async () => {
        const results = await searchRecords(query);
        setSearchResults(results);
      }, 300);
    } else {
      setSearchResults(null);
    }
  }, [searchRecords]);

  return (
    <div>
      <AppHeader
        title={t("records.title")}
        rightAction={
          <Link href="/records/add">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("common.add")}
            </Button>
          </Link>
        }
      />

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("records.search")}
            className="pl-9"
          />
        </div>

        {/* Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Badge
            variant={typeFilter === "all" ? "default" : "outline"}
            className="cursor-pointer shrink-0"
            onClick={() => setTypeFilter("all")}
          >
            {t("common.all")}
          </Badge>
          {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
            <Badge
              key={value}
              variant={typeFilter === value ? "default" : "outline"}
              className="cursor-pointer shrink-0"
              onClick={() =>
                setTypeFilter(value as RecordType)
              }
            >
              {label}
            </Badge>
          ))}
        </div>

        {/* Records List */}
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : filteredRecords.length === 0 ? (
          search ? (
            <EmptyState
              icon={Search}
              title={t("records.no_results")}
              description={`${t("records.no_results_desc")} "${search}"`}
            />
          ) : (
            <div className="py-8 space-y-4 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t("records.no_records")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("records.no_records_desc")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <Button size="sm" onClick={() => router.push("/scan")}>
                  {t("records.scan_prescription")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/records/add")}>
                  {t("records.add_manually")}
                </Button>
              </div>
              <div className="bg-muted rounded-lg p-3 text-left max-w-sm mx-auto">
                <p className="text-xs font-medium mb-1.5">{t("records.quick_start")}</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t("records.step1")}</li>
                  <li>{t("records.step2")}</li>
                  <li>{t("records.step3")}</li>
                  <li>{t("records.step4")}</li>
                </ol>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                memberName={memberMap[record.member_id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
