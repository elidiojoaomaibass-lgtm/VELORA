import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet, Key, Phone, RefreshCw, CheckCircle2, AlertCircle,
    Eye, EyeOff, Save, Loader2, Settings2, Shield,
    ArrowUpRight, Activity, Copy, Check, Zap, Globe,
    CreditCard, Hash, TestTube2, ChevronRight, Info,
    TrendingUp, Clock, XCircle, BarChart3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// ─── Local Storage Keys ─────────────────────────────────────────────────────
const LS_CLIENT_ID = 'b2c_client_id';
const LS_CLIENT_SECRET = 'b2c_client_secret';
const LS_WALLET_ID = 'b2c_wallet_id';
const LS_PHONE = 'b2c_default_phone';
const LS_ENV = 'b2c_environment';

// ─── Types ───────────────────────────────────────────────────────────────────
interface WalletBalance {
    wallet_uuid?: string;
    wallet_name?: string;
    balance?: number;
    currency?: string;
    environment?: string;
}

interface B2CTx {
    id?: string;
    transaction_id?: string;
    status: string;
    amount: number;
    phone: string;
    reference: string;
    created_at?: string;
    fees?: { fee_amount?: number; net_amount?: number };
}

type TabId = 'credenciais' | 'saldo' | 'numero' | 'historico' | 'testar';

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'credenciais', label: 'Credenciais', icon: Key, color: 'from-violet-500 to-purple-600' },
    { id: 'saldo', label: 'Saldo', icon: Wallet, color: 'from-emerald-500 to-teal-600' },
    { id: 'numero', label: 'Número', icon: Phone, color: 'from-blue-500 to-cyan-600' },
    { id: 'historico', label: 'Histórico', icon: BarChart3, color: 'from-amber-500 to-orange-600' },
    { id: 'testar', label: 'Testar', icon: TestTube2, color: 'from-rose-500 to-pink-600' },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    success: { label: 'Sucesso', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    completed: { label: 'Concluído', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    failed: { label: 'Falhou', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: XCircle },
    pending: { label: 'Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
};

// ─── Utility: CopyButton ─────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handle} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80">
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
    );
}

// ─── Utility: StatCard ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, gradient }: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; gradient: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
            <div className="relative flex items-start gap-4">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} opacity-80`}>
                    <Icon size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">{label}</p>
                    <p className="text-lg font-bold text-white leading-tight truncate">{value}</p>
                    {sub && <p className="text-[10px] text-white/30 mt-0.5 font-mono truncate">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const B2CConfigView = () => {
    const [activeTab, setActiveTab] = useState<TabId>('credenciais');

    // ── Credentials state ──
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [walletId, setWalletId] = useState('');
    const [environment, setEnvironment] = useState<'production' | 'sandbox'>('production');
    const [showSecret, setShowSecret] = useState(false);
    const [credsSaving, setCredsSaving] = useState(false);

    // ── Balance state ──
    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [saqueLoading, setSaqueLoading] = useState(false);

    // ── Phone state ──
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneSaving, setPhoneSaving] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);

    // ── History state ──
    const [txs, setTxs] = useState<B2CTx[]>([]);
    const [txsLoading, setTxsLoading] = useState(false);
    const [txFilter, setTxFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

    // ── Test Payout state ──
    const [testAmount, setTestAmount] = useState('10');
    const [testPhone, setTestPhone] = useState('');
    const [testRef, setTestRef] = useState(`TEST_${Date.now().toString().slice(-6)}`);
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    // ── Load from storage on mount ─────────────────────────────────────────────
    useEffect(() => {
        setClientId(localStorage.getItem(LS_CLIENT_ID) || (import.meta.env.VITE_KWIKPAY_CLIENT_ID ?? ''));
        setClientSecret(localStorage.getItem(LS_CLIENT_SECRET) || (import.meta.env.VITE_KWIKPAY_CLIENT_SECRET ?? ''));
        setWalletId(localStorage.getItem(LS_WALLET_ID) || (import.meta.env.VITE_KWIKPAY_WALLET_ID ?? ''));
        setEnvironment((localStorage.getItem(LS_ENV) as any) || 'production');
        const stored = localStorage.getItem(LS_PHONE);
        if (stored) setTestPhone(stored);

        (async () => {
            try {
                const { data: sess } = await supabase.auth.getSession();
                const user = sess?.session?.user;
                if (!user) return;
                const { data } = await supabase
                    .from('user_settings')
                    .select('phone_number')
                    .eq('user_email', user.email)
                    .maybeSingle();
                const ph = data?.phone_number || user.user_metadata?.phone_number;
                if (ph) {
                    const clean = String(ph).replace(/\D/g, '').slice(-9);
                    setPhoneNumber(clean);
                    if (!stored) setTestPhone(clean);
                }
            } catch { /* silent */ }
        })();
    }, []);

    // ── Fetch Balance ──────────────────────────────────────────────────────────
    const fetchBalance = useCallback(async () => {
        setBalanceLoading(true);
        try {
            const res = await fetch('/api/b2c?action=balance');
            const data = await res.json();
            setBalance(data.success && data.data ? data.data : data);
            setLastRefresh(new Date());
        } catch {
            toast.error('Não foi possível consultar o saldo.');
        } finally {
            setBalanceLoading(false);
        }
    }, []);

    // ── Fetch Transactions ─────────────────────────────────────────────────────
    const fetchTxs = useCallback(async () => {
        setTxsLoading(true);
        try {
            const sp = txFilter === 'all' ? '' : `&status=${txFilter}`;
            const res = await fetch(`/api/b2c?action=transactions&type=b2c&per_page=20${sp}`);
            const data = await res.json();
            setTxs(data.success && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);
        } catch {
            toast.error('Erro ao carregar histórico.');
        } finally {
            setTxsLoading(false);
        }
    }, [txFilter]);

    useEffect(() => {
        if (activeTab === 'saldo') fetchBalance();
        if (activeTab === 'historico') fetchTxs();
    }, [activeTab, fetchBalance, fetchTxs]);

    // ── Save Credentials ───────────────────────────────────────────────────────
    const handleSaveCredentials = async () => {
        if (!clientId.trim() || !clientSecret.trim() || !walletId.trim()) {
            toast.error('Preenche todos os campos de credenciais.');
            return;
        }
        setCredsSaving(true);
        await new Promise(r => setTimeout(r, 700));
        localStorage.setItem(LS_CLIENT_ID, clientId.trim());
        localStorage.setItem(LS_CLIENT_SECRET, clientSecret.trim());
        localStorage.setItem(LS_WALLET_ID, walletId.trim());
        localStorage.setItem(LS_ENV, environment);
        setCredsSaving(false);
        toast.success('✅ Credenciais B2C guardadas com sucesso!');
    };

    // ── Save Phone ─────────────────────────────────────────────────────────────
    const handleSavePhone = async () => {
        const clean = phoneNumber.replace(/\D/g, '').slice(-9);
        if (clean.length !== 9) { toast.error('Número M-Pesa inválido (9 dígitos).'); return; }
        setPhoneSaving(true);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const user = sess?.session?.user;
            if (user?.email) {
                await supabase.from('user_settings')
                    .upsert({ user_email: user.email, phone_number: clean }, { onConflict: 'user_email' });
                await supabase.auth.updateUser({ data: { phone_number: clean } });
            }
            localStorage.setItem(LS_PHONE, clean);
            setPhoneVerified(true);
            setTestPhone(clean);
            toast.success(`📱 Número +258 ${clean} configurado como destino B2C!`);
        } catch {
            toast.error('Erro ao guardar número no Supabase.');
        } finally {
            setPhoneSaving(false);
        }
    };

    // ── Test Payout ────────────────────────────────────────────────────────────
    const handleTestPayout = async () => {
        const amt = parseFloat(testAmount);
        if (!amt || amt < 1) { toast.error('Valor mínimo: 1 MZN'); return; }
        const cleanPhone = testPhone.replace(/\D/g, '').slice(-9);
        if (cleanPhone.length !== 9) { toast.error('Número inválido (9 dígitos).'); return; }
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/b2c', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'payout', amount: amt, phone: cleanPhone, reference: testRef, recipient_name: 'Teste B2C' }),
            });
            const data = await res.json();
            const ok = res.ok && data.success !== false;
            setTestResult({ ok, data });
            ok ? toast.success('✅ Payout de teste processado!') : toast.error(`❌ ${data.error || 'Erro no payout'}`);
        } catch (err: any) {
            setTestResult({ ok: false, data: { error: err.message } });
            toast.error('Falha de conexão com a API B2C.');
        } finally {
            setTestLoading(false);
            setTestRef(`TEST_${Date.now().toString().slice(-6)}`);
        }
    };

    // ── Saque Imediato ─────────────────────────────────────────────────────────
    const handleSaque = async () => {
        if (!balance || !balance.balance || balance.balance < 1) {
            toast.error('Saldo insuficiente para saque.');
            return;
        }
        if (!phoneNumber || phoneNumber.length !== 9) {
            toast.error('Número de destino não configurado ou inválido. Configure na aba "Número".');
            return;
        }
        setSaqueLoading(true);
        try {
            const res = await fetch('/api/b2c', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'payout', amount: balance.balance, phone: phoneNumber, reference: `SAQ_${Date.now().toString().slice(-6)}`, recipient_name: 'Saque Imediato' }),
            });
            const data = await res.json();
            const ok = res.ok && data.success !== false;
            if (ok) {
                toast.success(`✅ Saque de ${Number(balance.balance).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN processado!`);
                fetchBalance();
            } else {
                toast.error(`❌ ${data.error || 'Erro no saque'}`);
            }
        } catch (err: any) {
            toast.error('Falha de conexão com a API B2C.');
        } finally {
            setSaqueLoading(false);
        }
    };

    // ── Format helpers ─────────────────────────────────────────────────────────
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    const fmtAmt = (n: number) => `${Number(n).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN`;
    const feePreview = (amt: number) => ({ fee: Math.max(amt * 0.07, 10), net: Math.max(amt - Math.max(amt * 0.07, 10), 0) });

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#080812] text-white">
            {/* Ambient glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[40%] right-[-5%] w-[30%] h-[40%] bg-emerald-600/8 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[30%] w-[35%] h-[35%] bg-blue-600/8 rounded-full blur-[130px]" />
            </div>

            <div className="relative z-10 p-4 lg:p-8 max-w-5xl mx-auto">
                {/* ── Header ── */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30">
                            <Settings2 size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Configuração B2C</h1>
                            <p className="text-sm text-white/40 mt-0.5">KwikPay · M-Pesa · Business-to-Consumer</p>
                        </div>
                    </div>

                    {/* Status pill */}
                    <div className="flex items-center gap-3 flex-wrap mt-4">
                        <span className={cn(
                            'flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border',
                            environment === 'production'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', environment === 'production' ? 'bg-emerald-400' : 'bg-amber-400')} />
                            {environment === 'production' ? 'PRODUÇÃO ACTIVA' : 'SANDBOX'}
                        </span>
                        {clientId && (
                            <span className="text-xs text-white/30 font-mono">Client ID: {clientId}</span>
                        )}
                        {balance?.balance !== undefined && (
                            <span className="text-xs font-bold text-emerald-400">
                                💰 {fmtAmt(balance.balance)}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Tab Bar ── */}
                <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl mb-8 overflow-x-auto scrollbar-hide">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-1 justify-center',
                                activeTab === tab.id
                                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                        >
                            <tab.icon size={15} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22 }}
                    >

                        {/* ━━━━━━━━━━ CREDENCIAIS ━━━━━━━━━━ */}
                        {activeTab === 'credenciais' && (
                            <div className="space-y-6">
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                                    <Info size={17} className="text-violet-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-violet-300 text-sm mb-1">Configuração Manual das Credenciais KwikPay</p>
                                        <p className="text-xs text-white/45 leading-relaxed">
                                            As credenciais guardadas aqui têm prioridade sobre as variáveis de ambiente.
                                            São usadas nas chamadas B2C via gateway KwikPay.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-5 lg:grid-cols-2">
                                    {/* Client ID */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <Hash size={11} className="text-violet-400" /> Client ID
                                        </label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={clientId}
                                                onChange={e => setClientId(e.target.value)}
                                                placeholder="Ex: 11"
                                                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25 transition-all"
                                            />
                                            {clientId && <span className="absolute right-2"><CopyButton text={clientId} /></span>}
                                        </div>
                                    </div>

                                    {/* Environment */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <Globe size={11} className="text-violet-400" /> Ambiente
                                        </label>
                                        <div className="flex gap-2 h-[46px]">
                                            {(['production', 'sandbox'] as const).map(env => (
                                                <button
                                                    key={env}
                                                    onClick={() => setEnvironment(env)}
                                                    className={cn(
                                                        'flex-1 rounded-xl text-sm font-semibold border transition-all',
                                                        environment === env
                                                            ? env === 'production'
                                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                                            : 'bg-white/[0.03] border-white/[0.09] text-white/40 hover:text-white/60'
                                                    )}
                                                >
                                                    {env === 'production' ? '🟢 Produção' : '🟡 Sandbox'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Client Secret */}
                                    <div className="space-y-2 lg:col-span-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <Shield size={11} className="text-violet-400" /> Client Secret
                                        </label>
                                        <div className="relative flex items-center">
                                            <input
                                                type={showSecret ? 'text' : 'password'}
                                                value={clientSecret}
                                                onChange={e => setClientSecret(e.target.value)}
                                                placeholder="ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q"
                                                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25 transition-all pr-20"
                                            />
                                            <div className="absolute right-2 flex gap-1">
                                                <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80">
                                                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                                {clientSecret && <CopyButton text={clientSecret} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Wallet UUID */}
                                    <div className="space-y-2 lg:col-span-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <CreditCard size={11} className="text-violet-400" /> Wallet UUID (M-Pesa)
                                        </label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={walletId}
                                                onChange={e => setWalletId(e.target.value)}
                                                placeholder="891ae33d-664c-4715-abb1-008688662a03"
                                                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25 transition-all pr-10"
                                            />
                                            {walletId && <span className="absolute right-2"><CopyButton text={walletId} /></span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleSaveCredentials}
                                        disabled={credsSaving}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {credsSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {credsSaving ? 'A guardar...' : 'Guardar Credenciais'}
                                    </button>
                                </div>

                                {/* Active config summary */}
                                {(clientId || walletId) && (
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-3">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Configuração Activa</p>
                                        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs">
                                            <div><span className="text-white/30">Client ID:</span> <span className="text-white/70 font-mono ml-1">{clientId || '—'}</span></div>
                                            <div><span className="text-white/30">Ambiente:</span> <span className={cn('font-semibold ml-1', environment === 'production' ? 'text-emerald-400' : 'text-amber-400')}>{environment}</span></div>
                                            <div className="col-span-2"><span className="text-white/30">Wallet:</span> <span className="text-white/60 font-mono ml-1 break-all">{walletId || '—'}</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ━━━━━━━━━━ SALDO ━━━━━━━━━━ */}
                        {activeTab === 'saldo' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Saldo da Carteira KwikPay</h2>
                                        <p className="text-xs text-white/30 mt-0.5">
                                            {lastRefresh ? `Última actualização: ${lastRefresh.toLocaleTimeString('pt-PT')}` : 'Clique em Atualizar para consultar'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={fetchBalance}
                                        disabled={balanceLoading}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-60"
                                    >
                                        <RefreshCw size={15} className={balanceLoading ? 'animate-spin' : ''} />
                                        Atualizar
                                    </button>
                                </div>

                                {balanceLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                                            <Wallet size={20} className="text-emerald-400 absolute inset-0 m-auto" />
                                        </div>
                                        <p className="text-sm text-white/40">A consultar saldo KwikPay...</p>
                                    </div>
                                ) : balance ? (
                                    <>
                                        {/* Hero balance card */}
                                        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 p-8"
                                            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(13,148,136,0.08) 100%)' }}>
                                            <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
                                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-400/5 rounded-full blur-2xl -translate-x-1/4 translate-y-1/4" />
                                            <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Wallet size={16} className="text-emerald-400" />
                                                        <span className="text-[11px] font-bold text-emerald-400/70 uppercase tracking-widest">Saldo Disponível</span>
                                                    </div>
                                                    <p className="text-5xl lg:text-6xl font-black text-white tracking-tight">
                                                        {balance.balance !== undefined ? Number(balance.balance).toLocaleString('pt-MZ', { minimumFractionDigits: 2 }) : '—'}
                                                    </p>
                                                    <p className="text-lg text-emerald-400/60 font-bold mt-1">{balance.currency || 'MZN'}</p>
                                                </div>
                                                <button
                                                    onClick={handleSaque}
                                                    disabled={saqueLoading || !balance.balance || balance.balance < 1}
                                                    className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                                                >
                                                    {saqueLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                                    Saque Imediato
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stats grid */}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            <StatCard label="Carteira" value={balance.wallet_name || 'KwikPay'} icon={CreditCard} gradient="from-blue-500 to-cyan-600" />
                                            <StatCard label="Ambiente" value={balance.environment || environment} icon={Globe} gradient="from-violet-500 to-purple-600" />
                                            <StatCard label="Wallet UUID" value={balance.wallet_uuid ? `${balance.wallet_uuid.slice(0, 8)}…` : '—'} sub={balance.wallet_uuid} icon={Hash} gradient="from-amber-500 to-orange-600" />
                                        </div>

                                        {/* Raw response */}
                                        <details className="group">
                                            <summary className="cursor-pointer flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors select-none list-none">
                                                <ChevronRight size={13} className="group-open:rotate-90 transition-transform" />
                                                Ver resposta completa da API
                                            </summary>
                                            <pre className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] text-xs text-white/45 overflow-x-auto font-mono leading-relaxed">
                                                {JSON.stringify(balance, null, 2)}
                                            </pre>
                                        </details>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <AlertCircle size={36} className="text-white/15" />
                                        <p className="text-white/35 text-sm">Clique em "Atualizar" para consultar o saldo.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ━━━━━━━━━━ NÚMERO ━━━━━━━━━━ */}
                        {activeTab === 'numero' && (
                            <div className="space-y-6">
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                                    <Info size={17} className="text-blue-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-blue-300 text-sm mb-1">Número Padrão de Destino B2C</p>
                                        <p className="text-xs text-white/45 leading-relaxed">
                                            Este número M-Pesa é usado automaticamente como destino quando não é especificado
                                            um número durante o saque. É guardado no Supabase e sincronizado com o teu perfil.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                        <Phone size={11} className="text-blue-400" /> Número M-Pesa (9 dígitos)
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.09] text-sm text-white/50 font-semibold whitespace-nowrap">
                                            🇲🇿 +258
                                        </div>
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={e => {
                                                setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9));
                                                setPhoneVerified(false);
                                            }}
                                            placeholder="856195186"
                                            maxLength={9}
                                            className="flex-1 bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-lg text-white placeholder-white/20 font-mono tracking-[0.2em] focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/25 transition-all"
                                        />
                                    </div>

                                    {/* Validation indicator */}
                                    {phoneNumber.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                'flex items-center gap-2 text-xs px-3 py-2 rounded-lg border',
                                                phoneNumber.length === 9
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                            )}
                                        >
                                            {phoneNumber.length === 9
                                                ? <><CheckCircle2 size={13} /> Número válido — pronto para guardar</>
                                                : <><AlertCircle size={13} /> Faltam {9 - phoneNumber.length} dígito(s)</>}
                                        </motion.div>
                                    )}

                                    {/* Prefixes info */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {[{ p: '84', op: 'Vodacom M-Pesa' }, { p: '85', op: 'Vodacom M-Pesa' }, { p: '86', op: 'Movitel' }, { p: '87', op: 'e-Mola' }].map(({ p, op }) => (
                                            <div key={p} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px] text-white/35">
                                                <span className="font-mono font-bold text-white/50">+258 {p}x</span> · {op}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSavePhone}
                                    disabled={phoneSaving || phoneNumber.length !== 9}
                                    className={cn(
                                        'flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all',
                                        phoneVerified
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-gradient-to-r from-blue-600 to-cyan-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]',
                                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none'
                                    )}
                                >
                                    {phoneSaving
                                        ? <><Loader2 size={16} className="animate-spin" /> A guardar no Supabase...</>
                                        : phoneVerified
                                            ? <><CheckCircle2 size={16} /> Número Guardado!</>
                                            : <><Save size={16} /> Guardar como Destino Padrão</>}
                                </button>

                                {/* Preview card */}
                                {phoneNumber.length === 9 && (
                                    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                                        className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Destino Configurado</p>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                <Phone size={20} className="text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-xl font-bold text-white font-mono">+258 {phoneNumber}</p>
                                                <p className="text-xs text-white/35 mt-0.5">M-Pesa · Moçambique</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        {/* ━━━━━━━━━━ HISTÓRICO ━━━━━━━━━━ */}
                        {activeTab === 'historico' && (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white">Histórico de Transações B2C</h2>
                                    <button
                                        onClick={fetchTxs}
                                        disabled={txsLoading}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 active:scale-95 transition-all"
                                    >
                                        <RefreshCw size={15} className={txsLoading ? 'animate-spin' : ''} />
                                        Atualizar
                                    </button>
                                </div>

                                {/* Filter chips */}
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {(['all', 'success', 'failed', 'pending'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setTxFilter(f)}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all',
                                                txFilter === f
                                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                                    : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60 hover:bg-white/[0.05]'
                                            )}
                                        >
                                            {f === 'all' ? '· Todas' : STATUS_MAP[f]?.label || f}
                                        </button>
                                    ))}
                                </div>

                                {txsLoading ? (
                                    <div className="flex items-center justify-center py-14">
                                        <Loader2 size={28} className="animate-spin text-amber-400" />
                                    </div>
                                ) : txs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                                        <Activity size={40} className="text-white/10" />
                                        <div className="text-center">
                                            <p className="text-white/35 text-sm font-semibold">Nenhuma transação encontrada</p>
                                            <p className="text-white/20 text-xs mt-1">As transações B2C aparecem aqui após processamento</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {txs.map((tx, i) => {
                                            const sk = tx.status?.toLowerCase();
                                            const si = STATUS_MAP[sk] || { label: tx.status, color: 'text-white/50 bg-white/5 border-white/10', icon: Clock };
                                            const SIcon = si.icon;
                                            return (
                                                <motion.div
                                                    key={tx.id || tx.transaction_id || i}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-white/[0.13] transition-all"
                                                >
                                                    <div className={cn('p-2 rounded-xl border shrink-0', si.color)}>
                                                        <SIcon size={15} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-bold text-white">{fmtAmt(tx.amount)}</p>
                                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', si.color)}>
                                                                {si.label}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-white/35 mt-0.5 font-mono">
                                                            📱 +258 {tx.phone} · <span className="text-white/25">{tx.reference}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs text-white/30">{fmtDate(tx.created_at)}</p>
                                                        {tx.fees?.net_amount !== undefined && (
                                                            <p className="text-xs text-emerald-400 mt-0.5 font-semibold">
                                                                Líq: {fmtAmt(tx.fees.net_amount)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ━━━━━━━━━━ TESTAR ━━━━━━━━━━ */}
                        {activeTab === 'testar' && (
                            <div className="space-y-6">
                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                                    <AlertCircle size={17} className="text-rose-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-rose-300 text-sm mb-1">⚠️ Payout Real — Atenção</p>
                                        <p className="text-xs text-white/45 leading-relaxed">
                                            Este módulo executa um payout B2C real via KwikPay M-Pesa.
                                            Usa um número e valor corretos. Transações aprovadas não são reembolsadas automaticamente.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-5 lg:grid-cols-2">
                                    {/* Amount */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <TrendingUp size={11} className="text-rose-400" /> Valor (MZN)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number" min="1" value={testAmount}
                                                onChange={e => setTestAmount(e.target.value)}
                                                placeholder="10"
                                                className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/25 transition-all"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/25 font-bold">MZN</span>
                                        </div>
                                        {/* Quick amounts */}
                                        <div className="flex gap-2">
                                            {['10', '50', '100', '500'].map(a => (
                                                <button key={a} onClick={() => setTestAmount(a)}
                                                    className={cn(
                                                        'flex-1 py-1.5 rounded-lg text-xs border transition-all',
                                                        testAmount === a
                                                            ? 'bg-rose-500/20 border-rose-500/30 text-rose-300 font-bold'
                                                            : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60'
                                                    )}>
                                                    {a}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <Phone size={11} className="text-rose-400" /> Número Destino
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="flex items-center px-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.09] text-xs text-white/40 whitespace-nowrap">
                                                🇲🇿 +258
                                            </div>
                                            <input
                                                type="tel" value={testPhone} maxLength={9}
                                                onChange={e => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                                placeholder="856195186"
                                                className="flex-1 bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/25 transition-all"
                                            />
                                        </div>
                                        {phoneNumber && testPhone !== phoneNumber && (
                                            <button onClick={() => setTestPhone(phoneNumber)}
                                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                                                <ArrowUpRight size={12} /> Usar número padrão ({phoneNumber})
                                            </button>
                                        )}
                                    </div>

                                    {/* Reference */}
                                    <div className="space-y-2 lg:col-span-2">
                                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                            <Hash size={11} className="text-rose-400" /> Referência
                                        </label>
                                        <input
                                            type="text" value={testRef}
                                            onChange={e => setTestRef(e.target.value)}
                                            className="w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/25 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Fee preview */}
                                {parseFloat(testAmount) > 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Previsão de Taxas · 7% (mín. 10 MZN)</p>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            {[
                                                { label: 'Valor Enviado', val: parseFloat(testAmount), color: 'text-white' },
                                                { label: 'Taxa KwikPay', val: -feePreview(parseFloat(testAmount)).fee, color: 'text-rose-400' },
                                                { label: 'Líquido Recebido', val: feePreview(parseFloat(testAmount)).net, color: 'text-emerald-400' },
                                            ].map(({ label, val, color }) => (
                                                <div key={label}>
                                                    <p className="text-[10px] text-white/30 mb-2 uppercase tracking-wide">{label}</p>
                                                    <p className={cn('text-xl font-black', color)}>
                                                        {val < 0 ? '-' : ''}{fmtAmt(Math.abs(val))}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                <button
                                    onClick={handleTestPayout}
                                    disabled={testLoading}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-700 text-white font-bold text-sm shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                                >
                                    {testLoading
                                        ? <><Loader2 size={16} className="animate-spin" /> A processar payout...</>
                                        : <><Zap size={16} /> Executar Payout de Teste</>}
                                </button>

                                {/* Result */}
                                <AnimatePresence>
                                    {testResult && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.96 }}
                                            className={cn(
                                                'rounded-2xl border p-5 space-y-3',
                                                testResult.ok
                                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                                    : 'bg-rose-500/5 border-rose-500/20'
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                {testResult.ok
                                                    ? <CheckCircle2 size={18} className="text-emerald-400" />
                                                    : <XCircle size={18} className="text-rose-400" />}
                                                <span className={cn('font-bold text-sm', testResult.ok ? 'text-emerald-300' : 'text-rose-300')}>
                                                    {testResult.ok ? 'Payout processado com sucesso!' : `Erro: ${testResult.data?.error || 'Falha desconhecida'}`}
                                                </span>
                                            </div>
                                            <details className="group">
                                                <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50 flex items-center gap-1 list-none select-none">
                                                    <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                                                    Ver resposta completa da API
                                                </summary>
                                                <pre className="mt-2 p-3 rounded-xl bg-black/30 text-xs text-white/45 overflow-x-auto font-mono leading-relaxed">
                                                    {JSON.stringify(testResult.data, null, 2)}
                                                </pre>
                                            </details>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
