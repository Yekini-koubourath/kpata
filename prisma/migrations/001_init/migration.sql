-- KPATA — Migration initiale PostgreSQL / Neon (alignée sur prisma/schema.prisma)

CREATE TYPE "GlobalRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "GroupType" AS ENUM ('FAMILLE', 'FOYER', 'COUPLE', 'COLOCATION', 'AMIS', 'ASSOCIATION', 'ORGANISATION', 'PROFESSIONNEL', 'VOYAGE', 'EVENEMENT', 'COMMUNAUTE', 'AUTRE');
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'ADMIN', 'TREASURER', 'MEMBER', 'OBSERVER');
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');
CREATE TYPE "GroupVisibility" AS ENUM ('PRIVATE', 'LINK', 'PUBLIC');
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');
CREATE TYPE "SplitMethod" AS ENUM ('EQUAL', 'CUSTOM', 'PERCENTAGE', 'WEIGHT', 'PARTICIPATION', 'FIXED');
CREATE TYPE "ExpenseScope" AS ENUM ('COLLECTIVE', 'PARTIAL', 'PERSONAL');
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('RECORDED', 'PARTIAL', 'PAID');
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED');
CREATE TYPE "ContributionPaymentStatus" AS ENUM ('DECLARED', 'CONFIRMED', 'DISPUTED', 'CANCELLED');
CREATE TYPE "SubscriptionPlanCode" AS ENUM ('FREE', 'PREMIUM', 'ORG');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "GlobalRole" NOT NULL DEFAULT 'USER',
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "preferredLang" TEXT NOT NULL DEFAULT 'fr',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "Group" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" "GroupType" NOT NULL DEFAULT 'FAMILLE',
  "description" TEXT,
  "country" TEXT NOT NULL DEFAULT 'BJ',
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Porto-Novo',
  "visibility" "GroupVisibility" NOT NULL DEFAULT 'PRIVATE',
  "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "GroupMember" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "familyRelation" TEXT,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "isExternal" BOOLEAN NOT NULL DEFAULT FALSE,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

CREATE TABLE "GroupInvitation" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "invitedById" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "token" TEXT NOT NULL UNIQUE,
  "code" TEXT NOT NULL UNIQUE,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ExpenseCategory" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT REFERENCES "Group"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "Expense" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amountInt" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "expenseDate" TIMESTAMPTZ NOT NULL,
  "categoryId" TEXT,
  "scope" "ExpenseScope" NOT NULL DEFAULT 'COLLECTIVE',
  "splitMethod" "SplitMethod" NOT NULL DEFAULT 'EQUAL',
  "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'PAID',
  "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
  "isRecurring" BOOLEAN NOT NULL DEFAULT FALSE,
  "recurrenceFreq" TEXT,
  "nextOccurrence" TIMESTAMPTZ,
  "createdByMemberId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "Expense_groupId_expenseDate_idx" ON "Expense"("groupId", "expenseDate");

CREATE TABLE "ExpensePayer" (
  "id" TEXT PRIMARY KEY,
  "expenseId" TEXT NOT NULL REFERENCES "Expense"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "GroupMember"("id"),
  "amountPaidInt" INTEGER NOT NULL
);

CREATE TABLE "ExpenseShare" (
  "id" TEXT PRIMARY KEY,
  "expenseId" TEXT NOT NULL REFERENCES "Expense"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "GroupMember"("id"),
  "shareAmountInt" INTEGER NOT NULL,
  "weightOrPctNum" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "ExpenseComment" (
  "id" TEXT PRIMARY KEY,
  "expenseId" TEXT NOT NULL REFERENCES "Expense"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL,
  "userId" TEXT,
  "content" TEXT NOT NULL,
  "isDispute" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "ContributionPlan" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "objective" TEXT,
  "targetAmountInt" INTEGER NOT NULL,
  "amountPerMemberInt" INTEGER NOT NULL,
  "frequency" TEXT NOT NULL DEFAULT 'ONCE',
  "startDate" TIMESTAMPTZ NOT NULL,
  "dueDate" TIMESTAMPTZ,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Contribution" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL REFERENCES "ContributionPlan"("id") ON DELETE CASCADE,
  "groupId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL REFERENCES "GroupMember"("id"),
  "expectedAmountInt" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EXPECTED'
);

CREATE TABLE "ContributionPayment" (
  "id" TEXT PRIMARY KEY,
  "contributionId" TEXT NOT NULL REFERENCES "Contribution"("id") ON DELETE CASCADE,
  "amountInt" INTEGER NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "status" "ContributionPaymentStatus" NOT NULL DEFAULT 'DECLARED',
  "declaredByUserId" TEXT,
  "confirmedByUserId" TEXT,
  "disputeReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmedAt" TIMESTAMPTZ
);

CREATE TABLE "Settlement" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "fromMemberId" TEXT NOT NULL REFERENCES "GroupMember"("id"),
  "toMemberId" TEXT NOT NULL REFERENCES "GroupMember"("id"),
  "amountInt" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "settlementDate" TIMESTAMPTZ NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "disputeReason" TEXT,
  "declaredByUserId" TEXT,
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmedAt" TIMESTAMPTZ
);

CREATE TABLE "Budget" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "categoryId" TEXT,
  "periodType" TEXT NOT NULL DEFAULT 'MONTHLY',
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  "limitAmountInt" INTEGER NOT NULL,
  "alertThresholdsJson" TEXT NOT NULL DEFAULT '[50,75,90,100]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "SavingsGoal" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "targetAmountInt" INTEGER NOT NULL,
  "deadline" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "groupId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "link" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Subscription" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL UNIQUE REFERENCES "Group"("id") ON DELETE CASCADE,
  "planCode" "SubscriptionPlanCode" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endDate" TIMESTAMPTZ,
  "autoRenew" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerTxId" TEXT UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "amountInt" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "paymentMethod" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rawPayloadJson" TEXT,
  "verifiedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "groupId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "detailsJson" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
