alter table public.import_batches add column if not exists audit jsonb;
alter table public.import_batch_rows add column if not exists parse_confidence int check (parse_confidence between 0 and 100);

create or replace function public.enforce_import_row_selection() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('review','invalid') then new.selected_for_import := false; end if;
  if new.status = 'duplicate' and coalesce(new.duplicate_action,'skip') <> 'import_anyway' then new.selected_for_import := false; end if;
  return new;
end $$;
drop trigger if exists trg_enforce_import_row_selection on public.import_batch_rows;
create trigger trg_enforce_import_row_selection before insert or update on public.import_batch_rows
  for each row execute function public.enforce_import_row_selection();

create or replace function public.block_audited_batch() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'importing' and old.status <> 'importing' and new.audit->>'status' = 'blocked' then
    raise exception 'BATCH_AUDIT_BLOCKED';
  end if;
  return new;
end $$;
drop trigger if exists trg_block_audited_batch on public.import_batches;
create trigger trg_block_audited_batch before update on public.import_batches
  for each row execute function public.block_audited_batch();