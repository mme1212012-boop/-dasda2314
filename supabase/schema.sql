create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null
    check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  attachments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attachments) = 'array'),
  reply_to jsonb,
  created_at timestamptz not null default now(),
  unique (id, conversation_id),
  check (char_length(btrim(body)) > 0 or jsonb_array_length(attachments) > 0)
);

create table if not exists public.message_reactions (
  message_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  foreign key (message_id, conversation_id)
    references public.messages (id, conversation_id) on delete cascade
);
alter table public.message_reactions replica identity full;

create or replace function public.validate_message_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment jsonb;
  attachment_path text;
  attachment_size bigint;
begin
  for attachment in
    select value from jsonb_array_elements(new.attachments)
  loop
    if jsonb_typeof(attachment) is distinct from 'object'
      or jsonb_typeof(attachment -> 'size') is distinct from 'number'
      or nullif(attachment ->> 'name', '') is null then
      raise exception 'Invalid attachment metadata.';
    end if;
    attachment_path := attachment ->> 'path';
    attachment_size := (attachment ->> 'size')::bigint;
    if attachment_size < 0 or attachment_size > 10485760
      or attachment_path !~ (
        '^' || new.conversation_id::text || '/' ||
        new.sender_id::text || '/[^/]+$'
      )
      or not exists (
        select 1
        from storage.objects object
        where object.bucket_id = 'chat-attachments'
          and object.name = attachment_path
      ) then
      raise exception 'Attachment is missing or does not belong to this message.';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.validate_message_attachments() from public;

create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id, conversation_id);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists message_reactions_conversation_idx
  on public.message_reactions (conversation_id, message_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'user_' || left(new.id::text, 8)
  ));
  requested_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    requested_username
  );
  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists validate_message_attachments on public.messages;
create trigger validate_message_attachments
  before insert on public.messages
  for each row execute procedure public.validate_message_attachments();

insert into public.profiles (id, username, display_name)
select users.id,
  case
    when lower(coalesce(users.raw_user_meta_data ->> 'username', ''))
      ~ '^[a-z0-9_]{3,24}$'
      and not exists (
        select 1 from public.profiles profile
        where profile.username = lower(users.raw_user_meta_data ->> 'username')
      )
    then lower(users.raw_user_meta_data ->> 'username')
    else 'user_' || left(users.id::text, 8)
  end,
  left(coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    'user_' || left(users.id::text, 8)
  ), 60)
from auth.users users
where not exists (
  select 1 from public.profiles profile where profile.id = users.id
)
on conflict (id) do nothing;

create or replace function private.is_conversation_member(
  target_conversation uuid,
  target_user uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation
      and user_id = target_user
  );
$$;

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  peer_id uuid,
  peer_username text,
  peer_display_name text,
  last_message_body text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select mine.conversation_id,
    peer.id,
    peer.username,
    peer.display_name,
    latest.body,
    latest.created_at
  from public.conversation_members mine
  join public.conversation_members other
    on other.conversation_id = mine.conversation_id
    and other.user_id <> auth.uid()
  join public.profiles peer on peer.id = other.user_id
  left join lateral (
    select message.body, message.created_at
    from public.messages message
    where message.conversation_id = mine.conversation_id
    order by message.created_at desc
    limit 1
  ) latest on true
  where mine.user_id = auth.uid()
  order by coalesce(latest.created_at, now()) desc;
$$;

create or replace function public.create_direct_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_conversation uuid;
  new_conversation uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if target_user is null or target_user = auth.uid() then
    raise exception 'Choose another user.';
  end if;
  if not exists (select 1 from public.profiles where id = target_user) then
    raise exception 'User not found.';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(auth.uid()::text, target_user::text) || ':' ||
      greatest(auth.uid()::text, target_user::text),
      0
    )
  );

  select mine.conversation_id into existing_conversation
  from public.conversation_members mine
  join public.conversation_members peer
    on peer.conversation_id = mine.conversation_id
    and peer.user_id = target_user
  where mine.user_id = auth.uid()
    and (
      select count(*)
      from public.conversation_members member
      where member.conversation_id = mine.conversation_id
    ) = 2
  limit 1;

  if existing_conversation is not null then
    return existing_conversation;
  end if;

  insert into public.conversations default values returning id into new_conversation;
  insert into public.conversation_members (conversation_id, user_id)
  values (new_conversation, auth.uid()), (new_conversation, target_user);
  return new_conversation;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function private.is_conversation_member(uuid, uuid) from public;
revoke all on function public.get_my_conversations() from public;
revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function private.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.get_my_conversations() to authenticated;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists conversations_read_member on public.conversations;
create policy conversations_read_member on public.conversations
  for select to authenticated
  using (private.is_conversation_member(id, auth.uid()));

drop policy if exists members_read_member on public.conversation_members;
create policy members_read_member on public.conversation_members
  for select to authenticated
  using (private.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages
  for select to authenticated
  using (private.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists messages_send_member on public.messages;
create policy messages_send_member on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and private.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists reactions_read_member on public.message_reactions;
create policy reactions_read_member on public.message_reactions
  for select to authenticated
  using (private.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists reactions_add_self on public.message_reactions;
create policy reactions_add_self on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_conversation_member(conversation_id, auth.uid())
  );
drop policy if exists reactions_remove_self on public.message_reactions;
create policy reactions_remove_self on public.message_reactions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and private.is_conversation_member(conversation_id, auth.uid())
  );

grant select, update on public.profiles to authenticated;
grant select on public.conversations, public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

create or replace function private.uuid_or_null(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;
revoke all on function private.uuid_or_null(text) from public;
grant execute on function private.uuid_or_null(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 10485760)
on conflict (id) do update
set public = false, file_size_limit = 10485760;

drop policy if exists chat_attachments_read_member on storage.objects;
create policy chat_attachments_read_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and private.is_conversation_member(
      private.uuid_or_null((storage.foldername(name))[1]),
      auth.uid()
    )
  );
drop policy if exists chat_attachments_add_member on storage.objects;
create policy chat_attachments_add_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and private.is_conversation_member(
      private.uuid_or_null((storage.foldername(name))[1]),
      auth.uid()
    )
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists chat_attachments_remove_owner on storage.objects;
create policy chat_attachments_remove_owner on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and private.is_conversation_member(
      private.uuid_or_null((storage.foldername(name))[1]),
      auth.uid()
    )
    and (storage.foldername(name))[2] = auth.uid()::text
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.message_reactions';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_members'
  ) then
    execute 'alter publication supabase_realtime add table public.conversation_members';
  end if;
end;
$$;
