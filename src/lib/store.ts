import { useState, useEffect } from 'react';
// import { clearLocalDataIfNotAdmin } from './clearLocalData'; // removed unused import
import { supabase } from './supabase';
import { toast } from 'sonner';

// Key for offline product storage
const OFFLINE_PRODUCTS_KEY = 'velora_offline_products';

export const getActiveUserEmail = async (): Promise<string> => {
    try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.user?.email) {
            return sess.session.user.email.toLowerCase();
        }
    } catch {}

    const fake = localStorage.getItem('velora_fake_session');
    if (fake) {
        try {
            const parsed = JSON.parse(fake);
            if (parsed?.user?.email) return parsed.user.email.toLowerCase();
        } catch {}
    }

    return (import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();
};

const getInitialLocalProducts = (): Product[] => {
    const stored = localStorage.getItem(OFFLINE_PRODUCTS_KEY) || localStorage.getItem('velora_products') || localStorage.getItem('evolux_offline_products') || localStorage.getItem('evolux_products');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            console.error('Failed to parse products from localStorage', e);
        }
    }
    return [];
};
export const sendLocalNotification = (title: string, options?: NotificationOptions) => {
    // Always show a toast in-app (styled by sonner)
    if (title.includes('Erro') || title.includes('Falha')) {
        toast.error(title, { description: options?.body });
    } else {
        toast.success(title, { description: options?.body });
    }

    // Try to send native browser notification for background/away state
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    reg.showNotification(title, options);
                } else {
                    new Notification(title, options);
                }
            }).catch(() => {
                new Notification(title, options);
            });
        } else {
            new Notification(title, options);
        }
    }
};

// Shared type definitions
export type ProductType = 'Digital' | 'Fisico' | 'Serviço';
export type Category = 'Ebook' | 'Curso' | 'Mentoria' | 'Workshop' | 'Outro';

export interface Product {
    id: string;
    name: string;
    type: ProductType;
    category: Category;
    price: number;
    sales: number;
    revenue: number;
    status: 'Ativo' | 'Rascunho' | 'Arquivado';
    description?: string;
    phone?: string;
    salesLink?: string;
    pixel?: string;
    isMarketplaceEnabled: boolean;
    commission: number; // Percentage (0-100)
    affiliationType: 'Automatica' | 'Manual';
    image?: string;
    deliveryLink?: string; // Product deliverable link
    enableCountdown?: boolean; // Activate countdown timer
    user_email?: string; // Associated user email
    enableScarcity?: boolean; // Scarcity notifications toggle
    enableScarcityNotification?: boolean; // Scarcity notifications legacy toggle
    barColor?: string; // Countdown bar color
    createdAt: string;
}

export const mapSupabaseProduct = (row: any): Product => ({
    id: String(row.id || crypto.randomUUID()),
    name: row.name || 'Produto sem nome',
    type: (row.type as ProductType) || 'Digital',
    category: (row.category as Category) || 'Outro',
    price: Number(row.price) || 0,
    sales: Number(row.sales) || 0,
    revenue: Number(row.revenue) || 0,
    status: (row.status as Product['status']) || 'Ativo',
    description: row.description || '',
    phone: row.phone || '',
    salesLink: row.saleslink || row.salesLink || '',
    pixel: row.pixel || '',
    isMarketplaceEnabled: Boolean(row.ismarketplaceenabled ?? row.isMarketplaceEnabled ?? true),
    commission: Number(row.commission) || 0,
    affiliationType: (row.affiliationtype || row.affiliationType || 'Automatica') as Product['affiliationType'],
    image: row.image || '',
    deliveryLink: row.deliverylink || row.deliveryLink || '',
    enableCountdown: Boolean(row.enablecountdown ?? row.enableCountdown),
    enableScarcity: Boolean(row.enablescarcity ?? row.enableScarcity),
    enableScarcityNotification: Boolean(row.enablescarcitynotification ?? row.enableScarcityNotification ?? row.enablescarcity ?? row.enableScarcity),
    barColor: row.barcolor || row.barColor || '#007BFF',
    user_email: row.user_email || '',
    createdAt: row.createdat || row.createdAt || row.created_at || new Date().toISOString()
});

export const formatProductForSupabase = (p: Product, userEmail?: string) => ({
    id: p.id,
    name: p.name,
    type: p.type || 'Digital',
    category: p.category,
    price: Number(p.price) || 0,
    sales: Number(p.sales) || 0,
    revenue: Number(p.revenue) || 0,
    status: p.status || 'Ativo',
    description: p.description || '',
    phone: p.phone || '',
    saleslink: p.salesLink || '',
    pixel: p.pixel || '',
    ismarketplaceenabled: Boolean(p.isMarketplaceEnabled ?? true),
    commission: Number(p.commission) || 0,
    affiliationtype: p.affiliationType || 'Automatica',
    image: p.image || '',
    deliverylink: p.deliveryLink || '',
    enablecountdown: Boolean(p.enableCountdown),
    enablescarcity: Boolean(p.enableScarcity || p.enableScarcityNotification),
    enablescarcitynotification: Boolean(p.enableScarcityNotification || p.enableScarcity),
    barcolor: p.barColor || '#007BFF',
    user_email: p.user_email || userEmail || '',
    createdat: p.createdAt || new Date().toISOString()
});

const getInitialProducts = async (): Promise<Product[]> => {
    const localProducts = getInitialLocalProducts();
    try {
        const userEmail = await getActiveUserEmail();
        const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();

        let query = supabase.from('products').select('*');
        if (userEmail && userEmail !== ADMIN_EMAIL) {
            query = query.eq('user_email', userEmail);
        }

        const { data, error } = await query;
        if (error) {
            console.warn('Could not fetch products from Supabase, using local fallback:', error);
            return localProducts;
        }

        if (data && Array.isArray(data) && data.length > 0) {
            let remoteProducts = data.map(mapSupabaseProduct);

            // Fetch associated images from product_images table if present
            try {
                const { data: imgData, error: imgError } = await supabase.from('product_images').select('product_id,url');
                if (!imgError && imgData) {
                    const imgMap = new Map<string, string>();
                    (imgData as any[]).forEach(row => {
                        if (!imgMap.has(row.product_id)) imgMap.set(row.product_id, row.url);
                    });
                    remoteProducts = remoteProducts.map(p => ({
                        ...p,
                        image: p.image || imgMap.get(p.id) || '',
                    }));
                }
            } catch (e) {
                console.warn('Could not fetch product_images:', e);
            }

            // Merge remote products with local products (avoiding duplicates by id)
            const remoteIds = new Set(remoteProducts.map(p => p.id));
            const merged = [...remoteProducts];
            localProducts.forEach(lp => {
                if (!remoteIds.has(lp.id)) {
                    merged.push(lp);
                    // Sync unpushed local products to Supabase
                    try {
                        const payload = formatProductForSupabase(lp, lp.user_email || userEmail);
                        supabase.from('products').upsert(payload, { onConflict: 'id' }).then(() => {});
                    } catch (e) {}
                }
            });

            merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            return merged;
        }

        return localProducts;
    } catch (e) {
        console.warn('Failed to fetch products from Supabase:', e);
        return localProducts;
    }
};

let globalProducts: Product[] = getInitialLocalProducts(); 

const listeners = new Set<(products: Product[]) => void>();

export const useProductsStore = () => {
    const [products, setProducts] = useState<Product[]>(globalProducts);

    useEffect(() => {
        const listener = (newProducts: Product[]) => setProducts(newProducts);
        listeners.add(listener);

        const fetchProducts = async () => {
            const data = await getInitialProducts();
            if (data && data.length > 0) {
                globalProducts = data;
                localStorage.setItem(OFFLINE_PRODUCTS_KEY, JSON.stringify(globalProducts));
                localStorage.setItem('velora_products', JSON.stringify(globalProducts));
                listeners.forEach(l => l(globalProducts));
            }
        };
        fetchProducts();

        return () => {
            listeners.delete(listener);
        };
    }, []);

    const updateProducts = (newProducts: Product[]) => {
        globalProducts = newProducts;
        localStorage.setItem(OFFLINE_PRODUCTS_KEY, JSON.stringify(globalProducts));
        localStorage.setItem('velora_products', JSON.stringify(globalProducts));
        listeners.forEach(l => l(globalProducts));
    };

    const addProduct = async (product: Product) => {
        const userEmail = await getActiveUserEmail();
        const completeProduct: Product = {
            ...product,
            price: Number(product.price) || 0,
            user_email: userEmail,
            createdAt: product.createdAt || new Date().toISOString()
        };

        // 1. Optimistic update: Guarantee immediate save to state and localStorage
        const updatedList = [completeProduct, ...globalProducts.filter(p => p.id !== completeProduct.id)];
        updateProducts(updatedList);

        // Preload checkout cache for immediate preview
        try {
            localStorage.setItem(`checkout_product_${completeProduct.id}`, JSON.stringify(completeProduct));
            if (completeProduct.image) {
                localStorage.setItem(`checkout_img_${completeProduct.id}`, completeProduct.image);
            }
        } catch (e) {}

        sendLocalNotification('📦 Novo Produto Salvo!', {
            body: `O produto "${product.name}" foi criado e salvo com sucesso.`,
            icon: '/logo.png'
        });

        // 2. Persist to Supabase in background
        try {
            const dbPayload = formatProductForSupabase(completeProduct, userEmail);

            const { error } = await supabase.from('products').upsert(dbPayload, { onConflict: 'id' });
            if (error) {
                console.warn('Aviso ao sincronizar produto com Supabase:', error);
            }

            if (completeProduct.image) {
                await supabase.from('product_images').upsert({
                    product_id: completeProduct.id,
                    url: completeProduct.image
                }, { onConflict: 'product_id' }).catch((err: any) => console.warn('Aviso product_images:', err));
            }
        } catch (e: any) {
            console.warn('Falha de rede ao persistir no Supabase (salvo localmente):', e);
        }

        return completeProduct;
    };

    const deleteProduct = async (id: string) => {
        // Atualiza imediatamente local
        updateProducts(globalProducts.filter(p => p.id !== id));
        try {
            localStorage.removeItem(`checkout_product_${id}`);
            localStorage.removeItem(`checkout_img_${id}`);
        } catch (e) {}
        toast.success('Produto removido com sucesso!');

        // Remove do Supabase de forma assíncrona
        try {
            await supabase.from('products').delete().eq('id', id);
            await supabase.from('product_images').delete().eq('product_id', id).catch(() => {});
        } catch (e) {
            console.warn('Erro ao remover produto do Supabase:', e);
        }
    };

    const editProduct = async (updatedProduct: Product) => {
        const oldProduct = globalProducts.find(p => p.id === updatedProduct.id);
        const userEmail = await getActiveUserEmail();
        const completeProduct: Product = {
            ...updatedProduct,
            price: Number(updatedProduct.price) || 0,
            user_email: updatedProduct.user_email || userEmail
        };

        // 1. Atualização imediata local
        updateProducts(globalProducts.map(p => (p.id === completeProduct.id ? completeProduct : p)));

        // Update checkout cache so any checkout opened or refreshed immediately reflects the new price & details
        try {
            localStorage.setItem(`checkout_product_${completeProduct.id}`, JSON.stringify(completeProduct));
            if (completeProduct.image) {
                localStorage.setItem(`checkout_img_${completeProduct.id}`, completeProduct.image);
            }
        } catch (e) {}

        if (oldProduct && oldProduct.status !== 'Ativo' && completeProduct.status === 'Ativo') {
            sendLocalNotification('✅ Produto Aprovado!', {
                body: `O produto "${completeProduct.name}" agora está Ativo.`,
                icon: '/logo.png'
            });
        } else {
            toast.success('Produto atualizado com sucesso!');
        }

        // 2. Sincroniza no Supabase
        try {
            const dbPayload = formatProductForSupabase(completeProduct, completeProduct.user_email || userEmail);

            const { error } = await supabase.from('products').upsert(dbPayload, { onConflict: 'id' });
            if (error) {
                console.warn('Erro ao atualizar produto no Supabase:', error);
            }

            if (completeProduct.image) {
                await supabase.from('product_images').upsert({
                    product_id: completeProduct.id,
                    url: completeProduct.image
                }, { onConflict: 'product_id' }).catch(() => {});
            }
        } catch (e) {
            console.warn('Erro ao atualizar produto no Supabase:', e);
        }
    };

    return { products, addProduct, deleteProduct, editProduct, updateProducts };
};

// --- Affiliates Store ---

export interface AffiliateRequest {
    id: string;
    productId: string;
    productName: string;
    userName: string;
    userEmail: string;
    status: 'Pendente' | 'Aprovado' | 'Rejeitado';
    requestedAt: string;
    commission: number;
}

const AFFILIATES_STORAGE_KEY = 'velora_affiliate_requests';

const initialRequests: AffiliateRequest[] = [];

const getInitialRequests = (): AffiliateRequest[] => {
    const stored = localStorage.getItem(AFFILIATES_STORAGE_KEY) || localStorage.getItem('evolux_affiliate_requests');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse requests from localStorage', e);
        }
    }
    return initialRequests;
};

let globalRequests = getInitialRequests();
const requestListeners = new Set<(requests: AffiliateRequest[]) => void>();

export const useAffiliatesStore = () => {
    const [requests, setRequests] = useState<AffiliateRequest[]>(globalRequests);

    useEffect(() => {
        const listener = (newRequests: AffiliateRequest[]) => setRequests(newRequests);
        requestListeners.add(listener);
        return () => {
            requestListeners.delete(listener);
        };
    }, []);

    const updateRequests = (newRequests: AffiliateRequest[]) => {
        globalRequests = newRequests;
        localStorage.setItem(AFFILIATES_STORAGE_KEY, JSON.stringify(globalRequests));
        requestListeners.forEach(l => l(globalRequests));
    };

    const addRequest = (request: Omit<AffiliateRequest, 'id' | 'requestedAt' | 'status'>) => {
        const newReq: AffiliateRequest = {
            ...request,
            id: `REQ-${Math.floor(Math.random() * 10000)}`,
            requestedAt: new Date().toISOString().split('T')[0],
            status: 'Pendente'
        };
        updateRequests([newReq, ...globalRequests]);
    };

    const approveRequest = (id: string) => {
        updateRequests(globalRequests.map(r => r.id === id ? { ...r, status: 'Aprovado' } : r));
    };

    const rejectRequest = (id: string) => {
        updateRequests(globalRequests.map(r => r.id === id ? { ...r, status: 'Rejeitado' } : r));
    };

    return { requests, addRequest, approveRequest, rejectRequest };
};

// --- Marketing Store ---

export interface Coupon {
  // New flag to control scarcity notification toggle
  enableScarcity?: boolean;
    id: string;
    code: string;
    discount: number;
    type: 'Percentage' | 'Fixed';
    productId: string; // "all" or specific PRD-ID
    status: 'Ativo' | 'Inativo';
    uses: number;
}

export interface MarketingCampaign {
    id: string;
    name: string;
    type: 'Email' | 'Whatsapp' | 'Ads';
    status: 'Ativo' | 'Pausado';
    leads: number;
    conversions: number;
    spend: number;
}

const COUPONS_STORAGE_KEY = 'velora_coupons';
const CAMPAIGNS_STORAGE_KEY = 'velora_campaigns';

const initialCoupons: Coupon[] = [];

const initialCampaigns: MarketingCampaign[] = [];

export const useMarketingStore = () => {
    const [coupons, setCoupons] = useState<Coupon[]>(() => {
        const stored = localStorage.getItem(COUPONS_STORAGE_KEY) || localStorage.getItem('evolux_coupons');
        return stored ? JSON.parse(stored) : initialCoupons;
    });

    const [campaigns, setCampaigns] = useState<MarketingCampaign[]>(() => {
        const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY) || localStorage.getItem('evolux_campaigns');
        return stored ? JSON.parse(stored) : initialCampaigns;
    });

    useEffect(() => {
        localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
    }, [coupons]);

    useEffect(() => {
        localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
    }, [campaigns]);

    const addCoupon = (coupon: Omit<Coupon, 'id' | 'uses'>) => {
        const newCoupon: Coupon = {
            ...coupon,
            id: `CPN-${Math.floor(Math.random() * 10000)}`,
            uses: 0
        };
        setCoupons([newCoupon, ...coupons]);
    };

    const deleteCoupon = (id: string) => {
        setCoupons(coupons.filter(c => c.id !== id));
    };

    const addCampaign = (campaign: Omit<MarketingCampaign, 'id' | 'leads' | 'conversions'>) => {
        const newCamp: MarketingCampaign = {
            ...campaign,
            id: `CMP-${Math.floor(Math.random() * 10000)}`,
            leads: 0,
            conversions: 0
        };
        setCampaigns([newCamp, ...campaigns]);
    };

    return { coupons, addCoupon, deleteCoupon, campaigns, addCampaign };
};

// --- Transactions Store ---

export interface Transaction {
    id: string;
    type: 'payment' | 'withdrawal';
    amount: number;
    phone: string;
    method: 'M-Pesa' | 'e-Mola';
    status: 'Pendente' | 'Concluído' | 'Falhou';
    reference: string;
    description?: string;
    customerName?: string;
    customerEmail?: string;
    createdAt: string;
    device?: 'Mobile' | 'Desktop';
    failureReason?: string;
}

const TRANSACTIONS_STORAGE_KEY = 'velora_transactions';

const getInitialTransactions = (): Transaction[] => {
    const stored = localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || localStorage.getItem('evolux_transactions');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse transactions', e);
        }
    }
    return [];
};

let globalTransactions = getInitialTransactions();
const transactionListeners = new Set<(txs: Transaction[]) => void>();

export const useTransactionsStore = () => {
    const [transactions, setTransactions] = useState<Transaction[]>(globalTransactions);

    const updateTransactions = (newTxs: Transaction[]) => {
        globalTransactions = newTxs;
        localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(globalTransactions));
        transactionListeners.forEach(l => l(globalTransactions));
    };

    useEffect(() => {
        const listener = (newTxs: Transaction[]) => setTransactions(newTxs);
        transactionListeners.add(listener);

        console.log('Supabase client initialized:', supabase);

        const fetchTransactions = async () => {
            try {

                let query = supabase.from('transactions').select('*').order('createdat', { ascending: false });
                
                // Multi-Tenant Isolation
                const { data: sess } = await supabase.auth.getSession();
                const userEmail = sess?.session?.user?.email;
                const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();
                
                if (userEmail && userEmail.toLowerCase() !== ADMIN_EMAIL) {
                    query = query.eq('customerEmail', userEmail);
                }

                const { data, error } = await query;
                console.log('Supabase fetch result:', { data, error });
                
                if (error) {
                    throw error;
                }
                if (data && data.length > 0) {
                    const mapped = data.map((tx: any) => ({
                        ...tx,
                        amount: Number(tx.amount),
                        createdAt: tx.createdAt || tx.created_at || tx.createdat
                    }));
                    updateTransactions(mapped);
                } else {
                    // Se estiver vazio no Supabase, tenta carregar as transações locais salvas
                    const local = getInitialTransactions();
                    if (local.length > 0) {
                        updateTransactions(local);
                    }
                }
            } catch (err) {
                console.warn('Erro ao conectar ao Supabase (usando localStorage como backup offline):', err);
                // Carrega transações offline salvas em localStorage
                const local = getInitialTransactions();
                updateTransactions(local);
            }
        };

        fetchTransactions();

        // Inscreve no canal em tempo real para escutar atualizações de transações
        let channel: any = null;
        try {
            channel = supabase
                .channel('public-transactions-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
                    console.log('Realtime transaction update:', payload);
                    fetchTransactions();
                    
                    // Trigger System Notification for Payments
                    if (payload.eventType === 'INSERT' && payload.new.type === 'payment' && payload.new.status === 'Concluído') {
                        const val = Number(payload.new.amount).toLocaleString('pt-PT');
                        // const method = payload.new.method || 'VELORA Pay'; // removed unused variable
                        sendLocalNotification('Você recebeu um novo pedido! 🎉', {
                            body: `Venda aprovada de ${val} MT ${payload.new.method}`,
                            icon: '/logo.png'
                        });
                    } else if (payload.eventType === 'UPDATE' && payload.new.type === 'payment' && payload.old?.status !== 'Concluído' && payload.new.status === 'Concluído') {
                        const val = Number(payload.new.amount).toLocaleString('pt-PT');
                        // const method = payload.new.method || 'VELORA Pay'; // removed unused variable
                        sendLocalNotification('Você recebeu um novo pedido! 🎉', {
                            body: `Venda aprovada de ${val} MT ${payload.new.method}`,
                            icon: '/logo.png'
                        });
                    }
                    
                    // Trigger System Notification for Withdrawals
                    if (payload.eventType === 'UPDATE' && payload.new.type === 'withdrawal' && payload.old.status !== 'Concluído' && payload.new.status === 'Concluído') {
                        const val = Number(payload.new.amount).toLocaleString('pt-PT');
                        sendLocalNotification('💸 Levantamento Aprovado!', {
                            body: `O seu saque de ${val} MZN foi concluído com sucesso.`,
                            icon: '/logo.png'
                        });
                    }
                })
                .on('broadcast', { event: 'test_push' }, (payload: any) => {
                    console.log('Realtime broadcast test_push:', payload);
                    const val = Number(payload.payload.amount).toLocaleString('pt-PT');
                    sendLocalNotification('Você recebeu um novo pedido! 🎉 (TESTE)', {
                        body: `Venda aprovada de ${val} MT ${payload.payload.method}`,
                        icon: '/logo.png'
                    });
                })
                .subscribe();
        } catch (e) {
            console.warn('Falha ao assinar canal em tempo real do Supabase:', e);
        }

        // Auto-aprovação removida: A aprovação deve vir exclusivamente do Webhook da E2Payments (api/webhook.ts)
        // para garantir a segurança e o disparo correto das integrações (LowTrack, Pushcut, etc).

        // Recarrega transações ao voltar ao aplicativo (ex: no celular quando sai de segundo plano)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('App returned to foreground, refreshing transactions...');
                fetchTransactions();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            transactionListeners.delete(listener);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (channel) {
                try {
                    supabase.removeChannel(channel);
                } catch (e) {}
            }
        };
    }, []);

    const addTransaction = async (tx: Omit<Transaction, 'createdAt'>) => {
        const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const newTx: Transaction = {
            ...tx,
            device: tx.device || (isMobile ? 'Mobile' : 'Desktop'),
            createdAt: new Date().toISOString()
        };
        
        // Atualização otimista local
        updateTransactions([newTx, ...globalTransactions]);
        
        // Notifications
        if (newTx.type === 'withdrawal') {
            const val = Number(newTx.amount).toLocaleString('pt-PT');
            sendLocalNotification('🏦 Levantamento Solicitado!', {
                body: `Sua solicitação de saque de ${val} MZN foi enviada. Processando B2C automático...`,
                icon: '/logo.png'
            });
        }

        // Grava no Supabase de forma assíncrona
        try {
            const { error } = await supabase
                .from('transactions')
                .insert([{
                    id: newTx.id,
                    type: newTx.type,
                    amount: newTx.amount,
                    phone: newTx.phone,
                    method: newTx.method,
                    status: newTx.status,
                    reference: newTx.reference,
                    description: newTx.description,
                    customerName: newTx.customerName,
                    customerEmail: newTx.customerEmail,
                    device: newTx.device,
                    createdat: newTx.createdAt
                }]);
            if (error) {
                console.warn('Erro ao inserir transação no Supabase:', error);
            }



        } catch (err) {
            console.warn('Falha de rede ao persistir transação no Supabase (salva apenas localmente):', err);
        }
    };

    const updateTransactionStatus = async (id: string, status: Transaction['status'], failureReason?: string) => {
        const tx = globalTransactions.find(t => t.id === id);
        const updated = globalTransactions.map(t =>
            t.id === id ? { ...t, status, ...(failureReason ? { failureReason } : {}) } : t
        );
        updateTransactions(updated);
        
        // Local Notification for withdrawal approval if not coming from realtime
        if (tx && tx.type === 'withdrawal' && tx.status !== 'Concluído' && status === 'Concluído') {
            const val = Number(tx.amount).toLocaleString('pt-PT');
            sendLocalNotification('💸 Levantamento Aprovado!', {
                body: `O seu saque de ${val} MZN foi concluído com sucesso.`,
                icon: '/logo.png'
            });
        }
        try {
            await supabase
                .from('transactions')
                .update({ status, ...(failureReason ? { failureReason } : {}) })
                .eq('id', id);
        } catch (e) {
            console.warn('Erro ao atualizar status no Supabase:', e);
        }
    };

    return { transactions, addTransaction, updateTransactionStatus };
};
