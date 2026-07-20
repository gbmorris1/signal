-- Track-record integrity fixes.
-- The moat is this number; these four defects all biased or corrupted it.
-- Apply with: supabase db execute -f supabase/migrations/2026-07-20-track-record-integrity.sql
--   (or paste into the SQL editor)

-- 1) Record an explicit verdict. `ai_correct` alone couldn't distinguish
--    "the market was better" from "we agreed with the market".
alter table ai_predictions
  add column if not exists verdict text
  check (verdict in ('beat', 'lost', 'tie'));

-- 2) Backfill verdict for already-scored rows from their Brier scores.
update ai_predictions
set verdict = case
  when abs(ai_brier - market_brier) < 1e-9 then 'tie'
  when ai_brier < market_brier            then 'beat'
  else                                         'lost'
end
where resolved = true
  and verdict is null
  and ai_brier is not null
  and market_brier is not null;

-- 3) Correct ai_correct for rows where a tie had been recorded as a loss.
update ai_predictions
set ai_correct = (verdict = 'beat')
where resolved = true and verdict is not null;

-- 4) Rebuild the view with honest statistics.
create or replace view track_record as
with deduped as (
  -- ONE scored call per market. The same market analysed at several snapshots
  -- produces correlated predictions that all resolve identically; counting them
  -- individually inflates the sample size and weights the headline metric
  -- toward whichever markets happened to be analysed most.
  select distinct on (market_id)
    market_id, ai_brier, market_brier, verdict
  from ai_predictions
  where resolved = true and verdict is not null
  order by market_id, created_at asc
)
select
  count(*)                                                as resolved_predictions,
  -- Ties are PUSHES: excluded from the denominator rather than counted as
  -- losses. Agreeing with the market shows no forecasting skill either way.
  round(
    (count(*) filter (where verdict = 'beat')::numeric
      / nullif(count(*) filter (where verdict in ('beat', 'lost')), 0)) * 100
  , 1)                                                    as beat_market_pct,
  round(avg(market_brier - ai_brier)::numeric, 4)         as brier_edge,
  count(*) filter (where verdict = 'beat')                as beat_count,
  count(*) filter (where verdict = 'lost')                as lost_count,
  count(*) filter (where verdict = 'tie')                 as tie_count
from deduped;

grant select on track_record to anon, authenticated;
