import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    TrendingUp, Receipt, Wallet, TrendingDown,
    CheckCircle2, XCircle, Clock, Calendar, X, BarChart3,
    ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useProductsStore, useTransactionsStore } from '../lib/store';

// ─── Data Generation Utilities ──────────────────────────────────────────────


type Period = 'Hoje' | 'Ontem' | '7d' | '30d' | '90d' | 'Todo' | 'custom';

export const AnalyticsView = () => {
    const { products } = useProductsStore();
    const { transactions } = useTransactionsStore();
    const [period, setPeriod] = useState<Period>('Hoje');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Refs for auto-focus
    const startDRef = useRef<HTMLInputElement>(null);
    const startMRef = useRef<HTMLInputElement>(null);
    const startYRef = useRef<HTMLInputElement>(null);
    const endDRef = useRef<HTMLInputElement>(null);
    const endMRef = useRef<HTMLInputElement>(null);
    const endYRef = useRef<HTMLInputElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const startInputRef = useRef<HTMLInputElement>(null);
    const endInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Derived from startDate — no useEffect needed
    const startParts = useMemo(() => {
        if (!startDate) return { d: '', m: '', y: '' };
        const [y, m, d] = startDate.split('-');
        return { d, m, y };
    }, [startDate]);

    // Derived from endDate — no useEffect needed
    const endParts = useMemo(() => {
        if (!endDate) return { d: '', m: '', y: '' };
        const [y, m, d] = endDate.split('-');
        return { d, m, y };
    }, [endDate]);

    // Mutable working copies so user can type freely before a full date is formed
    const [startPartsEdit, setStartPartsEdit] = useState({ d: '', m: '', y: '' });
    const [endPartsEdit, setEndPartsEdit] = useState({ d: '', m: '', y: '' });

    // Keep edit copies in sync when programmatic changes happen (e.g. quick-fill buttons)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setStartPartsEdit(startParts); }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setEndPartsEdit(endParts); }, [endDate]); // eslint-disable-line react-hooks/exhaustive-deps

    // Helper to update date from parts with auto-focus
    const updateFromParts = (type: 'start' | 'end', key: 'd' | 'm' | 'y', val: string) => {
        const numericVal = val.replace(/\D/g, '');

        if (type === 'start') {
            const newParts = { ...startPartsEdit, [key]: numericVal };
            setStartPartsEdit(newParts);
            if (key === 'd' && numericVal.length === 2) startMRef.current?.focus();
            if (key === 'm' && numericVal.length === 2) startYRef.current?.focus();
            if (key === 'y' && numericVal.length === 4) endDRef.current?.focus();
            if (newParts.d.length === 2 && newParts.m.length === 2 && newParts.y.length === 4) {
                setStartDate(`${newParts.y}-${newParts.m}-${newParts.d}`);
            }
        } else {
            const newParts = { ...endPartsEdit, [key]: numericVal };
            setEndPartsEdit(newParts);
            if (key === 'd' && numericVal.length === 2) endMRef.current?.focus();
            if (key === 'm' && numericVal.length === 2) endYRef.current?.focus();
            if (newParts.d.length === 2 && newParts.m.length === 2 && newParts.y.length === 4) {
                setEndDate(`${newParts.y}-${newParts.m}-${newParts.d}`);
            }
        }
    };

    // Helper to filter transactions by date range
    const getFilteredTransactions = useCallback(() => {
        const now = new Date();
        return transactions.filter(tx => {
            const txDate = new Date(tx.createdAt);
            if (period === 'Hoje') return txDate.toDateString() === now.toDateString();
            if (period === 'Ontem') {
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                return txDate.toDateString() === yesterday.toDateString();
            }
            if (period === '7d') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                return txDate >= weekAgo;
            }
            if (period === '30d') {
                const monthAgo = new Date();
                monthAgo.setDate(now.getDate() - 30);
                return txDate >= monthAgo;
            }
            if (period === '90d') {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setDate(now.getDate() - 90);
                return txDate >= threeMonthsAgo;
            }
            if (period === 'Todo') return true;
            if (period === 'custom' && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59);
                return txDate >= start && txDate <= end;
            }
            return true;
        });
    }, [period, startDate, endDate, transactions]);

    // Filtering logic that generates UI-optimized data per period
    const filteredData = useMemo(() => {
        const txs = getFilteredTransactions().filter(t => t.type === 'payment');
        
        if (period === 'Hoje' || period === 'Ontem') {
            const hours = period === 'Hoje' ? new Date().getHours() + 1 : 24;
            return Array.from({ length: hours }, (_, i) => {
                const hourTxs = txs.filter(t => new Date(t.createdAt).getHours() === i);
                return {
                    name: `${i.toString().padStart(2, '0')}h`,
                    leads: 0,
                    vendas: hourTxs.length,
                    receita: hourTxs.reduce((acc, curr) => acc + (curr.status === 'Concluído' ? curr.amount : 0), 0),
                    perdido: hourTxs.reduce((acc, curr) => acc + (curr.status === 'Falhou' ? curr.amount : 0), 0)
                };
            });
        }

        // Daily aggregation for longer periods
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 120;
        return Array.from({ length: days }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dayStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
            
            const dayTxs = txs.filter(t => new Date(t.createdAt).toDateString() === date.toDateString());

            return {
                name: dayStr,
                leads: 0,
                vendas: dayTxs.length,
                receita: dayTxs.reduce((acc, curr) => acc + (curr.status === 'Concluído' ? curr.amount : 0), 0),
                perdido: dayTxs.reduce((acc, curr) => acc + (curr.status === 'Falhou' ? curr.amount : 0), 0)
            };
        });
    }, [getFilteredTransactions, period, startDate, endDate, transactions]);

    // Calculate dynamic stats based on filtered data
    const stats = useMemo(() => {
        const currentTxs = getFilteredTransactions();
        const payments = currentTxs.filter(t => t.type === 'payment');
        
        const totalRevenue = payments.reduce((acc, curr) => acc + (curr.status === 'Concluído' ? curr.amount : 0), 0);
        const totalSales = payments.filter(t => t.status === 'Concluído').length;
        const lostRevenue = payments.reduce((acc, curr) => acc + (curr.status === 'Falhou' ? curr.amount : 0), 0);

        return {
            totalRevenue,
            totalSales,
            lostRevenue,
            netRevenue: totalRevenue,
            failedTransactions: payments.filter(t => t.status === 'Falhou').length,
            pendingTransactions: payments.filter(t => t.status === 'Pendente').length,
            totalTransactions: payments.length
        };
    }, [getFilteredTransactions, filteredData, period, transactions]);

    const topProducts = useMemo(() =>
        [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
        [products]);

    return (
        <div className="px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-1 md:space-y-3 mt-3 md:mt-2"
                >
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0 flex items-center min-h-[2rem] md:min-h-0">
                        <span>Relatório de <span className="text-gradient">Transações</span></span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug">
                        Visão detalhada sobre volumes financeiros e estado de processamento.
                    </p>
                </motion.div>

                <div className="flex flex-row items-center gap-2 bg-white dark:bg-brand-900 border border-slate-100 dark:border-white/5 p-1.5 rounded-3xl shadow-xl relative" ref={datePickerRef}>
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
                        {['Hoje', 'Ontem', '7d', '30d', '90d', 'Todo'].map((p) => (
                            <button
                                key={p}
                                onClick={() => {
                                    setPeriod(p as Period);
                                    setShowDatePicker(false);
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    period === p && !showDatePicker
                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                        : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white"
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            const newState = !showDatePicker;
                            setShowDatePicker(newState);
                            if (newState) {
                                setTimeout(() => startDRef.current?.focus(), 100);
                            }
                        }}
                        className={cn(
                            "h-8 px-3.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0 ring-1 ring-inset",
                            showDatePicker || period === 'custom'
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 ring-white/20"
                                : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white ring-transparent"
                        )}
                    >
                        <Calendar size={14} />
                        <span className="hidden sm:inline">{period === 'custom' && startDate ? startDate.split('-').reverse().join('/') : 'Personalizar'}</span>
                        {(showDatePicker || period === 'custom') && (
                            <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(139,92,246,1)]" />
                        )}
                    </button>

                    <AnimatePresence>
                        {showDatePicker && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowDatePicker(false)}
                                    className="fixed inset-0 bg-slate-900/10 dark:bg-black/40 z-[50]"
                                />

                                <motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95, rotateX: -10 }}
                                    animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95, rotateX: -10 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                                                        className="absolute right-0 top-full mt-10 w-[340px] md:w-[380px] bg-white dark:bg-brand-950 border border-white/20 dark:border-white/5 rounded-[2rem] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.5)] z-[100] p-5 md:p-6 space-y-4"
                                >
                                    <div className="absolute -top-32 -right-32 h-96 w-96 bg-emerald-600/10 rounded-full blur-[100px]" />
                                    <div className="absolute -bottom-32 -left-32 h-96 w-96 bg-fuchsia-600/10 rounded-full blur-[100px]" />

                                    <div className="relative z-10 space-y-4">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                            <div>
                                                <h4 className="text-sm font-black uppercase text-white tracking-[0.2em] flex items-center gap-3">
                                                    <Calendar size={20} className="text-emerald-500" /> Filtro de Datas
                                                </h4>
                                                <p className="text-[9px] text-brand-500 font-black uppercase tracking-widest mt-0.5 ml-8">Sistema de filtragem avançado</p>
                                            </div>
                                            <button
                                                onClick={() => setShowDatePicker(false)}
                                                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all hover:rotate-90 transition-transform duration-500"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6 relative">

                                            {/* Data De */}
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400">
                                                        <ArrowUpRight size={20} />
                                                    </div>
                                                    <span className="text-xs font-black uppercase text-white tracking-widest">Data de Início</span>
                                                    <div className="ml-auto flex gap-2">
                                                        <button 
                                                            onClick={() => setStartDate(new Date().toISOString().split('T')[0])}
                                                            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[8px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all"
                                                        >
                                                            Hoje
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const d = new Date();
                                                                d.setDate(d.getDate() - 1);
                                                                setStartDate(d.toISOString().split('T')[0]);
                                                            }}
                                                            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[8px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all"
                                                        >
                                                            Ontem
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center bg-brand-950/50 p-3 rounded-2xl border border-white/5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-inner">
                                                    <input
                                                        ref={startDRef}
                                                        type="text"
                                                        placeholder="DD"
                                                        maxLength={2}
                                                        value={startPartsEdit.d}
                                                        onChange={(e) => updateFromParts('start', 'd', e.target.value)}
                                                        className="w-12 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <span className="text-white/10 text-2xl font-light">/</span>
                                                    <input
                                                        ref={startMRef}
                                                        type="text"
                                                        placeholder="MM"
                                                        maxLength={2}
                                                        value={startPartsEdit.m}
                                                        onChange={(e) => updateFromParts('start', 'm', e.target.value)}
                                                        className="w-12 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <span className="text-white/10 text-2xl font-light">/</span>
                                                    <input
                                                        ref={startYRef}
                                                        type="text"
                                                        placeholder="YYYY"
                                                        maxLength={4}
                                                        value={startPartsEdit.y}
                                                        onChange={(e) => updateFromParts('start', 'y', e.target.value)}
                                                        className="w-20 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <div 
                                                        onClick={() => {
                                                            try {
                                                                (startInputRef.current as any)?.showPicker();
                                                            } catch {
                                                                startInputRef.current?.focus();
                                                            }
                                                        }}
                                                        className="ml-auto relative group-hover:scale-125 transition-transform cursor-pointer"
                                                    >
                                                        <Calendar size={20} className="text-emerald-500" />
                                                        <input
                                                            ref={startInputRef}
                                                            type="date"
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Data Até */}
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-fuchsia-600/20 flex items-center justify-center text-fuchsia-400">
                                                        <ArrowDownRight size={20} />
                                                    </div>
                                                    <span className="text-xs font-black uppercase text-white tracking-widest">Data de Fim</span>
                                                    <div className="ml-auto flex gap-2">
                                                        <button 
                                                            onClick={() => setEndDate(new Date().toISOString().split('T')[0])}
                                                            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[8px] font-black uppercase hover:bg-fuchsia-500 hover:text-white transition-all"
                                                        >
                                                            Hoje
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const d = new Date();
                                                                const startOfYear = new Date(d.getFullYear(), 0, 1);
                                                                setStartDate(startOfYear.toISOString().split('T')[0]);
                                                                setEndDate(d.toISOString().split('T')[0]);
                                                            }}
                                                            className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/5 text-[8px] font-black uppercase hover:bg-fuchsia-500 hover:text-white transition-all"
                                                        >
                                                            Ano
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center bg-brand-950/50 p-3 rounded-2xl border border-white/5 focus-within:ring-2 focus-within:ring-fuchsia-500/20 transition-all shadow-inner">
                                                    <input
                                                        ref={endDRef}
                                                        type="text"
                                                        placeholder="DD"
                                                        maxLength={2}
                                                        value={endPartsEdit.d}
                                                        onChange={(e) => updateFromParts('end', 'd', e.target.value)}
                                                        className="w-12 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <span className="text-white/10 text-2xl font-light">/</span>
                                                    <input
                                                        ref={endMRef}
                                                        type="text"
                                                        placeholder="MM"
                                                        maxLength={2}
                                                        value={endPartsEdit.m}
                                                        onChange={(e) => updateFromParts('end', 'm', e.target.value)}
                                                        className="w-12 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <span className="text-white/10 text-2xl font-light">/</span>
                                                    <input
                                                        ref={endYRef}
                                                        type="text"
                                                        placeholder="YYYY"
                                                        maxLength={4}
                                                        value={endPartsEdit.y}
                                                        onChange={(e) => updateFromParts('end', 'y', e.target.value)}
                                                        className="w-20 bg-transparent text-lg font-black focus:outline-none text-white placeholder:text-white/10 text-center"
                                                    />
                                                    <div 
                                                        onClick={() => {
                                                            try {
                                                                (endInputRef.current as any)?.showPicker();
                                                            } catch {
                                                                endInputRef.current?.focus();
                                                            }
                                                        }}
                                                        className="ml-auto relative group-hover:scale-125 transition-transform cursor-pointer"
                                                    >
                                                        <Calendar size={20} className="text-fuchsia-500" />
                                                        <input
                                                            ref={endInputRef}
                                                            type="date"
                                                            value={endDate}
                                                            onChange={(e) => setEndDate(e.target.value)}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (startDate && endDate) {
                                                    setPeriod('custom');
                                                    setShowDatePicker(false);
                                                }
                                            }}
                                            className="w-full h-14 bg-gradient-to-r from-emerald-600 via-emerald-600 to-fuchsia-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_20px_60px_-10px_rgba(139,92,246,0.5)] active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-6 group"
                                        >
                                            <BarChart3 size={18} className="group-hover:rotate-12 transition-transform" />
                                            Iniciar Análise
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Painel Operacional (Quantidades) */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-5 w-1 bg-emerald-600 rounded-full" />
                    <h3 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Controle de Transações</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    {[
                        { label: 'TOTAL TRANSAÇÕES', value: stats.totalTransactions, sub: 'Volume bruto processado', color: 'slate', icon: Receipt },
                        { label: 'COM SUCESSO', value: stats.totalSales, sub: 'Pagamentos aprovados', color: 'emerald', icon: CheckCircle2 },
                        { label: 'COM FALHA', value: stats.failedTransactions, sub: 'Recusadas ou erros', color: 'rose', icon: XCircle },
                        { label: 'PENDENTES', value: stats.pendingTransactions, sub: 'Aguardando confirmação', color: 'amber', icon: Clock },
                    ].map((item, idx) => (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="glass dark:bg-brand-900/60 p-4 rounded-2xl border border-white/20 dark:border-white/5 shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-500"
                        >
                            <div className={cn("absolute -top-4 -right-4 h-20 w-20 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity bg-", item.color === 'emerald' ? 'emerald-500' : item.color === 'emerald' ? 'emerald-500' : item.color === 'rose' ? 'rose-500' : 'amber-500')} />

                            <div className="relative z-10 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:rotate-12 group-hover:scale-110",
                                        item.color === 'emerald' ? 'bg-emerald-600/10 text-emerald-600' :
                                            item.color === 'emerald' ? 'bg-emerald-600/10 text-emerald-600' :
                                                item.color === 'rose' ? 'bg-rose-600/10 text-rose-600' :
                                                    'bg-amber-600/10 text-amber-600')}>
                                        <item.icon size={16} />
                                    </div>
                                    <div className="h-1 w-1 rounded-full animate-pulse bg-slate-300 dark:bg-white/20" />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-slate-500 dark:text-brand-500 uppercase tracking-widest mb-0.5">{item.label}</p>
                                    <h3 className={cn("text-xl font-black tabular-nums tracking-tighter",
                                        item.color === 'emerald' ? 'text-emerald-600' :
                                            item.color === 'rose' ? 'text-rose-600' :
                                                item.color === 'amber' ? 'text-amber-600' :
                                                    'text-slate-900 dark:text-white')}>
                                        {item.value.toLocaleString()}
                                    </h3>
                                    <p className="text-[8px] text-slate-400 dark:text-brand-600 font-bold uppercase tracking-tighter mt-0.5">{item.sub}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Resumo de Faturamento (Valores) */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="h-5 w-1 bg-emerald-500 rounded-full" />
                    <h3 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Resumo Financeiro</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-gradient-to-br from-emerald-600 to-indigo-700 text-white rounded-2xl shadow-xl shadow-emerald-500/20 relative group overflow-hidden hover:scale-[1.01] transition-transform duration-500">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                        <div className="relative z-10">
                            <p className="text-[8px] font-black text-emerald-200 uppercase tracking-widest mb-0.5 opacity-80">VALOR TOTAL</p>
                            <h3 className="text-xl md:text-2xl font-black flex items-baseline gap-1.5 tabular-nums tracking-tighter">
                                {stats.totalRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} <span className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest opacity-60">MZN</span>
                            </h3>
                            <div className="mt-3 flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                    <Wallet size={12} />
                                </div>
                                <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-80">100% da receita bruta</span>
                            </div>
                        </div>
                    </motion.div>

                    {[
                        { label: 'VALOR RECEBIDO', value: stats.netRevenue, trend: 'Conversão real', icon: TrendingUp, color: 'emerald' },
                        { label: 'VALOR PERDIDO', value: stats.lostRevenue, trend: 'Recuperação sugerida', icon: TrendingDown, color: 'rose' },
                        { label: 'TICKET MÉDIO', value: (stats.totalSales > 0 ? stats.totalRevenue / stats.totalSales : 0), trend: 'Média por venda', icon: BarChart3, color: 'slate' },
                    ].map((item, idx) => (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + (idx * 0.1) }}
                            className={cn(
                                "glass dark:bg-brand-900/60 p-4 rounded-2xl border shadow-lg group hover:shadow-xl transition-all duration-500",
                                item.color === 'emerald' ? "border-emerald-500/30" : item.color === 'rose' ? "border-rose-500/30" : "border-white/20 dark:border-white/5"
                            )}
                        >
                            <p className="text-[8px] font-black text-slate-500 dark:text-brand-500 uppercase tracking-widest mb-0.5">{item.label}</p>
                            <h3 className={cn("text-xl font-black tabular-nums tracking-tighter",
                                item.color === 'emerald' ? 'text-emerald-600' :
                                    item.color === 'rose' ? 'text-rose-600' :
                                        'text-slate-900 dark:text-white')}>
                                {item.value.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
                            </h3>
                            <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mt-2 border transition-all",
                                item.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 animate-pulse' :
                                    item.color === 'rose' ? 'bg-rose-500/5 border-rose-500/20 text-rose-500' :
                                        'bg-slate-500/5 border-white/10 text-slate-500 dark:text-brand-400')}>
                                <item.icon size={8} /> {item.trend}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Gráfico de Evolução e Destaques */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass dark:bg-brand-900/60 rounded-[2rem] border border-white/20 dark:border-white/5 p-6 md:p-8 shadow-xl relative group overflow-hidden">
                    <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-600/5 rounded-full blur-[80px] -mr-32 -mt-32" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                Fluxo Financeiro
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                            </h3>
                            <p className="text-[9px] text-slate-500 dark:text-brand-400 font-bold uppercase tracking-[0.2em] mt-2">Comparativo Recebido vs Perdido.</p>
                        </div>
                        <div className="flex items-center gap-6 p-4 glass-dark rounded-2xl border border-white/10">
                            {[
                                { label: 'RECEBIDO', color: 'bg-emerald-600' },
                                { label: 'PERDIDO', color: 'bg-rose-500', dash: true }
                            ].map((l) => (
                                <div key={l.label} className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", l.color, l.dash && "animate-pulse")} />
                                    <span className="text-[8px] font-black text-slate-600 dark:text-brand-400 uppercase tracking-widest">{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-[300px] w-full relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData}>
                                <defs>
                                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="rgba(148, 163, 184, 0.08)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                                    dx={-10}
                                    tickFormatter={(val) => {
                                        if (val >= 1000) {
                                            return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k%`;
                                        }
                                        return `${val}%`;
                                    }}
                                />
                                <Tooltip
                                    formatter={(value: any) => [`${value}%`]}
                                    cursor={{ stroke: 'rgba(139, 92, 246, 0.5)', strokeWidth: 2 }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(13, 13, 23, 0.9)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        padding: '16px'
                                    }}
                                    itemStyle={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '11px' }}
                                    labelStyle={{ color: '#8b5cf6', fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="perdido"
                                    name="Perdido"
                                    stroke="#ec4899"
                                    strokeWidth={2}
                                    strokeDasharray="6 6"
                                    fillOpacity={0}
                                    animationDuration={2500}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="receita"
                                    name="Recebido"
                                    stroke="#8b5cf6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRec)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass dark:bg-brand-900/60 rounded-[2rem] border border-white/20 dark:border-white/5 p-8 shadow-xl flex flex-col group">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:rotate-6 transition-transform duration-500">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Performance</h3>
                            <p className="text-[9px] text-slate-500 dark:text-brand-500 font-black uppercase tracking-[0.2em] mt-1">Top Produtos</p>
                        </div>
                    </div>

                    <div className="flex-1 space-y-6">
                        {topProducts.map((p, idx) => {
                            const getScaleFactor = () => {
                                if (period === 'Hoje' || period === 'Ontem') return 0.15;
                                if (period === '7d') return 0.4;
                                if (period === '30d') return 1;
                                if (period === '90d') return 2.5;
                                if (period === 'Todo') return 4;
                                if (period === 'custom') return filteredData.length / 30;
                                return 1;
                            };
                            const scaleFactor = getScaleFactor();
                            const val = (p.revenue * scaleFactor);
                            const sales = Math.floor(p.sales * scaleFactor);
                            const totalTopSales = topProducts.reduce((sum, prod) => sum + (prod.sales * scaleFactor), 0);
                            const salesPercent = totalTopSales > 0 ? Math.round((sales / totalTopSales) * 100) : 0;

                            return (
                                <div key={p.id} className="group/item relative">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-slate-300 dark:text-brand-800 group-hover/item:text-emerald-500 transition-colors">0{idx + 1}</span>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 dark:text-white tracking-tight group-hover/item:translate-x-1 transition-transform">{p.name}</span>
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-brand-600 uppercase tracking-tighter">
                                                    {sales.toLocaleString()} vendas • {salesPercent}% Qtd
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-emerald-600 tracking-tighter">
                                            {val.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} <span className="text-[9px] opacity-60">MZN</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (val / 15000) * 100)}%` }}
                                            transition={{ duration: 1.5, ease: "circOut" }}
                                            className="h-full bg-gradient-to-r from-emerald-600 via-indigo-500 to-fuchsia-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button className="mt-8 h-12 w-full glass hover:bg-emerald-600 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ring-1 ring-inset ring-white/10">
                        Ver Ranking Completo
                    </button>
                </div>
            </div>
        </div>
    );
};

