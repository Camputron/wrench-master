import Database from 'better-sqlite3'
import { join } from 'path'

/** Milliseconds at local midnight: how the Java app stored dates (java.sql.Date via sqlite-jdbc). */
export const javaDate = (y: number, m: number, d: number): number => new Date(y, m - 1, d).getTime()

/** The Java app's tables, exactly as its DB.initTables created them. */
const JAVA_SCHEMA = `
create table customer (customer_id integer primary key autoincrement, first_name varchar(64), last_name varchar(64), phone varchar(16), email varchar(64), company varchar(64), address varchar(64), city varchar(64), state character(32), zip character(9));
create table vehicle (vehicle_id integer primary key autoincrement, customer_id integer, vin character(17), year character(4), make character(50), model character(50), license_plate character(16), color varchar(16), engine varchar(16), transmission varchar(20), foreign key (customer_id) references customer(customer_id));
create table item (item_name varchar(128) primary key, desc varchar(256), retail_price decimal(10,2), list_price decimal(10,2), taxable boolean, quantity tinyint);
create table work_order (work_order_id integer primary key autoincrement, date_created date, date_completed date, customer_id integer, customer_first_name varchar(64), customer_last_name varchar(64), customer_phone varchar(16), customer_email varchar(64), customer_company varchar(64), customer_address varchar(64), customer_city varchar(64), customer_state varchar(32), customer_zip character(9), vehicle_vin character(17), vehicle_year character(4), vehicle_make varchar(64), vehicle_model varchar(64), vehicle_license_plate character(16), vehicle_color varchar(16), vehicle_engine varchar(16), vehicle_transmission varchar(16), vehicle_mileage_in varchar(10), vehicle_mileage_out varchar(10), tax_rate real);
create table work_order_item (work_order_item_id integer primary key autoincrement, work_order_id integer, item_name varchar(128), item_desc varchar(256), item_retail_price decimal(10,2), item_list_price decimal(10,2), item_quantity tinyint, item_taxable boolean, foreign key(work_order_id) references work_order(work_order_id));
create table work_order_labor (work_order_labor_id integer primary key autoincrement, work_order_id integer, labor_code varchar(10), labor_desc varchar(256), labor_billed_hrs decimal(10,2), labor_rate decimal(10,2), labor_taxable boolean, foreign key (work_order_id) references work_order(work_order_id));
create table work_order_payment (work_order_payment_id integer primary key autoincrement, work_order_id integer, date_of_payment date, type character(5), amount decimal(10,2), foreign key (work_order_id) references work_order(work_order_id));
create table counter (id varchar(16) primary key, value integer);
`

/**
 * Creates a database the way the Java app left it, in `dir`. Contents:
 * - customers 1 Jane Doe (NEW_YORK) and 2 Bob Smith (company "Acme_Corp", whose underscore is a LIKE wildcard)
 * - vehicle 1: Jane's 2003 Honda Accord, VIN 1HGCM82633A004352, plate ABC123
 * - catalog part BP-100 "Brake pads front"
 * - work order 1 (Jane, created 2024-03-05, completed 2024-03-20): parts 2 x $45 taxable + $10 untaxed,
 *   labor 1.5h x $90 taxable, payments $100 cash + $50 credit, 8.625% tax -> total $254.40625
 * - work order 2 (Bob, created 2024-11-02, open): labor 1h x $90 untaxed
 * - work order 3 (Bob, created 2025-01-10, open): nothing billed
 */
export function createJavaDb(dir: string): string {
  const file = join(dir, 'autoshop.db')
  const db = new Database(file)
  db.exec(JAVA_SCHEMA)
  db.exec(`
    insert into counter values ('work.order.id', 4);
    insert into customer (first_name,last_name,phone,email,company,address,city,state,zip) values
      ('Jane','Doe','555-1234','jane@x.com','','1 Main St','Queens','NEW_YORK','11355'),
      ('Bob','Smith','','','Acme_Corp','','','UNKNOWN','');
    insert into vehicle (customer_id,vin,year,make,model,license_plate,color,engine,transmission) values
      (1,'1HGCM82633A004352','2003','Honda','Accord','ABC123','Blue','2.4L','Automatic');
    insert into item values ('BP-100','Brake pads front',45.0,30.0,1,1);
  `)
  const wo = db.prepare(
    `insert into work_order (date_created,date_completed,customer_id,customer_first_name,customer_last_name,customer_phone,customer_email,customer_company,
      customer_address,customer_city,customer_state,customer_zip,vehicle_vin,vehicle_year,vehicle_make,vehicle_model,vehicle_license_plate,vehicle_color,
      vehicle_engine,vehicle_transmission,vehicle_mileage_in,vehicle_mileage_out,tax_rate) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
  wo.run(
    javaDate(2024, 3, 5),
    javaDate(2024, 3, 20),
    1,
    'Jane',
    'Doe',
    '555-1234',
    'jane@x.com',
    '',
    '1 Main St',
    'Queens',
    'NEW_YORK',
    '11355',
    '1HGCM82633A004352',
    '2003',
    'Honda',
    'Accord',
    'ABC123',
    'Blue',
    '2.4L',
    'Automatic',
    '100000',
    '100050',
    0.08625
  )
  wo.run(javaDate(2024, 11, 2), null, 2, 'Bob', 'Smith', '', '', 'Acme_Corp', '', '', 'UNKNOWN', '', '', '2010', 'Ford', 'F-150', '', '', '', '', '', '', 0.08625)
  wo.run(javaDate(2025, 1, 10), null, 2, 'Bob', 'Smith', '', '', 'Acme_Corp', '', '', 'UNKNOWN', '', '', '2010', 'Ford', 'F-150', '', '', '', '', '', '', 0.08625)
  db.exec(`
    insert into work_order_item (work_order_id,item_name,item_desc,item_retail_price,item_list_price,item_quantity,item_taxable) values
      (1,'BP-100','Brake pads front',45.0,30.0,2,1), (1,'SH-1','Shop supplies',10.0,5.0,1,0);
    insert into work_order_labor (work_order_id,labor_code,labor_desc,labor_billed_hrs,labor_rate,labor_taxable) values
      (1,'L1','Replace pads',1.5,90.0,1), (2,'L2','Diagnose',1.0,90.0,0);
  `)
  db.prepare('insert into work_order_payment (work_order_id,date_of_payment,type,amount) values (?,?,?,?)').run(1, javaDate(2024, 3, 20), 'Cash', 100)
  db.prepare('insert into work_order_payment (work_order_id,date_of_payment,type,amount) values (?,?,?,?)').run(1, javaDate(2024, 3, 20), 'Credit', 50)
  db.close()
  return file
}

/** Work order 1's total from the fixture: $235 subtotal + 8.625% of the $225 taxable. */
export const WO1_TOTAL = 235 + 225 * 0.08625
