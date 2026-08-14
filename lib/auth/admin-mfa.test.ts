import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  createAdminMfaProof,
  generateRecoveryCodes,
  hashRecoveryCode,
  isValidAdminMfaProof,
  verifyTotpCode,
} from "@/lib/auth/admin-mfa";

describe("admin MFA", () => {
  it("verifies a standard TOTP vector within the allowed time window", () => {
    expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "282760", 0)).toBe(true);
    expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "000000", 0)).toBe(false);
  });

  it("builds an authenticator URI without exposing a password or recovery code", () => {
    const uri = buildTotpUri("JBSWY3DPEHPK3PXP", "dgovea04@gmail.com");

    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=MC+Presupuestos");
    expect(uri).not.toContain("password");
  });

  it("generates one-time recovery codes and stores only their hashes", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){2}$/.test(code))).toBe(true);
    expect(hashRecoveryCode(codes[0])).not.toBe(codes[0]);
  });

  it("accepts a signed proof only for its user and its ten-minute lifetime", () => {
    const issuedAt = 1_700_000_000_000;
    const proof = createAdminMfaProof("admin-1", issuedAt);

    expect(isValidAdminMfaProof(proof, "admin-1", issuedAt + 9 * 60 * 1000)).toBe(true);
    expect(isValidAdminMfaProof(proof, "other-admin", issuedAt + 9 * 60 * 1000)).toBe(false);
    expect(isValidAdminMfaProof(proof, "admin-1", issuedAt + 11 * 60 * 1000)).toBe(false);
  });
});
