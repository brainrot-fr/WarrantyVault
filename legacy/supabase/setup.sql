-- The bills bucket is private. The backend accesses Storage with its service role key and returns short-lived signed URLs after checking household access.
-- No public bucket or anonymous object policy is required.

insert into storage.buckets (id, name, public)
values ('bills', 'bills', false)
on conflict (id) do update set public = false;
