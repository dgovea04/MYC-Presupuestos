-- Cooperative cancellation keeps the worker lease alive until its next checkpoint.
ALTER TYPE "ReviewRunStatus" ADD VALUE IF NOT EXISTS 'CANCEL_REQUESTED' AFTER 'RUNNING';
