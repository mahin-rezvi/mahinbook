create extension if not exists pgcrypto;

create type public.post_visibility as enum ('public', 'friends', 'private');
create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'blocked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'New friend',
  bio text not null default '',
  avatar_url text,
  cover_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  visibility public.post_visibility not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_content_or_image check (length(trim(content)) > 0 or image_url is not null)
);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'like', 'comment', 'message')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);
create index comments_post_created_idx on public.comments (post_id, created_at);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.is_friend(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = target_user)
        or (f.addressee_id = auth.uid() and f.requester_id = target_user))
  );
$$;

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation and cm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g')), ''),
      'member'
    ) || '_' || substr(new.id::text, 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(coalesce(new.email, 'friend'), '@', 1), ''), 'New friend'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.guard_friendship_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friend request participants cannot be changed';
  end if;
  return new;
end;
$$;

create trigger friendships_participants_immutable
  before update on public.friendships
  for each row execute procedure public.guard_friendship_update();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are visible to signed-in users"
  on public.profiles for select to authenticated
  using (id = auth.uid() or not is_private or public.is_friend(id));
create policy "Users update their own profile"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read their friendship requests"
  on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Users send friend requests"
  on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "Addressees accept or decline friend requests"
  on public.friendships for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status in ('accepted', 'declined', 'blocked'));
create policy "Requesters cancel friendships"
  on public.friendships for delete to authenticated using (requester_id = auth.uid());

create policy "Posts visible by privacy setting"
  on public.posts for select to authenticated
  using (
    author_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and public.is_friend(author_id))
  );
create policy "Users create their own posts"
  on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "Authors update their own posts"
  on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Authors delete their own posts"
  on public.posts for delete to authenticated using (author_id = auth.uid());

create policy "Likes visible on visible posts"
  on public.likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Users like visible posts"
  on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "Users remove their own likes"
  on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "Comments visible on visible posts"
  on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Users comment on visible posts"
  on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy "Authors delete their own comments"
  on public.comments for delete to authenticated using (author_id = auth.uid());

create policy "Members read conversations"
  on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy "Users create conversations"
  on public.conversations for insert to authenticated with check (created_by = auth.uid());
create policy "Members read conversation membership"
  on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Conversation creators add members"
  on public.conversation_members for insert to authenticated
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));
create policy "Members read messages"
  on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "Members send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy "Users mark own notifications read"
  on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users update own notifications"
  on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
  if not found then
    raise exception 'No authenticated account found';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.likes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
