"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { RecordForm } from "@/components/records/record-form";
import { useRecords } from "@/hooks/use-records";

export default function AddRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultMemberId = searchParams.get("memberId") || undefined;
  const { addRecord } = useRecords();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: Parameters<typeof addRecord>[0], images: File[]) => {
    setIsSubmitting(true);
    try {
      await addRecord(data, images);
      toast.success("Record added successfully");
      router.push("/records");
    } catch (err) {
      toast.error("Failed to add record");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <AppHeader title="Add Record" showBack />
      <div className="p-4">
        <RecordForm
          defaultMemberId={defaultMemberId}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
