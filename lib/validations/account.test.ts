import { describe, expect, it } from "vitest";

import {
  MAX_AVATAR_SIZE_BYTES,
  accountAvatarUploadSchema,
  accountPasswordSchema,
  accountProfileSchema,
} from "@/lib/validations/account";

describe("account validations", () => {
  it("accepts a valid profile name and trims it", () => {
    expect(accountProfileSchema.parse({ name: "  Maria Calderon  " })).toEqual({
      name: "Maria Calderon",
      phone: "",
      jobTitle: "",
      bio: "",
    });
  });

  it("rejects a blank or too-short profile name", () => {
    expect(() => accountProfileSchema.parse({ name: " " })).toThrow();
    expect(() => accountProfileSchema.parse({ name: "Al" })).toThrow();
  });

  it("accepts optional professional fields and trims them", () => {
    expect(
      accountProfileSchema.parse({
        name: "Maria Calderon",
        phone: " 987654321 ",
        jobTitle: "  Ingeniera Residente ",
        bio: "  Especialista en costos y presupuestos de obra. ",
      }),
    ).toEqual({
      name: "Maria Calderon",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos y presupuestos de obra.",
    });
  });

  it("rejects professional fields that exceed their allowed length", () => {
    expect(() =>
      accountProfileSchema.parse({
        name: "Maria Calderon",
        phone: "9".repeat(41),
        jobTitle: "",
        bio: "",
      }),
    ).toThrow();

    expect(() =>
      accountProfileSchema.parse({
        name: "Maria Calderon",
        phone: "",
        jobTitle: "J".repeat(121),
        bio: "",
      }),
    ).toThrow();

    expect(() =>
      accountProfileSchema.parse({
        name: "Maria Calderon",
        phone: "",
        jobTitle: "",
        bio: "B".repeat(321),
      }),
    ).toThrow();
  });

  it("accepts a valid password change payload", () => {
    expect(
      accountPasswordSchema.parse({
        currentPassword: "clave-actual-123",
        newPassword: "clave-nueva-123",
        confirmPassword: "clave-nueva-123",
      }),
    ).toEqual({
      currentPassword: "clave-actual-123",
      newPassword: "clave-nueva-123",
      confirmPassword: "clave-nueva-123",
    });
  });

  it("rejects a password change when the confirmation does not match", () => {
    expect(() =>
      accountPasswordSchema.parse({
        currentPassword: "clave-actual-123",
        newPassword: "clave-nueva-123",
        confirmPassword: "otra-clave-123",
      }),
    ).toThrow();
  });

  it("rejects avatar files with unsupported content types or excessive size", () => {
    const validAvatar = new File(["avatar"], "avatar.png", { type: "image/png" });
    const invalidTypeAvatar = new File(["avatar"], "avatar.txt", { type: "text/plain" });
    const oversizedAvatar = {
      name: "avatar.jpg",
      size: MAX_AVATAR_SIZE_BYTES + 1,
      type: "image/jpeg",
    };

    expect(accountAvatarUploadSchema.parse({ avatar: validAvatar })).toEqual({
      avatar: validAvatar,
    });
    expect(() => accountAvatarUploadSchema.parse({ avatar: invalidTypeAvatar })).toThrow();
    expect(() => accountAvatarUploadSchema.parse({ avatar: oversizedAvatar })).toThrow();
  });
});
