// @ts-nocheck
import {
    X, Check,
    Loader2,
    AlertCircle,
    Smartphone
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import { cn } from '../lib/utils';
import { useTransactionsStore, mapSupabaseProduct } from '../lib/store';
import { supabase } from '../lib/supabase';
import { E2Payments } from '../lib/e2payments';

import { Logo } from './Logo';
import { CountdownBanner } from './CountdownBanner';
import { ScarcityNotification } from './ScarcityNotification';

export const CheckoutPage = () => {
    const { addTransaction, updateTransactionStatus } = useTransactionsStore();
    const [method, setMethod] = useState<'mpesa' | 'emola'>('mpesa');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const [paymentPhone, setPaymentPhone] = useState('');

    // Parse product info from URL
    const searchParams = new URLSearchParams(window.location.search);
    const rawPrice = Number(searchParams.get('price'));
    const productId = searchParams.get('id') || searchParams.get('product_id') || 'PRD-MOCK';
    const enableCountdown = searchParams.get('enableCountdown') === 'true';
    const enableScarcity = searchParams.get('enableScarcityNotification') === 'true';
    const barColor = searchParams.get('barColor');

    // Helper to get fallback from localStorage velora_products or velora_products_offline
    const getLocalProductFallback = (id: string) => {
        try {
            const raw = localStorage.getItem('velora_products') || localStorage.getItem('velora_products_offline');
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                    const found = list.find((p: any) => String(p.id) === String(id));
                    if (found) return found;
                }
            }
        } catch (e) {}
        return null;
    };

    // Load image: prioritize stored, then URL param, then fetch from Supabase if needed
    let storedImage = localStorage.getItem(`checkout_img_${productId}`) || '';
    const urlImage = searchParams.get('image') || '';
    // Cache direct http image URLs
    if (urlImage && urlImage.startsWith('http')) {
        localStorage.setItem(`checkout_img_${productId}`, urlImage);
        storedImage = urlImage;
    }
    // placeholder that will be possibly updated after fetch
    let productImage = storedImage || urlImage;

    const [dbProduct, setDbProduct] = useState<any>(() => {
        try {
            const cached = localStorage.getItem(`checkout_product_${productId}`);
            if (cached) return JSON.parse(cached);
            return getLocalProductFallback(productId);
        } catch {
            return null;
        }
    });
    const [loadingProduct, setLoadingProduct] = useState(() => {
        try {
            const cached = localStorage.getItem(`checkout_product_${productId}`);
            const localFallback = getLocalProductFallback(productId);
            return !cached && !localFallback && isNaN(rawPrice);
        } catch {
            return true;
        }
    });

    // Fetch product details from Supabase
    const fetchProduct = async () => {
        const cached = localStorage.getItem(`checkout_product_${productId}`);
        const localFallback = getLocalProductFallback(productId);
        if (!cached && !localFallback && isNaN(rawPrice)) {
            setLoadingProduct(true);
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error) {
                console.warn('Erro ao buscar produto do Supabase:', error);
                if (localFallback) {
                    setDbProduct(localFallback);
                }
            } else if (data) {
                const mapped = mapSupabaseProduct(data);
                setDbProduct(mapped);
                try {
                    localStorage.setItem(`checkout_product_${productId}`, JSON.stringify(mapped));
                    if (mapped.image) {
                        localStorage.setItem(`checkout_img_${productId}`, mapped.image);
                    }
                } catch (e) {
                    console.error('Error saving to localStorage', e);
                }
                
                // Initializar e disparar PageView
                import('../lib/pixel').then(({ initFacebookPixel, trackFacebookEvent, trackTiktokEvent }) => {
                    if (mapped && mapped.pixel) {
                        initFacebookPixel(mapped.pixel);
                    }
                    trackFacebookEvent('PageView');
                    trackTiktokEvent('ViewContent', { content_name: mapped ? mapped.name : 'Checkout' });
                });
            }
        } catch (err) {
            console.warn('Falha de rede ao buscar produto:', err);
            if (localFallback) {
                setDbProduct(localFallback);
            }
        } finally {
            setLoadingProduct(false);
        }
    };

    // Call fetchProduct when component mounts or productId changes
    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const dbPrice = dbProduct?.price !== undefined && dbProduct?.price !== null
        ? Number(dbProduct.price)
        : null;

    const finalPrice = dbPrice !== null && !isNaN(dbPrice)
        ? dbPrice
        : (!isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 0);

    const product = {
        id: productId,
        name: dbProduct?.name || searchParams.get('name') || 'Produto sem Nome',
        price: finalPrice,
        image: dbProduct?.image || productImage,
        deliveryLink: dbProduct?.deliveryLink || searchParams.get('deliveryLink') || '',
        user_email: dbProduct?.user_email || searchParams.get('user_email') || '',
        enableCountdown: dbProduct?.enableCountdown ?? enableCountdown,
        enableScarcityNotification: dbProduct?.enableScarcityNotification ?? dbProduct?.enableScarcity ?? enableScarcity,
        barColor: dbProduct?.barColor || barColor
    };

    if (loadingProduct) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-red-500" size={40} />
                    <p className="text-slate-500 font-bold text-sm tracking-wide">A carregar checkout...</p>
                </div>
            </div>
        );
    }

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!name) {
            setErrorMessage('Por favor, introduza o seu nome.');
            return;
        }
        if (!phone) {
            setErrorMessage('Por favor, introduza o seu número de contacto.');
            return;
        }
        if (!paymentPhone) {
            setErrorMessage('Por favor, introduza o número de telemóvel para o pagamento.');
            return;
        }

        setStatus('processing');

        const reference = `ORD${Date.now()}`;

        // Sanitização robusta dos números de telefone antes de enviar
        const cleanPhone = (num: string) => {
            let digits = num.replace(/\D/g, '');
            if (digits.startsWith('258') && digits.length > 9) {
                digits = digits.substring(3);
            }
            return digits.slice(0, 9);
        };

        const sanitizedPaymentPhone = cleanPhone(paymentPhone);

        let currentTxId = '';

        try {
            const e2p = new E2Payments();
            const walletId = method === 'mpesa'
                ? (import.meta.env.VITE_KWIKPAY_WALLET_ID || import.meta.env.VITE_E2_WALLET_MPESA || '')
                : (import.meta.env.VITE_KWIKPAY_WALLET_ID || import.meta.env.VITE_E2_WALLET_EMOLA || '');

            const result = await e2p.c2bPayment(
                method,
                walletId,
                product.price,
                sanitizedPaymentPhone,
                reference
            );

            currentTxId = result.transaction_id || 'TX_' + Date.now();

            try {
                await addTransaction({
                    id: currentTxId,
                    type: 'payment',
                    amount: product.price,
                    phone: sanitizedPaymentPhone,
                    method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola',
                    status: 'Pendente',
                    reference: reference,
                    description: `Compra: ${product.name}||PRODUCT_ID||${product.id}`,
                    customerName: name || 'Cliente',
                    customerEmail: product.user_email || '',
                });
            } catch (txErr) {
                console.warn("Falha ao registar transação pendente:", txErr);
            }

            if (result.pending) {
                setStatus('loading');
                setErrorMessage(result.message || 'A aguardar confirmação no telemóvel. Por favor, introduza o seu PIN...');
                
                // Poll the transaction status from Supabase to check if webhook approved it
                let attempts = 0;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const { createClient } = await import('@supabase/supabase-js');
                        const supabase = createClient(
                            import.meta.env.VITE_SUPABASE_URL,
                            import.meta.env.VITE_SUPABASE_ANON_KEY
                        );
                        const { data } = await supabase.from('transactions').select('status').eq('id', currentTxId).single();
                        
                        if (data?.status === 'Concluído') {
                            clearInterval(pollInterval);
                            finalizeAndRedirect();
                        } else if (data?.status === 'Falhou' || attempts > 60) { // 60 attempts * 2s = 2 mins
                            clearInterval(pollInterval);
                            setErrorMessage('Pagamento falhou ou expirou. Tente novamente.');
                            setStatus('idle');
                        }
                    } catch (e) {
                        // ignore poll errors
                    }
                }, 2000);
                
                return; // Do not proceed to finalize immediately!
            } else {
                // Synchronous success from gateway
                await updateTransactionStatus(currentTxId, 'Concluído');
                await finalizeAndRedirect();
            }

            async function finalizeAndRedirect() {
                try {
                    const finalizeRes = await fetch(`/api/finalize-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            transactionId: currentTxId,
                            phone: sanitizedPaymentPhone,
                            amount: product.price,
                            reference: reference,
                        customerName: name,
                        product_id: product.id,
                        product_name: product.name,
                        merchant_user_email: product.user_email || '',
                        method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola'
                    })
                });

                if (!finalizeRes.ok) {
                    console.error('Falha ao finalizar pagamento no backend', await finalizeRes.text());
                }
            } catch (finalizeErr) {
                console.error('Erro de rede ao chamar finalize-payment:', finalizeErr);
            }

            // Disparar os Pixels de conversão (Global e/ou Produto)
            import('../lib/pixel').then(({ initFacebookPixel, trackFacebookEvent, trackTiktokEvent }) => {
                if (product.pixel) {
                    initFacebookPixel(product.pixel);
                }
                trackFacebookEvent('Purchase', {
                    value: product.price,
                    currency: 'MZN',
                    content_name: product.name
                });
                trackTiktokEvent('CompletePayment', {
                    value: product.price,
                    currency: 'MZN',
                    content_name: product.name
                });
            });

            setStatus('success');

            // Redirect to Thank You page
            const queryParams: any = {
                name: name || '',

                product: product.name || '',
                amount: String(product.price),
                method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola',
                reference: reference,
            };

            if (product.deliveryLink) {
                queryParams.deliveryLink = product.deliveryLink;
            }

            if (product.enableCountdown) {
                queryParams.enableCountdown = 'true';
            }
            if (product.enableScarcityNotification) {
                queryParams.enableScarcityNotification = 'true';
            }
            if (product.barColor) {
                queryParams.barColor = product.barColor;
            }

            const params = new URLSearchParams(queryParams);
            window.location.href = `/obrigado?${params.toString()}`;

            // (Movemos isto para dentro de finalizeAndRedirect)
            } // fechar finalizeAndRedirect
        } catch (err: any) {
            setErrorMessage(err.message || 'Ocorreu um erro ao processar a compra. Tente novamente.');
            setStatus('idle');

            // Marca a transação como "Falhou" em vez de ficar pendente ou duplicada
            if (currentTxId) {
                updateTransactionStatus(currentTxId, 'Falhou', err?.message || 'Erro desconhecido').catch(() => {});
            }
        }
    };



    return (
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col mx-auto">
            <div className="sticky top-0 z-50 shadow-sm">
                {product.enableCountdown && <CountdownBanner barColor={product.barColor || undefined} />}
                {product.enableScarcityNotification && <ScarcityNotification />}
                {/* Header */}
                <header className="bg-white border-b border-slate-100 py-4 px-6">
                    <div className="max-w-4xl mx-auto flex items-center justify-start">
                        <Logo size={28} showText={true} textColor="text-slate-900" />
                    </div>
                </header>
            </div>

            {/* Centered Single-Column Container */}
            <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8">

                {/* Unified Form and Card */}
                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-8">

                    {/* Header Info */}
                    <div className="space-y-2 text-center pb-4 border-b border-slate-100">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Finalizar Compra 🚀</h2>
                        <p className="text-xs text-slate-400 font-semibold tracking-tight">Preencha os seus dados de facturação e pagamento para obter o acesso.</p>
                    </div>

                    <form onSubmit={handlePurchase} className="space-y-8">

                        {/* Section 1: Customer Details */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <h3 className="text-base font-bold text-slate-900  tracking-wider">Informações do cliente</h3>
                            </div>

                            <div className="space-y-3.5">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-600  tracking-wider">Nome</label>
                                    <input
                                        type="text"
                                        placeholder="Introduza o seu nome completo"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-base font-bold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-slate-600  tracking-wider">Contacto WhatsApp*</label>
                                        <div className="flex overflow-hidden">
                                            <div className="h-12 px-3.5 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-600 gap-1.5 shrink-0">
                                                <span className="text-[10px] opacity-60  font-black">MZ</span> +258
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="84 xxx xxxx"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                                className="flex-1 h-12 px-4 rounded-r-xl border border-slate-200 bg-white text-base font-bold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Resumo do Produto */}
                        <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                <h3 className="text-base font-bold text-slate-900 tracking-wider">Order Summary</h3>
                            </div>

                            <div className="flex flex-row gap-4 pt-2">
                                <div className="h-24 w-24 md:h-36 md:w-36 rounded-xl overflow-hidden bg-slate-150 border border-slate-200 shrink-0 shadow-sm mx-auto sm:mx-0">
                                    <img
                                        src={product.image}
                                        alt={product.name || 'Product Image'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1 text-left">
                                    <div className="flex justify-start items-start gap-2">
                                        <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-950 leading-tight line-clamp-2">{product.name}</p>
                                    </div>

                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold">Subtotal</span>
                                        <span className="text-slate-600 font-black">{product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold">Taxas / IVA</span>
                                        <span className="text-emerald-500 font-black">0,00 MT</span>
                                    </div>
                                </div>
                            </div>




                            {/* Money Totals */}
                            <div className="space-y-2 pt-3 border-t border-slate-200">

                                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200">
                                    <span className="text-sm font-black text-slate-900">Total a pagar</span>
                                    <span className="text-base font-black text-slate-900 tabular-nums">{product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                                </div>
                            </div>
                        </div>





                        {/* Section 3: Payment Provider */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <h3 className="text-base font-bold text-slate-900  tracking-wider">Método de Pagamento</h3>
                            </div>

                            <div className="space-y-4">
                                {/* M-Pesa Option */}
                                <div
                                    onClick={() => {
                                        if (method !== 'mpesa') {
                                            setMethod('mpesa');
                                            setPaymentPhone('');
                                        }
                                    }}
                                    className={cn(
                                        "rounded-2xl border-2 p-4 cursor-pointer transition-all relative overflow-hidden space-y-4",
                                        method === 'mpesa' ? "border-red-500 bg-red-50/5 shadow-md shadow-red-500/5" : "border-slate-100 hover:border-slate-200 bg-white"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 p-1 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                                <img
                                                    src="/mpesa_logo.png"
                                                    alt="M-Pesa"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-950  tracking-wider">M-Pesa</h4>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                            method === 'mpesa' ? "border-red-500" : "border-slate-300"
                                        )}>
                                            {method === 'mpesa' && <div className="h-2.5 w-2.5 rounded-full bg-red-500" />}
                                        </div>
                                    </div>

                                    {/* M-Pesa Wallet Input inside card */}
                                    <AnimatePresence>
                                        {method === 'mpesa' && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-2 pt-3 border-t border-red-500/10 cursor-default"
                                                onClick={(e) => e.stopPropagation()} // Prevent card deselection/toggle click
                                            >
                                                <div className="flex overflow-hidden">
                                                    <div className="h-12 px-3.5 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-600 gap-1.5 shrink-0">
                                                        <span className="text-[10px] opacity-60  font-black">MZ</span> +258
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="84 xxx xxxx"
                                                        value={paymentPhone}
                                                        onChange={(e) => setPaymentPhone(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                                        className="flex-1 h-12 px-4 rounded-r-xl border border-slate-200 bg-white text-base font-bold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                                        required={method === 'mpesa'}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium block">Introduza o seu PIN de segurança no telemóvel quando solicitado.</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>


                            </div>
                        </div>

                        {/* Error Displays inside checkout form */}
                        <AnimatePresence>
                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3"
                                >
                                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-red-700">Pagamento não processado</p>
                                        <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{errorMessage}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setErrorMessage(null)}
                                        className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                                    >
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Button Purchase CTA */}
                        <div className="space-y-4">
                            <button
                                type="submit"
                                disabled={status === 'processing'}
                                className={cn(
                                    "w-[95%] sm:w-[90%] mx-auto h-[56px] text-white bg-[#e11d24] rounded-2xl font-black text-sm min-[360px]:text-base min-[400px]:text-lg sm:text-xl md:text-2xl flex items-center justify-center gap-1.5 sm:gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-red-500/20 disabled:opacity-70 cursor-pointer"
                                )}
                            >
                                {status === 'processing' ? (
                                    <>
                                        <Loader2 className="animate-spin shrink-0" size={20} />
                                        <span className="tracking-wide whitespace-nowrap">Processando...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                                            <Check strokeWidth={4} className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                        </div>
                                        <span className="tracking-wide whitespace-nowrap">
                                            Pagar agora {product.price ? `- ${product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT` : ''}
                                        </span>
                                    </>
                                )}
                            </button>

                            <p className="text-xs text-slate-400 font-medium leading-relaxed text-center max-w-md mx-auto">
                                Clicando acima, aceita os nossos Termos de Compra. Seus dados estão 100% protegidos.
                            </p>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};
