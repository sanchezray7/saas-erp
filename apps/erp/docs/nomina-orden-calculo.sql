-- Orden de cálculo para conceptos de nómina
-- Los conceptos se calculan secuencialmente según orden_calculo
-- Los conceptos con orden_calculo menor se calculan primero y sus valores
-- están disponibles como variables en las fórmulas de los conceptos posteriores

alter table nomina_conceptos add column if not exists orden_calculo integer not null default 0;

-- Actualizar orden de cálculo para conceptos seed PY
update nomina_conceptos set orden_calculo = 1 where codigo = 'SALARIO';
update nomina_conceptos set orden_calculo = 2 where codigo = 'HE50';
update nomina_conceptos set orden_calculo = 3 where codigo = 'HE100';
update nomina_conceptos set orden_calculo = 4 where codigo = 'HE130';
update nomina_conceptos set orden_calculo = 5 where codigo = 'NOCTURNIDAD';
update nomina_conceptos set orden_calculo = 6 where codigo = 'VACACIONES';
update nomina_conceptos set orden_calculo = 7 where codigo = 'AGUINALDO';
update nomina_conceptos set orden_calculo = 10 where codigo = 'AUSENCIA';
update nomina_conceptos set orden_calculo = 15 where codigo = 'ADELANTO_QUINCENAL';
update nomina_conceptos set orden_calculo = 16 where codigo = 'ADELANTO_PAGADO';
update nomina_conceptos set orden_calculo = 17 where codigo = 'DESCUENTO_ADELANTO';
update nomina_conceptos set orden_calculo = 20 where codigo = 'BASE_IPS';
update nomina_conceptos set orden_calculo = 21 where codigo = 'BASE_IRP';
update nomina_conceptos set orden_calculo = 30 where codigo = 'IPS';
update nomina_conceptos set orden_calculo = 31 where codigo = 'IPS_PATRONAL';
update nomina_conceptos set orden_calculo = 40 where codigo = 'PRORRATEO_AGUINALDO';
