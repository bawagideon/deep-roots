-- =============================================================================
-- DEEP ROOTS: PRODUCTION POSTGRESQL SCHEMA (SUPABASE)
-- Version: 3.0 (Clerk Identity, Hardened Quotas, Privileged Field Protection)
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. APP SETTINGS & EMERGENCY OPERATIONS (Kill switches, model configs)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now()
);

-- Seed default settings
insert into public.app_settings (key, value)
values
    ('scan_kill_switch', 'false'::jsonb),
    ('maintenance_mode', 'false'::jsonb),
    ('free_scan_limit', '5'::jsonb),
    ('pro_scan_limit', '50'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. USER PROFILES (Clerk user ID as primary key text)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id text primary key, -- Clerk User ID (e.g. 'user_2...')
    display_name text default 'Explorer',
    avatar_url text,
    email text,
    plan text not null default 'free' check (plan in ('free', 'pro')),
    role text not null default 'user' check (role in ('user', 'admin', 'moderator')),
    preferences jsonb not null default '{
        "lenses": ["language", "culture", "tech"],
        "depth": "standard",
        "tone": "playful",
        "language": "English",
        "openTo": "home",
        "timezone": "UTC",
        "notifications": {
            "dailyRoot": {"enabled": true, "time": "08:00"},
            "streakReminder": true,
            "weeklyRecap": true,
            "quietHours": {"from": "22:00", "to": "07:00"}
        },
        "privacy": {
            "imageRetentionDays": 0,
            "shareDefault": "off",
            "analytics": true
        }
    }'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Protect sensitive columns (plan, role) from client-side privilege escalation
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    -- Disallow non-service_role callers from mutating plan or role
    if current_user <> 'service_role' and (current_setting('request.jwt.claim.role', true) is distinct from 'service_role') then
        if (OLD.plan is distinct from NEW.plan) then
            raise exception 'Unauthorized: Modifying subscription plan requires server billing webhook authority.';
        end if;
        if (OLD.role is distinct from NEW.role) then
            raise exception 'Unauthorized: Modifying administrative role requires server admin authority.';
        end if;
    end if;
    NEW.updated_at = now();
    return NEW;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_fields on public.profiles;
create trigger trg_protect_profile_privileged_fields
    before update on public.profiles
    for each row
    execute function public.protect_profile_privileged_fields();

-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS & BILLING EVENTS
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
    user_id text primary key references public.profiles(id) on delete cascade,
    provider text not null default 'paystack', -- 'paystack' | 'stripe' | 'lemonsqueezy'
    provider_customer_id text,
    provider_subscription_id text,
    plan text not null default 'pro',
    status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    updated_at timestamptz default now()
);

create table if not exists public.billing_events (
    provider_event_id text primary key,
    provider text not null,
    event_type text not null,
    payload jsonb not null,
    processed_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 4. ROOTS (Cards & Discoveries)
-- -----------------------------------------------------------------------------
create table if not exists public.roots (
    id text primary key,
    user_id text references public.profiles(id) on delete cascade,
    parent_id text references public.roots(id) on delete set null,
    depth integer not null default 0,
    input_kind text not null check (input_kind in ('photo', 'screenshot', 'text', 'question', 'link')),
    title text not null,
    input_text text,
    image_url text,
    card jsonb not null,
    visual jsonb,
    prompt_version text default 'v3.0',
    model text,
    status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
    created_at timestamptz default now()
);

create index if not exists idx_roots_user_id on public.roots(user_id);
create index if not exists idx_roots_parent_id on public.roots(parent_id);
create index if not exists idx_roots_created_at on public.roots(created_at desc);

-- -----------------------------------------------------------------------------
-- 5. CLAIMS & VERIFIED SOURCES (Evidence Grounding)
-- -----------------------------------------------------------------------------
create table if not exists public.claims (
    id text primary key,
    root_id text not null references public.roots(id) on delete cascade,
    local_id text not null, -- e.g. 'c1'
    text text not null,
    claim_type text not null default 'fact' check (claim_type in ('fact', 'interpretation', 'open_question')),
    evidence_status text not null default 'unverified' check (evidence_status in ('supported', 'contradicted', 'insufficient', 'unverified')),
    created_at timestamptz default now()
);

create index if not exists idx_claims_root_id on public.claims(root_id);

create table if not exists public.claim_sources (
    id uuid primary key default gen_random_uuid(),
    claim_id text not null references public.claims(id) on delete cascade,
    title text not null,
    url text not null,
    retrieved_at timestamptz default now(),
    excerpt text
);

create index if not exists idx_claim_sources_claim_id on public.claim_sources(claim_id);

-- -----------------------------------------------------------------------------
-- 6. KNOWLEDGE GRAPH EDGES
-- -----------------------------------------------------------------------------
create table if not exists public.edges (
    id text primary key,
    user_id text references public.profiles(id) on delete cascade,
    from_root text not null references public.roots(id) on delete cascade,
    to_root text not null references public.roots(id) on delete cascade,
    type text not null check (type in ('parent', 'shared_concept', 'cause', 'contrast', 'unexpected', 'flows', 'becomes', 'contains')),
    why text not null,
    limits text,
    created_by text default 'ai',
    created_at timestamptz default now()
);

create index if not exists idx_edges_user_id on public.edges(user_id);
create index if not exists idx_edges_from_root on public.edges(from_root);
create index if not exists idx_edges_to_root on public.edges(to_root);

-- -----------------------------------------------------------------------------
-- 7. USAGE & ATOMIC QUOTA
-- -----------------------------------------------------------------------------
create table if not exists public.usage (
    user_id text not null,
    day date not null default current_date,
    kind text not null default 'scan',
    count integer not null default 1,
    primary key (user_id, day, kind)
);

-- Atomic quota function: reserves a slot if count < limit with transactional row locking
create or replace function public.atomic_reserve_quota(
    p_user_id text,
    p_day date,
    p_kind text,
    p_limit integer
)
returns table (
    allowed boolean,
    new_count integer,
    remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_current integer;
begin
    -- Check and lock row for update
    select count into v_current
    from public.usage
    where user_id = p_user_id and day = p_day and kind = p_kind
    for update;

    if not found then
        -- First usage of the day
        if p_limit > 0 then
            insert into public.usage (user_id, day, kind, count)
            values (p_user_id, p_day, p_kind, 1);
            return query select true, 1, p_limit - 1;
        else
            return query select false, 0, 0;
        end if;
    else
        -- Check limit
        if v_current < p_limit then
            update public.usage
            set count = v_current + 1
            where user_id = p_user_id and day = p_day and kind = p_kind;
            return query select true, v_current + 1, p_limit - (v_current + 1);
        else
            return query select false, v_current, 0;
        end if;
    end if;
end;
$$;

-- Refund quota if model execution failed
create or replace function public.refund_quota(
    p_user_id text,
    p_day date,
    p_kind text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    update public.usage
    set count = greatest(0, count - 1)
    where user_id = p_user_id and day = p_day and kind = p_kind;
end;
$$;

-- Restrict execution grants on SECURITY DEFINER functions to server role
revoke execute on function public.atomic_reserve_quota(text, date, text, integer) from public, anon, authenticated;
grant execute on function public.atomic_reserve_quota(text, date, text, integer) to service_role;

revoke execute on function public.refund_quota(text, date, text) from public, anon, authenticated;
grant execute on function public.refund_quota(text, date, text) to service_role;

-- -----------------------------------------------------------------------------
-- 8. OBSERVABILITY & RUN LOGS
-- -----------------------------------------------------------------------------
create table if not exists public.analysis_runs (
    id uuid primary key default gen_random_uuid(),
    user_id text,
    root_id text,
    job text not null, -- 'scan', 'deepen', 'evidence', 'visual', 'link'
    provider text not null,
    model text not null,
    latency_ms integer not null,
    status text not null check (status in ('success', 'failure', 'retry')),
    error_code text,
    est_cost_usd numeric(8, 6),
    created_at timestamptz default now()
);

create index if not exists idx_analysis_runs_job on public.analysis_runs(job);
create index if not exists idx_analysis_runs_created_at on public.analysis_runs(created_at desc);

-- -----------------------------------------------------------------------------
-- 9. MISTAKE REPORTS (User Feedback Loop)
-- -----------------------------------------------------------------------------
create table if not exists public.mistake_reports (
    id text primary key,
    user_id text,
    root_id text,
    claim_id text not null,
    claim_text text,
    reason text not null,
    status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 10. VISUAL SPEC CACHE
-- -----------------------------------------------------------------------------
create table if not exists public.visual_assets (
    cache_key text primary key,
    spec jsonb not null,
    archetype text not null,
    hits integer not null default 1,
    created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 11. PUBLIC SHARES
-- -----------------------------------------------------------------------------
create table if not exists public.shares (
    token text primary key,
    snapshot jsonb not null,
    created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) - Idempotent
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.roots enable row level security;
alter table public.claims enable row level security;
alter table public.claim_sources enable row level security;
alter table public.edges enable row level security;
alter table public.usage enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.mistake_reports enable row level security;
alter table public.visual_assets enable row level security;
alter table public.shares enable row level security;
alter table public.app_settings enable row level security;

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
    for select using (auth.jwt()->>'sub' = id or auth.uid()::text = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
    for update using (auth.jwt()->>'sub' = id or auth.uid()::text = id);

-- Subscriptions: view own subscription only
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription" on public.subscriptions
    for select using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id);

-- Roots
drop policy if exists "Users can view own roots" on public.roots;
create policy "Users can view own roots" on public.roots
    for select using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id or user_id is null);

drop policy if exists "Users can insert own roots" on public.roots;
create policy "Users can insert own roots" on public.roots
    for insert with check (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id or user_id is null);

drop policy if exists "Users can update own roots" on public.roots;
create policy "Users can update own roots" on public.roots
    for update using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id);

drop policy if exists "Users can delete own roots" on public.roots;
create policy "Users can delete own roots" on public.roots
    for delete using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id);

-- Edges
drop policy if exists "Users can view own edges" on public.edges;
create policy "Users can view own edges" on public.edges
    for select using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id or user_id is null);

drop policy if exists "Users can insert own edges" on public.edges;
create policy "Users can insert own edges" on public.edges
    for insert with check (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id or user_id is null);

drop policy if exists "Users can delete own edges" on public.edges;
create policy "Users can delete own edges" on public.edges
    for delete using (auth.jwt()->>'sub' = user_id or auth.uid()::text = user_id);

-- Claims & sources
drop policy if exists "Claims readable with root" on public.claims;
create policy "Claims readable with root" on public.claims
    for select using (true);

drop policy if exists "Claim sources readable" on public.claim_sources;
create policy "Claim sources readable" on public.claim_sources
    for select using (true);

-- Shares
drop policy if exists "Public shares readable by token" on public.shares;
create policy "Public shares readable by token" on public.shares
    for select using (true);

-- Visual assets
drop policy if exists "Visual assets cache readable" on public.visual_assets;
create policy "Visual assets cache readable" on public.visual_assets
    for select using (true);

-- Mistake reports
drop policy if exists "Anyone can submit mistake reports" on public.mistake_reports;
create policy "Anyone can submit mistake reports" on public.mistake_reports
    for insert with check (true);

drop policy if exists "Admins can view mistake reports" on public.mistake_reports;
create policy "Admins can view mistake reports" on public.mistake_reports
    for select using (
        exists (
            select 1 from public.profiles
            where id = coalesce(auth.jwt()->>'sub', auth.uid()::text) and role in ('admin', 'moderator')
        )
    );

-- App Settings
drop policy if exists "Public can read kill switch setting" on public.app_settings;
create policy "Public can read kill switch setting" on public.app_settings
    for select using (key in ('scan_kill_switch', 'maintenance_mode'));

drop policy if exists "Admins can manage settings" on public.app_settings;
create policy "Admins can manage settings" on public.app_settings
    for all using (
        exists (
            select 1 from public.profiles
            where id = coalesce(auth.jwt()->>'sub', auth.uid()::text) and role = 'admin'
        )
    );
