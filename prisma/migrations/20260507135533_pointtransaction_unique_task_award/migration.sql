-- Idempotent task-completion awards: prevent the same task from
-- crediting the same profile more than once. PostgreSQL unique
-- indexes treat NULLs as distinct by default, so this constraint
-- does not affect manual / bonus / streak awards (which leave
-- taskId NULL).
CREATE UNIQUE INDEX "PointTransaction_profileId_taskId_reason_key"
  ON "PointTransaction" ("profileId", "taskId", "reason");
