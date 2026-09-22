-- Migration 001: full schema bootstrap
-- EC2's Postgres was found missing whole tables (sessions included), not just
-- the list_price/profile columns — its docker-entrypoint-initdb.d init only
-- ran once, against an older/empty schema.sql. This file is the current
-- server/sql/schema.sql verbatim: every statement is IF NOT EXISTS, so it
-- creates whatever tables/columns/indexes are missing and leaves existing
-- data untouched. Safe to re-run.

create table if not exists sessions (
  id text primary key,
  device_id text not null,
  visitor_id text,
  language text not null default 'vi',
  status text not null default 'active',
  consents text,
  scores text,
  subtypes text,
  persona text,
  full_name text,
  gender text check (gender in ('male', 'female')),
  age_group text,
  started_at text not null,
  completed_at text
);

create table if not exists answers (
  id bigint generated always as identity primary key,
  session_id text not null,
  core_key text not null,
  payload text not null,
  score integer not null,
  subtype text not null,
  answered_at text not null,
  unique (session_id, core_key)
);

create table if not exists results (
  token text primary key,
  session_id text not null unique,
  persona text not null,
  scores text not null,
  product_ids text,
  coupon_code text,
  expires_at text not null,
  deleted_at text,
  scan_count integer not null default 0,
  download_count integer not null default 0
);

create table if not exists events (
  id bigint generated always as identity primary key,
  session_id text,
  device_id text,
  type text not null,
  payload text,
  ts text not null
);

create table if not exists devices (
  id text primary key,
  name text,
  last_heartbeat text,
  app_version text,
  state text
);

create table if not exists visitors (
  id text primary key,
  visit_count integer not null default 0,
  first_seen_at text not null,
  last_seen_at text not null
);

create table if not exists pairings (
  code text primary key,
  device_id text not null,
  status text not null default 'pending',
  visitor_id text,
  session_id text,
  created_at text not null,
  expires_at text not null,
  claimed_at text
);
create index if not exists idx_pairings_device on pairings (device_id, status);

create table if not exists brands (
  id text primary key,
  name text not null,
  tagline text,
  emoji text,
  logo_url text,
  persona_tags text,
  axis_affinity text,
  sort_order integer not null default 0,
  active smallint not null default 1,
  updated_at text not null
);

create table if not exists brand_products (
  id text primary key,
  brand_id text not null,
  name text not null,
  price text,
  list_price text,
  shop_url text,
  image_url text,
  sort_order integer not null default 0,
  active smallint not null default 1,
  updated_at text not null
);
create index if not exists idx_products_brand on brand_products (brand_id, sort_order);

create table if not exists votes (
  id bigint generated always as identity primary key,
  visitor_id text not null unique,
  session_id text,
  result_token text,
  product_ids text not null,
  voted_at text not null,
  reward_claimed_at text,
  reward_staff text
);

create index if not exists idx_events_type_ts on events (type, ts);
create index if not exists idx_sessions_started on sessions (started_at);

create table if not exists event_registrations (
  id bigint generated always as identity primary key,
  external_id text,
  qr_code text,
  full_name text,
  phone text,
  dob text,
  gender text,
  raw_payload text not null,
  received_at text not null
);
-- Lets the same registration webhook retry/resend safely (upsert on conflict)
-- while still allowing unlimited rows with no external_id at all.
create unique index if not exists idx_event_registrations_external_id
  on event_registrations (external_id) where external_id is not null;

-- Re-running this file against a project that already has `sessions`
-- without the profile columns (e.g. you applied an older copy) adds them:
alter table sessions add column if not exists full_name text;
alter table sessions add column if not exists gender text check (gender in ('male', 'female'));
alter table sessions add column if not exists age_group text;
alter table brand_products add column if not exists list_price text;
