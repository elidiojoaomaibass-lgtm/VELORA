import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet, Clock, CheckCircle2,
    History, Loader2,
    ArrowUpRight, BadgeDollarSign,
    Smartphone, RefreshCw, AlertCircle, FileText, Check, Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useTransactionsStore } from '../lib/store';

interface KwikPayBalance {
    wallet_uuid: string;
    wallet_name: string;
    balance: number;
    currency: string;
    environment: string;
}

interface KwikPayTx {
    id?: string;
    transaction_id?: string;
    mpesa_transaction_id?: string;
    type?: string;
    status: string;
    amount: number;
    phone: string;
    reference: string;
    created_at?: string;
    fees?: {
        fee_percent?: number;
        fee_amount?: number;
        net_amount?: number;
    };
}

export const SaqueView = () => {
    const { transactions, addTransaction } = useTransactionsStore();

    // ── Abas de Navegação ──────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'b2c' | 'loja' | 'extrato_kwikpay'>('b2c');

    // ── Estado do Saque B2C KwikPay ────────────────────────────────────────────────
    const [b2cAmount, setB2cAmount] = useState('');
    const [b2cPhone, setB2cPhone] = useState('856195186'); // Padrão: João Maibass
    const [b2cRef, setB2cRef] = useState(`B2C_${Date.now().toString().slice(-6)}`);
    const [b2cLoading, setB2cLoading] = useState(false);
    const [b2cSuccessData, setB2cSuccessData] = useState<any>(null);

    // ── Saldo KwikPay em Tempo Real ────────────────────────────────────────────────
    const [walletBalance, setWalletBalance] = useState<KwikPayBalance | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // ── Extrato B2C KwikPay Gateway ────────────────────────────────────────────────
    const [kwikpayTxs, setKwikpayTxs] = useState<KwikPayTx[]>([]);
    const [txsLoading, setTxsLoading] = useState(false);
    const [txFilter, setTxFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

    // ── Estado do Saque da Loja (Legado / Saldo Acumulado) ─────────────────────────
    const [shopAmount, setShopAmount] = useState('');
    const [shopPhone, setShopPhone] = useState('856195186');
    const [shopMethod, setShopMethod] = useState<'M-Pesa' | 'e-Mola'>('M-Pesa');
    const [shopLoading, setShopLoading] = useState(false);
    const [showShopSuccess, setShowShopSuccess] = useState(false);
    const [copiedRef, setCopiedRef] = useState(false);

    const withdrawalHistory = transactions.filter(t => t.type === 'withdrawal');

    // ── Cálculos de Saldos da Loja ─────────────────────────────────────────────────
    const balances = useMemo(() => {
        const calcWallet = (wallet: 'M-Pesa' | 'e-Mola') => {
            const collected = transactions
                .filter(t => t.type === 'payment' && t.status === 'Concluído' && t.method === wallet)
                .reduce((sum, t) => sum + t.amount, 0);

            const withdrawn = transactions
                .filter(t => t.type === 'withdrawal' && t.status === 'Concluído' && t.method === wallet)
                .reduce((sum, t) => sum + t.amount, 0);

            const pending = transactions
                .filter(t => t.type === 'withdrawal' && t.status === 'Pendente' && t.method === wallet)
                .reduce((sum, t) => sum + t.amount, 0);

            const available = collected - withdrawn - pending;
            return { available: Math.max(0, available), pending, withdrawn, collected };
        };

        return {
            'M-Pesa': calcWallet('M-Pesa'),
            'e-Mola': calcWallet('e-Mola'),
        };
    }, [transactions]);

    const [pendingByWallet, setPendingByWallet] = useState(() => ({
        'M-Pesa': withdrawalHistory.some(w => w.method === 'M-Pesa' && w.status === 'Pendente'),
        'e-Mola': withdrawalHistory.some(w => w.method === 'e-Mola' && w.status === 'Pendente'),
    }));

    useEffect(() => {
        setPendingByWallet({
            'M-Pesa': withdrawalHistory.some(w => w.method === 'M-Pesa' && w.status === 'Pendente'),
            'e-Mola': withdrawalHistory.some(w => w.method === 'e-Mola' && w.status === 'Pendente'),
        });
    }, [transactions]);

    // ── Função: Buscar Saldo KwikPay ───────────────────────────────────────────────
    const fetchKwikPayBalance = async () => {
        setBalanceLoading(true);
        try {
            const res = await fetch('/api/b2c?action=balance');
            const data = await res.json();
            if (data.success && data.data) {
                setWalletBalance(data.data);
            } else if (data.balance !== undefined) {
                setWalletBalance(data);
            }
        } catch (e) {
            console.warn('Erro ao consultar saldo KwikPay:', e);
        } finally {
            setBalanceLoading(false);
        }
    };

    // ── Função: Buscar Transações KwikPay ──────────────────────────────────────────
    const fetchKwikPayTransactions = async () => {
        setTxsLoading(true);
        try {
            const statusParam = txFilter === 'all' ? '' : `&status=${txFilter}`;
            const res = await fetch(`/api/b2c?action=transactions&type=b2c&per_page=15${statusParam}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setKwikpayTxs(data.data);
            } else if (Array.isArray(data)) {
                setKwikpayTxs(data);
            }
        } catch (e) {
            console.warn('Erro ao consultar transações KwikPay:', e);
        } finally {
            setTxsLoading(false);
        }
    };

    useEffect(() => {
        fetchKwikPayBalance();
    }, []);

    useEffect(() => {
        if (activeTab === 'extrato_kwikpay') {
            fetchKwikPayTransactions();
        }
    }, [activeTab, txFilter]);

    // ── Cálculo em tempo real da taxa B2C (7%, mínimo 10 MZN) ──────────────────────
    const b2cFeeCalc = useMemo(() => {
        const val = parseFloat(b2cAmount) || 0;
        if (val <= 0) return { fee: 0, net: 0, isValid: false };
        const fee = Math.max(val * 0.07, 10);
        const net = Math.max(0, val - fee);
        return { fee, net, isValid: val >= 1 };
    }, [b2cAmount]);

    // ── Executar Saque B2C Imediato ────────────────────────────────────────────────
    const handleB2CWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        const num = parseFloat(b2cAmount);

        if (!b2cAmount || isNaN(num) || num < 1) {
            toast.error("O valor mínimo para saque B2C é de 1 MZN.");
            return;
        }

        const cleanPhone = b2cPhone.replace(/\D/g, '').slice(-9);
        if (cleanPhone.length !== 9) {
            toast.error("Informe um número M-Pesa válido com 9 dígitos (ex: 856195186 ou 842848202).");
            return;
        }

        setB2cLoading(true);
        try {
            const res = await fetch('/api/b2c', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'payout',
                    amount: num,
                    phone: cleanPhone,
                    reference: b2cRef || `B2C_${Date.now().toString().slice(-6)}`,
                    recipient_name: cleanPhone === '856195186' ? 'João Maibass' : 'Destinatário M-Pesa',
                }),
            });

            const result = await res.json();

            if (!res.ok || result.success === false) {
                const codeMsg = result.code ? ` [${result.code}]` : '';
                toast.error(`Falha no Saque B2C${codeMsg}: ${result.error || 'Erro desconhecido.'}`);
                return;
            }

            // Sucesso!
            toast.success("Pagamento B2C enviado com sucesso via M-Pesa!");
            setB2cSuccessData({
                ...result.data,
                amount: num,
                phone: cleanPhone,
                fee: b2cFeeCalc.fee,
                net: b2cFeeCalc.net,
                reference: b2cRef,
            });

            // Registrar no store local
            addTransaction({
                id: result.data?.transaction_id || `B2C_${Date.now()}`,
                type: 'withdrawal',
                amount: num,
                phone: cleanPhone,
                method: 'M-Pesa',
                status: 'Concluído',
                reference: b2cRef,
                customerName: cleanPhone === '856195186' ? 'João Maibass' : 'Destinatário M-Pesa',
                description: `Saque B2C KwikPay (${cleanPhone})`,
            });

            // Resetar formulário
            setB2cAmount('');
            setB2cRef(`B2C_${Date.now().toString().slice(-6)}`);
            fetchKwikPayBalance();
        } catch (err: any) {
            toast.error(`Erro ao conectar ao gateway KwikPay: ${err.message || err}`);
        } finally {
            setB2cLoading(false);
        }
    };

    // ── Executar Saque Local da Loja ───────────────────────────────────────────────
    const handleShopWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(shopAmount);

        if (!shopAmount || numAmount <= 0) {
            toast.error("Insira um valor válido para o levantamento.");
            return;
        }

        const cleanPhone = shopPhone.replace(/\D/g, '').slice(-9);
        if (!cleanPhone || cleanPhone.length < 9) {
            toast.error("Por favor, confirme o número de telefone de destino.");
            return;
        }

        if (numAmount > balances[shopMethod].available) {
            toast.error(`Saldo insuficiente na carteira ${shopMethod}.`);
            return;
        }

        if (numAmount < 50) {
            toast.error("O valor mínimo para levantamento interno é de 50 MZN.");
            return;
        }

        if (pendingByWallet[shopMethod]) {
            toast.error(`Já existe um levantamento pendente para ${shopMethod}.`);
            return;
        }

        setShopLoading(true);
        const reference = `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        try {
            setPendingByWallet(prev => ({ ...prev, [shopMethod]: true }));
            addTransaction({
                id: reference,
                type: 'withdrawal',
                amount: numAmount,
                phone: cleanPhone,
                method: shopMethod,
                status: 'Pendente',
                reference: reference,
                customerName: cleanPhone === '856195186' ? 'João Maibass' : 'Merchant',
            });

            setShowShopSuccess(true);
            toast.success(`Pedido de levantamento via ${shopMethod} registado!`);
            setShopAmount('');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setShopLoading(false);
        }
    };

    return (
        <div className="px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16">
                <div className="space-y-1 md:space-y-3 mt-3 md:mt-2">
                    <div className="flex items-center gap-3 mb-1 pl-[3.5rem] md:pl-0">
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                            <ArrowUpRight size={20} />
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.2em]">
                            Área de Saques B2C · KwikPay Gateway
                        </span>
                    </div>
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0 flex items-center gap-3">
                        <span>Central de Saques & Pagamentos B2C</span>
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] animate-pulse" />
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug flex items-center gap-2">
                        <BadgeDollarSign size={16} className="text-violet-500" />
                        Envie transferências imediatas para clientes via M-Pesa. Taxa oficial de 7% (mínimo 10 MZN).
                    </p>
                </div>

                {/* Sub-Tabs de Navegação */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 w-fit">
                    <button
                        onClick={() => setActiveTab('b2c')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                            activeTab === 'b2c'
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <ArrowUpRight size={14} />
                        Saque B2C Imediato
                    </button>
                    <button
                        onClick={() => setActiveTab('extrato_kwikpay')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                            activeTab === 'extrato_kwikpay'
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <History size={14} />
                        Extrato Gateway B2C
                    </button>
                    <button
                        onClick={() => setActiveTab('loja')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                            activeTab === 'loja'
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25 scale-[1.02]"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Wallet size={14} />
                        Saldos da Loja
                    </button>
                </div>
            </div>

            {/* CARD DE SALDO EM TEMPO REAL KWIKPAY */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                {/* Saldo Carteira KwikPay */}
                <div className="md:col-span-2 relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-brand-950 to-violet-950 text-white border border-white/10 shadow-xl">
                    <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-violet-300 text-xs font-black uppercase tracking-widest mb-1">
                                <Wallet size={16} />
                                <span>Saldo KwikPay Gateway (Produção)</span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] border border-emerald-500/30">
                                    Conectado
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl md:text-4xl font-black tracking-tight text-white">
                                    {walletBalance?.balance !== undefined
                                        ? Number(walletBalance.balance).toLocaleString('pt-PT', { minimumFractionDigits: 2 })
                                        : '1.250,50'}
                                </span>
                                <span className="text-lg font-bold text-violet-300">
                                    {walletBalance?.currency || 'MZN'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-300 font-mono mt-2 truncate max-w-md">
                                Carteira: <span className="text-white font-bold">{walletBalance?.wallet_name || 'Minha Carteira'}</span> · {walletBalance?.wallet_uuid || '891ae33d-664c-4715-abb1-008688662a03'}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                            <button
                                onClick={fetchKwikPayBalance}
                                disabled={balanceLoading}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10"
                            >
                                <RefreshCw size={13} className={balanceLoading ? 'animate-spin' : ''} />
                                Atualizar Saldo
                            </button>
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'Documentação' }))}
                                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/30"
                            >
                                <FileText size={13} />
                                Ver Documentação
                            </button>
                        </div>
                    </div>
                </div>

                {/* Beneficiário Ativo (João Maibass) */}
                <div className="rounded-3xl p-6 bg-white dark:bg-brand-900 border border-violet-100 dark:border-brand-800 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Destinatário Principal
                            </span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                                M-Pesa Direto
                            </span>
                        </div>
                        <p className="text-base font-black text-slate-900 dark:text-white">João Maibass</p>
                        <p className="text-lg font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                            856195186
                        </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-brand-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-brand-300">
                        <span>Taxa B2C KwikPay</span>
                        <span className="font-black text-slate-900 dark:text-white">7% (mín. 10 MT)</span>
                    </div>
                </div>
            </motion.div>

            {/* ABA 1: SAQUE B2C IMEDIATO */}
            {activeTab === 'b2c' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Formulário de Saque B2C */}
                    <div className="lg:col-span-1">
                        <motion.div
                            initial={{ opacity: 0, x: -15 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white dark:bg-brand-900 border border-violet-100 dark:border-brand-800 p-6 rounded-3xl shadow-sm space-y-6"
                        >
                            <div className="border-b border-slate-100 dark:border-brand-800 pb-3 flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                                        Enviar Saque B2C
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Transferência direta via API KwikPay M-Pesa.
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-[10px] font-black uppercase">
                                    M-Pesa B2C
                                </span>
                            </div>

                            <form onSubmit={handleB2CWithdrawal} className="space-y-5">
                                {/* Destinatário */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Número M-Pesa (9 Dígitos)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setB2cPhone('856195186')}
                                            className="text-[9px] font-black text-violet-600 dark:text-violet-400 hover:underline"
                                        >
                                            Meu Número (856195186)
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="tel"
                                            value={b2cPhone}
                                            onChange={(e) => setB2cPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                            placeholder="856195186"
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-brand-950 border border-violet-100 dark:border-brand-800 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-violet-500/10 transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                {/* Valor do Saque */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Valor do Saque (MZN)
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            step="any"
                                            min="1"
                                            value={b2cAmount}
                                            onChange={(e) => setB2cAmount(e.target.value)}
                                            placeholder="100,00"
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-brand-950 border border-violet-100 dark:border-brand-800 rounded-2xl text-2xl font-black outline-none focus:ring-4 focus:ring-violet-500/10 transition-all dark:text-white"
                                        />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            MZN
                                        </span>
                                    </div>
                                    {/* Botões de atalho rápido */}
                                    <div className="flex gap-1.5 flex-wrap pt-1">
                                        {[50, 100, 250, 500, 1000].map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                onClick={() => setB2cAmount(String(val))}
                                                className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-100 dark:bg-brand-950 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/40 text-slate-600 dark:text-brand-300 transition-all"
                                            >
                                                +{val} MT
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Referência */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Referência (Máx 20 caracteres)
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        value={b2cRef}
                                        onChange={(e) => setB2cRef(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20))}
                                        placeholder="PAGAMENTO_123"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-violet-100 dark:border-brand-800 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-violet-500/20 dark:text-white uppercase"
                                    />
                                </div>

                                {/* Discriminativo de Taxa (7%, min 10 MZN) */}
                                <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/30 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-brand-300 font-bold">
                                        <span>Taxa B2C (7% · mín. 10 MT):</span>
                                        <span className="text-violet-700 dark:text-violet-300 font-mono">
                                            - {b2cFeeCalc.fee.toFixed(2)} MZN
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-violet-200/50 dark:border-violet-900/40">
                                        <span>Valor Líquido a Receber:</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 text-base">
                                            {b2cFeeCalc.net.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                        </span>
                                    </div>
                                </div>

                                {/* Botão de Envio */}
                                <button
                                    type="submit"
                                    disabled={b2cLoading || !b2cAmount || parseFloat(b2cAmount) < 1}
                                    className="w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-violet-500/20 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {b2cLoading ? <Loader2 className="animate-spin" size={18} /> : <ArrowUpRight size={18} />}
                                    {b2cLoading ? "Processando B2C via KwikPay..." : "Enviar Saque B2C Imediato"}
                                </button>
                            </form>
                        </motion.div>
                    </div>

                    {/* Histórico Recente de Saques Locais & KwikPay */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-brand-900 border border-violet-100 dark:border-brand-800 rounded-3xl shadow-sm overflow-hidden">
                            <div className="p-4 md:p-6 border-b border-violet-50 dark:border-brand-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <History size={18} className="text-violet-600" />
                                        Histórico Recente de Saques (InfroPay & B2C)
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Transações de levantamento e saques automáticos registrados.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveTab('extrato_kwikpay')}
                                    className="text-[10px] font-black text-violet-600 dark:text-violet-400 hover:underline uppercase tracking-wider"
                                >
                                    Ver Extrato Gateway →
                                </button>
                            </div>

                            <div className="overflow-x-auto px-4 pb-4">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-brand-950/50 border-b border-slate-100 dark:border-brand-800">
                                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">ID / Referência</th>
                                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-center">Destinatário</th>
                                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Valor</th>
                                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-brand-800">
                                        {withdrawalHistory.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-xs italic">
                                                    Nenhum saque realizado ainda.
                                                </td>
                                            </tr>
                                        )}
                                        {withdrawalHistory.slice(0, 8).map((w) => (
                                            <tr key={w.id} className="hover:bg-violet-50/20 dark:hover:bg-brand-800/20 transition-all">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                                                            <ArrowUpRight size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                                                                {w.reference || w.id}
                                                            </p>
                                                            <p className="text-[9px] text-slate-400">
                                                                {new Date(w.createdAt).toLocaleDateString('pt-PT')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        {w.phone || '856195186'}
                                                    </span>
                                                    <span className="block text-[8px] text-slate-400 uppercase tracking-wider">
                                                        {w.customerName || 'M-Pesa'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white text-sm">
                                                    {Number(w.amount).toLocaleString('pt-PT')} MZN
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1",
                                                        w.status === 'Concluído'
                                                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                                                    )}>
                                                        {w.status === 'Concluído' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                                        {w.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Códigos de Erro KwikPay Guia Rápido */}
                        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle size={16} className="text-violet-600" />
                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                    Códigos de Retorno do Gateway (M-Pesa)
                                </h4>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                {[
                                    { code: 'INS-0', label: 'Sucesso' },
                                    { code: 'INS-2', label: 'API Key inválida' },
                                    { code: 'INS-6', label: 'Transação falhou' },
                                    { code: 'INS-10', label: 'Duplicada' },
                                    { code: 'INS-13', label: 'Shortcode inválido' },
                                    { code: 'INS-15', label: 'Valor inválido (<1)' },
                                    { code: 'INS-2006', label: 'Saldo insuficiente' },
                                    { code: 'INS-2051', label: 'MSISDN inválido' },
                                ].map((item) => (
                                    <div key={item.code} className="bg-white dark:bg-brand-900 p-2 rounded-xl border border-slate-100 dark:border-brand-800">
                                        <span className="font-mono font-black text-violet-600 dark:text-violet-400">{item.code}</span>
                                        <p className="text-slate-500 dark:text-brand-300 font-medium truncate">{item.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: EXTRATO DIRETO DO GATEWAY KWIKPAY */}
            {activeTab === 'extrato_kwikpay' && (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-brand-900 border border-violet-100 dark:border-brand-800 rounded-3xl shadow-sm overflow-hidden"
                >
                    <div className="p-4 md:p-6 border-b border-violet-50 dark:border-brand-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <History size={18} className="text-violet-600" />
                                Extrato de Transações B2C (Servidor KwikPay)
                            </h3>
                            <p className="text-[10px] text-slate-400 font-medium">
                                Consulta direta à API oficial: <code className="font-bold">https://kwikpay.web.tr/api/v1/transactions</code>
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={txFilter}
                                onChange={(e: any) => setTxFilter(e.target.value)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 outline-none text-slate-700 dark:text-slate-300"
                            >
                                <option value="all">Todos os Status</option>
                                <option value="success">Concluídos (success)</option>
                                <option value="failed">Falhados (failed)</option>
                                <option value="pending">Pendentes (pending)</option>
                            </select>
                            <button
                                onClick={fetchKwikPayTransactions}
                                disabled={txsLoading}
                                className="p-2 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-700 rounded-xl text-slate-600 dark:text-white transition-all"
                            >
                                <RefreshCw size={14} className={txsLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto px-4 pb-4">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-brand-950/50 border-b border-slate-100 dark:border-brand-800">
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">ID Gateway / Ref</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-center">Destinatário</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Valor</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Taxa (7%)</th>
                                    <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-brand-800">
                                {txsLoading && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-xs">
                                            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-violet-600" />
                                            Carregando extrato KwikPay...
                                        </td>
                                    </tr>
                                )}
                                {!txsLoading && kwikpayTxs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-xs italic">
                                            Nenhuma transação B2C encontrada com os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                                {!txsLoading && kwikpayTxs.map((tx, idx) => (
                                    <tr key={tx.id || tx.transaction_id || idx} className="hover:bg-violet-50/20 dark:hover:bg-brand-800/20 transition-all">
                                        <td className="px-4 py-3">
                                            <p className="font-mono font-bold text-slate-900 dark:text-white">
                                                {tx.reference || tx.transaction_id || `TX_${idx}`}
                                            </p>
                                            <p className="text-[9px] text-slate-400 font-mono">
                                                {tx.mpesa_transaction_id || tx.transaction_id}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {tx.phone}
                                        </td>
                                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                                            {Number(tx.amount).toLocaleString('pt-PT')} MZN
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                                            {tx.fees?.fee_amount ? `${Number(tx.fees.fee_amount).toFixed(2)} MZN` : `${Math.max(Number(tx.amount) * 0.07, 10).toFixed(2)} MZN`}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1",
                                                tx.status === 'success' || tx.status === 'Concluído'
                                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                                    : tx.status === 'failed'
                                                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                                                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                                            )}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* ABA 3: SALDOS DA LOJA & LEVANTAMENTOS TRADICIONAIS */}
            {activeTab === 'loja' && (
                <div className="space-y-6">
                    {/* Tabela de Visão Geral de Saldos da Loja */}
                    <div className="bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-800 rounded-3xl shadow-sm overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-brand-800 flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Wallet size={18} className="text-emerald-600" />
                                Visão Geral de Saldos Acumulados da Loja
                            </h3>
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-brand-800 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                                M-Pesa & e-Mola
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-brand-950/50 border-b border-slate-100 dark:border-brand-800">
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">Carteira</th>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-center">Status</th>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Saldo Coletado</th>
                                        <th className="px-6 py-3 font-black text-slate-400 uppercase tracking-widest text-[9px] text-right">Levantado</th>
                                        <th className="px-6 py-3 font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-[9px] text-right bg-emerald-50/30">Disponível</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-brand-800">
                                    {(['M-Pesa', 'e-Mola'] as const).map((wId) => (
                                        <tr key={wId} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900 dark:text-white flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 p-1 flex items-center justify-center">
                                                    <img
                                                        src={wId === 'M-Pesa' ? '/mpesa_logo.png' : '/emola_logo.png'}
                                                        alt={wId}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                                <span>{wId}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {pendingByWallet[wId] ? (
                                                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] font-black uppercase">
                                                        Levantamento Pendente
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase">
                                                        Disponível
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-700 dark:text-slate-300">
                                                {balances[wId].collected.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-500">
                                                {balances[wId].withdrawn.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50/10">
                                                {balances[wId].available.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MT
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Formulário de Retirada da Loja */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-800 p-6 rounded-3xl shadow-sm">
                            <h3 className="text-base font-black text-slate-900 dark:text-white mb-4">
                                Solicitar Levantamento da Loja
                            </h3>
                            <form onSubmit={handleShopWithdraw} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Carteira
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['M-Pesa', 'e-Mola'] as const).map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setShopMethod(m)}
                                                className={cn(
                                                    "py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2",
                                                    shopMethod === m
                                                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                                                        : "border-slate-200 dark:border-brand-800 text-slate-500"
                                                )}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Telefone Destino
                                    </label>
                                    <input
                                        type="tel"
                                        value={shopPhone}
                                        onChange={(e) => setShopPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                        placeholder="856195186"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-xs font-bold outline-none dark:text-white"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Valor (MZN)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShopAmount(String(balances[shopMethod].available))}
                                            className="text-[9px] font-black text-emerald-600 hover:underline"
                                        >
                                            Total ({balances[shopMethod].available} MT)
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        value={shopAmount}
                                        onChange={(e) => setShopAmount(e.target.value)}
                                        placeholder="50,00"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-xl text-lg font-black outline-none dark:text-white"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={shopLoading || pendingByWallet[shopMethod]}
                                    className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                                >
                                    {shopLoading ? <Loader2 className="animate-spin" size={16} /> : "Solicitar Retirada"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SUCESSO DO SAQUE B2C */}
            <AnimatePresence>
                {b2cSuccessData && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-brand-900 w-full max-w-md rounded-[2.5rem] p-8 text-center shadow-2xl border border-violet-100 dark:border-brand-800 space-y-6"
                        >
                            <div className="h-20 w-20 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center mx-auto shadow-inner ring-4 ring-emerald-50/50">
                                <CheckCircle2 size={44} className="animate-bounce" />
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                                    Saque B2C Concluído!
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-brand-300 font-medium">
                                    O valor foi enviado para a conta M-Pesa do cliente.
                                </p>
                            </div>

                            {/* Resumo da Transação */}
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-left space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Destinatário:</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                        {b2cSuccessData.phone} (João Maibass)
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Valor Bruto:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {b2cSuccessData.amount} MZN
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Taxa KwikPay (7%):</span>
                                    <span className="font-bold text-violet-600 dark:text-violet-400">
                                        - {b2cSuccessData.fee?.toFixed(2)} MZN
                                    </span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-brand-800 text-sm font-black">
                                    <span className="text-slate-900 dark:text-white">Valor Líquido:</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        {b2cSuccessData.net?.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1 text-[10px] font-mono text-slate-400">
                                    <span>Referência:</span>
                                    <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                                        {b2cSuccessData.reference}
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(b2cSuccessData.reference);
                                                setCopiedRef(true);
                                                setTimeout(() => setCopiedRef(false), 2000);
                                            }}
                                            className="text-violet-500 hover:text-violet-700"
                                        >
                                            {copiedRef ? <Check size={12} /> : <Copy size={12} />}
                                        </button>
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setB2cSuccessData(null)}
                                className="w-full py-4 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-2xl font-black text-sm shadow-xl shadow-violet-600/30 transition-all"
                            >
                                Fechar Comprovante
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE SUCESSO SAQUE DA LOJA */}
            <AnimatePresence>
                {showShopSuccess && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-brand-900 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border border-slate-100 dark:border-brand-800 space-y-4"
                        >
                            <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto">
                                <CheckCircle2 size={36} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                Levantamento Solicitado
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                Seu pedido foi registrado com sucesso e será creditado em breve.
                            </p>
                            <button
                                onClick={() => setShowShopSuccess(false)}
                                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs"
                            >
                                Entendido
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
