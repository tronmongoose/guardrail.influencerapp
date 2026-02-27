-- CreateIndex
CREATE INDEX "Action_sessionId_idx" ON "Action"("sessionId");

-- CreateIndex
CREATE INDEX "Program_creatorId_idx" ON "Program"("creatorId");

-- CreateIndex
CREATE INDEX "Session_weekId_idx" ON "Session"("weekId");
