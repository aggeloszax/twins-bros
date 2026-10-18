CREATE TABLE "AdminPasskey" (
  "id" TEXT PRIMARY KEY,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AdminPasskeyChallenge" (
  "id" TEXT PRIMARY KEY,
  "challenge" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "binding" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AdminPasskeyChallenge_expiresAt_idx" ON "AdminPasskeyChallenge"("expiresAt");
CREATE TABLE "AdminUnlock" (
  "tokenHash" TEXT PRIMARY KEY,
  "binding" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AdminUnlock_expiresAt_idx" ON "AdminUnlock"("expiresAt");
ALTER TABLE "AdminPasskey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminPasskeyChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminUnlock" ENABLE ROW LEVEL SECURITY;
