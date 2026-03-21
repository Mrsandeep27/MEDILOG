"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { RecordForm } from "@/components/records/record-form";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useRecord, useRecords } from "@/hooks/use-records";

export default function EditRecordPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
  const router = useRouter();
  const { record, isLoading } = useRecord(recordId);
  const { updateRecord } = useRecords();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div>
        <AppHeader title="Edit Record" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  if (!record) {
    return (
      <div>
        <AppHeader title="Edit Record" showBack />
        <p className="p-4 text-center text-muted-foreground">Record not found</p>
      </div>
    );
  }

  const handleSubmit = async (data: Parameters<typeof updateRecord>[1], images: File[]) => {
    setIsSubmitting(true);
    try {
      await updateRecord(recordId, data, images);
      toast.success("Record updated");
      router.push(`/records/${recordId}`);
    } catch (err) {
      toast.error("Failed to update record");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <AppHeader title="Edit Record" showBack />
      <div className="p-4">
        <RecordForm
          defaultValues={{
            member_id: record.member_id,
            type: record.type,
            title: record.title,
            doctor_name: record.doctor_name || "",
            hospital_name: record.hospital_name || "",
            visit_date: record.visit_date || "",
            diagnosis: record.diagnosis || "",
            notes: record.notes || "",
            tags: record.tags,
          }}
          defaultMemberId={record.member_id}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
