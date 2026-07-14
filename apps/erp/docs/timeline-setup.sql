-- Timeline: trigger para registrar cambios de etapa como actividades
-- Ejecutar en Supabase SQL Editor

-- Función: inserta actividad cuando un deal cambia de etapa
create or replace function log_stage_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_stage_name text;
begin
  if OLD.stage_id is distinct from NEW.stage_id then
    select name into v_stage_name from stages where id = NEW.stage_id;
    insert into activities (company_id, contact_id, deal_id, type, subject, description, created_by, created_at)
    values (
      NEW.company_id,
      NEW.contact_id,
      NEW.id,
      'note',
      'Cambio de etapa',
      'Oportunidad movida a: ' || coalesce(v_stage_name, 'desconocida'),
      NEW.updated_by,
      NEW.updated_at
    );
  end if;
  return NEW;
end;
$$;

-- Trigger sobre deals
drop trigger if exists trg_deals_stage_change on deals;
create trigger trg_deals_stage_change
  after update of stage_id on deals
  for each row
  execute function log_stage_change();

-- Agregar columna updated_by a deals si no existe (para saber quién movió)
alter table deals add column if not exists updated_by uuid references auth.users(id);
