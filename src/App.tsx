import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Minus, 
  Trash2, 
  Search,
  CheckCircle2,
  XCircle,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  User as UserIcon,
  ChevronRight,
  Printer,
  Download,
  FileText,
  AlertTriangle,
  Wifi,
  WifiOff,
  Cloud,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface User {
  id: number;
  username: string;
  role: 'admin' | 'operator';
}

interface Product {
  id: number;
  name: string;
  price: number;
  category_id: number;
  category_name: string;
  active: number;
  is_prepared: number;
  stock_quantity: number | null;
  min_quantity: number | null;
}

interface CartItem extends Product {
  quantity: number;
}

interface Category {
  id: number;
  name: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [view, setView] = useState<'pos' | 'stock' | 'reports' | 'admin' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cashStatus, setCashStatus] = useState<any>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isCloseCashModalOpen, setIsCloseCashModalOpen] = useState(false);
  const [cashSummary, setCashSummary] = useState<any>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dailyReport, setDailyReport] = useState<any[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<any[]>([]);
  const [topProductsReport, setTopProductsReport] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'operator' as 'admin' | 'operator' });
  const [adminTab, setAdminTab] = useState<'products' | 'users' | 'categories' | 'sync'>('products');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | null>(null);
  const [newStockQuantity, setNewStockQuantity] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportDatabase = async () => {
    try {
      const response = await fetch('/api/admin/export');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      alert('Erro ao exportar backup');
    }
  };

  const importDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('AVISO: Importar dados irá substituir TODA a informação atual. Deseja continuar?')) {
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        alert('Dados importados com sucesso! O sistema será reiniciado.');
        window.location.reload();
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      alert('Erro ao importar dados: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };
  const [pendingAction, setPendingAction] = useState<{ type: 'view' | 'logout', value?: any } | null>(null);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ 
    name: '', 
    price: '', 
    category_id: 0, 
    is_prepared: 0, 
    initial_stock: '0',
    active: 1
  });

  const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
  const [productDetails, setProductDetails] = useState<{ product: any, history: any[] } | null>(null);

  const [establishmentInfo, setEstablishmentInfo] = useState({
    establishment_name: '',
    establishment_nif: '',
    establishment_address: '',
    establishment_phone: ''
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '' });

  // Auth State
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchCategories();
      fetchCashStatus();
      fetchSettings();
      if (view === 'history') fetchSalesHistory();
      if (view === 'reports') fetchReportsData();
      if (view === 'admin') {
        fetchProducts();
        fetchUsers();
      }
    }
  }, [user, view]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setEstablishmentInfo(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(establishmentInfo)
      });
      if (response.ok) {
        alert('Informações do estabelecimento guardadas com sucesso!');
      } else {
        alert('Erro ao guardar informações.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro de conexão ao servidor.');
    }
  };

  const fetchReportsData = async () => {
    const [daily, monthly, top] = await Promise.all([
      fetch('/api/reports/daily').then(r => r.json()),
      fetch('/api/reports/monthly').then(r => r.json()),
      fetch('/api/reports/top-products').then(r => r.json())
    ]);
    setDailyReport(daily);
    setMonthlyReport(monthly);
    setTopProductsReport(top);
  };

  const exportDailyPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Vendas Diárias', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Data', 'Total (Kz)', 'Nº Pedidos']],
      body: dailyReport.map(r => [r.date, r.total_sales.toFixed(2), r.count]),
    });
    doc.save(`vendas_diarias_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportMonthlyPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Vendas Mensais', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Mês', 'Total (Kz)', 'Nº Pedidos']],
      body: monthlyReport.map(r => [r.month, r.total_sales.toFixed(2), r.count]),
    });
    doc.save(`vendas_mensais_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportTopProductsPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Produtos Mais Vendidos', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Produto', 'Quantidade']],
      body: topProductsReport.map(r => [r.name, r.total_qty]),
    });
    doc.save(`produtos_mais_vendidos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const printReceipt = (sale: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = sale.items.map((item: any) => `
      <tr>
        <td style="padding: 2px 0;">${item.product_name}<br/><small>${item.quantity}x ${item.price.toFixed(2)}</small></td>
        <td style="text-align: right; vertical-align: bottom;">${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo ${sale.invoice_number}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 12px; 
              width: 58mm; 
              margin: 0; 
              padding: 10px;
              color: #000;
            }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .footer { text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; }
            .total-row { font-weight: bold; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; }
            .text-right { text-align: right; }
            .mb-5 { margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3 style="margin: 0; text-transform: uppercase;">${establishmentInfo.establishment_name || 'POS RESTAURAÇÃO'}</h3>
            <p style="margin: 2px 0;">NIF: ${establishmentInfo.establishment_nif || '500123456'}</p>
            <p style="margin: 2px 0;">${establishmentInfo.establishment_address || 'Luanda, Angola'}</p>
            ${establishmentInfo.establishment_phone ? `<p style="margin: 2px 0;">Tel: ${establishmentInfo.establishment_phone}</p>` : ''}
          </div>
          
          <div class="mb-5">
            <b>Fatura:</b> ${sale.invoice_number}<br/>
            <b>Data:</b> ${new Date(sale.created_at).toLocaleString()}<br/>
            <b>Operador:</b> ${sale.operator_name || user?.username}<br/>
            ${sale.customer_name ? `<b>Cliente:</b> ${sale.customer_name}<br/>` : ''}
          </div>

          <table>
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left;">Item</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-row">
            <div style="display: flex; justify-content: space-between;">
              <span>TOTAL</span>
              <span>${sale.total.toFixed(2)} Kz</span>
            </div>
          </div>

          <div style="margin-top: 5px; font-size: 10px;">
            <b>Pagamento:</b> ${sale.payment_method.toUpperCase()}
          </div>

          <div class="footer">
            <p>Obrigado pela preferência!</p>
            <p>Processado por Software POS</p>
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
  };

  const handleUpdateStock = async () => {
    if (!selectedStockProduct || newStockQuantity === '') return;
    
    try {
      const response = await fetch(`/api/products/${selectedStockProduct.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(newStockQuantity) })
      });
      
      if (response.ok) {
        fetchProducts();
        setIsStockModalOpen(false);
        setSelectedStockProduct(null);
        setNewStockQuantity('');
      }
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleSafeAction = (type: 'view' | 'logout', value?: any) => {
    if (cart.length > 0 && view === 'pos') {
      setPendingAction({ type, value });
      setIsConfirmModalOpen(true);
    } else {
      if (type === 'view') setView(value);
      if (type === 'logout') setUser(null);
    }
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'view') setView(pendingAction.value);
    if (pendingAction.type === 'logout') setUser(null);
    setIsConfirmModalOpen(false);
    setPendingAction(null);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.category_id) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const method = editingProduct ? 'PUT' : 'POST';
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          price: parseFloat(productForm.price),
          initial_stock: parseFloat(productForm.initial_stock || '0')
        })
      });
      
      if (response.ok) {
        fetchProducts();
        setIsProductModalOpen(false);
        setEditingProduct(null);
        setProductForm({ name: '', price: '', category_id: categories[0]?.id || 0, is_prepared: 0, initial_stock: '0', active: 1 });
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao guardar produto');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro de conexão ao servidor');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) return;

    const method = editingCategory ? 'PUT' : 'POST';
    const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });

      if (response.ok) {
        fetchCategories();
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setCategoryForm({ name: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao guardar categoria');
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Tem certeza que deseja eliminar esta categoria?')) return;

    try {
      const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchCategories();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao eliminar categoria');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const fetchProductDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/products/${id}/details`);
      const data = await response.json();
      setProductDetails(data);
      setIsProductDetailsModalOpen(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Tem a certeza que deseja remover este produto?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
  };

  const handleSaveUser = async () => {
    const method = editingUser ? 'PUT' : 'POST';
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: 'operator' });
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Erro ao guardar utilizador');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (id === user?.id) {
      alert('Não pode remover o utilizador atual.');
      return;
    }
    if (!confirm('Tem a certeza que deseja remover este utilizador?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) fetchUsers();
  };

  const fetchSalesHistory = async () => {
    const res = await fetch('/api/sales');
    const data = await res.json();
    setSalesHistory(data);
  };

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data);
  };

  const fetchCashStatus = async () => {
    const res = await fetch('/api/cash/status');
    const data = await res.json();
    setCashStatus(data);
    if (data.status === 'closed') {
      setIsCashModalOpen(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setLoginError('Credenciais inválidas');
      }
    } catch (err) {
      setLoginError('Erro ao conectar ao servidor');
    }
  };

  const handleOpenCash = async () => {
    if (!openingBalance) return;
    await fetch('/api/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, opening_balance: parseFloat(openingBalance) }),
    });
    setIsCashModalOpen(false);
    fetchCashStatus();
  };

  const handleRequestCloseCash = async () => {
    if (!cashStatus?.id) return;
    try {
      const res = await fetch(`/api/cash/summary/${cashStatus.id}`);
      const data = await res.json();
      setCashSummary(data);
      setIsCloseCashModalOpen(true);
    } catch (error) {
      console.error('Error fetching cash summary:', error);
      alert('Erro ao obter resumo do caixa');
    }
  };

  const handleConfirmCloseCash = async () => {
    if (!cashStatus?.id || !cashSummary) return;
    
    const finalBalance = cashSummary.opening_balance + cashSummary.sales_by_method.cash;
    
    try {
      const res = await fetch('/api/cash/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cashStatus.id, closing_balance: finalBalance }),
      });
      
      if (res.ok) {
        setIsCloseCashModalOpen(false);
        setCashSummary(null);
        fetchCashStatus();
        alert('Caixa fechado com sucesso!');
      }
    } catch (error) {
      console.error('Error closing cash:', error);
      alert('Erro ao fechar caixa');
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const change = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - cartTotal);
  }, [cashReceived, cartTotal]);

  const handleFinalizeSale = async () => {
    const saleData = {
      user_id: user?.id,
      items: cart,
      total: cartTotal,
      discount: 0,
      payment_method: paymentMethod,
      customer_name: customerName
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData),
    });

    if (res.ok) {
      const result = await res.json();
      
      // Trigger thermal print
      printReceipt({
        invoice_number: result.invoiceNumber,
        created_at: new Date().toISOString(),
        items: cart,
        total: cartTotal,
        payment_method: paymentMethod,
        customer_name: customerName,
        operator_name: user?.username
      });

      setCart([]);
      setIsPaymentModalOpen(false);
      setCashReceived('');
      setCustomerName('');
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory && p.active;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="text-emerald-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">POS Restauração</h1>
            <p className="text-white/50 text-sm">Entre com suas credenciais para continuar</p>
            <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Dica de Acesso</p>
              <p className="text-xs text-emerald-500/80">Utilizador: <span className="text-white">admin</span> | Senha: <span className="text-white">admin123</span></p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Utilizador</label>
              <input 
                type="text"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Ex: admin"
                value={loginForm.username}
                onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Senha</label>
              <input 
                type="password"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2">
                <XCircle size={16} />
                {loginError}
              </div>
            )}
            <button 
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              Entrar no Sistema
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-24 bg-[#141414] border-r border-white/10 flex flex-col items-center py-8 gap-8">
        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <LayoutDashboard className="text-white w-6 h-6" />
        </div>

        <nav className="flex-1 flex flex-col gap-4">
          <SidebarItem icon={<ShoppingCart />} active={view === 'pos'} onClick={() => handleSafeAction('view', 'pos')} label="Vendas" />
          <SidebarItem icon={<ArrowRightLeft />} active={view === 'history'} onClick={() => handleSafeAction('view', 'history')} label="Histórico" />
          <SidebarItem icon={<Package />} active={view === 'stock'} onClick={() => handleSafeAction('view', 'stock')} label="Stock" />
          <SidebarItem icon={<BarChart3 />} active={view === 'reports'} onClick={() => handleSafeAction('view', 'reports')} label="Relatórios" />
          {user.role === 'admin' && (
            <SidebarItem icon={<Settings />} active={view === 'admin'} onClick={() => handleSafeAction('view', 'admin')} label="Admin" />
          )}
        </nav>

        <button 
          onClick={() => handleSafeAction('logout')}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={24} />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-[#141414] border-b border-white/10 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold capitalize">{view === 'pos' ? 'Ponto de Venda' : view}</h2>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <UserIcon size={16} />
              <span>{user.username} ({user.role})</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? 'SISTEMA ONLINE' : 'MODO OFFLINE'}</span>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full text-sm font-medium border border-emerald-500/20">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Caixa Aberto
              <button 
                onClick={handleRequestCloseCash}
                className="ml-2 bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-colors"
              >
                FECHAR CAIXA
              </button>
            </div>
            <div className="text-white/50 text-sm font-mono">
              {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'pos' && (
            <div className="flex h-full">
              {/* Products Area */}
              <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                {/* Search and Categories */}
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar produto..."
                      className="w-full bg-[#141414] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <CategoryTab 
                      label="Todos" 
                      active={selectedCategory === null} 
                      onClick={() => setSelectedCategory(null)} 
                    />
                    {categories.map(cat => (
                      <CategoryTab 
                        key={cat.id}
                        label={cat.name}
                        active={selectedCategory === cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-2 custom-scrollbar">
                  {filteredProducts.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onClick={() => addToCart(product)} 
                    />
                  ))}
                </div>
              </div>

              {/* Cart Area */}
              <div className="w-[400px] bg-[#141414] border-l border-white/10 flex flex-col">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingCart size={20} className="text-emerald-500" />
                    Carrinho
                  </h3>
                  <span className="bg-white/5 text-white/50 px-3 py-1 rounded-full text-xs font-bold">
                    {cart.length} Itens
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {cart.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
                        <ShoppingCart size={64} strokeWidth={1} />
                        <p className="text-sm">Carrinho vazio</p>
                      </div>
                    ) : (
                      cart.map(item => (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-3"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-bold text-sm leading-tight">{item.name}</h4>
                              <p className="text-emerald-500 text-xs font-mono mt-1">{item.price.toFixed(2)} Kz</p>
                              {item.stock_quantity !== null && item.stock_quantity <= (item.min_quantity || 5) && (
                                <div className="flex items-center gap-1 mt-2 text-amber-500">
                                  <AlertTriangle size={12} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider">Stock Baixo: {item.stock_quantity}</span>
                                </div>
                              )}
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="text-white/20 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center bg-black/20 rounded-xl p-1">
                              <button 
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-white/40">Subtotal</p>
                              <p className="font-bold text-sm">{(item.price * item.quantity).toFixed(2)} Kz</p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-6 bg-black/20 border-t border-white/10 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50">Total</span>
                    <span className="text-3xl font-bold text-emerald-500">{cartTotal.toFixed(2)} Kz</span>
                  </div>
                  <button 
                    disabled={cart.length === 0}
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
                  >
                    Finalizar Venda
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'stock' && (
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Gestão de Stock</h3>
                <button className="bg-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors">
                  <Plus size={20} />
                  Nova Entrada
                </button>
              </div>

              <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Produto</th>
                      <th className="px-6 py-4 font-semibold">Categoria</th>
                      <th className="px-6 py-4 font-semibold text-center">Stock Atual</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.filter(p => p.is_prepared === 0).map(product => (
                      <tr key={product.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium">{product.name}</td>
                        <td className="px-6 py-4 text-white/50 text-sm">{product.category_name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-mono font-bold ${product.stock_quantity && product.stock_quantity < 10 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {product.stock_quantity || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {product.stock_quantity && product.stock_quantity < 10 ? (
                            <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Stock Baixo</span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Normal</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedStockProduct(product);
                              setNewStockQuantity(product.stock_quantity?.toString() || '0');
                              setIsStockModalOpen(true);
                            }}
                            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                          >
                            Atualizar
                          </button>
                          <button className="text-white/40 hover:text-white transition-colors text-xs font-bold">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'reports' && (
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Relatórios de Vendas</h3>
                <div className="flex gap-3">
                  <button 
                    onClick={exportDailyPDF}
                    className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <Download size={16} />
                    PDF Diário
                  </button>
                  <button 
                    onClick={exportMonthlyPDF}
                    className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <Download size={16} />
                    PDF Mensal
                  </button>
                  <button 
                    onClick={exportTopProductsPDF}
                    className="bg-emerald-500 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all"
                  >
                    <FileText size={16} />
                    PDF Top Produtos
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ReportCard title="Vendas Hoje" value={`${(dailyReport[0]?.total_sales || 0).toFixed(2)} Kz`} trend="+12%" />
                <ReportCard title="Pedidos Hoje" value={dailyReport[0]?.count || 0} trend="+5%" />
                <ReportCard title="Ticket Médio" value={`${((dailyReport[0]?.total_sales || 0) / (dailyReport[0]?.count || 1)).toFixed(2)} Kz`} trend="-2%" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                  <h4 className="font-bold mb-6 flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald-500" />
                    Produtos Mais Vendidos
                  </h4>
                  <div className="space-y-4">
                    {topProductsReport.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="font-bold text-sm">{item.name}</p>
                          <p className="text-xs text-white/40">{item.total_qty} unidades</p>
                        </div>
                      </div>
                    ))}
                    {topProductsReport.length === 0 && <p className="text-white/20 text-center py-4">Sem dados disponíveis</p>}
                  </div>
                </div>

                <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                  <h4 className="font-bold mb-6 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-500" />
                    Vendas Recentes (Diário)
                  </h4>
                  <div className="space-y-4">
                    {dailyReport.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="font-bold text-sm">{item.date}</p>
                          <p className="text-xs text-white/40">{item.count} pedidos</p>
                        </div>
                        <p className="font-mono text-emerald-500 text-sm">{item.total_sales.toFixed(2)} Kz</p>
                      </div>
                    ))}
                    {dailyReport.length === 0 && <p className="text-white/20 text-center py-4">Sem dados disponíveis</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'admin' && (
            <div className="p-8 h-full overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Configurações do Sistema</h3>
                <div className="flex gap-4">
                  <div className="flex bg-[#141414] border border-white/10 p-1 rounded-xl">
                    <button 
                      onClick={() => setAdminTab('products')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'products' ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      Produtos
                    </button>
                    <button 
                      onClick={() => setAdminTab('users')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'users' ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      Utilizadores
                    </button>
                    <button 
                      onClick={() => setAdminTab('categories')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'categories' ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      Categorias
                    </button>
                    <button 
                      onClick={() => setAdminTab('sync')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${adminTab === 'sync' ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white'}`}
                    >
                      Sincronização
                    </button>
                  </div>
                  {adminTab === 'products' && (
                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ name: '', price: '', category_id: categories[0]?.id || 0, is_prepared: 0, initial_stock: '0', active: 1 });
                        setIsProductModalOpen(true);
                      }}
                      className="bg-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                    >
                      <Plus size={20} />
                      Novo Produto
                    </button>
                  )}
                  {adminTab === 'users' && (
                    <button 
                      onClick={() => {
                        setEditingUser(null);
                        setUserForm({ username: '', password: '', role: 'operator' });
                        setIsUserModalOpen(true);
                      }}
                      className="bg-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                    >
                      <Plus size={20} />
                      Novo Utilizador
                    </button>
                  )}
                  {adminTab === 'categories' && (
                    <button 
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({ name: '' });
                        setIsCategoryModalOpen(true);
                      }}
                      className="bg-emerald-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                    >
                      <Plus size={20} />
                      Nova Categoria
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {adminTab === 'products' && (
                    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
                      <div className="p-6 border-b border-white/10">
                        <h4 className="font-bold">Lista de Produtos</h4>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">Produto</th>
                            <th className="px-6 py-4 font-semibold">Categoria</th>
                            <th className="px-6 py-4 font-semibold">Preço</th>
                            <th className="px-6 py-4 font-semibold">Estado</th>
                            <th className="px-6 py-4 font-semibold text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {products.map(product => (
                            <tr key={product.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-medium">{product.name}</td>
                              <td className="px-6 py-4 text-white/50 text-sm">{product.category_name}</td>
                              <td className="px-6 py-4 font-mono">{product.price.toFixed(2)} Kz</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${product.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {product.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-3">
                                <button 
                                  onClick={() => fetchProductDetails(product.id)}
                                  className="text-emerald-500 hover:text-emerald-400 text-xs font-bold transition-colors"
                                >
                                  Ver Detalhes
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setProductForm({
                                      name: product.name,
                                      price: product.price.toString(),
                                      category_id: product.category_id,
                                      is_prepared: product.is_prepared,
                                      initial_stock: (product.stock_quantity || 0).toString(),
                                      active: product.active
                                    });
                                    setIsProductModalOpen(true);
                                  }}
                                  className="text-white/40 hover:text-white transition-colors text-xs font-bold"
                                >
                                  Editar
                                </button>
                                <button 
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="text-red-500/40 hover:text-red-500 transition-colors text-xs font-bold"
                                >
                                  Apagar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {adminTab === 'users' && (
                    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
                      <div className="p-6 border-b border-white/10">
                        <h4 className="font-bold">Lista de Utilizadores</h4>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">Utilizador</th>
                            <th className="px-6 py-4 font-semibold">Nível</th>
                            <th className="px-6 py-4 font-semibold text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-medium flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                  <UserIcon size={16} />
                                </div>
                                {u.username}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                  {u.role === 'admin' ? 'Administrador' : 'Operador'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-4">
                                <button 
                                  onClick={() => {
                                    setEditingUser(u);
                                    setUserForm({ username: u.username, password: '', role: u.role });
                                    setIsUserModalOpen(true);
                                  }}
                                  className="text-white/40 hover:text-white transition-colors"
                                >
                                  Editar
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-white/40 hover:text-red-500 transition-colors"
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {adminTab === 'categories' && (
                    <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
                      <div className="p-6 border-b border-white/10">
                        <h4 className="font-bold">Lista de Categorias</h4>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/5 text-white/40 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">ID</th>
                            <th className="px-6 py-4 font-semibold">Nome</th>
                            <th className="px-6 py-4 font-semibold text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {categories.map(cat => (
                            <tr key={cat.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono text-white/40 text-sm">{cat.id}</td>
                              <td className="px-6 py-4 font-medium">{cat.name}</td>
                              <td className="px-6 py-4 text-right space-x-4">
                                <button 
                                  onClick={() => {
                                    setEditingCategory(cat);
                                    setCategoryForm({ name: cat.name });
                                    setIsCategoryModalOpen(true);
                                  }}
                                  className="text-white/40 hover:text-white transition-colors"
                                >
                                  Editar
                                </button>
                                <button 
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="text-white/40 hover:text-red-500 transition-colors"
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {adminTab === 'sync' && (
                    <div className="bg-[#141414] border border-white/10 rounded-2xl p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                          <Cloud className="text-emerald-500" size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">Sincronização em Nuvem</h4>
                          <p className="text-white/40 text-sm">Gerencie o backup e acesso online do seu sistema</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Backup Local</span>
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded-full">RECOMENDADO</span>
                          </div>
                          <p className="text-sm text-white/60 mb-6 leading-relaxed">
                            Exporte todos os seus dados para um ficheiro de segurança que pode guardar em qualquer lugar.
                          </p>
                          <div className="flex gap-3">
                            <button 
                              onClick={exportDatabase}
                              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10"
                            >
                              <Download size={18} />
                              Exportar JSON
                            </button>
                            <label className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer">
                              <Upload size={18} />
                              Importar
                              <input type="file" accept=".json" onChange={importDatabase} className="hidden" disabled={isImporting} />
                            </label>
                          </div>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Estado Atual</span>
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded-full">TOTALMENTE OFFLINE</span>
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">
                            O sistema está operando em modo local. Todos os dados são salvos com segurança neste dispositivo.
                          </p>
                        </div>
                      </div>

                      <div className="mt-8 p-6 border border-dashed border-white/10 rounded-2xl flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <Cloud size={32} className="text-white/20" />
                        </div>
                        <h5 className="font-bold mb-2">Deseja habilitar o acesso online?</h5>
                        <p className="text-sm text-white/40 max-w-md mb-6">
                          Esta funcionalidade está em desenvolvimento e será disponibilizada em uma atualização futura para permitir a gestão remota do seu negócio.
                        </p>
                        <button 
                          disabled
                          className="bg-white/5 text-white/20 px-8 py-3 rounded-xl font-bold cursor-not-allowed"
                        >
                          Ativar Sincronização (Brevemente)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                    <h4 className="font-bold mb-4">Informação do Estabelecimento</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome</label>
                        <input 
                          type="text" 
                          value={establishmentInfo.establishment_name} 
                          onChange={e => setEstablishmentInfo({ ...establishmentInfo, establishment_name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">NIF</label>
                        <input 
                          type="text" 
                          value={establishmentInfo.establishment_nif} 
                          onChange={e => setEstablishmentInfo({ ...establishmentInfo, establishment_nif: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Endereço</label>
                        <input 
                          type="text" 
                          value={establishmentInfo.establishment_address} 
                          onChange={e => setEstablishmentInfo({ ...establishmentInfo, establishment_address: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Telefone</label>
                        <input 
                          type="text" 
                          value={establishmentInfo.establishment_phone} 
                          onChange={e => setEstablishmentInfo({ ...establishmentInfo, establishment_phone: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <button 
                        onClick={handleSaveSettings}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all"
                      >
                        Guardar Alterações
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
                    <h4 className="font-bold mb-4">Segurança e Backup</h4>
                    <p className="text-sm text-white/40 mb-4">O sistema realiza backups automáticos todos os dias à meia-noite. Pode também realizar um backup manual agora.</p>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/admin/backup', { method: 'POST' });
                          if (res.ok) alert('Backup realizado com sucesso!');
                          else alert('Erro ao realizar backup.');
                        } catch (e) {
                          alert('Erro de conexão ao servidor.');
                        }
                      }}
                      className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      Realizar Backup Agora
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="p-8 h-full flex gap-6 overflow-hidden">
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Histórico de Vendas</h3>
                  <div className="relative w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar fatura ou data..."
                      className="w-full bg-[#141414] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 bg-[#141414] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
                  <div className="overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#1a1a1a] z-10">
                        <tr className="text-white/40 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Fatura</th>
                          <th className="px-6 py-4 font-semibold">Data/Hora</th>
                          <th className="px-6 py-4 font-semibold">Operador</th>
                          <th className="px-6 py-4 font-semibold">Pagamento</th>
                          <th className="px-6 py-4 font-semibold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {salesHistory
                          .filter(s => 
                            s.invoice_number.toLowerCase().includes(historySearch.toLowerCase()) ||
                            (s.customer_name && s.customer_name.toLowerCase().includes(historySearch.toLowerCase())) ||
                            s.created_at.includes(historySearch)
                          )
                          .map(sale => (
                            <tr 
                              key={sale.id} 
                              onClick={() => setSelectedOrder(sale)}
                              className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedOrder?.id === sale.id ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''}`}
                            >
                              <td className="px-6 py-4">
                                <p className="font-mono text-sm">{sale.invoice_number}</p>
                                {sale.customer_name && <p className="text-[10px] text-white/30">{sale.customer_name}</p>}
                              </td>
                              <td className="px-6 py-4 text-white/50 text-sm">
                                {new Date(sale.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-white/50 text-sm">{sale.operator_name}</td>
                              <td className="px-6 py-4">
                                <span className="bg-white/5 text-white/60 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                                  {sale.payment_method}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-emerald-500">
                                {sale.total.toFixed(2)} Kz
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Order Details Panel */}
              <AnimatePresence>
                {selectedOrder && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-96 bg-[#141414] border border-white/10 rounded-2xl flex flex-col overflow-hidden"
                  >
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <h4 className="font-bold">Detalhes da Fatura</h4>
                      <button onClick={() => setSelectedOrder(null)} className="text-white/20 hover:text-white">
                        <XCircle size={20} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      <div className="mb-6">
                        <p className="text-xs text-white/30 uppercase font-bold mb-1">Número</p>
                        <p className="font-mono text-lg">{selectedOrder.invoice_number}</p>
                      </div>
                      {selectedOrder.customer_name && (
                        <div className="mb-6">
                          <p className="text-xs text-white/30 uppercase font-bold mb-1">Cliente</p>
                          <p className="text-sm font-bold">{selectedOrder.customer_name}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                          <p className="text-xs text-white/30 uppercase font-bold mb-1">Data</p>
                          <p className="text-sm">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/30 uppercase font-bold mb-1">Hora</p>
                          <p className="text-sm">{new Date(selectedOrder.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-8">
                        <p className="text-xs text-white/30 uppercase font-bold">Itens</p>
                        {selectedOrder.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <div className="flex-1">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-white/40">{item.quantity}x {item.price.toFixed(2)} Kz</p>
                            </div>
                            <p className="font-mono">{(item.quantity * item.price).toFixed(2)} Kz</p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-6 border-t border-white/10 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Subtotal</span>
                          <span>{selectedOrder.total.toFixed(2)} Kz</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/40">Desconto</span>
                          <span>0.00 Kz</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-emerald-500 pt-2">
                          <span>Total</span>
                          <span>{selectedOrder.total.toFixed(2)} Kz</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 bg-black/20 border-t border-white/10">
                      <button 
                        onClick={() => printReceipt(selectedOrder)}
                        className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Printer size={18} />
                        Reimprimir Talão
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-2xl font-bold">Finalizar Pagamento</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="flex flex-col md:flex-row">
                <div className="flex-1 p-8 border-r border-white/10">
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Método de Pagamento</label>
                  <div className="grid grid-cols-1 gap-3">
                    <PaymentMethodBtn 
                      active={paymentMethod === 'cash'} 
                      onClick={() => setPaymentMethod('cash')}
                      icon={<Banknote />}
                      label="Dinheiro"
                    />
                    <PaymentMethodBtn 
                      active={paymentMethod === 'card'} 
                      onClick={() => setPaymentMethod('card')}
                      icon={<CreditCard />}
                      label="Multicaixa"
                    />
                    <PaymentMethodBtn 
                      active={paymentMethod === 'transfer'} 
                      onClick={() => setPaymentMethod('transfer')}
                      icon={<ArrowRightLeft />}
                      label="Transferência"
                    />
                  </div>

                  <div className="mt-8">
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome do Cliente (Opcional)</label>
                    <input 
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Ex: João Silva"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className="mt-8">
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Valor Recebido</label>
                      <input 
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-2xl font-mono text-white focus:outline-none focus:border-emerald-500"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={e => setCashReceived(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div className="w-full md:w-[300px] p-8 bg-black/20 flex flex-col gap-6">
                  <div>
                    <p className="text-white/40 text-sm mb-1">Total a Pagar</p>
                    <p className="text-3xl font-bold text-white">{cartTotal.toFixed(2)} Kz</p>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div>
                      <p className="text-white/40 text-sm mb-1">Troco</p>
                      <p className={`text-3xl font-bold ${change > 0 ? 'text-emerald-500' : 'text-white/20'}`}>
                        {change.toFixed(2)} Kz
                      </p>
                    </div>
                  )}

                  <div className="flex-1" />

                  <button 
                    onClick={handleFinalizeSale}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20"
                  >
                    Confirmar Venda
                    <CheckCircle2 size={20} />
                  </button>
                  <button className="w-full bg-white/5 hover:bg-white/10 text-white/60 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2">
                    <Printer size={18} />
                    Imprimir Talão
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Opening Modal */}
      <AnimatePresence>
        {isCashModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                  <Banknote size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Abertura de Caixa</h3>
                <p className="text-white/40 text-sm">Informe o valor inicial em caixa para começar o turno</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Valor de Abertura (Kz)</label>
                  <input 
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-2xl font-mono text-white text-center focus:outline-none focus:border-emerald-500"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(e.target.value)}
                    autoFocus
                  />
                </div>
                <button 
                  onClick={handleOpenCash}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                >
                  Abrir Caixa e Iniciar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome da Categoria</label>
                  <input 
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Sobremesas"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm({ name: e.target.value })}
                  />
                </div>

                <button 
                  onClick={handleSaveCategory}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                >
                  {editingCategory ? 'Guardar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome do Produto</label>
                    <input 
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      value={productForm.name}
                      onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Preço (Kz)</label>
                    <input 
                      type="number"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Categoria</label>
                    {categories.length === 0 ? (
                      <div className="text-xs text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                        Crie uma categoria primeiro na aba "Categorias"
                      </div>
                    ) : (
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                        value={productForm.category_id}
                        onChange={e => setProductForm({ ...productForm, category_id: parseInt(e.target.value) })}
                      >
                        <option value={0} disabled className="bg-[#141414]">Selecionar Categoria</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-[#141414]">{cat.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Tipo de Produto</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      value={productForm.is_prepared}
                      onChange={e => setProductForm({ ...productForm, is_prepared: parseInt(e.target.value) })}
                    >
                      <option value={0} className="bg-[#141414]">Item com Stock (Bebidas, etc)</option>
                      <option value={1} className="bg-[#141414]">Preparado (Hambúrgueres, etc)</option>
                    </select>
                  </div>
                  {productForm.is_prepared === 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Stock Inicial</label>
                      <input 
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                        value={productForm.initial_stock}
                        onChange={e => setProductForm({ ...productForm, initial_stock: e.target.value })}
                        disabled={!!editingProduct}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Estado</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                      value={productForm.active}
                      onChange={e => setProductForm({ ...productForm, active: parseInt(e.target.value) })}
                    >
                      <option value={1} className="bg-[#141414]">Ativo</option>
                      <option value={0} className="bg-[#141414]">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsProductModalOpen(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveProduct}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                  >
                    {editingProduct ? 'Atualizar' : 'Criar Produto'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {isProductDetailsModalOpen && productDetails && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductDetailsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-2xl font-bold">{productDetails.product.name}</h3>
                  <p className="text-white/40 text-sm mt-1">{productDetails.product.category_name}</p>
                </div>
                <button onClick={() => setIsProductDetailsModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Informações Gerais</h4>
                    <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between">
                        <span className="text-white/40 text-sm">Preço Atual</span>
                        <span className="font-bold text-emerald-500">{productDetails.product.price.toFixed(2)} Kz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40 text-sm">Stock</span>
                        <span className="font-bold">{productDetails.product.is_prepared ? 'Preparado' : `${productDetails.product.stock_quantity || 0} unidades`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40 text-sm">Criado em</span>
                        <span className="text-sm">{new Date(productDetails.product.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40 text-sm">Última Modificação</span>
                        <span className="text-sm">{new Date(productDetails.product.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Histórico de Preços</h4>
                  <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-white/40 text-[10px] uppercase">
                          <tr>
                            <th className="px-4 py-2">Data</th>
                            <th className="px-4 py-2 text-right">Preço</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {productDetails.history.map((h, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 text-white/60 text-xs">
                                {new Date(h.changed_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {h.new_price.toFixed(2)} Kz
                              </td>
                            </tr>
                          ))}
                          {productDetails.history.length === 0 && (
                            <tr>
                              <td colSpan={2} className="px-4 py-8 text-center text-white/20">Sem histórico</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUserModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome de Utilizador</label>
                  <input 
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: joao.silva"
                    value={userForm.username}
                    onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                  </label>
                  <input 
                    type="password"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nível de Permissão</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setUserForm({ ...userForm, role: 'operator' })}
                      className={`py-4 rounded-2xl text-sm font-bold border transition-all ${userForm.role === 'operator' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      Operador
                    </button>
                    <button 
                      onClick={() => setUserForm({ ...userForm, role: 'admin' })}
                      className={`py-4 rounded-2xl text-sm font-bold border transition-all ${userForm.role === 'admin' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSaveUser}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                >
                  {editingUser ? 'Guardar Alterações' : 'Criar Utilizador'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Dados não salvos</h3>
                <p className="text-white/40 text-sm mb-8">
                  Tem itens no carrinho que serão perdidos. Tem certeza que deseja sair?
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmPendingAction}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-red-500/20"
                  >
                    Sim, Sair
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Update Modal */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStockModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Atualizar Stock</h3>
                  <p className="text-white/40 text-xs mt-1">{selectedStockProduct?.name}</p>
                </div>
                <button onClick={() => setIsStockModalOpen(false)} className="text-white/40 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nova Quantidade</label>
                  <input 
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-2xl font-mono text-white text-center focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                    value={newStockQuantity}
                    onChange={e => setNewStockQuantity(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsStockModalOpen(false)}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleUpdateStock}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/20"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function SidebarItem({ icon, active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
        active 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'text-white/40 hover:text-white hover:bg-white/5'
      }`}
    >
      {React.cloneElement(icon, { size: 24 })}
      <div className="absolute left-full ml-4 px-2 py-1 bg-white text-black text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {label}
      </div>
    </button>
  );
}

function CategoryTab({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border ${
        active 
          ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'bg-[#141414] border-white/10 text-white/40 hover:border-white/20 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({ product, onClick }: { product: Product, onClick: () => void, key?: any }) {
  return (
    <motion.button 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-[#141414] border border-white/10 rounded-2xl p-4 text-left flex flex-col gap-4 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-emerald-500 rounded-lg p-1">
          <Plus size={16} className="text-white" />
        </div>
      </div>
      
      <div className="flex-1">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1 block">
          {product.category_name}
        </span>
        <h4 className="font-bold text-sm leading-tight group-hover:text-emerald-500 transition-colors">
          {product.name}
        </h4>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-white font-mono">
            {product.price.toFixed(2)} <span className="text-[10px] text-white/40">Kz</span>
          </p>
          {product.is_prepared === 0 && product.stock_quantity !== null && product.stock_quantity <= (product.min_quantity || 5) && (
            <div className="flex items-center gap-1 mt-1 text-amber-500">
              <AlertTriangle size={10} />
              <span className="text-[9px] font-bold uppercase">Stock Baixo</span>
            </div>
          )}
        </div>
        {product.is_prepared === 0 && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
            product.stock_quantity !== null && product.stock_quantity <= (product.min_quantity || 5) ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-white/30'
          }`}>
            {product.stock_quantity || 0} un
          </span>
        )}
      </div>
    </motion.button>
  );
}

function PaymentMethodBtn({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 px-6 py-5 rounded-2xl border-2 transition-all ${
        active 
          ? 'bg-emerald-500/10 border-emerald-500 text-white' 
          : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
      }`}
    >
      <div className={`${active ? 'text-emerald-500' : 'text-white/20'}`}>
        {React.cloneElement(icon, { size: 24 })}
      </div>
      <span className="font-bold">{label}</span>
      {active && <CheckCircle2 size={20} className="ml-auto text-emerald-500" />}
    </button>
  );
}

function ReportCard({ title, value, trend }: any) {
  const isPositive = trend.startsWith('+');
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold">{value}</p>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}
