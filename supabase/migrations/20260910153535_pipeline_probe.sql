-- Migration: pipeline_probe
--
-- Purpose: prove the migration pipeline runs forward and rolls back cleanly
-- (Phase 8 gate, task 8.10; R1.19, R1.20, R1.23; P9). This migration introduces
-- NO baseline schema — the baseline tables, RLS, triggers, and RPCs are owned by
-- Phase 9 (see supabase/migrations/.gitkeep). It creates a single self-contained
-- probe object in a dedicated schema so it can be dropped without side effects.
--
-- Reversibility: the paired down script
-- 20260910153535_pipeline_probe.down.sql drops everything this creates.
--
-- Idempotence (P9): all DDL uses IF NOT EXISTS so applying the set twice equals
-- applying it once. Supabase wraps each migration in a single transaction, so a
-- mid-migration failure rolls back entirely and registers no version (R1.20).

create schema if not exists _pipeline_probe;

comment on schema _pipeline_probe is
  'Throwaway schema used only to prove the migration pipeline forward/rollback (task 8.10). Safe to drop. Not part of the Phase 9 baseline schema.';

create table if not exists _pipeline_probe.applied_marker (
  id          integer primary key generated always as identity,
  note        text not null,
  applied_at  timestamptz not null default now()
);

insert into _pipeline_probe.applied_marker (note)
select 'pipeline probe applied'
where not exists (select 1 from _pipeline_probe.applied_marker);
