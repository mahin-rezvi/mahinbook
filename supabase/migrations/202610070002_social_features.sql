alter table public.likes
  add column reaction text not null default 'like',
  add constraint likes_reaction_valid
    check (reaction in ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'));

create policy "Users update their own reactions"
  on public.likes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy "Addressees accept or decline friend requests" on public.friendships;
create policy "Addressees accept or decline friend requests"
  on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'declined'));

create policy "Users block friendship participants"
  on public.friendships for update to authenticated
  using (
    requester_id = (select auth.uid())
    and status in ('pending', 'accepted')
  )
  with check (
    requester_id = (select auth.uid())
    and status = 'blocked'
  );

create policy "Users remove received requests"
  on public.friendships for delete to authenticated
  using (addressee_id = (select auth.uid()));

create or replace function public.is_friend(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = target_user)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = target_user)
      )
  )
  and not exists (
    select 1 from public.friendships blocked
    where blocked.status = 'blocked'
      and (
        (blocked.requester_id = (select auth.uid()) and blocked.addressee_id = target_user)
        or (blocked.addressee_id = (select auth.uid()) and blocked.requester_id = target_user)
      )
  );
$$;

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_blocked(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'blocked'
      and (
        (f.requester_id = (select auth.uid()) and f.addressee_id = target_user)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = target_user)
      )
  );
$$;

revoke all on function public.is_friend(uuid) from public, anon;
revoke all on function public.is_blocked(uuid) from public, anon;
revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.is_blocked(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy "Profiles are visible to signed-in users" on public.profiles;
create policy "Profiles are visible to signed-in users"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      not public.is_blocked(id)
      and (not is_private or public.is_friend(id))
    )
  );

drop policy "Posts visible by privacy setting" on public.posts;
create policy "Posts visible by privacy setting"
  on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (
      not public.is_blocked(author_id)
      and (
        (visibility = 'public' and not exists (
          select 1 from public.profiles p
          where p.id = author_id and p.is_private
        ))
        or (visibility = 'friends' and public.is_friend(author_id))
      )
    )
  );

create or replace function public.send_friend_request(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  friendship_id uuid;
begin
  if actor_id is null or target_user is null or target_user = actor_id then
    raise exception 'A valid signed-in user and a different recipient are required';
  end if;
  if not exists (select 1 from public.profiles where id = target_user) then
    raise exception 'That profile does not exist';
  end if;
  if public.is_blocked(target_user) then
    raise exception 'Friend requests are unavailable for this profile';
  end if;
  if public.is_friend(target_user) then
    raise exception 'You are already friends';
  end if;

  delete from public.friendships f
  where f.status = 'declined'
    and (
      (f.requester_id = actor_id and f.addressee_id = target_user)
      or (f.requester_id = target_user and f.addressee_id = actor_id)
    );

  insert into public.friendships (requester_id, addressee_id, status)
  values (actor_id, target_user, 'pending')
  returning id into friendship_id;
  return friendship_id;
end;
$$;

create or replace function public.block_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or target_user is null or target_user = actor_id then
    raise exception 'A valid signed-in user and a different profile are required';
  end if;
  if not exists (select 1 from public.profiles where id = target_user) then
    raise exception 'That profile does not exist';
  end if;

  delete from public.friendships f
  where (f.requester_id = actor_id and f.addressee_id = target_user)
     or (f.requester_id = target_user and f.addressee_id = actor_id);

  insert into public.friendships (requester_id, addressee_id, status)
  values (actor_id, target_user, 'blocked');
end;
$$;

create or replace function public.unblock_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from public.friendships f
  where f.requester_id = auth.uid()
    and f.addressee_id = target_user
    and f.status = 'blocked';
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.create_conversation(member_ids uuid[], conversation_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_conversation_id uuid;
  normalized_members uuid[];
  member_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::uuid[])
    into normalized_members
    from unnest(coalesce(member_ids, array[]::uuid[])) as member_id
    where member_id is not null and member_id <> actor_id;

  member_count := cardinality(normalized_members);
  if member_count < 1 or member_count > 49 then
    raise exception 'A conversation must include between 1 and 49 other members';
  end if;

  if exists (
    select 1 from unnest(normalized_members) member_id
    where not public.is_friend(member_id)
  ) then
    raise exception 'You can only start conversations with accepted friends';
  end if;

  insert into public.conversations (title, is_group, created_by)
  values (
    case when member_count = 1 then null else nullif(trim(conversation_title), '') end,
    member_count > 1,
    actor_id
  )
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  select new_conversation_id, member_id
  from unnest(array_append(normalized_members, actor_id)) as member_id;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_conversation(uuid[], text) from public, anon;
grant execute on function public.create_conversation(uuid[], text) to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.can_access_conversation(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members self_member
    where self_member.conversation_id = target_conversation
      and self_member.user_id = (select auth.uid())
  )
  and not exists (
    select 1
    from public.conversation_members other_member
    where other_member.conversation_id = target_conversation
      and other_member.user_id <> (select auth.uid())
      and public.is_blocked(other_member.user_id)
  );
$$;

revoke all on function private.can_access_conversation(uuid) from public, anon, authenticated;
grant execute on function private.can_access_conversation(uuid) to authenticated;

create or replace function private.can_access_conversation_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_topic ~ '^conversation:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then private.can_access_conversation(substring(target_topic from 14)::uuid)
    else false
  end;
$$;

revoke all on function private.can_access_conversation_topic(text) from public, anon, authenticated;
grant execute on function private.can_access_conversation_topic(text) to authenticated;

create policy "Conversation reads respect blocks"
  on public.conversations as restrictive for select to authenticated
  using (private.can_access_conversation(id));

create policy "Membership reads respect blocks"
  on public.conversation_members as restrictive for select to authenticated
  using (private.can_access_conversation(conversation_id));

create policy "Conversation invites are friends only"
  on public.conversation_members as restrictive for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_friend(user_id));

create policy "Message reads respect blocks"
  on public.messages as restrictive for select to authenticated
  using (private.can_access_conversation(conversation_id));

create policy "Message sends respect blocks"
  on public.messages as restrictive for insert to authenticated
  with check (private.can_access_conversation(conversation_id));

create policy "Conversation members can listen to presence"
  on realtime.messages for select to authenticated
  using (
    extension = 'presence'
    and private.can_access_conversation_topic((select realtime.topic()))
  );

create policy "Conversation members can track presence"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'presence'
    and private.can_access_conversation_topic((select realtime.topic()))
  );

create or replace function private.notify_social_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'friendships' then
    if tg_op = 'INSERT' and new.status = 'pending' then
      insert into public.notifications (user_id, actor_id, kind, entity_id)
      values (new.addressee_id, new.requester_id, 'friend_request', new.id);
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      insert into public.notifications (user_id, actor_id, kind, entity_id)
      values (new.requester_id, new.addressee_id, 'friend_accepted', new.id);
    end if;
  elsif tg_table_name = 'likes' then
    insert into public.notifications (user_id, actor_id, kind, entity_id)
    select p.author_id, new.user_id, 'like', new.post_id
    from public.posts p
    where p.id = new.post_id and p.author_id <> new.user_id;
  elsif tg_table_name = 'comments' then
    insert into public.notifications (user_id, actor_id, kind, entity_id)
    select p.author_id, new.author_id, 'comment', new.id
    from public.posts p
    where p.id = new.post_id and p.author_id <> new.author_id;
  elsif tg_table_name = 'messages' then
    insert into public.notifications (user_id, actor_id, kind, entity_id)
    select cm.user_id, new.sender_id, 'message', new.conversation_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_social_activity() from public, anon, authenticated;

create or replace function private.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.actor_id is distinct from old.actor_id
    or new.kind is distinct from old.kind
    or new.entity_id is distinct from old.entity_id
    or new.created_at is distinct from old.created_at
    or old.read_at is not null
    or new.read_at is null then
    raise exception 'Only unread notification read status can be changed';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_notification_update() from public, anon, authenticated;

create trigger notifications_read_only_update
  before update on public.notifications
  for each row execute procedure private.guard_notification_update();

create trigger friendship_notifications
  after insert or update of status on public.friendships
  for each row execute procedure private.notify_social_activity();

create trigger like_notifications
  after insert on public.likes
  for each row execute procedure private.notify_social_activity();

create trigger comment_notifications
  after insert on public.comments
  for each row execute procedure private.notify_social_activity();

create trigger message_notifications
  after insert on public.messages
  for each row execute procedure private.notify_social_activity();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mahinbook-media',
  'mahinbook-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users upload their own media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mahinbook-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users list their own media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'mahinbook-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users remove their own media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'mahinbook-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter publication supabase_realtime add table public.friendships;
