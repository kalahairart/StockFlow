# SQL Schema for StockFlow WMS
# Execute this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Products Table
create table products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  stock_quantity integer not null default 0,
  min_stock integer not null default 10,
  unit_cost decimal(12,2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by text
);

-- Create Transactions Table
create type transaction_type as enum ('in', 'out');

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade not null,
  type transaction_type not null,
  quantity integer not null,
  unit_cost decimal(12,2) default 0, -- Unit cost at the time of this transaction
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid, -- Optional: link to auth.users if needed
  user_name text,
  note text
);

-- Create Laundry Records Table
CREATE TABLE IF NOT EXISTS laundry_records (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity_out integer not null,
  quantity_in integer default 0,
  unit_cost decimal(12,2) default 0,
  total_cost decimal(12,2) default 0,
  status text not null default 'out', -- 'out', 'partial', 'returned'
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  returned_at timestamp with time zone,
  operator_name text,
  product_id uuid references products(id),
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Laundry
ALTER TABLE laundry_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON laundry_records FOR ALL TO authenticated USING (true);

-- Indexes for performance
create index idx_products_category on products(category);
create index idx_transactions_product_id on transactions(product_id);
create index idx_transactions_timestamp on transactions(timestamp);

-- Row Level Security (RLS)
-- For MVP, we enable RLS but allow authenticated access
alter table products enable row level security;
alter table transactions enable row level security;

create policy "Allow all access to authenticated users on products"
  on products for all
  using (true);

create policy "Allow all access to authenticated users on transactions"
  on transactions for all
  using (true);

-- Functions & Triggers: Automatic stock update
create or replace function update_stock_quantity()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    if (new.type = 'in') then
      update products
      set stock_quantity = stock_quantity + new.quantity
      where id = new.product_id;
    elsif (new.type = 'out') then
      update products
      set stock_quantity = stock_quantity - new.quantity
      where id = new.product_id;
    end if;
  elsif (TG_OP = 'DELETE') then
    if (old.type = 'in') then
      update products
      set stock_quantity = stock_quantity - old.quantity
      where id = old.product_id;
    elsif (old.type = 'out') then
      update products
      set stock_quantity = stock_quantity + old.quantity
      where id = old.product_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_stock_after_transaction on transactions;
create trigger trg_update_stock_after_transaction
after insert or delete on transactions
for each row
execute function update_stock_quantity();
