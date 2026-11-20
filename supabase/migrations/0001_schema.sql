-- =====================================================================
-- Entrena con Fede — esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en Supabase → SQL Editor (o `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'student' check (role in ('trainer','student')),
  email       text not null,
  full_name   text not null default '',
  age         int check (age is null or (age between 5 and 120)),
  phone       text,
  trainer_id  uuid references public.profiles(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists profiles_trainer_idx on public.profiles(trainer_id);

-- El primer usuario que se registra es el profesor. El resto son alumnos;
-- el trainer_id lo fija el servidor (app_metadata) al dar de alta al alumno.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_trainer uuid;
begin
  if not exists (select 1 from public.profiles where role = 'trainer') then
    v_role := 'trainer';
  else
    v_role := coalesce(new.raw_app_meta_data->>'role', 'student');
    if v_role not in ('trainer','student') then v_role := 'student'; end if;
  end if;
  v_trainer := nullif(new.raw_app_meta_data->>'trainer_id','')::uuid;
  insert into public.profiles (id, role, email, full_name, trainer_id)
  values (new.id, v_role, new.email,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          case when v_role = 'student' then v_trainer else null end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de permisos (security definer para evitar recursión en RLS)
create or replace function public.is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer');
$$;

create or replace function public.is_trainer_of(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_student and trainer_id = auth.uid()
  ) and public.is_trainer();
$$;

create or replace function public.my_trainer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select trainer_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Catálogo de ejercicios
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  muscle_group  text not null,
  equipment     text not null default '',
  video_url     text,
  cues          text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (name)
);
create index if not exists exercises_group_idx on public.exercises(muscle_group);

-- ---------------------------------------------------------------------
-- Rutinas
-- ---------------------------------------------------------------------
create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  trainer_id  uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name        text not null default 'Rutina',
  goal        text not null default '',
  notes       text not null default '',
  published   boolean not null default false,
  start_date  date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists routines_student_idx on public.routines(student_id);

create table if not exists public.routine_days (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines(id) on delete cascade,
  title        text not null default 'Día',
  day_of_week  int check (day_of_week is null or day_of_week between 1 and 7), -- 1 = lunes
  position     int not null default 0
);
create index if not exists routine_days_routine_idx on public.routine_days(routine_id);

create table if not exists public.routine_exercises (
  id             uuid primary key default gen_random_uuid(),
  day_id         uuid not null references public.routine_days(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id) on delete restrict,
  position       int not null default 0,
  sets           int not null default 3 check (sets between 1 and 12),
  rep_min        int not null default 8 check (rep_min between 1 and 100),
  rep_max        int not null default 12 check (rep_max between 1 and 100),
  target_weight  numeric(6,2),
  rest_seconds   int,
  notes          text not null default '',
  check (rep_max >= rep_min)
);
create index if not exists routine_exercises_day_idx on public.routine_exercises(day_id);

-- Opciones de reemplazo (swap) definidas por el profe
create table if not exists public.routine_exercise_alternatives (
  id                   uuid primary key default gen_random_uuid(),
  routine_exercise_id  uuid not null references public.routine_exercises(id) on delete cascade,
  exercise_id          uuid not null references public.exercises(id) on delete restrict,
  unique (routine_exercise_id, exercise_id)
);

-- ---------------------------------------------------------------------
-- Registro de series
-- ---------------------------------------------------------------------
create table if not exists public.set_logs (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  routine_exercise_id  uuid not null references public.routine_exercises(id) on delete cascade,
  exercise_id          uuid not null references public.exercises(id) on delete restrict, -- ejercicio realmente hecho (puede ser un swap)
  performed_on         date not null default current_date,
  set_number           int not null check (set_number between 1 and 12),
  reps                 int check (reps is null or reps between 0 and 200),
  weight               numeric(6,2) check (weight is null or weight between 0 and 1000),
  created_at           timestamptz not null default now(),
  unique (routine_exercise_id, performed_on, set_number)
);
create index if not exists set_logs_student_idx on public.set_logs(student_id, performed_on);

-- ---------------------------------------------------------------------
-- Mediciones corporales
-- ---------------------------------------------------------------------
create table if not exists public.measurements (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  measured_on  date not null default current_date,
  weight       numeric(5,2),
  waist        numeric(5,1),
  chest        numeric(5,1),
  hips         numeric(5,1),
  arm          numeric(5,1),
  thigh        numeric(5,1),
  body_fat     numeric(4,1),
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  unique (student_id, measured_on)
);

-- ---------------------------------------------------------------------
-- Doble progresión: pedidos de subida de carga
-- ---------------------------------------------------------------------
create table if not exists public.progression_requests (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.profiles(id) on delete cascade,
  routine_exercise_id  uuid not null references public.routine_exercises(id) on delete cascade,
  triggered_on         date not null,
  weight_at            numeric(6,2),
  reps_at              int,
  status               text not null default 'pending' check (status in ('pending','approved','rejected')),
  increment            numeric(5,2),
  new_weight           numeric(6,2),
  trainer_note         text not null default '',
  resolved_at          timestamptz,
  student_seen_at      timestamptz,
  created_at           timestamptz not null default now()
);
create unique index if not exists one_pending_per_exercise
  on public.progression_requests(routine_exercise_id) where status = 'pending';
create index if not exists progression_student_idx on public.progression_requests(student_id, status);

-- Cuando el alumno completa TODAS las series en el tope del rango (con la carga
-- pautada o más), se genera automáticamente un pedido para el profe.
create or replace function public.check_double_progression()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rex     public.routine_exercises%rowtype;
  v_ok    int;
  v_min_w numeric;
  v_min_r int;
begin
  select * into rex from public.routine_exercises where id = new.routine_exercise_id;
  if not found or new.exercise_id <> rex.exercise_id then
    return new; -- los swaps no disparan progresión
  end if;

  select count(*) filter (where reps >= rex.rep_max
                            and weight is not null
                            and weight >= coalesce(rex.target_weight, 0)),
         min(weight), min(reps)
    into v_ok, v_min_w, v_min_r
    from public.set_logs
   where routine_exercise_id = rex.id
     and performed_on = new.performed_on
     and exercise_id = rex.exercise_id
     and set_number <= rex.sets;

  if v_ok >= rex.sets
     and not exists (select 1 from public.progression_requests
                      where routine_exercise_id = rex.id
                        and (status = 'pending' or triggered_on = new.performed_on)) then
    insert into public.progression_requests (student_id, routine_exercise_id, triggered_on, weight_at, reps_at)
    values (new.student_id, rex.id, new.performed_on, v_min_w, v_min_r);
  end if;
  return new;
end $$;

drop trigger if exists set_logs_progression on public.set_logs;
create trigger set_logs_progression
  after insert or update on public.set_logs
  for each row execute function public.check_double_progression();

-- El profe aprueba (con cuánto peso sumar) o rechaza un pedido.
create or replace function public.resolve_progression(
  p_request uuid, p_approve boolean, p_increment numeric default null, p_note text default ''
) returns public.progression_requests
language plpgsql security definer set search_path = public as $$
declare
  req public.progression_requests%rowtype;
  rex public.routine_exercises%rowtype;
  v_new numeric;
begin
  select * into req from public.progression_requests where id = p_request for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if not public.is_trainer_of(req.student_id) then raise exception 'Sin permiso'; end if;
  if req.status <> 'pending' then raise exception 'El pedido ya fue resuelto'; end if;

  if p_approve then
    if p_increment is null or p_increment <= 0 then raise exception 'Indicá cuánto peso sumar'; end if;
    select * into rex from public.routine_exercises where id = req.routine_exercise_id;
    v_new := coalesce(greatest(rex.target_weight, req.weight_at), req.weight_at, 0) + p_increment;
    update public.routine_exercises set target_weight = v_new where id = rex.id;
    update public.progression_requests
       set status = 'approved', increment = p_increment, new_weight = v_new,
           trainer_note = coalesce(p_note,''), resolved_at = now()
     where id = req.id returning * into req;
  else
    update public.progression_requests
       set status = 'rejected', trainer_note = coalesce(p_note,''), resolved_at = now()
     where id = req.id returning * into req;
  end if;
  return req;
end $$;

-- El alumno marca como vistos los avisos (para no repetir el festejo).
create or replace function public.mark_progressions_seen(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.progression_requests
     set student_seen_at = now()
   where id = any(p_ids) and student_id = auth.uid() and status <> 'pending';
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles                        enable row level security;
alter table public.exercises                       enable row level security;
alter table public.routines                        enable row level security;
alter table public.routine_days                    enable row level security;
alter table public.routine_exercises               enable row level security;
alter table public.routine_exercise_alternatives   enable row level security;
alter table public.set_logs                        enable row level security;
alter table public.measurements                    enable row level security;
alter table public.progression_requests            enable row level security;

-- profiles: cada uno se ve a sí mismo; el profe ve a sus alumnos.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or trainer_id = auth.uid()
         or id = public.my_trainer_id());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_trainer_of(id))
  with check (id = auth.uid() or public.is_trainer_of(id));
-- Sólo se pueden tocar datos personales; rol, profe y estado los maneja el servidor.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, age, phone) on public.profiles to authenticated;

-- exercises: todos leen; sólo profes escriben.
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated using (true);
drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises for all to authenticated
  using (public.is_trainer()) with check (public.is_trainer());

-- routines
drop policy if exists routines_trainer on public.routines;
create policy routines_trainer on public.routines for all to authenticated
  using (public.is_trainer_of(student_id))
  with check (public.is_trainer_of(student_id) and trainer_id = auth.uid());
drop policy if exists routines_student on public.routines;
create policy routines_student on public.routines for select to authenticated
  using (student_id = auth.uid() and published);

create or replace function public.can_read_routine(p_routine uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.routines r where r.id = p_routine
                 and ((r.student_id = auth.uid() and r.published) or public.is_trainer_of(r.student_id)));
$$;
create or replace function public.can_write_routine(p_routine uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.routines r where r.id = p_routine and public.is_trainer_of(r.student_id));
$$;

drop policy if exists days_select on public.routine_days;
create policy days_select on public.routine_days for select to authenticated
  using (public.can_read_routine(routine_id));
drop policy if exists days_write on public.routine_days;
create policy days_write on public.routine_days for all to authenticated
  using (public.can_write_routine(routine_id)) with check (public.can_write_routine(routine_id));

drop policy if exists rex_select on public.routine_exercises;
create policy rex_select on public.routine_exercises for select to authenticated
  using (public.can_read_routine((select routine_id from public.routine_days d where d.id = day_id)));
drop policy if exists rex_write on public.routine_exercises;
create policy rex_write on public.routine_exercises for all to authenticated
  using (public.can_write_routine((select routine_id from public.routine_days d where d.id = day_id)))
  with check (public.can_write_routine((select routine_id from public.routine_days d where d.id = day_id)));

drop policy if exists alt_select on public.routine_exercise_alternatives;
create policy alt_select on public.routine_exercise_alternatives for select to authenticated
  using (public.can_read_routine((select d.routine_id from public.routine_exercises re
                                   join public.routine_days d on d.id = re.day_id
                                   where re.id = routine_exercise_id)));
drop policy if exists alt_write on public.routine_exercise_alternatives;
create policy alt_write on public.routine_exercise_alternatives for all to authenticated
  using (public.can_write_routine((select d.routine_id from public.routine_exercises re
                                    join public.routine_days d on d.id = re.day_id
                                    where re.id = routine_exercise_id)))
  with check (public.can_write_routine((select d.routine_id from public.routine_exercises re
                                         join public.routine_days d on d.id = re.day_id
                                         where re.id = routine_exercise_id)));

-- set_logs: el alumno carga lo suyo (sólo sobre su rutina publicada); el profe lee.
drop policy if exists logs_student on public.set_logs;
create policy logs_student on public.set_logs for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid()
              and public.can_read_routine((select d.routine_id from public.routine_exercises re
                                            join public.routine_days d on d.id = re.day_id
                                            where re.id = routine_exercise_id)));
drop policy if exists logs_trainer on public.set_logs;
create policy logs_trainer on public.set_logs for select to authenticated
  using (public.is_trainer_of(student_id));

-- measurements
drop policy if exists meas_student on public.measurements;
create policy meas_student on public.measurements for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists meas_trainer on public.measurements;
create policy meas_trainer on public.measurements for select to authenticated
  using (public.is_trainer_of(student_id));

-- progression_requests: lectura; las escrituras van por las funciones de arriba.
drop policy if exists prog_select on public.progression_requests;
create policy prog_select on public.progression_requests for select to authenticated
  using (student_id = auth.uid() or public.is_trainer_of(student_id));

-- Permisos de la API explícitos (por si el proyecto no los otorga automáticamente).
-- La seguridad fila por fila la siguen dando las políticas RLS de arriba.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on
  public.exercises, public.routines, public.routine_days, public.routine_exercises,
  public.routine_exercise_alternatives, public.set_logs, public.measurements
  to authenticated;
grant select on public.progression_requests to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;

grant execute on function public.resolve_progression(uuid, boolean, numeric, text) to authenticated;
grant execute on function public.mark_progressions_seen(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Carga inicial opcional: si el profe no la pauta, la define el alumno
-- con el peso de su primera sesión de ese ejercicio.
-- ---------------------------------------------------------------------
alter table public.routine_exercises
  add column if not exists target_source text not null default 'trainer'
    check (target_source in ('trainer','student')),
  add column if not exists target_set_on date;

create or replace function public.set_initial_weight()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rex public.routine_exercises%rowtype;
  v_min numeric;
begin
  if new.weight is null then return new; end if;
  select * into rex from public.routine_exercises where id = new.routine_exercise_id;
  if not found or new.exercise_id <> rex.exercise_id then return new; end if; -- los reemplazos no cuentan

  -- Sin carga pautada: la primera sesión del alumno fija la carga inicial.
  -- Mientras siga siendo esa misma sesión, se ajusta al peso más bajo de sus series.
  if rex.target_weight is null
     or (rex.target_source = 'student' and rex.target_set_on = new.performed_on) then
    select min(weight) into v_min from public.set_logs
     where routine_exercise_id = rex.id and performed_on = new.performed_on
       and exercise_id = rex.exercise_id and weight is not null;
    update public.routine_exercises
       set target_weight = v_min, target_source = 'student', target_set_on = new.performed_on
     where id = rex.id;
  end if;
  return new;
end $$;

-- El nombre empieza con "a_" para que corra antes que el control de progresión.
drop trigger if exists set_logs_a_initial_weight on public.set_logs;
create trigger set_logs_a_initial_weight
  after insert or update on public.set_logs
  for each row execute function public.set_initial_weight();

-- ---------------------------------------------------------------------
-- Ficha privada del profe sobre cada alumno (el alumno no la ve)
-- ---------------------------------------------------------------------
create table if not exists public.student_training_info (
  student_id  uuid primary key references public.profiles(id) on delete cascade,
  level       text check (level in ('principiante','intermedio','avanzado')),
  notes       text not null default '',   -- lesiones, experiencia, preferencias
  updated_at  timestamptz not null default now()
);
alter table public.student_training_info enable row level security;
drop policy if exists sti_trainer on public.student_training_info;
create policy sti_trainer on public.student_training_info for all to authenticated
  using (public.is_trainer_of(student_id)) with check (public.is_trainer_of(student_id));
grant select, insert, update, delete on public.student_training_info to authenticated;

-- ---------------------------------------------------------------------
-- Revisiones de rutina hechas con IA (historial para el profe)
-- ---------------------------------------------------------------------
create table if not exists public.routine_reviews (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references public.routines(id) on delete cascade,
  trainer_id   uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  methodology  text not null check (methodology in ('piramide','heavy_duty','ambas')),
  level        text,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists routine_reviews_routine_idx on public.routine_reviews(routine_id, created_at desc);
alter table public.routine_reviews enable row level security;
drop policy if exists reviews_trainer on public.routine_reviews;
create policy reviews_trainer on public.routine_reviews for all to authenticated
  using (public.can_write_routine(routine_id))
  with check (public.can_write_routine(routine_id) and trainer_id = auth.uid());
grant select, insert, delete on public.routine_reviews to authenticated;

-- =====================================================================
-- NUTRICIÓN
-- =====================================================================

-- Datos para el cálculo de calorías (ficha privada del profe)
alter table public.student_training_info
  add column if not exists sex text check (sex in ('M','F')),
  add column if not exists height_cm numeric(5,1) check (height_cm is null or height_cm between 100 and 250),
  add column if not exists activity text check (activity in ('sedentario','ligero','moderado','activo','muy_activo'));

-- Base de alimentos: valores cada 100 g (o 100 ml) y una porción casera opcional
create table if not exists public.foods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  category    text not null,
  kcal        numeric(6,1) not null check (kcal >= 0),
  protein     numeric(5,1) not null check (protein >= 0),
  carbs       numeric(5,1) not null check (carbs >= 0),
  fat         numeric(5,1) not null check (fat >= 0),
  unit_name   text,                 -- p. ej. 'unidad', 'rebanada', 'taza'
  unit_grams  numeric(6,1),         -- gramos que pesa esa porción
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((unit_name is null) = (unit_grams is null))
);
create index if not exists foods_category_idx on public.foods(category);
alter table public.foods enable row level security;
drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods for select to authenticated using (true);
drop policy if exists foods_write on public.foods;
create policy foods_write on public.foods for all to authenticated
  using (public.is_trainer()) with check (public.is_trainer());
grant select, insert, update, delete on public.foods to authenticated;

-- Plan de alimentación
create table if not exists public.diet_plans (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  trainer_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name          text not null default 'Plan de alimentación',
  goal_type     text not null default 'mantenimiento'
                  check (goal_type in ('baja_grasa','recomposicion','mantenimiento','aumento')),
  explanation   text not null default '',   -- lo lee el alumno
  -- Cálculo (foto de los datos usados)
  method        text not null default 'mifflin' check (method in ('mifflin','katch','cunningham')),
  weight_kg     numeric(5,1),
  height_cm     numeric(5,1),
  age           int,
  sex           text check (sex in ('M','F')),
  body_fat      numeric(4,1),
  activity      text check (activity in ('sedentario','ligero','moderado','activo','muy_activo')),
  bmr           int,
  tdee          int,
  adjust_pct    numeric(5,1) not null default 0,
  protein_per_kg numeric(3,1) not null default 2.0,
  fat_per_kg    numeric(3,1) not null default 0.8,
  published     boolean not null default false,
  start_date    date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists diet_plans_student_idx on public.diet_plans(student_id);

-- Días tipo (p. ej. entrenamiento / descanso), cada uno con su objetivo
create table if not exists public.diet_days (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.diet_plans(id) on delete cascade,
  title         text not null default 'Día',
  weekdays      int[] not null default '{}',   -- 1 = lunes … 7 = domingo
  position      int not null default 0,
  target_kcal   int not null default 0,
  target_protein int not null default 0,
  target_carbs  int not null default 0,
  target_fat    int not null default 0
);
create index if not exists diet_days_plan_idx on public.diet_days(plan_id);

create table if not exists public.diet_meals (
  id        uuid primary key default gen_random_uuid(),
  day_id    uuid not null references public.diet_days(id) on delete cascade,
  title     text not null default 'Comida',
  time_hint text,
  notes     text not null default '',
  position  int not null default 0
);
create index if not exists diet_meals_day_idx on public.diet_meals(day_id);

create table if not exists public.diet_meal_items (
  id        uuid primary key default gen_random_uuid(),
  meal_id   uuid not null references public.diet_meals(id) on delete cascade,
  food_id   uuid not null references public.foods(id) on delete restrict,
  grams     numeric(6,1) not null check (grams > 0),
  position  int not null default 0
);
create index if not exists diet_items_meal_idx on public.diet_meal_items(meal_id);

-- Permisos: el profe de ese alumno arma; el alumno ve sólo planes publicados
create or replace function public.can_read_diet(p_plan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diet_plans p where p.id = p_plan
                 and ((p.student_id = auth.uid() and p.published) or public.is_trainer_of(p.student_id)));
$$;
create or replace function public.can_write_diet(p_plan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.diet_plans p where p.id = p_plan and public.is_trainer_of(p.student_id));
$$;
create or replace function public.diet_plan_of_meal(p_meal uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select d.plan_id from public.diet_meals m join public.diet_days d on d.id = m.day_id where m.id = p_meal;
$$;

alter table public.diet_plans      enable row level security;
alter table public.diet_days       enable row level security;
alter table public.diet_meals      enable row level security;
alter table public.diet_meal_items enable row level security;

drop policy if exists diet_plans_trainer on public.diet_plans;
create policy diet_plans_trainer on public.diet_plans for all to authenticated
  using (public.is_trainer_of(student_id))
  with check (public.is_trainer_of(student_id) and trainer_id = auth.uid());
drop policy if exists diet_plans_student on public.diet_plans;
create policy diet_plans_student on public.diet_plans for select to authenticated
  using (student_id = auth.uid() and published);

drop policy if exists diet_days_select on public.diet_days;
create policy diet_days_select on public.diet_days for select to authenticated using (public.can_read_diet(plan_id));
drop policy if exists diet_days_write on public.diet_days;
create policy diet_days_write on public.diet_days for all to authenticated
  using (public.can_write_diet(plan_id)) with check (public.can_write_diet(plan_id));

drop policy if exists diet_meals_select on public.diet_meals;
create policy diet_meals_select on public.diet_meals for select to authenticated
  using (public.can_read_diet((select plan_id from public.diet_days d where d.id = day_id)));
drop policy if exists diet_meals_write on public.diet_meals;
create policy diet_meals_write on public.diet_meals for all to authenticated
  using (public.can_write_diet((select plan_id from public.diet_days d where d.id = day_id)))
  with check (public.can_write_diet((select plan_id from public.diet_days d where d.id = day_id)));

drop policy if exists diet_items_select on public.diet_meal_items;
create policy diet_items_select on public.diet_meal_items for select to authenticated
  using (public.can_read_diet(public.diet_plan_of_meal(meal_id)));
drop policy if exists diet_items_write on public.diet_meal_items;
create policy diet_items_write on public.diet_meal_items for all to authenticated
  using (public.can_write_diet(public.diet_plan_of_meal(meal_id)))
  with check (public.can_write_diet(public.diet_plan_of_meal(meal_id)));

grant select, insert, update, delete on public.diet_plans, public.diet_days, public.diet_meals, public.diet_meal_items to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Diario de comidas del alumno (con o sin plan)
-- ---------------------------------------------------------------------
create table if not exists public.food_logs (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  logged_on     date not null default current_date,
  logged_at     time,                       -- hora aproximada
  meal_label    text,                       -- "Desayuno", "Comida 2", etc.
  plan_meal_id  uuid references public.diet_meals(id) on delete set null, -- si viene de "La comí como estaba"
  food_id       uuid references public.foods(id) on delete set null,
  grams         numeric(6,1),
  name          text not null,              -- nombre del alimento o del agregado rápido
  kcal          numeric(7,1) not null default 0 check (kcal >= 0),
  protein       numeric(6,1) not null default 0 check (protein >= 0),
  carbs         numeric(6,1) not null default 0 check (carbs >= 0),
  fat           numeric(6,1) not null default 0 check (fat >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists food_logs_student_day_idx on public.food_logs(student_id, logged_on);
alter table public.food_logs enable row level security;
drop policy if exists food_logs_student on public.food_logs;
create policy food_logs_student on public.food_logs for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists food_logs_trainer on public.food_logs;
create policy food_logs_trainer on public.food_logs for select to authenticated
  using (public.is_trainer_of(student_id));
grant select, insert, update, delete on public.food_logs to authenticated;

-- ---------------------------------------------------------------------
-- Cierre del día: ¿cumplió el plan? + desvío calculado (le llega al profe)
-- ---------------------------------------------------------------------
create table if not exists public.diet_checkins (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  day             date not null,
  plan_id         uuid references public.diet_plans(id) on delete set null,
  complied        text not null check (complied in ('si','parcial','no')),
  comment         text not null default '',
  target_kcal     int, target_protein int, target_carbs int, target_fat int,
  total_kcal      numeric(7,1) not null default 0,
  total_protein   numeric(6,1) not null default 0,
  total_carbs     numeric(6,1) not null default 0,
  total_fat       numeric(6,1) not null default 0,
  trainer_seen_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, day)
);
create index if not exists diet_checkins_student_idx on public.diet_checkins(student_id, day desc);
alter table public.diet_checkins enable row level security;
drop policy if exists checkins_student on public.diet_checkins;
create policy checkins_student on public.diet_checkins for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists checkins_trainer on public.diet_checkins;
create policy checkins_trainer on public.diet_checkins for select to authenticated
  using (public.is_trainer_of(student_id));
grant select, insert, update, delete on public.diet_checkins to authenticated;

-- Si el alumno vuelve a cerrar el día (cambió algo), el profe lo vuelve a ver como nuevo.
create or replace function public.checkin_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and auth.uid() = new.student_id then new.trainer_seen_at := null; end if;
  return new;
end $$;
drop trigger if exists diet_checkins_touch on public.diet_checkins;
create trigger diet_checkins_touch before update on public.diet_checkins
  for each row execute function public.checkin_touch();

-- El profe marca como vistos los cierres de sus alumnos.
create or replace function public.mark_checkins_seen(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.diet_checkins set trainer_seen_at = now()
   where id = any(p_ids) and public.is_trainer_of(student_id);
$$;
grant execute on function public.mark_checkins_seen(uuid[]) to authenticated;

-- Nuevo marco de revisión: evidencia científica actual
alter table public.routine_reviews drop constraint if exists routine_reviews_methodology_check;
alter table public.routine_reviews add constraint routine_reviews_methodology_check
  check (methodology in ('evidencia','piramide','heavy_duty','ambas'));

-- =====================================================================
-- NOTIFICACIONES PUSH
-- =====================================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Configuración interna (claves de notificaciones). Sólo la lee el servidor.
create table if not exists public.app_config (
  key    text primary key,
  value  text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
grant all on public.app_config to service_role;

-- =====================================================================
-- SESIONES DE ENTRENAMIENTO Y SERIES SALTEADAS
-- =====================================================================
alter table public.set_logs
  add column if not exists skipped boolean not null default false,
  add column if not exists skip_reason text;

create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  routine_id       uuid references public.routines(id) on delete set null,
  day_id           uuid references public.routine_days(id) on delete set null,
  day_title        text not null default '',
  performed_on     date not null default current_date,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  end_reason       text check (end_reason in ('completo','manual','olvidado')),
  total_sets       int not null default 0,
  done_sets        int not null default 0,
  skipped_sets     int not null default 0,
  summary          jsonb not null default '{}'::jsonb,   -- ejercicios salteados / sin cargar
  reminder_sent_at timestamptz,
  trainer_seen_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (student_id, day_id, performed_on)
);
create index if not exists workout_sessions_student_idx on public.workout_sessions(student_id, performed_on desc);
create index if not exists workout_sessions_open_idx on public.workout_sessions(started_at) where ended_at is null;
alter table public.workout_sessions enable row level security;
drop policy if exists sessions_student on public.workout_sessions;
create policy sessions_student on public.workout_sessions for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists sessions_trainer on public.workout_sessions;
create policy sessions_trainer on public.workout_sessions for select to authenticated
  using (public.is_trainer_of(student_id));
grant select, insert, update, delete on public.workout_sessions to authenticated;

create or replace function public.mark_sessions_seen(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.workout_sessions set trainer_seen_at = now()
   where id = any(p_ids) and public.is_trainer_of(student_id);
$$;
grant execute on function public.mark_sessions_seen(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Aviso de "entrenamiento sin finalizar" a la 1,5 h (pg_cron + pg_net).
-- La app guarda su dirección (site_url) la primera vez que alguien activa
-- las notificaciones; el secreto se genera acá y la app lo verifica.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into public.app_config (key, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create or replace function public.notify_stale_sessions()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select value from public.app_config where key = 'site_url');
  v_secret text := (select value from public.app_config where key = 'cron_secret');
  r record;
  n int := 0;
begin
  if v_url is null or v_secret is null then return 0; end if;
  for r in
    select id from public.workout_sessions
     where ended_at is null and reminder_sent_at is null
       and started_at < now() - interval '90 minutes'
       and started_at > now() - interval '24 hours'
     for update skip locked
  loop
    perform net.http_post(
      url := v_url || '/api/cron/stale-session',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('session_id', r.id)
    );
    update public.workout_sessions set reminder_sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.notify_stale_sessions() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'entrenamientos-sin-finalizar';
  perform cron.schedule('entrenamientos-sin-finalizar', '*/5 * * * *', 'select public.notify_stale_sessions()');
end $$;
