-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "workMode" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'PLN',
    "technologies" TEXT[],
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobOffer_sourceUrl_key" ON "JobOffer"("sourceUrl");

-- CreateIndex
CREATE INDEX "JobOffer_source_externalId_idx" ON "JobOffer"("source", "externalId");

-- CreateIndex
CREATE INDEX "JobOffer_city_idx" ON "JobOffer"("city");

-- CreateIndex
CREATE INDEX "JobOffer_technologies_idx" ON "JobOffer"("technologies");

-- CreateIndex
CREATE INDEX "JobOffer_salaryMin_salaryMax_idx" ON "JobOffer"("salaryMin", "salaryMax");

-- CreateIndex
CREATE INDEX "JobOffer_publishedAt_idx" ON "JobOffer"("publishedAt");
