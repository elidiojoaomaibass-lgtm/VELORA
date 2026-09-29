import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronDown, Check,
    ShieldCheck,
    Loader2,
    AlertCircle,
    Smartphone
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

import { useTransactionsStore, useProductsStore, type Product } from '../lib/store';
import { supabase } from '../lib/supabase';
import { E2Payments } from '../lib/e2payments';
import { Logo } from './Logo';
import { CountdownBanner } from './CountdownBanner';

interface CheckoutModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
}

export const CheckoutModal = ({ product, isOpen, onClose }: CheckoutModalProps) => {
    const { addTransaction, updateTransactionStatus } = useTransactionsStore();
    const { products, updateProducts } = useProductsStore();
    const [method, setMethod] = useState<'mpesa' | 'emola'>('mpesa');
    const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const [paymentPhone, setPaymentPhone] = useState('');
    const [showSummary, setShowSummary] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStatus('idle');
                setErrorMessage(null);
                setName('');
                setPhone('');

                setPaymentPhone('');
                setMethod('mpesa');
            }, 500);
        }
    }, [isOpen]);

    if (!product) return null;

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault();

        setErrorMessage(null);

        if (!paymentPhone) {
            setErrorMessage('Por favor, introduza o número de telefone para pagamento.');
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

        // Auto-detectar o método correto baseado no prefixo do número
        // e-Mola: 86, 87 | M-Pesa: 84, 85, 82, 83
        let detectedMethod: 'mpesa' | 'emola' = method;
        const prefix = sanitizedPaymentPhone.substring(0, 2);
        if (prefix === '86' || prefix === '87') {
            detectedMethod = 'emola';
        } else if (prefix === '84' || prefix === '85' || prefix === '82' || prefix === '83') {
            detectedMethod = 'mpesa';
        }

        // Validar que o método selecionado na UI corresponde ao número
        if (detectedMethod !== method) {
            const correctMethod = detectedMethod === 'emola' ? 'e-Mola' : 'M-Pesa';
            setErrorMessage(`O número introduzido pertence ao ${correctMethod}. Por favor, selecione ${correctMethod} como método de pagamento.`);
            setStatus('idle');
            return;
        }

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
                    customerEmail: product.user_email || ''
                });
            } catch (txErr) {
                console.warn("Falha ao registar transação pendente", txErr);
            }

            // Atualiza a transação para Concluído temporariamente, aguardando webhook real
            await updateTransactionStatus(currentTxId, 'Concluído');

            // Disparar webhooks e notificações via servidor (idêntico ao webhook do VendasView)
            try {
                fetch('/api/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'success',
                        transaction_id: currentTxId,
                        reference: reference,
                        amount: product.price,
                        phone: sanitizedPaymentPhone,
                        customerName: name || 'Cliente',
                        method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola'
                    })
                }).catch(err => console.warn('Webhook dispatch failed:', err));

                fetch('/api/finalize-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transactionId: currentTxId,
                        phone: sanitizedPaymentPhone,
                        amount: product.price,
                        reference: reference,
                        customerName: name || 'Cliente',
                        product_id: product.id,
                        product_name: product.name,
                        merchant_user_email: product.user_email || '',
                        method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola'
                    })
                }).catch(err => console.warn('Finalize payment dispatch failed:', err));
            } catch (e) {
                console.warn('Failed to dispatch webhook / finalize-payment:', e);
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

            // Increment sales count and total revenue for the product
            try {
                // Update in Supabase
                await supabase
                    .from('products')
                    .update({
                        sales: (product.sales ?? 0) + 1,
                        revenue: (product.revenue ?? 0) + product.price,
                    })
                    .eq('id', product.id);
                // Update local store if needed (optimistic)
                updateProducts(
                    products.map(p =>
                        p.id === product.id
                            ? { ...p, sales: (p.sales ?? 0) + 1, revenue: (p.revenue ?? 0) + product.price }
                            : p
                    )
                );
            } catch (e) {
                console.warn('Failed to increment product sales:', e);
            }

            // Redirecionar para a página de obrigado com detalhes da compra
            const params = new URLSearchParams({
                name: name || '',

                product: product.name || '',
                amount: String(product.price),
                reference: reference,
                deliveryLink: product.deliveryLink || '',
            });
            window.location.href = `/obrigado?${params.toString()}`;

        } catch (err: any) {
            // Extrair mensagem amigável do erro da API E2Payments (pode ser um objeto)
            let errorMsg = 'Ocorreu um erro. Tente novamente.';
            if (typeof err === 'string') {
                errorMsg = err;
            } else if (err?.message) {
                errorMsg = err.message;
            } else if (err?.mpesa_server_response?.output_ResponseDesc) {
                errorMsg = err.mpesa_server_response.output_ResponseDesc;
            } else if (err?.emola_server_response?.output_ResponseDesc) {
                errorMsg = err.emola_server_response.output_ResponseDesc;
            } else if (err?.error) {
                errorMsg = err.error;
            }

            // Map common E2Payments error codes to friendly messages
            const code = err?.mpesa_server_response?.output_ResponseCode || err?.emola_server_response?.output_ResponseCode || '';
            const friendlyErrors: Record<string, string> = {
                'INS-2006': 'Saldo insuficiente. Por favor, recarregue a sua conta e tente novamente.',
                'INS-6': 'Saldo insuficiente. Verifique o saldo e tente novamente.',
                'INS-5': 'Pagamento cancelado. Não introduziu o PIN no seu telemóvel. Tente novamente.',
                'INS-17': 'Pagamento cancelado ou recusado. Tente novamente e confirme o PIN.',
                'INS-9': 'Tempo esgotado. Não confirmou o PIN a tempo. Tente novamente.',
                'INS-14': 'Número de telemóvel inválido. Verifique e tente novamente.',
                'INS-2': 'Número não encontrado. Verifique se é um número M-Pesa/e-Mola válido.',
                'INS-4': 'Não foi possível enviar o pedido ao seu telemóvel. Verifique se tem M-Pesa/e-Mola ativo.',
                'INS-13': 'Valor inválido. O valor mínimo é 1 MT.',
                'INS-10': 'Transação duplicada. Aguarde alguns minutos antes de tentar novamente.',
                'INS-1': 'Erro temporário. Por favor, tente novamente em instantes.',
            };
            if (code && friendlyErrors[code]) {
                errorMsg = friendlyErrors[code];
            }

            // Se falhou/cancelou, marca como "Falhou" com motivo
            if (currentTxId) {
                updateTransactionStatus(currentTxId, 'Falhou', errorMsg).catch(() => {});
            }

            setErrorMessage(errorMsg);
            setStatus('idle');

            // Fallback de segurança local para quando a requisição falhar totalmente (ex: localhost 404)
            try {
                addTransaction({
                    id: `ERR_FB_${Date.now()}`,
                    type: 'payment',
                    amount: product.price,
                    phone: paymentPhone,
                    method: method === 'mpesa' ? 'M-Pesa' : 'e-Mola',
                    status: 'Falhou',
                    reference: reference,
                    description: `Compra: ${product.name}`,
                    customerName: name || 'Cliente',
                    customerEmail: product.user_email || '',
                    failureReason: errorMsg
                });
            } catch (dbErr) {
                console.warn("Falha no fallback de gravação Supabase (não autenticado):", dbErr);
            }
        }
    };

    if (status === 'success') {
        return (
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative w-full max-w-md bg-white rounded-3xl p-10 text-center shadow-2xl"
                        >
                            <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                                <Check size={40} strokeWidth={3} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center justify-center gap-2">
                                <span>🎉</span> Pedido Realizado!
                            </h3>
                            <p className="text-sm text-slate-500 font-medium mb-8">
                                O seu acesso foi enviado para o seu e‑mail cadastrado. Verifique também a pasta de spam.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full h-14 bg-slate-900 text-white rounded-xl font-bold tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                            >
                                Fechar
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 overflow-y-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="relative w-full max-w-[500px] bg-[#f8f9fa] md:rounded-[2rem] shadow-2xl overflow-hidden min-h-[100dvh] md:min-h-0 md:max-h-[95vh] flex flex-col"
                    >
                        {product.enableCountdown && <CountdownBanner />}
                        {/* Branding Header */}
                        <div className="bg-white px-6 py-4 md:py-6 flex items-center justify-between z-30 shadow-sm">
                            <Logo size={28} showText={true} textColor="text-slate-900" />
                            <button
                                onClick={onClose}
                                className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all border border-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Order Progress (Optional) */}
                        <div className="w-full h-1 bg-slate-100 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 0.8 }}
                                className="h-full bg-red-600"
                            />
                        </div>

                        {/* Header Summary (Sticky-ish) */}
                        <div className="bg-[#fcfcfc] border-y border-slate-100 p-4 flex items-center justify-between z-20">
                            <button
                                onClick={() => setShowSummary(!showSummary)}
                                className="flex items-center gap-2 text-slate-600 text-[13px] font-medium hover:text-slate-900 transition-colors"
                            >
                                <ShoppingCartIcon />
                                <span>Resumo do pedido</span>
                                <ChevronDown size={14} className={cn("transition-transform duration-300", showSummary && "rotate-180")} />
                            </button>
                            <span className="text-slate-900 font-black text-sm">{product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                        </div>

                        {/* Order Summary Collapsible */}
                        <AnimatePresence>
                            {showSummary && (
                                <motion.div key={showSummary ? "open" : "closed"}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-slate-50 border-b border-slate-100 overflow-visible"
                                >
                                    <div className="p-6 flex flex-row items-end gap-4">
                                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shadow-sm shrink-0">
                                            <img src={product.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&fit=crop"} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex flex-col flex-1 gap-2">
                                            <div className="flex-1 flex flex-col justify-between">
                                                <span className="text-xs font-bold text-slate-600 truncate">{product.description}</span>
                                                <span className="text-xs font-black text-slate-900 mt-1">{product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                                            </div>
                                            <div className="flex flex-col gap-1 mt-2">
                                                <span className="text-xs text-slate-500">Subtotal: {product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                                                <span className="text-xs text-slate-500">Tax/Iva: 0,00 MT</span>
                                                <span className="text-sm font-bold text-slate-900">Total: {product.price.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Form Body */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white shadow-inner">
                            {/* Client Info */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 items-center flex gap-3">
                                    Informações do Cliente
                                </h3>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700">Nome</label>
                                        <input
                                            type="text"
                                            placeholder="Seu nome completo"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-base focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700">Telefone*</label>
                                        <div className="flex overflow-hidden">
                                            <div className="h-11 px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-medium text-slate-600 gap-1.5 shrink-0">
                                                <span className="text-[10px] opacity-60  font-black">MZ</span> +258
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="84 xxx xxxx"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                                className="flex-1 h-11 px-4 rounded-r-xl border border-slate-200 bg-white text-base focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300"
                                                required
                                            />
                                        </div>
                                    </div>

                                </div>
                            </section>

                            {/* Payment Section */}
                            <section className="space-y-4 pt-4 border-t border-slate-100 pb-2">
                                <h3 className="text-lg font-bold text-slate-900">Pagamento</h3>
                                {/* Product Creation Form */}
                                <div className="space-y-4">
                                    {/* Scarcity Notification Toggle */}
                                    <label className="flex items-center space-x-2 text-sm text-slate-600">
                                        <input
                                            type="checkbox"
                                            onChange={() => { /* Assuming local state update, logic simplified for structure */ }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Ativar notificação de escassez (exibe nomes aleatórios moçambicanos)</span>
                                    </label>
                                </div>

                                <div className="space-y-3">
                                    {/* M-Pesa */}
                                    <div
                                        onClick={() => setMethod('mpesa')}
                                        className={cn(
                                            "rounded-xl border transition-all cursor-pointer overflow-hidden",
                                            method === 'mpesa' ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-slate-200 hover:border-slate-300 bg-white"
                                        )}
                                    >
                                        <div className="p-4 flex items-center gap-3">
                                            <div className={cn(
                                                "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                                                method === 'mpesa' ? "border-red-500" : "border-slate-300"
                                            )}>
                                                {method === 'mpesa' && <div className="h-2 w-2 rounded-full bg-red-500" />}
                                            </div>
                                            <div className="h-8 w-8 p-0.5 bg-white rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden">
                                                <img src="/mpesa_logo.png" alt="M-Pesa" className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-xs font-black text-slate-900  tracking-tight">M-Pesa</span>
                                        </div>

                                        <AnimatePresence>
                                            {method === 'mpesa' && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    className="px-4 pb-4 space-y-2"
                                                >
                                                    <label className="text-[10px] font-black text-slate-500  tracking-widest leading-none">Número de celular*</label>
                                                    <input
                                                        type="text"
                                                        placeholder="84 xxx xxxx"
                                                        value={paymentPhone}
                                                        onChange={(e) => setPaymentPhone(e.target.value.replace(/\D/g, '').slice(0, 14))}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-base focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300"
                                                    />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>


                                </div>
                            </section>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {errorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="mx-6 mb-0 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3"
                                >
                                    <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-red-700">Pagamento não processado</p>
                                        <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{errorMessage}</p>
                                    </div>
                                    <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 transition-colors shrink-0">
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Processing / PIN Prompt Banner */}
                        <AnimatePresence>
                            {status === 'processing' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="mx-6 mb-2 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3.5 text-amber-950 shadow-sm"
                                >
                                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 animate-bounce">
                                        <Smartphone size={22} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                                            <span>📱</span> Confirme no telemóvel agora!
                                        </p>
                                        <p className="text-[11px] text-amber-800 font-semibold mt-0.5 leading-snug">
                                            Introduza o seu <strong>PIN do {method === 'emola' ? 'e-Mola' : 'M-Pesa'}</strong> no aviso que apareceu no telemóvel para debitar o valor e concluir a compra.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Footer / Button Area */}
                        <div className="bg-white border-t border-slate-100 p-6 md:p-8 space-y-4">
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed text-center">
                                Os seus dados serão processados de acordo com a nossa <a href="#" className="underline text-emerald-500">política de privacidade</a>.
                            </p>
                            <button
                                onClick={handlePurchase}
                                disabled={status === 'processing'}
                                className="w-[95%] sm:w-[90%] mx-auto flex h-[56px] text-white bg-[#e11d24] rounded-2xl font-black text-sm min-[360px]:text-base min-[400px]:text-lg sm:text-xl md:text-2xl items-center justify-center gap-1.5 sm:gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-red-500/20 disabled:opacity-70"
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

                            <div className="flex flex-row items-center justify-center gap-4 opacity-70">
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <ShieldCheck size={14} />
                                    <span className="text-[9px] font-bold  tracking-widest">Seguro</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <Check size={14} />
                                    <span className="text-[9px] font-bold  tracking-widest">100% Protegido</span>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Processing Overlay */}
                        <AnimatePresence>
                            {status === 'processing' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="absolute inset-0 z-50 bg-white/20 backdrop-blur-[2px] pointer-events-none"
                                />
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const ShoppingCartIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.783 20.9391 21 20.4304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
