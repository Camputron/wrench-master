import Database from 'better-sqlite3'

/**
 * Schema copied from the Java app (`DB.initTables`) so databases created by either app are interchangeable.
 * Every statement is idempotent, so this is safe to run against an existing database.
 */
const SCHEMA = `
create table if not exists customer (
  customer_id integer primary key autoincrement,
  first_name varchar(64),
  last_name varchar(64),
  phone varchar(16),
  email varchar(64),
  company varchar(64),
  address varchar(64),
  city varchar(64),
  state character(32),
  zip character(9));

create table if not exists vehicle (
  vehicle_id integer primary key autoincrement,
  customer_id integer,
  vin character(17),
  year character(4),
  make character(50),
  model character(50),
  license_plate character(16),
  color varchar(16),
  engine varchar(16),
  transmission varchar(20),
  foreign key (customer_id) references customer(customer_id));

create table if not exists item (
  item_name varchar(128) primary key,
  desc varchar(256),
  retail_price decimal(10,2),
  list_price decimal(10,2),
  taxable boolean,
  quantity tinyint);

create table if not exists work_order (
  work_order_id integer primary key autoincrement,
  date_created date,
  date_completed date,
  customer_id integer,
  customer_first_name varchar(64),
  customer_last_name varchar(64),
  customer_phone varchar(16),
  customer_email varchar(64),
  customer_company varchar(64),
  customer_address varchar(64),
  customer_city varchar(64),
  customer_state varchar(32),
  customer_zip character(9),
  vehicle_vin character(17),
  vehicle_year character(4),
  vehicle_make varchar(64),
  vehicle_model varchar(64),
  vehicle_license_plate character(16),
  vehicle_color varchar(16),
  vehicle_engine varchar(16),
  vehicle_transmission varchar(16),
  vehicle_mileage_in varchar(10),
  vehicle_mileage_out varchar(10),
  tax_rate real);

create table if not exists work_order_item (
  work_order_item_id integer primary key autoincrement,
  work_order_id integer,
  item_name varchar(128),
  item_desc varchar(256),
  item_retail_price decimal(10,2),
  item_list_price decimal(10,2),
  item_quantity tinyint,
  item_taxable boolean,
  foreign key(work_order_id) references work_order(work_order_id));

create table if not exists work_order_labor (
  work_order_labor_id integer primary key autoincrement,
  work_order_id integer,
  labor_code varchar(10),
  labor_desc varchar(256),
  labor_billed_hrs decimal(10,2),
  labor_rate decimal(10,2),
  labor_taxable boolean,
  foreign key (work_order_id) references work_order(work_order_id));

create table if not exists work_order_payment (
  work_order_payment_id integer primary key autoincrement,
  work_order_id integer,
  date_of_payment date,
  type character(5),
  amount decimal(10,2),
  foreign key (work_order_id) references work_order(work_order_id));

create table if not exists counter (id varchar(16) primary key, value integer);
insert or ignore into counter (id, value) values ('work.order.id', 1);

create index if not exists idx_vehicle_customer on vehicle(customer_id);
create index if not exists idx_work_order_customer on work_order(customer_id);
create index if not exists idx_work_order_item_wo on work_order_item(work_order_id);
create index if not exists idx_work_order_labor_wo on work_order_labor(work_order_id);
create index if not exists idx_work_order_payment_wo on work_order_payment(work_order_id);
`

export function openDatabase(file: string): Database.Database {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}
