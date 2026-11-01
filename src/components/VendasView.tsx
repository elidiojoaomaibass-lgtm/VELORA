import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Calendar, X, MoreHorizontal,
    ExternalLink, Copy, MessageCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { User } from '@supabase/supabase-js';
import { useTransactionsStore, useProductsStore } from '../lib/store';
import { cleanProductName } from '../lib/descriptionUtils';

type PeriodType = 'Hoje' | 'Ontem' | '7d' | '30d' | '90d' | 'Todo' | 'custom';

interface VendasViewProps {
    user: User;
}

export const VendasView = ({ user: _user }: VendasViewProps) => {
    // Store
    const { transactions } = useTransactionsStore();
    const { products } = useProductsStore();

    // State
    const [period, setPeriod] = useState<PeriodType>('Hoje');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todas');
    const [selectedTx, setSelectedTx] = useState<any>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startParts, setStartParts] = useState({ d: '', m: '', y: '' });
    const [endParts, setEndParts] = useState({ d: '', m: '', y: '' });

    // Refs
    const detailRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);
    // @ts-ignore
    const _startDRef = useRef<HTMLInputElement>(null);
    const startMRef = useRef<HTMLInputElement>(null);
    const startYRef = useRef<HTMLInputElement>(null);
    const endDRef = useRef<HTMLInputElement>(null);
    const endMRef = useRef<HTMLInputElement>(null);
    const endYRef = useRef<HTMLInputElement>(null);

    // Close date picker when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Scroll to top when detail panel opens
    useEffect(() => {
        if (showDetail && detailRef.current) {
            detailRef.current.scrollTop = 0;
        }
    }, [showDetail]);



    // Sync parts when startDate changes
    useEffect(() => {
        if (startDate) {
            const [y, m, d] = startDate.split('-');
            setStartParts({ d, m, y });
        }
    }, [startDate]);

    // Sync parts when endDate changes
    useEffect(() => {
        if (endDate) {
            const [y, m, d] = endDate.split('-');
            setEndParts({ d, m, y });
        }
    }, [endDate]);

    // Helper to update parts from inputs
    // @ts-ignore
    const _updateFromParts = (type: 'start' | 'end', key: 'd' | 'm' | 'y', val: string) => {
        const numericVal = val.replace(/\D/g, '');
        if (type === 'start') {
            const newParts = { ...startParts, [key]: numericVal };
            setStartParts(newParts);
            if (key === 'd' && numericVal.length === 2) startMRef.current?.focus();
            if (key === 'm' && numericVal.length === 2) startYRef.current?.focus();
            if (key === 'y' && numericVal.length === 4) endDRef.current?.focus();
            if (newParts.d.length === 2 && newParts.m.length === 2 && newParts.y.length === 4) {
                setStartDate(`${newParts.y}-${newParts.m}-${newParts.d}`);
            }
        } else {
            const newParts = { ...endParts, [key]: numericVal };
            setEndParts(newParts);
            if (key === 'd' && numericVal.length === 2) endMRef.current?.focus();
            if (key === 'm' && numericVal.length === 2) endYRef.current?.focus();
            if (newParts.d.length === 2 && newParts.m.length === 2 && newParts.y.length === 4) {
                setEndDate(`${newParts.y}-${newParts.m}-${newParts.d}`);
            }
        }
    };

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        const search = searchTerm.toLowerCase();
        
        let startLimit: Date | null = null;
        let endLimit: Date | null = null;

        if (period === 'Hoje') {
            startLimit = new Date();
            startLimit.setHours(0, 0, 0, 0);
            endLimit = new Date();
            endLimit.setHours(23, 59, 59, 999);
        } else if (period === 'Ontem') {
            startLimit = new Date();
            startLimit.setDate(startLimit.getDate() - 1);
            startLimit.setHours(0, 0, 0, 0);
            endLimit = new Date();
            endLimit.setDate(endLimit.getDate() - 1);
            endLimit.setHours(23, 59, 59, 999);
        } else if (period === '7d') {
            startLimit = new Date();
            startLimit.setDate(startLimit.getDate() - 7);
        } else if (period === '30d') {
            startLimit = new Date();
            startLimit.setDate(startLimit.getDate() - 30);
        } else if (period === '90d') {
            startLimit = new Date();
            startLimit.setDate(startLimit.getDate() - 90);
        } else if (period === 'custom' && startDate && endDate) {
            startLimit = new Date(startDate);
            endLimit = new Date(endDate);
            endLimit.setHours(23, 59, 59, 999);
        }

        return transactions.filter(trx => {
            const matchesStatus = statusFilter === 'Todas' || trx.status === statusFilter;
            if (!matchesStatus) return false;

            const matchesSearch = !searchTerm ||
                trx.id.toLowerCase().includes(search) ||
                (trx.description || '').toLowerCase().includes(search) ||
                (trx.customerName || '').toLowerCase().includes(search) ||
                (trx.customerEmail || '').toLowerCase().includes(search) ||
                (trx.phone || '').includes(search);
                
            if (!matchesSearch) return false;

            if (startLimit || endLimit) {
                const txDate = new Date(trx.createdAt);
                if (startLimit && txDate < startLimit) return false;
                if (endLimit && txDate > endLimit) return false;
            }

            return true;
        }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }, [transactions, period, startDate, endDate, statusFilter, searchTerm]);

    // Stats
    // @ts-ignore
    const _stats = useMemo(() => {
        const approved = filteredTransactions.filter(t => t.status === 'Concluído');
        const pending = filteredTransactions.filter(t => t.status === 'Pendente');
        const cancelled = filteredTransactions.filter(t => t.status === 'Falhou');
        return {
            total: approved.reduce((acc, t) => acc + t.amount, 0),
            approvedCount: approved.length,
            pendingCount: pending.length,
            cancelledCount: cancelled.length,
        };
    }, [filteredTransactions]);

    console.log('VendasView rendered');

    const handleOpenCheckout = (tx: any) => {
        if (!tx) return;
        const productName = cleanProductName(tx.description) || 'Produto';
        const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
        
        const params = new URLSearchParams();
        if (product) {
            params.append('product_id', product.id);
            if (product.image) params.append('image', product.image);
        }
        params.append('name', productName);
        params.append('price', tx.amount.toString());
        
        const origin = window.location.origin;
        const link = `${origin}/checkout?${params.toString()}`;
        window.open(link, '_blank');
    };

    return (
        <div className="flex flex-col text-slate-900 dark:text-white px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-1 md:space-y-3 mt-3 md:mt-2">
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0 flex items-center min-h-[2rem] md:min-h-0">
                        <span>Protocolo de <span className="text-gradient">Vendas</span> 🧾</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug">
                        Registro imutável e auditoria em tempo real de todas as transações da rede.
                    </p>
                </motion.div>
                <div className="flex flex-row items-center gap-2 bg-white dark:bg-brand-900 border border-slate-100 dark:border-white/5 p-1.5 rounded-3xl shadow-xl relative" ref={datePickerRef}>
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
                        {(['Hoje', 'Ontem', '7d', '30d', '90d', 'Todo'] as PeriodType[]).map(p => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setShowDatePicker(false); }}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    period === p && !showDatePicker ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white"
                                )}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            onClick={() => { setPeriod('custom'); setShowDatePicker(!showDatePicker); }}
                            className={cn(
                                "h-8 px-3.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0 ring-1 ring-inset",
                                showDatePicker || period === 'custom' ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 ring-white/20" : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white ring-transparent"
                            )}
                        >
                            <Calendar size={14} />
                            <span className="hidden sm:inline">
                                {period === 'custom' && startDate ? startDate.split('-').reverse().join('/') : 'Personalizar'}
                            </span>
                            {(showDatePicker || period === 'custom') && (
                                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(139,92,246,1)]" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="space-y-8">
                <div className="flex flex-col lg:flex-row gap-6 items-center justify-between px-2">
                    <div className="relative w-full lg:max-w-xl">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Pesquisar por cliente, e‑mail ou referência..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-6 rounded-xl border border-white/20 dark:border-white/5 bg-white/50 dark:bg-brand-900/40 backdrop-blur-3xl text-sm font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                        />
                    </div>
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-brand-900/60 rounded-3xl border border-white/10 overflow-x-auto w-full lg:w-auto scrollbar-hide">
                        {['Todas', 'Concluído', 'Pendente', 'Falhou'].map(filter => (
                            <button
                                key={filter}
                                onClick={() => setStatusFilter(filter)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    statusFilter === filter ? "bg-white dark:bg-white text-slate-900 dark:text-slate-900 shadow-xl" : "text-slate-500 hover:text-slate-800 dark:text-brand-400 dark:hover:text-white"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="glass dark:bg-brand-900/60 rounded-[3rem] border border-white/20 dark:border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-fuchsia-600 to-indigo-600 opacity-30" />
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-white/5">
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Cliente</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Contacto</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Estado</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Canal</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Produto</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Valor</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">ID Transação</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Data / Hora</th>
                                    <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTransactions.length > 0 ? filteredTransactions.map(trx => (
                                    <tr
                                        key={trx.id}
                                        className="group/row hover:bg-emerald-600/[0.03] dark:hover:bg-white/[0.02] transition-all"
                                    >
                                        <td className="px-10 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-black text-slate-800 dark:text-white tracking-tight">
                                                    {trx.customerName || 'Unknown Customer'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-2.5">
                                            <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-brand-400 tracking-wider">{trx.phone || '—'}</span>
                                        </td>
                                        <td className="px-10 py-2.5 text-center">
                                            <span className={cn(
                                                "text-[11px] font-black uppercase tracking-widest",
                                                trx.status === 'Concluído' ? "text-green-500" :
                                                    trx.status === 'Pendente' ? "text-amber-500" :
                                                        "text-red-500"
                                            )}>{trx.status}</span>
                                        </td>
                                        <td className="px-10 py-2.5 text-center align-middle">
                                            <span className={cn(
                                                "px-3 py-0.5 rounded-full border font-black tracking-tighter text-[12px] inline-flex items-center justify-center gap-1 whitespace-nowrap",
                                                trx.method === 'M-Pesa'
                                                    ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                                    : "border-orange-500 bg-orange-50/50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                                            )}>{trx.method}</span>
                                        </td>
                                        <td className="px-10 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-slate-500 dark:text-brand-500">
                                                    {cleanProductName(trx.description)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-2.5 text-center">
                                            <span className="font-black tabular-nums tracking-tighter text-sm text-slate-800 dark:text-white">
                                                {trx.amount.toLocaleString()} MT
                                            </span>
                                        </td>
                                        <td className="px-10 py-2.5 font-mono text-[11px] font-black text-slate-400 dark:text-brand-600 group-hover/row:text-emerald-600 transition-colors">
                                            #{trx.id}
                                        </td>
                                        <td className="px-10 py-2.5 text-center">
                                            <div className="flex flex-col items-start pl-2 h-full">
                                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                    {new Date(trx.createdAt).toLocaleDateString('pt-PT')} {new Date(trx.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-2.5 text-center">
                                            <button onClick={() => { setSelectedTx(trx); setShowDetail(true); }} className="p-1 hover:bg-slate-200 dark:hover:bg-brand-800 rounded-full">
                                                <MoreHorizontal size={16} className="text-slate-600 dark:text-brand-400" />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={9} className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center gap-6">
                                                <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-brand-950 flex items-center justify-center text-slate-200 dark:text-brand-900 border-2 border-dashed border-slate-200 dark:border-brand-800">
                                                    <Search size={40} />
                                                </div>
                                                <p className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Sem Vendas no Período</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Modal */}
                {showDetail && selectedTx && (
                    <AnimatePresence>
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                                onClick={() => setShowDetail(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-3xl bg-white dark:bg-[#1e2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-white/5"
                            >
                                <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Detalhes da encomenda</h3>
                                    <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto" ref={detailRef}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">ID da Encomenda:</p>
                                            <div className="inline-block px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-[#171d2b]">
                                                <p className="text-sm font-mono text-slate-600 dark:text-slate-300">{selectedTx.id}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Estado:</p>
                                            <span className={cn(
                                                "px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap",
                                                selectedTx.status === 'Concluído' ? "bg-green-500 text-white" :
                                                    selectedTx.status === 'Pendente' ? "bg-amber-500 text-white" :
                                                        "bg-red-500 text-white"
                                            )}>
                                                {selectedTx.status === 'Concluído' ? 'Concluído' : selectedTx.status === 'Pendente' ? 'Pendente' : 'Falhou'}
                                            </span>
                                        </div>
                                        {selectedTx.status === 'Falhou' && (
                                            <div className="md:col-span-2">
                                                <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">Motivo da Falha:</p>
                                                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                                                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                                    </svg>
                                                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                                                        {selectedTx.failureReason || 'Pagamento cancelado ou recusado pelo cliente.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="md:col-span-2">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-2">Link de Checkout:</p>
                                            <button 
                                                onClick={() => handleOpenCheckout(selectedTx)}
                                                className="flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-[#111724] hover:bg-slate-800 dark:hover:bg-[#151b2a] text-white text-xs font-semibold rounded-lg transition-colors border border-transparent dark:border-white/5 shadow-sm"
                                            >
                                                <ExternalLink size={14} /> Abrir Página de Checkout
                                            </button>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Criado em:</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                {new Date(selectedTx.createdAt).toLocaleDateString('pt-PT')} {new Date(selectedTx.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <hr className="border-slate-100 dark:border-white/5 my-6" />
                                    
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-base font-bold text-slate-800 dark:text-white">Informação do Cliente</h4>
                                        <button className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            <Copy size={14} /> Copiar Info
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Nome:</p>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 uppercase">{selectedTx.customerName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Telefone:</p>
                                            <a href={`https://wa.me/${selectedTx.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-[#60a5fa] hover:underline w-fit">
                                                <MessageCircle size={14} /> {selectedTx.phone || 'N/A'}
                                            </a>
                                        </div>
                                    </div>

                                    <hr className="border-slate-100 dark:border-white/5 my-6" />

                                    <h4 className="text-base font-bold text-slate-800 dark:text-white mb-4">Itens da Encomenda</h4>
                                    
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 mb-6">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">Produto</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-white/10">Quantidade</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-white/10">Preço Unitário</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-white/10">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-slate-200 dark:border-white/10 last:border-0 bg-white dark:bg-[#1e2638]">
                                                    <td className="px-4 py-4 text-sm text-blue-600 dark:text-[#60a5fa] hover:underline cursor-pointer">
                                                        {cleanProductName(selectedTx.description) || 'Produto'}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-white/10">
                                                        1
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-white/10">
                                                        {selectedTx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                                    </td>
                                                    <td className="px-4 py-4 text-sm font-bold text-slate-800 dark:text-white border-l border-slate-200 dark:border-white/10">
                                                        {selectedTx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col items-end space-y-4">
                                        <div className="flex items-center justify-between w-full max-w-sm">
                                            <span className="text-sm font-bold text-slate-700 dark:text-white">Subtotal:</span>
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                {selectedTx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between w-full max-w-sm">
                                            <span className="text-sm font-bold text-slate-700 dark:text-white">Valor Total:</span>
                                            <span className="text-lg font-bold text-blue-600 dark:text-[#38bdf8]">
                                                {selectedTx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 sm:px-6 bg-slate-100 dark:bg-[#9ca3af]/40 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">

                                    <button onClick={() => setShowDetail(false)} className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">
                                        Fechar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
