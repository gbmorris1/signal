-- Schedule the daily track-record resolver.
--
-- Nothing was resolving before this: `resolve-predictions` was deployed but never
-- scheduled, so `ai_predictions` accumulated forever and the `track_record` view
-- stayed empty. The track record is the product's moat, so every unscheduled day
-- is a day of settled markets that never got scored.
--
-- The cron secret is NOT hard-coded here (this file is committed to a public repo).
-- It is lifted out of the existing sync-markets job's command, which already
-- carries the same `x-cron-secret` header. If that job is ever renamed, this
-- migration fails loudly rather than scheduling a job that 401s silently.

do $$
declare
  v_secret text;
  v_url    text := 'https://aanhvekseyfsecezxgne.supabase.co/functions/v1/resolve-predictions';
begin
  select substring(command from '"x-cron-secret"\s*:\s*"([^"]+)"')
    into v_secret
    from cron.job
   where command like '%x-cron-secret%'
     and jobname is distinct from 'resolve-predictions'
   order by jobid
   limit 1;

  if v_secret is null or v_secret = '' then
    raise exception
      'could not recover the cron secret from an existing cron.job command; '
      'schedule resolve-predictions by hand with the CRON_SECRET value';
  end if;

  -- Idempotent: re-running replaces rather than duplicating the schedule.
  perform cron.unschedule('resolve-predictions')
    where exists (select 1 from cron.job where jobname = 'resolve-predictions');

  perform cron.schedule(
    'resolve-predictions',
    '17 3 * * *',
    format(
      $cmd$select net.http_post(url:=%L, headers:=%L::jsonb)$cmd$,
      v_url,
      json_build_object('x-cron-secret', v_secret)::text
    )
  );

  if not exists (select 1 from cron.job where jobname = 'resolve-predictions' and active) then
    raise exception 'resolve-predictions was not scheduled';
  end if;
end
$$;
