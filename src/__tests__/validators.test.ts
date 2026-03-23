import { describe, it, expect } from "vitest";
import {
  phoneSchema,
  otpSchema,
  pinSchema,
  memberSchema,
  recordSchema,
} from "@/lib/utils/validators";

describe("Phone Schema", () => {
  it("accepts valid Indian mobile numbers", () => {
    expect(phoneSchema.safeParse("9876543210").success).toBe(true);
    expect(phoneSchema.safeParse("6000000000").success).toBe(true);
    expect(phoneSchema.safeParse("7999999999").success).toBe(true);
    expect(phoneSchema.safeParse("8123456789").success).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(phoneSchema.safeParse("1234567890").success).toBe(false); // starts with 1
    expect(phoneSchema.safeParse("5555555555").success).toBe(false); // starts with 5
    expect(phoneSchema.safeParse("987654321").success).toBe(false);  // 9 digits
    expect(phoneSchema.safeParse("98765432100").success).toBe(false); // 11 digits
    expect(phoneSchema.safeParse("").success).toBe(false);
    expect(phoneSchema.safeParse("abcdefghij").success).toBe(false);
  });
});

describe("OTP Schema", () => {
  it("accepts valid 6-digit OTPs", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
    expect(otpSchema.safeParse("000000").success).toBe(true);
    expect(otpSchema.safeParse("999999").success).toBe(true);
  });

  it("rejects invalid OTPs", () => {
    expect(otpSchema.safeParse("12345").success).toBe(false);   // 5 digits
    expect(otpSchema.safeParse("1234567").success).toBe(false);  // 7 digits
    expect(otpSchema.safeParse("abcdef").success).toBe(false);   // letters
    expect(otpSchema.safeParse("").success).toBe(false);
  });
});

describe("PIN Schema", () => {
  it("accepts valid 4-digit PINs", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("0000").success).toBe(true);
    expect(pinSchema.safeParse("9999").success).toBe(true);
  });

  it("rejects invalid PINs", () => {
    expect(pinSchema.safeParse("123").success).toBe(false);
    expect(pinSchema.safeParse("12345").success).toBe(false);
    expect(pinSchema.safeParse("abcd").success).toBe(false);
    expect(pinSchema.safeParse("").success).toBe(false);
  });
});

describe("Member Schema", () => {
  const validMember = {
    name: "Sandeep Pandey",
    relation: "self" as const,
    date_of_birth: "1995-11-27",
    blood_group: "B+" as const,
    gender: "male" as const,
    allergies: [],
    chronic_conditions: [],
    emergency_contact_name: "Mom",
    emergency_contact_phone: "9876543210",
  };

  it("accepts valid member data", () => {
    expect(memberSchema.safeParse(validMember).success).toBe(true);
  });

  it("accepts member with all fields", () => {
    const full = {
      ...validMember,
      allergies: ["Penicillin", "Dust"],
      chronic_conditions: ["Diabetes"],
    };
    expect(memberSchema.safeParse(full).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(memberSchema.safeParse({ ...validMember, name: "" }).success).toBe(false);
  });

  it("rejects missing date_of_birth", () => {
    expect(memberSchema.safeParse({ ...validMember, date_of_birth: "" }).success).toBe(false);
  });

  it("rejects missing gender", () => {
    expect(memberSchema.safeParse({ ...validMember, gender: "" }).success).toBe(false);
  });

  it("rejects missing blood_group", () => {
    expect(memberSchema.safeParse({ ...validMember, blood_group: "" }).success).toBe(false);
  });

  it("rejects missing emergency contact name", () => {
    expect(memberSchema.safeParse({ ...validMember, emergency_contact_name: "" }).success).toBe(false);
  });

  it("rejects invalid emergency phone", () => {
    expect(memberSchema.safeParse({ ...validMember, emergency_contact_phone: "1234" }).success).toBe(false);
  });

  it("rejects invalid relation", () => {
    expect(memberSchema.safeParse({ ...validMember, relation: "friend" }).success).toBe(false);
  });

  it("accepts all valid relations", () => {
    const relations = ["self", "spouse", "father", "mother", "son", "daughter", "grandfather", "grandmother", "brother", "sister", "other"];
    for (const rel of relations) {
      expect(memberSchema.safeParse({ ...validMember, relation: rel }).success).toBe(true);
    }
  });

  it("accepts all valid blood groups", () => {
    const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    for (const bg of groups) {
      expect(memberSchema.safeParse({ ...validMember, blood_group: bg }).success).toBe(true);
    }
  });
});

describe("Record Schema", () => {
  const validRecord = {
    member_id: "uuid-123",
    type: "prescription" as const,
    title: "Dr. Kumar Prescription",
    tags: [],
  };

  it("accepts valid record data", () => {
    expect(recordSchema.safeParse(validRecord).success).toBe(true);
  });

  it("accepts all record types", () => {
    const types = ["prescription", "lab_report", "vaccination", "bill", "discharge_summary", "other"];
    for (const t of types) {
      expect(recordSchema.safeParse({ ...validRecord, type: t }).success).toBe(true);
    }
  });

  it("rejects empty member_id", () => {
    expect(recordSchema.safeParse({ ...validRecord, member_id: "" }).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(recordSchema.safeParse({ ...validRecord, title: "" }).success).toBe(false);
  });

  it("rejects invalid record type", () => {
    expect(recordSchema.safeParse({ ...validRecord, type: "xray" }).success).toBe(false);
  });

  it("accepts record with optional fields", () => {
    const full = {
      ...validRecord,
      doctor_name: "Dr. Kumar",
      hospital_name: "AIIMS Delhi",
      visit_date: "2026-03-15",
      diagnosis: "Viral fever",
      notes: "Take rest for 3 days",
      tags: ["fever", "viral"],
    };
    expect(recordSchema.safeParse(full).success).toBe(true);
  });
});
