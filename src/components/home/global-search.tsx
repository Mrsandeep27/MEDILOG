"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, User, Pill, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useMedicines } from "@/hooks/use-medicines";

interface SearchResult {
  id: string;
  type: "record" | "member" | "medicine";
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { members } = useMembers();
  const { records } = useRecords();
  const { medicines } = useMedicines();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const matched: SearchResult[] = [];

    // Search members
    members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.relation.toLowerCase().includes(q) ||
          m.blood_group?.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((m) =>
        matched.push({
          id: m.id,
          type: "member",
          title: m.name,
          subtitle: `${m.relation} · ${m.blood_group || ""}`.trim(),
          href: `/family/${m.id}`,
        })
      );

    // Search records
    records
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.doctor_name?.toLowerCase().includes(q) ||
          r.hospital_name?.toLowerCase().includes(q) ||
          r.diagnosis?.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((r) =>
        matched.push({
          id: r.id,
          type: "record",
          title: r.title,
          subtitle: [r.doctor_name, r.type.replace("_", " ")].filter(Boolean).join(" · "),
          href: `/records/${r.id}`,
        })
      );

    // Search medicines
    medicines
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.dosage?.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((m) =>
        matched.push({
          id: m.id,
          type: "medicine",
          title: m.name,
          subtitle: [m.dosage, m.is_active ? "Active" : "Inactive"].filter(Boolean).join(" · "),
          href: `/reminders`,
        })
      );

    setResults(matched);
  }, [query, members, records, medicines]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const iconMap = {
    record: FileText,
    member: User,
    medicine: Pill,
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          placeholder="Search records, members, medicines..."
          className="pl-9 pr-8 bg-muted/50 border-0 h-10 rounded-xl"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.map((result) => {
            const Icon = iconMap[result.type];
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  router.push(result.href);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
