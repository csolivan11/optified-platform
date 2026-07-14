-- ─────────────────────────────────────────────────────────────
-- 00019 — RAG Assistant Chat History Table
-- ─────────────────────────────────────────────────────────────

create table phi_stub.chat_history (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  sender          text not null,      -- 'user', 'ai'
  message_text    text not null,
  created_at      timestamptz not null default now()
);

grant all on phi_stub.chat_history to service_role;
alter table phi_stub.chat_history enable row level security;
create index idx_chat_history_client on phi_stub.chat_history(client_id);
create index idx_chat_history_date on phi_stub.chat_history(created_at);
