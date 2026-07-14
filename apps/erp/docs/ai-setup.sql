-- 5. Actualizar RPC para incluir campos de IA
create or replace function obtener_contacto_con_asignado(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', c.id, 'company_id', c.company_id, 'organization_id', c.organization_id,
    'name', c.name, 'email', c.email, 'phone', c.phone, 'position', c.position,
    'source', c.source, 'notes', c.notes,
    'assigned_to', case when c.assigned_to is not null then jsonb_build_object('id', c.assigned_to, 'email', u.email) else null end,
    'created_at', c.created_at, 'updated_at', c.updated_at, 'last_activity_at', c.last_activity_at,
    'ai_summary', c.ai_summary, 'summary_updated_at', c.summary_updated_at,
    'score', c.score, 'score_reasoning', c.score_reasoning, 'last_scored_at', c.last_scored_at,
    'organization', case when org.id is not null then jsonb_build_object('name', org.name) else null end
  ) into v_result
  from contacts c
  left join auth.users u on u.id = c.assigned_to
  left join organizations org on org.id = c.organization_id
  where c.id = p_contact_id;

  return v_result;
end;
$$;
