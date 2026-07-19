-- =====================================================================================
-- 0008: W3TR TOKEN PURCHASES (Paystack)
-- =====================================================================================
-- Lets a student top up their W3TR balance with real money via Paystack, for cases
-- where they want a premium course but don't have enough W3TR yet. This is separate
-- from — and does not replace — earning W3TR through genuine learning activity.
--
-- IMPORTANT: This does NOT make W3TR a cryptocurrency, security, or tradable asset.
-- It remains exactly what it already was — an off-chain, in-app ledger balance (see
-- lib/reward-engine.ts) — just with an additional way to increase that balance
-- besides earning it. See the required disclaimer surfaced throughout the purchase
-- UI and in the Terms of Service.
-- =====================================================================================

do $$ begin
  alter type w3tr_transaction_type add value if not exists 'token_purchase';
exception when duplicate_object then null; end $$;

create table if not exists public.w3tr_purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  bundle_key text not null,
  w3tr_amount int not null check (w3tr_amount > 0),
  amount_naira numeric(12,2) not null check (amount_naira > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  provider_reference text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_w3tr_purchases_profile on public.w3tr_purchases(profile_id);
create index if not exists idx_w3tr_purchases_reference on public.w3tr_purchases(provider_reference);

alter table public.w3tr_purchases enable row level security;

drop policy if exists "w3tr_purchases_select_own" on public.w3tr_purchases;
create policy "w3tr_purchases_select_own" on public.w3tr_purchases for select
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "w3tr_purchases_insert_own" on public.w3tr_purchases;
create policy "w3tr_purchases_insert_own" on public.w3tr_purchases for insert
  with check (profile_id = auth.uid());

commit;