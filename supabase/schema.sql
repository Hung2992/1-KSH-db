-- ZoliGPT Omega Admin Core - initial schema

create table if not exists users (
  id uuid primary key,
  tenant_id uuid not null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('user','analyst','operator','admin','superadmin','founder_root')),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  tenant_id uuid not null,
  actor uuid,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists finance_events (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  amount numeric(14,2) not null,
  currency text not null,
  risk_score int not null check (risk_score between 0 and 100),
  decision text not null check (decision in ('approve','review','block')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists security_events (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  event_type text not null,
  ip inet,
  device text,
  threat_score int not null check (threat_score between 0 and 100),
  action_taken text not null,
  created_at timestamptz not null default now()
);

create table if not exists health_metrics (
  id bigserial primary key,
  tenant_id uuid not null,
  user_id uuid,
  sleep_hours numeric(4,2),
  stress_index int check (stress_index between 0 and 100),
  activity_score int check (activity_score between 0 and 100),
  recovery_score int check (recovery_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists energy_metrics (
  id bigserial primary key,
  tenant_id uuid not null,
  source_id text not null,
  usage_value numeric(14,3) not null,
  peak_flag boolean not null default false,
  anomaly_score int not null check (anomaly_score between 0 and 100),
  optimization_tip text,
  created_at timestamptz not null default now()
);
