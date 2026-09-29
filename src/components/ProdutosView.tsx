
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Edit2,
    Trash2, Package, Globe,
    ChevronDown, Phone, Link2, Target,
    Upload, X, DollarSign, XCircle, Check, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProductsStore, type Product, type Category } from '../lib/store';
import { ConfirmationModal } from './ConfirmationModal';
import { CheckoutModal } from './CheckoutModal';

export const ProdutosView = () => {
    const { products, addProduct, deleteProduct, editProduct } = useProductsStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [filterStatus, setFilterStatus] = useState<'Todos' | 'Ativo' | 'Rascunho'>('Todos');
    const [productToDelete, setProductToDelete] = useState<string | null>(null);
    const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
    const [copiedProductId, setCopiedProductId] = useState<string | null>(null);
    const [shorteningProductId, setShorteningProductId] = useState<string | null>(null);



    const handleCopyLink = async (product: Product) => {
        const origin = window.location.origin;
        
        // Save full image and product to localStorage for same-origin preview
        if (product.image) {
            localStorage.setItem(`checkout_img_${product.id}`, product.image);
        } else {
            localStorage.removeItem(`checkout_img_${product.id}`);
        }
        try {
            localStorage.setItem(`checkout_product_${product.id}`, JSON.stringify(product));
        } catch (e) {}

        const queryParams: Record<string, string> = {
            id: product.id,
            name: product.name,
            price: String(product.price)
        };

        setShorteningProductId(product.id);

        const params = new URLSearchParams(queryParams);
        const longLink = `${origin}/checkout?${params.toString()}`;
        
        setShorteningProductId(null);
        
        navigator.clipboard.writeText(longLink).then(() => {
            setCopiedProductId(product.id);
            setTimeout(() => { setCopiedProductId(null); }, 2000);
        }).catch(() => {
            // Fallback para celulares/Safari onde o clipboard assíncrono é bloqueado
            window.prompt('Link de Checkout gerado! Copie o link abaixo:', longLink);
            setCopiedProductId(product.id);
            setTimeout(() => { setCopiedProductId(null); }, 2000);
        });
    };

    const handleOpenCheckout = async (product: Product) => {
        const origin = window.location.origin;
        const newWindow = window.open('', '_blank'); // Abre imediatamente para não ser bloqueado no celular

        // Save full image and product to localStorage for same-origin preview
        if (product.image) {
            localStorage.setItem(`checkout_img_${product.id}`, product.image);
        } else {
            localStorage.removeItem(`checkout_img_${product.id}`);
        }
        try {
            localStorage.setItem(`checkout_product_${product.id}`, JSON.stringify(product));
        } catch (e) {}

        const queryParams: Record<string, string> = {
            id: product.id,
            name: product.name,
            price: String(product.price)
        };

        const params = new URLSearchParams(queryParams);
        const link = `${origin}/checkout?${params.toString()}`;
        if (newWindow) {
            newWindow.location.href = link;
        } else {
            window.location.href = link;
        }
    };

    // Create Form States
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newCategory, setNewCategory] = useState<Category>('Ebook');
    const [newDescription, setNewDescription] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newSalesLink, setNewSalesLink] = useState('');
    const [newDeliveryLink, setNewDeliveryLink] = useState('');
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [uploadedFileName, setUploadedFileName] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingFile(true);
        setUploadStatus('idle');
        setUploadedFileName(file.name);

        try {
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            formData.append('fileToUpload', file);

            const response = await fetch('/api/catbox', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const url = await response.text();
                if (url && url.trim().startsWith('http')) {
                    setNewDeliveryLink(url.trim());
                    setUploadStatus('success');
                } else {
                    setUploadStatus('error');
                }
            } else {
                setUploadStatus('error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    const [newPixel, setNewPixel] = useState('');
    const [isMarketplaceEnabled, setIsMarketplaceEnabled] = useState(false);
    const [newCommission, setNewCommission] = useState('50');
    const [newAffiliationType, setNewAffiliationType] = useState<'Automatica' | 'Manual'>('Automatica');
    const [newEnableCountdown, setNewEnableCountdown] = useState(false);
    const [newEnableScarcityNotification, setNewEnableScarcityNotification] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [newBarColor, setNewBarColor] = useState('#007BFF');

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.src = reader.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 150;
                    const MAX_HEIGHT = 150;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                        setImagePreview(compressedBase64);
                    } else {
                        setImagePreview(reader.result as string);
                    }
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'Todos' || p.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingProduct) {
                await editProduct({
                    ...editingProduct,
                    name: newName.trim(),
                    price: Number(newPrice) || 0,
                    category: newCategory,
                    description: newDescription.trim(),
                    phone: newPhone.trim(),
                    salesLink: newSalesLink.trim(),
                    pixel: newPixel.trim(),
                    isMarketplaceEnabled,
                    commission: Number(newCommission) || 0,
                    affiliationType: newAffiliationType,
                    image: imagePreview || editingProduct.image || '',
                    deliveryLink: newDeliveryLink.trim(),
                    enableCountdown: newEnableCountdown,
                    enableScarcityNotification: newEnableScarcityNotification,
                    barColor: newBarColor
                });
            } else {
                const prodId = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : 'prd_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

                const newProd: Product = {
                    id: prodId,
                    name: newName.trim(),
                    type: 'Digital',
                    category: newCategory,
                    price: Number(newPrice) || 0,
                    sales: 0,
                    revenue: 0,
                    status: 'Ativo',
                    description: newDescription.trim(),
                    phone: newPhone.trim(),
                    salesLink: newSalesLink.trim(),
                    pixel: newPixel.trim(),
                    isMarketplaceEnabled: isMarketplaceEnabled,
                    commission: Number(newCommission) || 0,
                    affiliationType: newAffiliationType,
                    image: imagePreview || undefined,
                    deliveryLink: newDeliveryLink.trim(),
                    enableCountdown: newEnableCountdown,
                    enableScarcityNotification: newEnableScarcityNotification,
                    barColor: newBarColor,
                    createdAt: new Date().toISOString()
                };
                await addProduct(newProd);
            }

            closeModal();
        } catch (err: any) {
            console.error('Erro ao submeter produto:', err);
            closeModal();
        }
    };

    const handleDeleteProduct = (id: string) => {
        setProductToDelete(id);
    };

    const confirmDelete = () => {
        if (productToDelete) {
            deleteProduct(productToDelete);
            setProductToDelete(null);
        }
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setNewName(product.name);
        setNewPrice(product.price.toString());
        setNewCategory(product.category);
        setNewDescription(product.description || '');
        setNewPhone(product.phone || '');
        setNewSalesLink(product.salesLink || '');
        setNewPixel(product.pixel || '');
        setIsMarketplaceEnabled(product.isMarketplaceEnabled);
        setNewCommission(product.commission.toString());
        setNewAffiliationType(product.affiliationType || 'Automatica');
        setNewDeliveryLink(product.deliveryLink || '');
        setNewEnableCountdown(product.enableCountdown || false);
        setNewEnableScarcityNotification(product.enableScarcityNotification || false);
        setNewBarColor(product.barColor || '#007BFF');
        setImagePreview(product.image || null);
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingProduct(null);
        setNewName('');
        setNewPrice('');
        setNewDescription('');
        setNewPhone('');
        setNewSalesLink('');
        setNewPixel('');
        setIsMarketplaceEnabled(false);
        setNewCommission('50');
        setNewAffiliationType('Automatica');
        setNewDeliveryLink('');
        setNewEnableCountdown(false);
        setNewBarColor('#007BFF');
        // reset scarcity toggle
        setNewEnableScarcityNotification(false);
        setImagePreview(null);
        setUploadStatus('idle');
        setUploadedFileName('');
    };

    return (
        <div className="px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Top Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16 relative">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-1 md:space-y-3 mt-4 md:mt-2"
                >
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0 flex items-center min-h-[2rem] md:min-h-0">
                        <span>Meus <span className="text-gradient">Produtos</span> 💎</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug">Gestão e criação de ativos digitais.</p>
                </motion.div>

                {/* Ativos Badge - Absolute Top Right */}
                <div className="absolute top-5 right-0 md:top-4 md:right-0 flex items-center justify-center gap-1.5 bg-white/50 dark:bg-emerald-950/20 backdrop-blur-md px-2 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm group/badge hover:border-emerald-400 transition-all duration-300 shrink-0 z-10">
                    <div className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-[0.15em] flex items-center gap-1">
                        <Package size={10} className="text-emerald-600 group-hover/badge:scale-110 transition-transform" />
                        {products.length} Ativos
                    </span>
                </div>

                <div className="flex flex-col items-end gap-2 ml-auto mt-6 md:mt-0">
                    <div className="flex flex-row flex-wrap items-center justify-end gap-2 md:gap-3 w-full md:w-auto shrink-0">
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100/50 dark:bg-brand-900/60 rounded-xl border border-white/10 backdrop-blur-3xl overflow-x-auto scrollbar-hide shrink-0">
                            {['Todos', 'Ativo', 'Rascunho'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s as any)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                        filterStatus === s
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                                            : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-row w-auto gap-1.5 shrink-0">
                            <div className="relative w-[100px] md:w-[140px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
                                <input
                                    type="text"
                                    placeholder="Pesquisar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-7 pl-6 pr-2 rounded-lg border border-white/20 dark:border-white/5 bg-white/50 dark:bg-brand-900/40 backdrop-blur-3xl text-[8px] md:text-[10px] font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                                />
                            </div>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="h-7 px-2.5 md:px-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-black text-[7px] md:text-[8px] uppercase tracking-[0.15em] shadow-xl hover:scale-[1.05] active:scale-[0.98] transition-all flex items-center justify-center gap-1 group whitespace-nowrap"
                            >
                                <Plus size={10} className="group-hover:rotate-90 transition-transform duration-500" />
                                <span className="hidden xs:inline">Criar </span>Produto
                            </button>
                        </div>
                    </div>
                </div>
            </div>







            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
                <AnimatePresence mode="popLayout">
                    {filteredProducts.map((product) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={product.id}
                            className="glass dark:bg-brand-900/60 rounded-2xl border border-white/20 dark:border-white/5 p-3 md:p-4 flex flex-col justify-between shadow-lg hover:shadow-emerald-600/20 transition-all duration-700 group hover:-translate-y-1"
                        >
                            {/* Top: Photo & Basic Info side by side */}
                            <div className="flex flex-col gap-3 items-center text-center mb-3">
                                <div className="relative h-12 w-12 md:h-16 md:w-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-brand-950 shrink-0 shadow-md border border-white dark:border-white/5">
                                    <img
                                        src={product.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop"}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    {product.status !== 'Ativo' && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                                            <XCircle size={18} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", product.status === 'Ativo' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                                            <span className="text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-widest">
                                                {product.category}
                                            </span>
                                        </div>
                                        <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-tight tracking-tighter group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                            {product.name}
                                        </h3>
                                        {product.description && (
                                            <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-500 font-medium line-clamp-2 max-w-[200px] mx-auto">
                                                {product.description}
                                            </p>
                                        )}
                                    </div>
                            </div>

                            {/* Bottom Info Table (Compact) */}
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-50/50 dark:bg-black/30 border border-slate-100 dark:border-white/5">
                                    <div className="space-y-0.5">
                                        <p className="text-[7px] font-black text-slate-400 dark:text-brand-600 uppercase tracking-widest">Preço</p>
                                        <p className="text-xs font-black text-emerald-600 dark:text-brand-300 tabular-nums">
                                            {product.price.toLocaleString()} <span className="text-[7px] opacity-60">MZN</span>
                                        </p>
                                    </div>
                                    <div className="space-y-0.5 border-l border-slate-200 dark:border-white/10 pl-2">
                                        <p className="text-[7px] font-black text-slate-400 dark:text-brand-600 uppercase tracking-widest">Vendas</p>
                                        <p className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                                            {product.sales}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => openEditModal(product)}
                                        className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-[10px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[8px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all shadow-md"
                                    >
                                        <Edit2 size={12} />
                                        Editar
                                    </button>
                                    <button 
                                        onClick={() => handleOpenCheckout(product)}
                                        className="h-8 w-8 flex items-center justify-center rounded-[10px] bg-white dark:bg-brand-800 border border-slate-100 dark:border-white/5 text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
                                        title="Visualizar Checkout"
                                    >
                                        <Globe size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleCopyLink(product)}
                                        disabled={shorteningProductId === product.id}
                                        className={cn(
                                            "h-8 w-8 flex items-center justify-center rounded-[10px] bg-white dark:bg-brand-800 border border-slate-100 dark:border-white/5 transition-all shadow-sm",
                                            copiedProductId === product.id ? "text-emerald-500" : (shorteningProductId === product.id ? "text-emerald-500 animate-pulse" : "text-slate-400 hover:text-emerald-600")
                                        )}
                                        title="Copiar Link de Checkout"
                                    >
                                        {copiedProductId === product.id ? (
                                            <Check size={14} />
                                        ) : (
                                            shorteningProductId === product.id ? (
                                                <div className="h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Link2 size={14} />
                                            )
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="h-8 w-8 flex items-center justify-center rounded-[10px] bg-white dark:bg-brand-800 border border-slate-100 dark:border-white/5 text-slate-400 hover:text-rose-500 transition-all shadow-sm"
                                        title="Apagar Produto"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 40 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-brand-900/90 rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden border border-white/20 dark:border-white/5 flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-brand-900/50 backdrop-blur-xl shrink-0">
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                                        Configuração <span className="text-gradient">do Produto</span>
                                    </h3>
                                    <p className="text-[10px] lg:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight mt-1">
                                        {editingProduct ? 'Sincronizando parâmetros do produto.' : 'Criação de novo produto digital.'}
                                    </p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    className="h-10 w-10 rounded-full bg-slate-100 dark:bg-brand-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all transform hover:rotate-90"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
                                <form id="asset-form" onSubmit={handleSubmit} className="space-y-6">
                                    {/* Section 1: Visual Identity */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                                            <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Identidade Visual</h4>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Image Upload Area */}
                                            <div className="lg:col-span-4">
                                                <div className="relative group aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-brand-800 bg-slate-50/50 dark:bg-brand-950/50 overflow-hidden transition-all hover:border-emerald-500/50 flex flex-col items-center justify-center">
                                                    {imagePreview ? (
                                                        <>
                                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setImagePreview(null)}
                                                                    className="h-10 w-10 rounded-full bg-white text-rose-600 flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer p-4 text-center group">
                                                            <Upload size={20} className="text-slate-400 mb-2 group-hover:scale-110 group-hover:text-emerald-600 transition-all" />
                                                            <span className="text-[8px] font-black text-slate-500 dark:text-brand-400 uppercase tracking-widest">Capa</span>
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Name & Description */}
                                            <div className="lg:col-span-8 space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Produto</label>
                                                    <input
                                                        required
                                                        value={newName}
                                                        onChange={(e) => setNewName(e.target.value)}
                                                        placeholder="ex: Curso de Finanças"
                                                        className="w-full h-10 px-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição</label>
                                                    <textarea
                                                        required
                                                        value={newDescription}
                                                        onChange={(e) => setNewDescription(e.target.value)}
                                                        placeholder="Descreva os benefícios..."
                                                        className="w-full h-24 px-4 py-3 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Parameters */}
                <div className="flex items-center gap-3">
                  <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                  <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Parâmetros de Notificação</h4>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="scarcityNotif"
                    checked={newEnableScarcityNotification}
                    onChange={(e) => setNewEnableScarcityNotification(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="scarcityNotif" className="text-xs font-black text-slate-400 uppercase">Ativar Notificações de Escassez</label>
                </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                                            <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Parâmetros Comerciais</h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Preço (MZN)</label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                                                    <input
                                                        required
                                                        type="number"
                                                        value={newPrice}
                                                        onChange={(e) => setNewPrice(e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all tabular-nums"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">WhatsApp</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                                                    <input
                                                        required
                                                        value={newPhone}
                                                        onChange={(e) => setNewPhone(e.target.value)}
                                                        placeholder="84xxxxxxx"
                                                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Pixel ID</label>
                                                <div className="relative">
                                                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                                                    <input
                                                        value={newPixel}
                                                        onChange={(e) => setNewPixel(e.target.value)}
                                                        placeholder="e.g. 123456789"
                                                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-black text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                                                <div className="relative">
                                                    <select
                                                        value={newCategory}
                                                        onChange={(e) => setNewCategory(e.target.value as Category)}
                                                        className="w-full h-10 px-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[13px] font-black text-slate-700 dark:text-white outline-none appearance-none cursor-pointer shadow-inner"
                                                    >
                                                        <option value="Ebook">E-book</option>
                                                        <option value="Curso">Curso Online</option>
                                                        <option value="Mentoria">Mentoria</option>
                                                        <option value="Workshop">Workshop</option>
                                                        <option value="Outro">Outro</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Página de Vendas</label>
                                            <div className="relative">
                                                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                <input
                                                    value={newSalesLink}
                                                    onChange={(e) => setNewSalesLink(e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[12px] font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">ENTREGÁVEL</label>
                                            <div className="space-y-2">
                                                {/* Link input */}
                                                <div className="relative">
                                                    <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                                                    <input
                                                        value={newDeliveryLink}
                                                        onChange={(e) => setNewDeliveryLink(e.target.value)}
                                                        placeholder="Link do Entregável"
                                                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50 text-[12px] font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                                    />
                                                </div>
                                                {/* Upload button - full width, larger */}
                                                <label className={cn(
                                                    "w-full h-12 rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all border-2 font-bold text-[13px]",
                                                    isUploadingFile
                                                        ? "border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-brand-950/50 text-slate-400 cursor-not-allowed"
                                                        : "border-dashed border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20"
                                                )}>
                                                    {isUploadingFile ? (
                                                        <Loader2 size={18} className="animate-spin text-emerald-500" />
                                                    ) : (
                                                        <Upload size={18} className="text-emerald-500" />
                                                    )}
                                                    <span>{isUploadingFile ? 'A carregar...' : 'Carregar Arquivo do Entregável'}</span>
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        className="hidden"
                                                        disabled={isUploadingFile}
                                                        onChange={handleFileUpload}
                                                    />
                                                </label>
                                            </div>
                                            {/* Upload status feedback - replaces alert() to prevent white screen */}
                                            {uploadStatus === 'success' && (
                                                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/20">
                                                    <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                                        <Check size={10} className="text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Arquivo carregado com sucesso!</p>
                                                        {uploadedFileName && <p className="text-[9px] text-emerald-600/70 dark:text-emerald-500/70 truncate">{uploadedFileName}</p>}
                                                    </div>
                                                    <button type="button" onClick={() => setUploadStatus('idle')} className="text-emerald-400 hover:text-emerald-600 transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            {uploadStatus === 'error' && (
                                                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/20">
                                                    <XCircle size={14} className="text-rose-500 shrink-0" />
                                                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Falha ao carregar. Tente novamente.</p>
                                                    <button type="button" onClick={() => setUploadStatus('idle')} className="ml-auto text-rose-400 hover:text-rose-600 transition-colors">
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-[9px] text-slate-400 px-1 pt-1">
                                                Adicione o link do Google Drive/Dropbox ou carregue diretamente arquivos até 4MB (PDFs, ZIPs, etc).
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 p-3 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-brand-950/50">
                                            <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                                <Target size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ativar Escassez (Contagem Regressiva)</h4>
                                                <p className="text-[9px] text-slate-500 dark:text-brand-400">Mostra um banner de contagem regressiva de 15 min no Checkout.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setNewEnableCountdown(!newEnableCountdown)}
                                                className={cn(
                                                    "w-10 h-5 rounded-full transition-all relative p-1 flex items-center",
                                                    newEnableCountdown ? "bg-orange-500" : "bg-slate-300 dark:bg-brand-800"
                                                )}
                                            >
                                                <motion.div
                                                    animate={{ x: newEnableCountdown ? 20 : 0 }}
                                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                    className="h-3 w-3 bg-white rounded-full shadow-md"
                                                />
                                            </button>
                                        </div>
                                        {newEnableCountdown && (
                                            <div className="flex flex-col gap-2 mt-2">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cor da Barra</label>
                                                <input
                                                    type="color"
                                                    value={newBarColor}
                                                    onChange={(e) => setNewBarColor(e.target.value)}
                                                    className="w-10 h-8 p-0 border rounded"
                                                />
                                                <div className="flex gap-2 mt-1">
                                                    {/* Preset color buttons */}
                                                    {[
                                                        { name: 'Roxo', value: '#8B00FF' },
                                                        { name: 'Azul', value: '#007BFF' },
                                                        { name: 'Vermelho', value: '#E11D24' },
                                                        { name: 'Preto', value: '#000000' },
                                                        { name: 'Verde', value: '#28A745' }
                                                    ].map(color => (
                                                        <button
                                                            key={color.name}
                                                            type="button"
                                                            onClick={() => setNewBarColor(color.value)}
                                                            title={color.name}
                                                            className="w-6 h-6 rounded-full border border-slate-300"
                                                            style={{ backgroundColor: color.value }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
{newBarColor === '#FFFFFF' && (
    <p className="text-xs mt-1">Treto</p>
)}
                                    </div>

                                    {/* Section 3: Global Expansion */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-1 bg-emerald-600 rounded-full" />
                                            <h4 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Afiliação e Mercado</h4>
                                        </div>

                                        <div className="p-4 lg:p-5 rounded-[1.5rem] bg-gradient-to-br from-emerald-600/10 via-fuchsia-600/5 to-transparent border border-emerald-500/20 shadow-xl space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shrink-0">
                                                    <Globe size={20} className="animate-pulse" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">Ativar Afiliação</h4>
                                                </div>
                                                <div className="ml-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMarketplaceEnabled(!isMarketplaceEnabled)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-all relative p-1 flex items-center",
                                                            isMarketplaceEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-brand-800"
                                                        )}
                                                    >
                                                        <motion.div
                                                            animate={{ x: isMarketplaceEnabled ? 24 : 0 }}
                                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                                            className="h-4 w-4 bg-white rounded-full shadow-lg"
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            {isMarketplaceEnabled && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="pt-4 border-t border-emerald-500/10 grid grid-cols-1 lg:grid-cols-2 gap-4"
                                                >
                                                    <div className="space-y-2">
                                                        <label className="text-[8px] font-black text-emerald-600 dark:text-brand-300 uppercase tracking-widest px-1">Tipo de Afiliação</label>
                                                        <div className="flex p-1 bg-white/50 dark:bg-brand-950/50 rounded-xl border border-emerald-500/10 shadow-inner">
                                                            {(['Automatica', 'Manual'] as const).map((type) => (
                                                                <button
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={() => setNewAffiliationType(type)}
                                                                    className={cn(
                                                                        "flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.1em] transition-all",
                                                                        newAffiliationType === type
                                                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                                                                            : "text-slate-400 hover:text-slate-600"
                                                                    )}
                                                                >
                                                                    {type}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[8px] font-black text-emerald-600 dark:text-brand-300 uppercase tracking-widest px-1">Comissão (%)</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                value={newCommission}
                                                                onChange={(e) => setNewCommission(e.target.value)}
                                                                className="w-full h-10 px-4 pr-10 rounded-xl border border-emerald-500/20 bg-white/50 dark:bg-brand-950/50 text-[14px] font-black text-emerald-600 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none tabular-nums shadow-inner"
                                                            />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 lg:p-6 border-t border-slate-100 dark:border-white/5 bg-white/50 dark:bg-brand-900/50 backdrop-blur-xl shrink-0 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 h-12 px-6 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-brand-400 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-slate-50 dark:hover:bg-brand-800 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    form="asset-form"
                                    type="submit"
                                    className="flex-[1.5] h-12 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                                >
                                    {editingProduct ? 'Guardar' : 'Criar Produto'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!productToDelete}
                onClose={() => setProductToDelete(null)}
                onConfirm={confirmDelete}
                title="Apagar Produto?"
                description="Tem a certeza que deseja apagar este produto? Esta ação é irreversível e removerá o produto do mercado."
                confirmText="Apagar Agora"
                cancelText="Manter Produto"
                variant="danger"
            />

            <CheckoutModal 
                product={checkoutProduct}
                isOpen={!!checkoutProduct}
                onClose={() => setCheckoutProduct(null)}
            />
        </div >
    );
};
