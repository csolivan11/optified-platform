-- ─────────────────────────────────────────────────────────────
-- 00021 — Prune Audit Logs Older Than 6 Years (HIPAA Compliance)
-- ─────────────────────────────────────────────────────────────

create or replace function public.prune_expired_audit_logs()
returns void as $$
begin
  delete from public.audit_logs
  where created_at < now() - interval '6 years';
end;
$$ language plpgsql security definer;

-- Trigger logic or cron scheduler placeholder
grant execute on function public.prune_expired_audit_logs() to service_role;
