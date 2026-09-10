-- Down migration for 20260910153535_pipeline_probe.sql
--
-- Reverses the pipeline probe completely (task 8.10). Dropping the schema with
-- CASCADE removes the probe table and its marker rows. IF EXISTS keeps the
-- rollback idempotent so it can be run more than once without error.

drop schema if exists _pipeline_probe cascade;
