-- =============================================================================
-- DEEP ROOTS: PRODUCTION POSTGRESQL SCHEMA (SUPABASE)
-- Version: 2.0 (Beta & Visual Discovery Engine)
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
-- 2. USER PROFILES
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text default 'Explorer',
    avatar_url text,
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

-- -----------------------------------------------------------------------------
-- 3. ROOTS (Cards & Discoveries)
-- -----------------------------------------------------------------------------
create table if not exists public.roots (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade,
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
-- 4. CLAIMS & VERIFIED SOURCES (Evidence Grounding)
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
-- 5. KNOWLEDGE GRAPH EDGES
-- -----------------------------------------------------------------------------
create table if not exists public.edges (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade,
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
-- 6. USAGE & ATOMIC QUOTA
-- -----------------------------------------------------------------------------
create table if not exists public.usage (
    user_id text not null,
    day date not null default current_date,
    kind text not null default 'scan',
    count integer not null default 1,
    primary key (user_id, day, kind)
);

-- Atomic quota function: reserves a slot if count < limit, otherwise returns false
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
as $$
declare
    v_current integer;
begin
    -- Check if record exists
    select count into v_current
    from public.usage
    where user_id = p_user_id and day = p_day and kind = p_kind
    for update;

    if not found then
        -- First scan of the day
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
as $$
begin
    update public.usage
    set count = greatest(0, count - 1)
    where user_id = p_user_id and day = p_day and kind = p_kind;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. OBSERVABILITY & RUN LOGS
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
-- 8. MISTAKE REPORTS (User Feedback Loop)
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
-- 9. VISUAL SPEC CACHE
-- -----------------------------------------------------------------------------
create table if not exists public.visual_assets (
    cache_key text primary key,
    spec jsonb not null,
    archetype text not null,
    hits integer not null default 1,
    created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 10. PUBLIC SHARES
-- -----------------------------------------------------------------------------
create table if not exists public.shares (
    token text primary key,
    snapshot jsonb not null,
    created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
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

-- Profiles: Users can read and update their own profile
create policy "Users can view own profile" on public.profiles
    for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
    for update using (auth.uid() = id);

-- Roots: Users can view and manage their own roots
create policy "Users can view own roots" on public.roots
    for select using (auth.uid() = user_id or user_id is null);

create policy "Users can insert own roots" on public.roots
    for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users can update own roots" on public.roots
    for update using (auth.uid() = user_id);

create policy "Users can delete own roots" on public.roots
    for delete using (auth.uid() = user_id);

-- Edges: Users can view and manage own edges
create policy "Users can view own edges" on public.edges
    for select using (auth.uid() = user_id or user_id is null);

create policy "Users can insert own edges" on public.edges
    for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users can delete own edges" on public.edges
    for delete using (auth.uid() = user_id);

-- Claims & sources: readable by anyone with root access
create policy "Claims readable with root" on public.claims
    for select using (true);

create policy "Claim sources readable" on public.claim_sources
    for select using (true);

-- Shares: read-only by token
create policy "Public shares readable by token" on public.shares
    for select using (true);

-- Visual assets: readable by all
create policy "Visual assets cache readable" on public.visual_assets
    for select using (true);

-- Mistake reports: insertable by anyone, readable by admins
create policy "Anyone can submit mistake reports" on public.mistake_reports
    for insert with check (true);

create policy "Admins can view mistake reports" on public.mistake_reports
    for select using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'moderator')
        )
    );

-- App Settings: readable by service role / admins, readable by public for kill switch
create policy "Public can read kill switch setting" on public.app_settings
    for select using (key in ('scan_kill_switch', 'maintenance_mode'));

create policy "Admins can manage settings" on public.app_settings
    for all using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- -----------------------------------------------------------------------------
-- 12. AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Explorer'),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
