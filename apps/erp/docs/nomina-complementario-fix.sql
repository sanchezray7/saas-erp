alter table nomina_periodos
  drop constraint if exists nomina_periodos_company_id_fecha_desde_fecha_hasta_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nomina_periodos_company_id_fecha_desde_fecha_hasta_tipo_key'
  ) then
    alter table nomina_periodos
      add constraint nomina_periodos_company_id_fecha_desde_fecha_hasta_tipo_key
      unique(company_id, fecha_desde, fecha_hasta, tipo);
  end if;
end;
$$;

-- Número Patronal IPS para exportación
alter table nomina_config add column if not exists numero_patronal text not null default '';
