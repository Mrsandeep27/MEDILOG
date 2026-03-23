"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Loader2,
  User,
  Pill,
  Activity,
  Calendar,
  Phone,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useMedicines } from "@/hooks/use-medicines";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import { toast } from "sonner";

export default function DoctorReportPage() {
  const { members } = useMembers();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { records } = useRecords(selectedMemberId || undefined);
  const { medicines } = useMedicines(selectedMemberId || undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const activeMedicines = medicines.filter((m) => m.is_active);
  const recentRecords = records.slice(0, 10);

  const generatePDF = async () => {
    if (!selectedMember) {
      toast.error("Select a family member first");
      return;
    }

    setIsGenerating(true);

    try {
      // Build HTML content for the PDF
      const html = buildReportHTML(selectedMember, recentRecords, activeMedicines);

      // Open in new window for printing/saving as PDF
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Auto-trigger print dialog after content loads
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 500);
        };
        toast.success("Report generated! Use Print → Save as PDF");
      } else {
        toast.error("Pop-up blocked. Please allow pop-ups for this site.");
      }
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <AppHeader title="Doctor Report" showBack />
      <div className="p-4 space-y-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Generate a professional health summary PDF that you can show to your doctor
              during a visit. It includes your medical history, current medicines, allergies, and recent records.
            </p>
          </CardContent>
        </Card>

        {/* Member Selection */}
        <div className="space-y-2">
          <Label>Select Family Member *</Label>
          <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
            <SelectTrigger>
              <SelectValue placeholder="Choose member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {selectedMember && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Name:</strong> {selectedMember.name}</p>
                <p><strong>DOB:</strong> {selectedMember.date_of_birth || "Not set"}</p>
                <p><strong>Gender:</strong> {selectedMember.gender || "Not set"}</p>
                <p><strong>Blood Group:</strong> {selectedMember.blood_group || "Not set"}</p>
                {selectedMember.allergies.length > 0 && (
                  <p><strong>Allergies:</strong> {selectedMember.allergies.join(", ")}</p>
                )}
                {selectedMember.chronic_conditions.length > 0 && (
                  <p><strong>Conditions:</strong> {selectedMember.chronic_conditions.join(", ")}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Current Medicines ({activeMedicines.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeMedicines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active medicines</p>
                ) : (
                  <div className="space-y-1">
                    {activeMedicines.map((med) => (
                      <div key={med.id} className="text-sm flex justify-between">
                        <span>{med.name}</span>
                        <span className="text-muted-foreground">{med.dosage}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Records ({recentRecords.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records yet</p>
                ) : (
                  <div className="space-y-1">
                    {recentRecords.map((rec) => (
                      <div key={rec.id} className="text-sm flex justify-between">
                        <span>{rec.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {rec.visit_date || "No date"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={generatePDF}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Generate Doctor Report (PDF)</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function buildReportHTML(
  member: { name: string; date_of_birth?: string; gender: string; blood_group: string; allergies: string[]; chronic_conditions: string[]; emergency_contact_name?: string; emergency_contact_phone?: string },
  records: Array<{ title: string; type: string; visit_date?: string; doctor_name?: string; hospital_name?: string; diagnosis?: string }>,
  medicines: Array<{ name: string; dosage?: string; frequency?: string; before_food: boolean }>
): string {
  const now = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>MediLog Health Report - ${member.name}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; font-size: 13px; }
  .header { text-align: center; border-bottom: 3px solid #16a34a; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { color: #16a34a; margin: 0; font-size: 24px; }
  .header p { color: #666; margin: 5px 0; font-size: 12px; }
  .section { margin-bottom: 18px; }
  .section h2 { font-size: 15px; color: #16a34a; border-bottom: 1px solid #e5e5e5; padding-bottom: 5px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .info-item { display: flex; gap: 8px; }
  .info-item .label { color: #888; min-width: 100px; }
  .info-item .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-weight: 600; }
  td { padding: 6px 8px; border: 1px solid #ddd; }
  .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 8px; border-radius: 6px; margin: 6px 0; }
  .alert-label { color: #dc2626; font-weight: 600; font-size: 12px; }
  .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #999; font-size: 10px; }
  @media print { body { font-size: 11px; } .header h1 { font-size: 20px; } }
</style></head><body>
<div class="header">
  <h1>MediLog Health Report</h1>
  <p>Generated on ${now}</p>
  <p style="font-size:10px;">This report is for informational purposes only</p>
</div>

<div class="section">
  <h2>Patient Information</h2>
  <div class="info-grid">
    <div class="info-item"><span class="label">Name:</span><span class="value">${member.name}</span></div>
    <div class="info-item"><span class="label">Blood Group:</span><span class="value">${member.blood_group || "N/A"}</span></div>
    <div class="info-item"><span class="label">Date of Birth:</span><span class="value">${member.date_of_birth || "N/A"}</span></div>
    <div class="info-item"><span class="label">Gender:</span><span class="value">${member.gender || "N/A"}</span></div>
  </div>
  ${member.emergency_contact_name ? `<div class="info-item" style="margin-top:8px;"><span class="label">Emergency Contact:</span><span class="value">${member.emergency_contact_name} (${member.emergency_contact_phone || "N/A"})</span></div>` : ""}
</div>

${member.allergies.length > 0 ? `
<div class="section">
  <div class="alert">
    <span class="alert-label">⚠ Known Allergies:</span> ${member.allergies.join(", ")}
  </div>
</div>` : ""}

${member.chronic_conditions.length > 0 ? `
<div class="section">
  <h2>Chronic Conditions</h2>
  <p>${member.chronic_conditions.join(", ")}</p>
</div>` : ""}

<div class="section">
  <h2>Current Medicines (${medicines.length})</h2>
  ${medicines.length > 0 ? `
  <table>
    <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th></tr>
    ${medicines.map((m) => `
    <tr>
      <td>${m.name}</td>
      <td>${m.dosage || "-"}</td>
      <td>${m.frequency || "-"}</td>
      <td>${m.before_food ? "Before food" : "After food"}</td>
    </tr>`).join("")}
  </table>` : "<p>No active medicines</p>"}
</div>

<div class="section">
  <h2>Recent Medical Records (${records.length})</h2>
  ${records.length > 0 ? `
  <table>
    <tr><th>Date</th><th>Title</th><th>Type</th><th>Doctor</th><th>Diagnosis</th></tr>
    ${records.map((r) => `
    <tr>
      <td>${r.visit_date || "-"}</td>
      <td>${r.title}</td>
      <td>${RECORD_TYPE_LABELS[r.type] || r.type}</td>
      <td>${r.doctor_name || "-"}</td>
      <td>${r.diagnosis || "-"}</td>
    </tr>`).join("")}
  </table>` : "<p>No records available</p>"}
</div>

<div class="footer">
  <p>Generated by MediLog — India's Family Health Record Manager</p>
  <p>medi--log.vercel.app</p>
</div>
</body></html>`;
}
