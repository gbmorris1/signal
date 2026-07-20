-- One-shot verification kick for the newly scheduled resolver.
--
-- Scheduling the job proves it exists; it does not prove the URL and the
-- recovered `x-cron-secret` actually authenticate. Rather than wait for 03:17
-- UTC to discover a 401, fire the same request once immediately and read the
-- result from net._http_response / the edge function logs.
--
-- Safe to run at any time: resolve-predictions only writes outcomes for markets
-- that have decisively settled, and re-running scores nothing twice.

do $$
declare
  v_secret text;
begin
  select substring(command from '"x-cron-secret"\s*:\s*"([^"]+)"')
    into v_secret
    from cron.job
   where jobname = 'resolve-predictions';

  if v_secret is null then
    raise exception 'resolve-predictions job not found';
  end if;

  perform net.http_post(
    url := 'https://aanhvekseyfsecezxgne.supabase.co/functions/v1/resolve-predictions',
    headers := json_build_object('x-cron-secret', v_secret)::jsonb
  );
end
$$;
