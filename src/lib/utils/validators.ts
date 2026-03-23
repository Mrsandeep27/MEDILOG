import { z } from "zod";

// Phone number (Indian +91)
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

// OTP
export const otpSchema = z
  .string()
  .length(6, "OTP must be 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only digits");

// PIN
export const pinSchema = z
  .string()
  .length(4, "PIN must be 4 digits")
  .regex(/^\d{4}$/, "PIN must contain only digits");

// Family member
export const memberSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  relation: z.enum([
    "self",
    "spouse",
    "father",
    "mother",
    "son",
    "daughter",
    "grandfather",
    "grandmother",
    "brother",
    "sister",
    "other",
  ]),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], {
    required_error: "Blood group is required",
    invalid_type_error: "Select a blood group",
  }),
  gender: z.enum(["male", "female", "other"], {
    required_error: "Gender is required",
    invalid_type_error: "Select gender",
  }),
  allergies: z.array(z.string()),
  chronic_conditions: z.array(z.string()),
  emergency_contact_name: z.string().min(1, "Emergency contact name is required"),
  emergency_contact_phone: z
    .string()
    .min(1, "Emergency contact phone is required")
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
});

export type MemberFormData = z.infer<typeof memberSchema>;

// Health record
export const recordSchema = z.object({
  member_id: z.string().min(1, "Select a family member"),
  type: z.enum([
    "prescription",
    "lab_report",
    "vaccination",
    "bill",
    "discharge_summary",
    "other",
  ]),
  title: z.string().min(1, "Title is required").max(200),
  doctor_name: z.string().optional(),
  hospital_name: z.string().optional(),
  visit_date: z.string().optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
});

export type RecordFormData = z.infer<typeof recordSchema>;
