-- Corrects two things the previous migration surfaced.
--
-- 1) There were TWO sync-markets cron jobs carrying DIFFERENT secrets: `sync-markets`
--    (stale, left over from the Signal→ODDIQ rename) and `oddiq-sync-markets` (live).
--    The stale one has been 401ing every 15 minutes — the function's own `unauthorized`
--    body, which proves its secret no longer matches CRON_SECRET. It is unscheduled here.
--    Its only effect was noise in net._http_response.
--
-- 2) 20260720220000 recovered the cron secret from the OLDEST matching job, which was
--    the stale one, so resolve-predictions was scheduled with a secret that cannot
--    authenticate. It is repointed at the live job's secret.
--
-- Selection is by *proven-live* job now, not by jobid order.

do $$
declare
  v_secret text;
begin
  select substring(command from '"x-cron-secret"\s*:\s*"([^"]+)"')
    into v_secret
    from cron.job
   where jobname = 'oddiq-sync-markets';

  if v_secret is null or v_secret = '' then
    raise exception 'live cron secret not found on job oddiq-sync-markets';
  end if;

  perform cron.unschedule('sync-markets')
    where exists (select 1 from cron.job where jobname = 'sync-markets');

  perform cron.schedule(
    'resolve-predictions',
    '17 3 * * *',
    format(
      $cmd$select net.http_post(url:=%L, headers:=%L::jsonb, timeout_milliseconds:=30000)$cmd$,
      'https://aanhvekseyfsecezxgne.supabase.co/functions/v1/resolve-predictions',
      json_build_object('x-cron-secret', v_secret)::text
    )
  );

  -- Fire once now so the fix is verified against the live function rather than
  -- assumed. Idempotent: only decisively settled markets are ever scored.
  perform net.http_post(
    url := 'https://aanhvekseyfsecezxgne.supabase.co/functions/v1/resolve-predictions',
    headers := json_build_object('x-cron-secret', v_secret)::jsonb,
    timeout_milliseconds := 30000
  );
end
$$;
