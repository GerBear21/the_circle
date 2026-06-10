-- ============================================================
-- HRIMS DEMO — organization structure + dummy employees
-- ============================================================
-- Run against the HRIMS DEMO Supabase project (tdlfzjelerzueqtlsspc).
-- Populates the demo with a realistic RTG multi-business-unit
-- structure and dummy employees spread across business units and
-- departments. Idempotent — safe to re-run (matches on code/name/
-- employee_number).
-- ============================================================
DO $$
DECLARE
  v_org uuid := '00000000-0000-0000-0000-0000000000aa'; -- RTG Demo
  v_bu_id uuid;
  v_dept_id uuid;
  v_counter int := 0;
  v_first text;
  v_last text;
  v_firsts text[] := ARRAY['Tendai','Rumbidzai','Farai','Chipo','Tatenda','Nyasha','Kudzai','Rutendo',
                           'Tinashe','Vimbai','Brian','Sharon','Blessing','Privilege','Tafadzwa','Memory',
                           'Simbarashe','Patience','Gift','Anesu','Munashe','Rejoice','Tonderai','Chiedza'];
  v_lasts text[] := ARRAY['Moyo','Ncube','Chikwava','Dube','Sibanda','Mlambo','Marufu','Chitsa',
                          'Mhaka','Gumbo','Banda','Zhou','Madziva','Ngwenya','Mpofu','Chirwa',
                          'Nyoni','Kamba','Muzira','Charamba'];
  v_bus text[][] := ARRAY[
    ['RTH','Rainbow Towers Hotel','hotel'],
    ['AZL','A''Zambezi River Lodge','hotel'],
    ['KAD','Kadoma Hotel & Conference Centre','hotel'],
    ['HRB','Hotel Rainbow Bulawayo','hotel'],
    ['NAH','New Ambassador Hotel','hotel'],
    ['GHO','Group Head Office','head_office']
  ];
  v_depts text[][] := ARRAY[
    ['FIN','Finance'],
    ['FNB','Food & Beverage'],
    ['RMS','Rooms Division'],
    ['ENG','Engineering'],
    ['HR','Human Resources'],
    ['SAM','Sales & Marketing']
  ];
  i int; j int; k int;
BEGIN
  FOR i IN 1 .. array_length(v_bus, 1) LOOP
    SELECT id INTO v_bu_id FROM business_units WHERE organization_id = v_org AND code = v_bus[i][1];
    IF v_bu_id IS NULL THEN
      INSERT INTO business_units (organization_id, name, code, type, is_active, created_at, updated_at)
      VALUES (v_org, v_bus[i][2], v_bus[i][1], v_bus[i][3]::business_unit_type, true, now(), now())
      RETURNING id INTO v_bu_id;
    END IF;

    FOR j IN 1 .. array_length(v_depts, 1) LOOP
      SELECT id INTO v_dept_id FROM departments WHERE business_unit_id = v_bu_id AND name = v_depts[j][2];
      IF v_dept_id IS NULL THEN
        INSERT INTO departments (business_unit_id, name, code, created_at, updated_at)
        VALUES (v_bu_id, v_depts[j][2], v_bus[i][1] || '-' || v_depts[j][1], now(), now())
        RETURNING id INTO v_dept_id;
      END IF;

      -- 3 dummy employees per department (manager, officer, assistant)
      FOR k IN 1 .. 3 LOOP
        v_counter := v_counter + 1;
        v_first := v_firsts[1 + (v_counter * 7) % array_length(v_firsts, 1)];
        v_last := v_lasts[1 + (v_counter * 13) % array_length(v_lasts, 1)];
        INSERT INTO employees (
          organization_id, business_unit_id, department_id,
          employee_number, first_name, last_name, email, job_title,
          employment_status, employment_type, auth_provider, created_at, updated_at
        ) VALUES (
          v_org, v_bu_id, v_dept_id,
          'EMPD' || lpad(v_counter::text, 4, '0'),
          v_first, v_last,
          lower(v_first || '.' || v_last || v_counter || '@rtgdemo.co.zw'),
          v_depts[j][2] || CASE k WHEN 1 THEN ' Manager' WHEN 2 THEN ' Officer' ELSE ' Assistant' END,
          'active'::employment_status,
          (ARRAY['full_time','full_time','full_time','part_time','contract'])[1 + v_counter % 5]::employment_type,
          'azure', now(), now()
        )
        ON CONFLICT (employee_number) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'HRIMS demo seeded: % business units, % departments, ~% dummy employees',
    array_length(v_bus, 1), array_length(v_bus, 1) * array_length(v_depts, 1), v_counter;
END $$;
