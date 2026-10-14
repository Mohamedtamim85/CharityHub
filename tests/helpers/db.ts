import { PrismaClient } from "@prisma/client";
import { testEnv } from "./test-env";

process.env.DATABASE_URL = testEnv.DATABASE_URL;

export const prisma = new PrismaClient();

export async function closeDb() {
  await prisma.$disconnect();
}
