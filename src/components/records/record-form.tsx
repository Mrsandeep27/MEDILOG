"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/family/tag-input";
import { recordSchema, type RecordFormData } from "@/lib/utils/validators";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import { useMembers } from "@/hooks/use-members";

interface RecordFormProps {
  defaultValues?: Partial<RecordFormData>;
  defaultMemberId?: string;
  onSubmit: (data: RecordFormData, images: File[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function RecordForm({
  defaultValues,
  defaultMemberId,
  onSubmit,
  isSubmitting,
}: RecordFormProps) {
  const { members } = useMembers();
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      member_id: defaultMemberId || "",
      type: "prescription",
      title: "",
      doctor_name: "",
      hospital_name: "",
      visit_date: new Date().toISOString().split("T")[0],
      diagnosis: "",
      notes: "",
      tags: [],
      ...defaultValues,
    },
  });

  const tags = watch("tags");

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalImages = images.length + files.length;
    if (totalImages > 10) {
      toast.error("Maximum 10 images per record");
      return;
    }

    setImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (data: RecordFormData) => {
    await onSubmit(data, images);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Member */}
      <div className="space-y-2">
        <Label>Family Member *</Label>
        <Select
          value={watch("member_id")}
          onValueChange={(v) => setValue("member_id", v || "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.member_id && (
          <p className="text-xs text-destructive">{errors.member_id.message}</p>
        )}
      </div>

      {/* Record Type */}
      <div className="space-y-2">
        <Label>Record Type *</Label>
        <Select
          value={watch("type")}
          onValueChange={(v) => setValue("type", (v || "prescription") as RecordFormData["type"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input
          {...register("title")}
          placeholder="e.g. Dr. Sharma - Fever checkup"
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Doctor & Hospital */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Doctor Name</Label>
          <Input {...register("doctor_name")} placeholder="Dr. Name" />
        </div>
        <div className="space-y-2">
          <Label>Hospital</Label>
          <Input {...register("hospital_name")} placeholder="Hospital name" />
        </div>
      </div>

      {/* Visit Date */}
      <div className="space-y-2">
        <Label>Visit Date</Label>
        <Input type="date" {...register("visit_date")} />
      </div>

      {/* Diagnosis */}
      <div className="space-y-2">
        <Label>Diagnosis</Label>
        <Input {...register("diagnosis")} placeholder="e.g. Viral fever" />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea {...register("notes")} placeholder="Additional notes..." rows={3} />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <TagInput
          tags={tags}
          onChange={(newTags) => setValue("tags", newTags)}
          placeholder="Add tag and press Enter"
        />
      </div>

      {/* Images */}
      <div className="space-y-2">
        <Label>Photos / Documents</Label>
        <div className="grid grid-cols-4 gap-2">
          {previews.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          {images.length < 10 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Add</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageAdd}
          className="hidden"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Record"}
      </Button>
    </form>
  );
}
