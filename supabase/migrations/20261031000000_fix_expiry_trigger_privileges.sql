create or replace function public.set_item_expiry_date()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.purchase_date is null or new.warranty_months is null then
    new.expiry_date := null;
  else
    new.expiry_date := public.calculate_expiry_date(new.purchase_date, new.warranty_months);
  end if;
  return new;
end;
$$;