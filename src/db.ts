import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  username: string;
  password?: string;
  role: 'admin' | 'operator';
}

export interface Category {
  id?: number;
  name: string;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  category_id: number;
  active: number;
  is_prepared: number;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id?: number;
  product_id: number;
  quantity: number;
  min_quantity: number;
}

export interface Sale {
  id?: number;
  invoice_number: string;
  user_id: number;
  customer_name: string;
  total: number;
  discount: number;
  payment_method: string;
  created_at: string;
}

export interface SaleItem {
  id?: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  price: number;
}

export interface CashRegister {
  id?: number;
  user_id: number;
  opening_balance: number;
  closing_balance?: number;
  actual_closing_balance?: number;
  difference?: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  notes?: string;
}

export interface Setting {
  key: string;
  value: string;
}

export class POSDatabase extends Dexie {
  users!: Table<User>;
  categories!: Table<Category>;
  products!: Table<Product>;
  stock!: Table<Stock>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  cashRegister!: Table<CashRegister>;
  settings!: Table<Setting>;

  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      users: '++id, username',
      categories: '++id, name',
      products: '++id, name, category_id',
      stock: '++id, product_id',
      sales: '++id, invoice_number, user_id, created_at',
      saleItems: '++id, sale_id, product_id',
      cashRegister: '++id, user_id, status',
      settings: 'key'
    });
  }
}

export const db = new POSDatabase();

// Initialize default data if empty
export const initializeDB = async () => {
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.add({ username: 'admin', password: 'admin123', role: 'admin' });
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkPut([
      { name: 'Hambúrgueres' },
      { name: 'Sandes' },
      { name: 'Bebidas' },
      { name: 'Extras' }
    ]);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkPut([
      { key: 'establishment_name', value: 'POS Restauração' },
      { key: 'establishment_nif', value: '500123456' },
      { key: 'establishment_address', value: 'Endereço do Estabelecimento' },
      { key: 'establishment_phone', value: '900000000' }
    ]);
  }
};
