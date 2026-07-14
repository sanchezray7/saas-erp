-- RRHH — Control horario (planificado vs real)
-- Ejecutar después de rrhh-turnos-rediseno-setup.sql

create table if not exists control_horario (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  fecha date not null,
  turno_planificado text,
  entrada_planificada time,
  salida_planificada time,
  entrada_real time,
  salida_real time,
  minutos_trabajados integer default 0,
  minutos_atraso integer default 0,
  minutos_salida_temp integer default 0,
  minutos_extra integer default 0,
  minutos_nocturnos integer default 0,
  es_ausente boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, empleado_id, fecha)
);

alter table control_horario add column if not exists es_feriado boolean not null default false;
alter table control_horario add column if not exists motivo_ausencia text;
alter table control_horario add column if not exists minutos_extra_50 integer not null default 0;
alter table control_horario add column if not exists minutos_extra_100 integer not null default 0;
alter table control_horario add column if not exists minutos_extra_130 integer not null default 0;
drop policy if exists "ctrl_horario_select" on control_horario;
create policy "ctrl_horario_select" on control_horario for select using (public.is_member_of(company_id));
drop policy if exists "ctrl_horario_insert" on control_horario;
create policy "ctrl_horario_insert" on control_horario for insert with check (public.is_member_of(company_id));
drop policy if exists "ctrl_horario_delete" on control_horario;
create policy "ctrl_horario_delete" on control_horario for delete using (public.is_member_of(company_id));

-- RPC: calcular control horario para uno o todos los empleados
create or replace function calcular_control_horario(
  p_company_id uuid,
  p_desde date,
  p_hasta date,
  p_empleado_id uuid default null
) returns integer
language plpgsql
security definer
as $$
declare
  v_emp record;
  v_fecha date;
  v_entrada_plan time;
  v_salida_plan time;
  v_turno_cod text;
  v_entrada_real time;
  v_salida_real time;
  v_tolerancia integer := 15;
  v_total integer := 0;
  v_calendario_id uuid;
  v_asistencia record;
  -- métricas
  v_min_trab integer;
  v_min_ats integer;
  v_min_stemp integer;
  v_min_extra integer;
  v_min_extra_50 integer;
  v_min_extra_100 integer;
  v_min_extra_130 integer;
  v_min_noct integer;
  v_ausente boolean;
  v_es_feriado boolean;
  v_feriado_nombre text;
  v_ausencia_motivo text;
  e_min integer; s_min integer; p_e_min integer; p_s_min integer;
  hh integer; v_overlap_start integer; v_overlap_end integer; v_is_sunday boolean;
  v_legal_min integer; v_p_fin_legal integer; v_s_min_norm integer; v_p_fin_legal_norm integer;
begin
  -- Eliminar registros anteriores del período (para evitar basura de cálculos previos)
  delete from control_horario
  where company_id = p_company_id
    and fecha between p_desde and p_hasta
    and (p_empleado_id is null or empleado_id = p_empleado_id);

  for v_emp in
    select e.id as empleado_id
    from empleados e
    where e.company_id = p_company_id
      and e.activo = true
      and (p_empleado_id is null or e.id = p_empleado_id)
  loop
    -- Obtener calendario asignado al empleado
    select er.calendario_id into v_calendario_id
    from empleado_rotacion er
    where er.empleado_id = v_emp.empleado_id;

    -- Iterar por cada fecha del período
    v_fecha := p_desde;
    while v_fecha <= p_hasta loop

      -- Resetear valores
      v_entrada_plan := null;
      v_salida_plan := null;
      v_turno_cod := null;
      v_entrada_real := null;
      v_salida_real := null;
      v_ausente := false;
      v_es_feriado := false;
      v_feriado_nombre := null;
      v_ausencia_motivo := null;
      v_min_trab := 0;
      v_min_ats := 0;
      v_min_stemp := 0;
      v_min_extra := 0;
      v_min_extra_50 := 0;
      v_min_extra_100 := 0;
      v_min_extra_130 := 0;
      v_min_noct := 0;

      -- Buscar turno planificado desde calendario
      if v_calendario_id is not null then
        select t.codigo, t.hora_entrada, t.hora_salida, coalesce(t.tolerancia_min, 15)
        into v_turno_cod, v_entrada_plan, v_salida_plan, v_tolerancia
        from calendario_turnos ct
        left join turnos t on t.id = ct.turno_id
        where ct.calendario_id = v_calendario_id
          and ct.fecha = v_fecha
        limit 1;
      end if;

      -- Fallback a empleado_horarios
      if v_entrada_plan is null then
        select eh.hora_entrada, eh.hora_salida, coalesce(eh.tolerancia_min, 15)
        into v_entrada_plan, v_salida_plan, v_tolerancia
        from empleado_horarios eh
        where eh.empleado_id = v_emp.empleado_id
          and eh.vigencia_hasta is null
        limit 1;
      end if;

      -- Verificar si es feriado
      select nombre into v_feriado_nombre from feriados
      where company_id = p_company_id and fecha = v_fecha;
      v_es_feriado := v_feriado_nombre is not null;

      if v_es_feriado then
        v_turno_cod := 'FER';
        -- El plan se mantiene para calcular nocturnidad y extra relativo al turno
      end if;

      -- Verificar ausencia aprobada (ausencias o vacaciones)
      if not v_es_feriado then
        select at.nombre into v_ausencia_motivo
        from ausencias a
        join ausencia_tipos at on at.id = a.tipo_id
        where a.empleado_id = v_emp.empleado_id
          and a.company_id = p_company_id
          and a.estado = 'aprobado'
          and v_fecha between a.fecha_inicio and a.fecha_fin
        limit 1;

        -- Si no hay ausencia, verificar vacaciones aprobadas
        if v_ausencia_motivo is null then
          select 'Vacaciones' into v_ausencia_motivo
          from vacaciones_solicitudes vs
          where vs.empleado_id = v_emp.empleado_id
            and vs.company_id = p_company_id
            and vs.estado = 'aprobado'
            and v_fecha between vs.fecha_inicio and vs.fecha_fin
          limit 1;
        end if;
      end if;

      -- Buscar asistencia real del día
      select a.hora_entrada, a.hora_salida
      into v_entrada_real, v_salida_real
      from asistencia a
      where a.empleado_id = v_emp.empleado_id
        and a.company_id = p_company_id
        and a.fecha = v_fecha
      limit 1;

      -- Si solo tenemos entrada (nocturno que cruza medianoche), buscar salida al día siguiente
      if v_entrada_real is not null and v_salida_real is null then
        select a2.hora_salida into v_salida_real
        from asistencia a2
        where a2.empleado_id = v_emp.empleado_id
          and a2.company_id = p_company_id
          and a2.fecha = v_fecha + 1
          and a2.hora_entrada is null
          and a2.hora_salida is not null
        limit 1;
      end if;

      -- Si solo tenemos salida, buscar entrada del día anterior
      if v_entrada_real is null and v_salida_real is not null then
        select a2.hora_entrada into v_entrada_real
        from asistencia a2
        where a2.empleado_id = v_emp.empleado_id
          and a2.company_id = p_company_id
          and a2.fecha = v_fecha - 1
          and a2.hora_entrada is not null
          and a2.hora_salida is null
        limit 1;
      end if;
      -- Calcular métricas
      if v_entrada_real is null then
        -- Sin marcación: si tenía turno planificado (y no es feriado), es ausente
        if v_entrada_plan is not null and not v_es_feriado then
          v_ausente := true;
        end if;
      elsif v_es_feriado then
        e_min := extract(hour from v_entrada_real) * 60 + extract(minute from v_entrada_real);
        s_min := extract(hour from v_salida_real) * 60 + extract(minute from v_salida_real);
        v_min_trab := s_min - e_min;
        if v_min_trab < 0 then v_min_trab := v_min_trab + 1440; end if;

        v_min_extra_50 := 0;
        v_min_extra_100 := 0;
        v_min_extra_130 := 0;
        v_min_noct := 0;
        v_min_ats := 0;
        v_min_stemp := 0;

        if v_entrada_plan is not null and v_salida_plan is not null and s_min is not null then
          p_e_min := extract(hour from v_entrada_plan) * 60 + extract(minute from v_entrada_plan);
          p_s_min := extract(hour from v_salida_plan) * 60 + extract(minute from v_salida_plan);

          -- Fin legal según tipo de turno (PY)
          if p_s_min >= p_e_min then
            if p_e_min >= 360 and p_s_min <= 1200 then v_legal_min := 480;
            elsif (p_e_min >= 1200 or p_e_min < 360) and (p_s_min >= 1200 or p_s_min <= 360) then v_legal_min := 420;
            else v_legal_min := 450; end if;
          else
            if p_e_min >= 1200 and p_s_min <= 360 then v_legal_min := 420;
            else v_legal_min := 450; end if;
          end if;
          v_p_fin_legal := p_e_min + v_legal_min;
          if v_p_fin_legal >= 1440 then v_p_fin_legal := v_p_fin_legal - 1440; end if;

          -- Extra relativo al fin legal
          if s_min >= p_e_min and v_p_fin_legal < p_e_min then
            v_min_extra := 0;
          else
            v_s_min_norm := s_min; v_p_fin_legal_norm := v_p_fin_legal;
            if s_min < p_e_min and v_p_fin_legal_norm >= p_e_min then v_s_min_norm := s_min + 1440; end if;
            if v_p_fin_legal_norm < p_e_min and s_min >= p_e_min then v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            if s_min < p_e_min and v_p_fin_legal_norm < p_e_min then v_s_min_norm := s_min + 1440; v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            v_min_extra := greatest(0, v_s_min_norm - v_p_fin_legal_norm);
          end if;

          -- Separar extra por franja (feriado: diurno → 100%, nocturno → 130%)
          for hh in 6..19 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 20..23 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;

          -- Nocturnidad: intersección real ∩ planificado entre 20-06
          v_overlap_start := greatest(e_min, p_e_min);
          v_overlap_end := least(s_min, v_p_fin_legal);
          if v_overlap_start < v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
          elsif v_overlap_start > v_overlap_end then
            -- Cruza medianoche: dos partes
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(1440, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(0, hh*60));
            end loop;
          end if;
        else
          -- Sin plan: todo el tiempo trabajado es extra
          v_min_extra := v_min_trab;
          for hh in 20..23 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 6..19 loop
            v_overlap_start := greatest(e_min, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
        end if;
      else
        e_min := extract(hour from v_entrada_real) * 60 + extract(minute from v_entrada_real);
        s_min := extract(hour from v_salida_real) * 60 + extract(minute from v_salida_real);

        if v_entrada_plan is not null then
          p_e_min := extract(hour from v_entrada_plan) * 60 + extract(minute from v_entrada_plan);
          p_s_min := extract(hour from v_salida_plan) * 60 + extract(minute from v_salida_plan);

          -- Fin legal según tipo de turno (PY)
          if p_s_min >= p_e_min then
            if p_e_min >= 360 and p_s_min <= 1200 then v_legal_min := 480;
            elsif (p_e_min >= 1200 or p_e_min < 360) and (p_s_min >= 1200 or p_s_min <= 360) then v_legal_min := 420;
            else v_legal_min := 450; end if;
          else
            if p_e_min >= 1200 and p_s_min <= 360 then v_legal_min := 420;
            else v_legal_min := 450; end if;
          end if;
          v_p_fin_legal := p_e_min + v_legal_min;
          if v_p_fin_legal >= 1440 then v_p_fin_legal := v_p_fin_legal - 1440; end if;

          -- Minutos trabajados
          v_min_trab := s_min - e_min;
          if v_min_trab < 0 then v_min_trab := v_min_trab + 1440; end if;

          -- Atraso
          v_min_ats := greatest(0, e_min - p_e_min - v_tolerancia);

          -- Salida temprano
          v_min_stemp := greatest(0, p_s_min - s_min);

          -- Hora extra total (contra fin legal PY)
          if s_min >= p_e_min and v_p_fin_legal < p_e_min then
            v_min_extra := 0;
          else
            v_s_min_norm := s_min; v_p_fin_legal_norm := v_p_fin_legal;
            if s_min < p_e_min and v_p_fin_legal_norm >= p_e_min then v_s_min_norm := s_min + 1440; end if;
            if v_p_fin_legal_norm < p_e_min and s_min >= p_e_min then v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            if s_min < p_e_min and v_p_fin_legal_norm < p_e_min then v_s_min_norm := s_min + 1440; v_p_fin_legal_norm := v_p_fin_legal_norm + 1440; end if;
            v_min_extra := greatest(0, v_s_min_norm - v_p_fin_legal_norm);
          end if;
          v_is_sunday := (extract(dow from v_fecha) = 0);

          -- Separar extra por franja horaria
          v_min_extra_50 := 0;
          v_min_extra_100 := 0;
          v_min_extra_130 := 0;
          for hh in 6..19 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              if v_is_sunday then
                v_min_extra_100 := v_min_extra_100 + (v_overlap_end - v_overlap_start);
              else
                v_min_extra_50 := v_min_extra_50 + (v_overlap_end - v_overlap_start);
              end if;
            end if;
          end loop;
          for hh in 20..23 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;
          for hh in 0..5 loop
            v_overlap_start := greatest(v_p_fin_legal, hh*60);
            v_overlap_end := least(s_min, (hh+1)*60);
            if v_overlap_start < v_overlap_end then
              v_min_extra_130 := v_min_extra_130 + (v_overlap_end - v_overlap_start);
            end if;
          end loop;

          -- Nocturnidad: solo en horas no extra (intersección real ∩ planificado) entre 20-06
      v_min_noct := 0;
          v_overlap_start := greatest(e_min, p_e_min);
          v_overlap_end := least(s_min, v_p_fin_legal);
          if v_overlap_start < v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
          elsif v_overlap_start > v_overlap_end then
            for hh in 20..23 loop
              v_min_noct := v_min_noct + greatest(0, least(1440, (hh+1)*60) - greatest(v_overlap_start, hh*60));
            end loop;
            for hh in 0..5 loop
              v_min_noct := v_min_noct + greatest(0, least(v_overlap_end, (hh+1)*60) - greatest(0, hh*60));
            end loop;
          end if;
        end if;
      end if;

      -- Insertar solo si datos completos o ausente declarado
      if v_ausente or (v_entrada_real is not null and v_salida_real is not null) then
        insert into control_horario (company_id, empleado_id, fecha,
            turno_planificado, entrada_planificada, salida_planificada,
            entrada_real, salida_real,
            minutos_trabajados, minutos_atraso, minutos_salida_temp, minutos_extra, minutos_extra_50, minutos_extra_100, minutos_extra_130, minutos_nocturnos, es_ausente, es_feriado, motivo_ausencia)
          values (p_company_id, v_emp.empleado_id, v_fecha,
            v_turno_cod, v_entrada_plan, v_salida_plan,
            v_entrada_real, v_salida_real,
            v_min_trab, v_min_ats, v_min_stemp, v_min_extra, v_min_extra_50, v_min_extra_100, v_min_extra_130, v_min_noct, v_ausente, v_es_feriado, v_ausencia_motivo)
        on conflict (company_id, empleado_id, fecha) do update set
          turno_planificado = excluded.turno_planificado,
          entrada_planificada = excluded.entrada_planificada,
          salida_planificada = excluded.salida_planificada,
          entrada_real = excluded.entrada_real,
          salida_real = excluded.salida_real,
          minutos_trabajados = excluded.minutos_trabajados,
          minutos_atraso = excluded.minutos_atraso,
          minutos_salida_temp = excluded.minutos_salida_temp,
          minutos_extra = excluded.minutos_extra,
          minutos_extra_50 = excluded.minutos_extra_50,
          minutos_extra_100 = excluded.minutos_extra_100,
          minutos_extra_130 = excluded.minutos_extra_130,
          minutos_nocturnos = excluded.minutos_nocturnos,
          es_ausente = excluded.es_ausente,
          es_feriado = excluded.es_feriado,
          motivo_ausencia = excluded.motivo_ausencia;
        v_total := v_total + 1;
      end if;
      v_fecha := v_fecha + 1;
    end loop;
  end loop;

  return v_total;
end;
$$;
