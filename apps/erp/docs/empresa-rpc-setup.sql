-- RPC para actualizar perfil de empresa (bypass RLS con security definer)

alter table companies add column if not exists payment_terms_days integer not null default 30;

create or replace function actualizar_empresa(p_company_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin boolean;
  v_result jsonb;
begin
  -- Verificar admin
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and role = 'admin'
  ) into v_admin;

  if not v_admin then
    return jsonb_build_object('error', 'No eres administrador de esta empresa', 'user_id', auth.uid());
  end if;

  -- Actualizar
  update companies
  set
    name = coalesce(p_data->>'name', name),
    rif = coalesce(p_data->>'rif', rif),
    pais = coalesce(p_data->>'pais', pais),
    direccion = coalesce(p_data->>'direccion', direccion),
    telefono = coalesce(p_data->>'telefono', telefono),
    email_empresa = coalesce(p_data->>'email_empresa', email_empresa),
    ruc_factura = coalesce(p_data->>'ruc_factura', ruc_factura),
    dv_factura = coalesce(p_data->>'dv_factura', dv_factura),
    timbrado = coalesce(p_data->>'timbrado', timbrado),
    establecimiento = coalesce(p_data->>'establecimiento', establecimiento),
    punto_expedicion = coalesce(p_data->>'punto_expedicion', punto_expedicion),
    csc = coalesce(p_data->>'csc', csc),
    id_csc = coalesce(p_data->>'id_csc', id_csc),
    actividad_economica = coalesce(p_data->>'actividad_economica', actividad_economica),
    des_actividad_economica = coalesce(p_data->>'des_actividad_economica', des_actividad_economica),
    payment_terms_days = coalesce((p_data->>'payment_terms_days')::integer, payment_terms_days)
  where id = p_company_id;

  return jsonb_build_object('ok', true);
end;
$$;
