"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { memberSchema, type MemberFormData } from "@/lib/utils/validators";
import { RELATION_LABELS, BLOOD_GROUPS } from "@/constants/config";
import { TagInput } from "@/components/family/tag-input";

interface MemberFormProps {
  onSubmit: (data: MemberFormData) => void;
  loading?: boolean;
  submitLabel?: string;
  defaultValues?: Partial<MemberFormData>;
  defaultRelation?: string;
  hideRelation?: boolean;
}

export function MemberForm({
  onSubmit,
  loading,
  submitLabel = "Save",
  defaultValues,
  defaultRelation,
  hideRelation,
}: MemberFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      relation: (defaultRelation as MemberFormData["relation"]) || "self",
      date_of_birth: "",
      blood_group: undefined,
      gender: undefined,
      allergies: [],
      chronic_conditions: [],
      emergency_contact_name: "",
      emergency_contact_phone: "",
      ...defaultValues,
    },
  });

  const allergies = watch("allergies");
  const chronicConditions = watch("chronic_conditions");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="Enter full name"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Relation */}
      {!hideRelation && (
        <div className="space-y-2">
          <Label>Relation *</Label>
          <Select
            defaultValue={defaultValues?.relation || defaultRelation || "self"}
            onValueChange={(val) =>
              setValue("relation", val as MemberFormData["relation"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select relation" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RELATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.relation && (
            <p className="text-sm text-destructive">
              {errors.relation.message}
            </p>
          )}
        </div>
      )}

      {/* Date of Birth */}
      <div className="space-y-2">
        <Label htmlFor="dob">Date of Birth *</Label>
        <Input id="dob" type="date" {...register("date_of_birth")} />
        {errors.date_of_birth && (
          <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <Label>Gender *</Label>
        <Select
          defaultValue={defaultValues?.gender || ""}
          onValueChange={(val) =>
            setValue("gender", val as MemberFormData["gender"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.gender && (
          <p className="text-sm text-destructive">{errors.gender.message}</p>
        )}
      </div>

      {/* Blood Group */}
      <div className="space-y-2">
        <Label>Blood Group *</Label>
        <Select
          defaultValue={defaultValues?.blood_group || ""}
          onValueChange={(val) =>
            setValue("blood_group", val as MemberFormData["blood_group"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select blood group" />
          </SelectTrigger>
          <SelectContent>
            {BLOOD_GROUPS.map((bg) => (
              <SelectItem key={bg} value={bg}>
                {bg}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.blood_group && (
          <p className="text-sm text-destructive">{errors.blood_group.message}</p>
        )}
      </div>

      {/* Allergies */}
      <div className="space-y-2">
        <Label>Allergies</Label>
        <TagInput
          tags={allergies}
          onChange={(tags) => setValue("allergies", tags)}
          placeholder="Add allergy (press Enter)"
        />
      </div>

      {/* Chronic Conditions */}
      <div className="space-y-2">
        <Label>Chronic Conditions</Label>
        <TagInput
          tags={chronicConditions}
          onChange={(tags) => setValue("chronic_conditions", tags)}
          placeholder="Add condition (press Enter)"
        />
      </div>

      {/* Emergency Contact */}
      <div className="space-y-2">
        <Label htmlFor="emergency_name">Emergency Contact Name *</Label>
        <Input
          id="emergency_name"
          placeholder="Contact person name"
          {...register("emergency_contact_name")}
        />
        {errors.emergency_contact_name && (
          <p className="text-sm text-destructive">{errors.emergency_contact_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergency_phone">Emergency Contact Phone *</Label>
        <Input
          id="emergency_phone"
          type="tel"
          placeholder="10-digit mobile number"
          maxLength={10}
          {...register("emergency_contact_phone")}
        />
        {errors.emergency_contact_phone && (
          <p className="text-sm text-destructive">{errors.emergency_contact_phone.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
