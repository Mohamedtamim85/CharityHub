-- CreateEnum
CREATE TYPE "DonationHubVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "DonorRelation" AS ENUM ('TEAM', 'FAMILY', 'CLOSE_FRIEND');

-- CreateEnum
CREATE TYPE "DonationCaseStatus" AS ENUM ('PENDING', 'ACTIVE', 'FUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DonationCaseAudience" AS ENUM ('CHAIN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DonationFundingType" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "DonationCaseCategory" AS ENUM ('FOOD', 'MEDICAL', 'ORPHAN', 'WIDOW', 'ELDERLY', 'DISABILITY', 'EDUCATION', 'HOUSING', 'DEBT', 'MARRIAGE', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "ZakatRecipientCategory" AS ENUM ('FUQARA', 'MASAKIN', 'AMILIN', 'MUALLAF', 'RIQAB', 'GHARIMIN', 'FI_SABILILLAH', 'IBN_SABIL');

-- CreateEnum
CREATE TYPE "DonationKind" AS ENUM ('ZAKAT', 'SADAQAH', 'ZAKAT_AL_FITR', 'UDHIYAH', 'KAFFARAH', 'FIDYAH', 'AQIQAH', 'NADHR', 'WAQF', 'OTHER');

-- CreateEnum
CREATE TYPE "SponsorshipFrequency" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "DonationOccasionType" AS ENUM ('ZAKAT_AL_FITR', 'EID_AL_ADHA', 'RAMADAN', 'AQIQAH', 'KAFFARAH', 'FIDYAH', 'WINTER', 'BACK_TO_SCHOOL', 'ASHURA', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationHub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "DonationHubVisibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationHub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationHubMember" (
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationHubMember_pkey" PRIMARY KEY ("hubId","userId")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "location" TEXT,
    "monthlyAmount" DECIMAL(14,2),
    "preferredMethod" TEXT,
    "notes" TEXT,
    "relation" "DonorRelation" NOT NULL,
    "layer" INTEGER NOT NULL,
    "invitedById" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationCase" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "mobile" TEXT,
    "mobileKey" TEXT,
    "governorate" TEXT,
    "city" TEXT,
    "address" TEXT,
    "gender" TEXT,
    "birthYear" INTEGER,
    "maritalStatus" TEXT,
    "familySize" INTEGER,
    "dependents" INTEGER,
    "monthlyIncome" DECIMAL(14,2),
    "monthlyNeed" DECIMAL(14,2),
    "category" "DonationCaseCategory" NOT NULL DEFAULT 'OTHER',
    "zakatCategory" "ZakatRecipientCategory",
    "story" TEXT,
    "paymentDetails" TEXT,
    "status" "DonationCaseStatus" NOT NULL DEFAULT 'PENDING',
    "audience" "DonationCaseAudience" NOT NULL DEFAULT 'CHAIN',
    "fundingType" "DonationFundingType" NOT NULL DEFAULT 'ONE_TIME',
    "goalAmount" DECIMAL(14,2),
    "periodAmount" DECIMAL(14,2),
    "periodStart" DATE,
    "periodEnd" DATE,
    "validatedByDonorId" TEXT,
    "validatedByUserId" TEXT,
    "validationLayer" INTEGER,
    "validatedAt" TIMESTAMP(3),
    "homeVisit" BOOLEAN NOT NULL DEFAULT false,
    "documentsChecked" BOOLEAN NOT NULL DEFAULT false,
    "nextReviewDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseVisibleDonor" (
    "caseId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,

    CONSTRAINT "CaseVisibleDonor_pkey" PRIMARY KEY ("caseId","donorId")
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" "SponsorshipFrequency" NOT NULL,
    "kind" "DonationKind" NOT NULL DEFAULT 'SADAQAH',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "kind" "DonationKind" NOT NULL DEFAULT 'SADAQAH',
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "sponsorshipId" TEXT,
    "periodKey" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonationOccasion" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "type" "DonationOccasionType" NOT NULL,
    "title" TEXT NOT NULL,
    "hijriYear" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "unitValue" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationOccasion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccasionAllocation" (
    "id" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2),
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccasionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Donor_hubId_idx" ON "Donor"("hubId");

-- CreateIndex
CREATE INDEX "Donor_invitedById_idx" ON "Donor"("invitedById");

-- CreateIndex
CREATE INDEX "Donor_mobile_idx" ON "Donor"("mobile");

-- CreateIndex
CREATE INDEX "DonationCase_hubId_status_idx" ON "DonationCase"("hubId", "status");

-- CreateIndex
CREATE INDEX "DonationCase_nationalId_idx" ON "DonationCase"("nationalId");

-- CreateIndex
CREATE INDEX "DonationCase_mobileKey_idx" ON "DonationCase"("mobileKey");

-- CreateIndex
CREATE INDEX "Sponsorship_caseId_idx" ON "Sponsorship"("caseId");

-- CreateIndex
CREATE INDEX "Sponsorship_donorId_idx" ON "Sponsorship"("donorId");

-- CreateIndex
CREATE INDEX "Donation_caseId_idx" ON "Donation"("caseId");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_sponsorshipId_periodKey_key" ON "Donation"("sponsorshipId", "periodKey");

-- CreateIndex
CREATE INDEX "DonationOccasion_hubId_idx" ON "DonationOccasion"("hubId");

-- CreateIndex
CREATE UNIQUE INDEX "OccasionAllocation_occasionId_caseId_key" ON "OccasionAllocation"("occasionId", "caseId");

-- AddForeignKey
ALTER TABLE "DonationHub" ADD CONSTRAINT "DonationHub_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationHubMember" ADD CONSTRAINT "DonationHubMember_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "DonationHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationHubMember" ADD CONSTRAINT "DonationHubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "DonationHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCase" ADD CONSTRAINT "DonationCase_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "DonationHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCase" ADD CONSTRAINT "DonationCase_validatedByDonorId_fkey" FOREIGN KEY ("validatedByDonorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCase" ADD CONSTRAINT "DonationCase_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationCase" ADD CONSTRAINT "DonationCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVisibleDonor" ADD CONSTRAINT "CaseVisibleDonor_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DonationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVisibleDonor" ADD CONSTRAINT "CaseVisibleDonor_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DonationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DonationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationOccasion" ADD CONSTRAINT "DonationOccasion_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "DonationHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccasionAllocation" ADD CONSTRAINT "OccasionAllocation_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "DonationOccasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccasionAllocation" ADD CONSTRAINT "OccasionAllocation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DonationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccasionAllocation" ADD CONSTRAINT "OccasionAllocation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
