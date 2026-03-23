"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ScanLine, Plus, AlertTriangle, Bell, FileText, Pill, TestTube, HeartPulse, FileDown, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberSelector } from "@/components/family/member-selector";
import { RecordCard } from "@/components/records/record-card";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useAuthStore } from "@/stores/auth-store";
import { useFamilyStore } from "@/stores/family-store";
import { APP_NAME } from "@/constants/config";
import { PWAInstallBanner } from "@/components/pwa/install-button";

export default function HomePage() {
  const router = useRouter();
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();
  const { records } = useRecords(selectedMemberId || undefined);

  const selfMember = members.find((m) => m.relation === "self");
  const greeting = selfMember
    ? `Hi, ${selfMember.name.split(" ")[0]}`
    : "Welcome";

  const recentRecords = records.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="MediLog"
              width={36}
              height={36}
              className="rounded-lg bg-white p-0.5"
            />
            <div>
              <h1 className="text-2xl font-bold">{greeting}</h1>
              <p className="text-primary-foreground/70 text-sm">{APP_NAME}</p>
            </div>
          </div>
          <Link href="/reminders">
            <Button
              size="icon"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Quick Actions — Row 1 */}
        <div className="grid grid-cols-4 gap-2">
          <Link href="/ai-doctor">
            <QuickAction icon={Stethoscope} label="AI Doctor" />
          </Link>
          <Link href="/medicine">
            <QuickAction icon={Pill} label="Medicine Info" />
          </Link>
          <Link href="/lab-insights">
            <QuickAction icon={TestTube} label="Lab Insights" />
          </Link>
          <Link href="/scan">
            <QuickAction icon={ScanLine} label="Scan Rx" />
          </Link>
        </div>
        {/* Quick Actions — Row 2 */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Link href="/symptom-tracker">
            <QuickAction icon={HeartPulse} label="Symptoms" />
          </Link>
          <Link href="/records/add">
            <QuickAction icon={Plus} label="Add Record" />
          </Link>
          <Link href="/doctor-report">
            <QuickAction icon={FileDown} label="Doctor PDF" />
          </Link>
          {selfMember ? (
            <Link href={`/family/${selfMember.id}/emergency`}>
              <QuickAction icon={AlertTriangle} label="Emergency" />
            </Link>
          ) : (
            <Link href="/reminders">
              <QuickAction icon={Bell} label="Reminders" />
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* Family Members */}
        {members.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Family Members</h2>
              <Link
                href="/family"
                className="text-sm text-primary font-medium"
              >
                View All
              </Link>
            </div>
            <MemberSelector
              members={members}
              selectedId={selectedMemberId}
              onSelect={(m) => setSelectedMember(m.id)}
            />
          </section>
        )}

        {/* Recent Records */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Records
            </h2>
            {records.length > 0 && (
              <Link
                href="/records"
                className="text-sm text-primary font-medium"
              >
                View All
              </Link>
            )}
          </div>
          {recentRecords.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No records yet. Add your first health record to get started.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push("/records/add")}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Record
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentRecords.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors">
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-medium text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
