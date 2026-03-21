"use client";

import { use, useEffect, useState } from "react";
import {
  User,
  Calendar,
  Stethoscope,
  Hospital,
  FileText,
  Heart,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RECORD_TYPE_LABELS, BLOOD_GROUPS } from "@/constants/config";

interface SharedData {
  member: {
    name: string;
    blood_group: string;
    allergies: string[];
    chronic_conditions: string[];
    date_of_birth?: string;
    gender?: string;
  };
  records: Array<{
    id: string;
    type: string;
    title: string;
    doctor_name?: string;
    hospital_name?: string;
    visit_date?: string;
    diagnosis?: string;
    notes?: string;
  }>;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    is_active: boolean;
  }>;
}

export default function SharedRecordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSharedData() {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("This share link has expired or does not exist.");
          } else {
            setError("Failed to load shared records.");
          }
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load shared records. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    fetchSharedData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading health records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Link Unavailable</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { member, records, medicines } = data;
  const activeMedicines = medicines.filter((m) => m.is_active);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1 text-primary-foreground/70 text-xs">
            <Shield className="h-3 w-3" />
            <span>Securely shared via MediLog</span>
          </div>
          <h1 className="text-2xl font-bold">{member.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-primary-foreground/80">
            {member.blood_group && (
              <Badge variant="secondary" className="text-xs">
                {member.blood_group}
              </Badge>
            )}
            {member.gender && <span>{member.gender}</span>}
            {member.date_of_birth && (
              <span>
                DOB:{" "}
                {new Date(member.date_of_birth).toLocaleDateString("en-IN")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Allergies & Conditions */}
        {((member.allergies || []).length > 0 ||
          (member.chronic_conditions || []).length > 0) && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              {(member.allergies || []).length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                      Allergies
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(member.allergies || []).map((a) => (
                      <Badge key={a} variant="outline" className="text-xs border-amber-300">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(member.chronic_conditions || []).length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Chronic Conditions
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(member.chronic_conditions || []).map((c) => (
                      <Badge key={c} variant="outline" className="text-xs border-amber-300">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Active Medicines */}
        {activeMedicines.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Current Medicines ({activeMedicines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeMedicines.map((med, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{med.name}</p>
                    {med.dosage && (
                      <p className="text-xs text-muted-foreground">{med.dosage}</p>
                    )}
                  </div>
                  {med.frequency && (
                    <Badge variant="secondary" className="text-[10px]">
                      {med.frequency.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Records */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Health Records ({records.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {RECORD_TYPE_LABELS[record.type] || record.type}
                  </Badge>
                  {record.visit_date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.visit_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                <p className="font-medium text-sm">{record.title}</p>
                {record.doctor_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dr. {record.doctor_name}
                    {record.hospital_name && ` · ${record.hospital_name}`}
                  </p>
                )}
                {record.diagnosis && (
                  <p className="text-xs mt-1">
                    <span className="text-muted-foreground">Diagnosis:</span>{" "}
                    {record.diagnosis}
                  </p>
                )}
                {record.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {record.notes}
                  </p>
                )}
              </div>
            ))}
            {records.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No records shared
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground py-4">
          Shared via MediLog — India&apos;s family health record manager
        </p>
      </div>
    </div>
  );
}
