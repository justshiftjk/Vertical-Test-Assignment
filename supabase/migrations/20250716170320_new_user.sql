create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profile (id,  email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger that calls the function after a new auth user is inserted
create or replace trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();