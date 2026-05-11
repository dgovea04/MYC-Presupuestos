import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function hasPolynomialFormulaDelegate(client: PrismaClient | undefined) {
  if (!client) {
    return false;
  }

  return typeof (client as PrismaClient & { polynomialFormula?: unknown }).polynomialFormula !== "undefined";
}

const existingClient =
  process.env.NODE_ENV !== "production" && hasPolynomialFormulaDelegate(global.prisma)
    ? global.prisma
    : undefined;

export const prisma = existingClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
