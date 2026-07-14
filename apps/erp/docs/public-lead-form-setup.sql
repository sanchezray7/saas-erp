-- Formulario público de leads para CRM LATAM
-- RPC público para mostrar nombre de empresa al lead

create or replace function obtener_empresa_por_token(p_token uuid)
returns jsonb
language sql
stable
security definer
as $$
  select jsonb_build_object('name', c.name)
  from webhook_tokens wt
  join companies c on c.id = wt.company_id
  where wt.token = p_token and wt.is_active = true;
$$;
