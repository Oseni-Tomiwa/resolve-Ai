ALTER TABLE "Organization"
ADD COLUMN "industry" TEXT,
ADD COLUMN "teamSize" TEXT;

CREATE TYPE "OrganizationIndustry" AS ENUM ('SAAS', 'ECOMMERCE', 'FINANCIAL_SERVICES', 'EDUCATION', 'HEALTHCARE', 'PROFESSIONAL_SERVICES', 'OTHER');
CREATE TYPE "OrganizationTeamSize" AS ENUM ('JUST_ME', 'TWO_TO_TEN', 'ELEVEN_TO_FIFTY', 'FIFTY_ONE_TO_TWO_HUNDRED', 'TWO_HUNDRED_PLUS');

ALTER TABLE "Organization"
ALTER COLUMN "industry" TYPE "OrganizationIndustry" USING "industry"::"OrganizationIndustry",
ALTER COLUMN "teamSize" TYPE "OrganizationTeamSize" USING "teamSize"::"OrganizationTeamSize";
