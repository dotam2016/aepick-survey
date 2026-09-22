-- Migration 001: profile columns on sessions + list_price on brand_products
-- Run this directly on any existing DB that predates these columns
-- (schema.sql already has these same statements — this file lets you apply
-- just the delta without re-running the whole schema.sql). Safe to re-run.

alter table sessions add column if not exists full_name text;
alter table sessions add column if not exists gender text check (gender in ('male', 'female'));
alter table sessions add column if not exists age_group text;
alter table brand_products add column if not exists list_price text;
