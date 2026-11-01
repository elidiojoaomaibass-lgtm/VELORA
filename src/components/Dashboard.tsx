import { useState, useRef, useEffect, useMemo } from 'react';
import {
    Gem, Calendar, Bell, LogOut, BarChart3, X, UserCircle2, ChevronDown,
    DollarSign, CheckCircle2, Clock, XCircle, TrendingUp, TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { Logo } from './Logo';
import { useTransactionsStore } from '../lib/store';



import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardProps {
    user: any;
    onLogout: () => void;
    setView: (view: string) => void;
    toggleSidebar: () => void;
}

export function Dashboard({ user, onLogout, setView, toggleSidebar }: DashboardProps) {
    const [period, setPeriod] = useState('HOJE');
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

    const profileRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const periodDropdownRef = useRef<HTMLDivElement>(null);

    const { transactions } = useTransactionsStore();

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
                setShowPeriodDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h >= 5 && h < 12) return 'Bom dia';
        if (h >= 12 && h < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const recentNotifications = useMemo(() => {
        const recent = transactions
            .filter(t => t.status === 'Concluído')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
        return recent;
    }, [transactions]);

    const periodOptions = [
        { key: 'HOJE', label: 'Hoje' },
        { key: 'ONTEM', label: 'Ontem' },
        { key: '7D', label: '7 Dias' },
        { key: '30D', label: '30 Dias' },
        { key: 'PERSONALIZADO', label: 'Personalizado' },
    ];

    // Filter transactions based on selected period
    const filteredTxs = useMemo(() => {
        const now = new Date();
        return transactions.filter(tx => {
            if (tx.type !== 'payment') return false;
            const txDate = new Date(tx.createdAt);
            if (period === 'HOJE') return txDate.toDateString() === now.toDateString();
            if (period === 'ONTEM') {
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                return txDate.toDateString() === yesterday.toDateString();
            }
            if (period === '7D') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                return txDate >= weekAgo;
            }
            if (period === '30D') {
                const monthAgo = new Date();
                monthAgo.setDate(now.getDate() - 30);
                return txDate >= monthAgo;
            }
            if (period === '90D') {
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setDate(now.getDate() - 90);
                return txDate >= threeMonthsAgo;
            }
            if (period === 'TODO') return true;
            return true;
        });
    }, [transactions, period]);

    const approvedTxs = useMemo(() => filteredTxs.filter(t => t.status === 'Concluído'), [filteredTxs]);
    const pendingTxs = useMemo(() => filteredTxs.filter(t => t.status === 'Pendente'), [filteredTxs]);
    const failedTxs = useMemo(() => filteredTxs.filter(t => t.status === 'Falhou'), [filteredTxs]);

    const totalRevenue = useMemo(() => approvedTxs.reduce((sum, t) => sum + t.amount, 0), [approvedTxs]);

    // Calculate level progression (Bronze, Silver, Gold, Platinum, Diamond) using all-time confirmed revenue
    const allApprovedTxs = useMemo(() => transactions.filter(t => t.type === 'payment' && t.status === 'Concluído'), [transactions]);
    const allTimeRevenue = useMemo(() => allApprovedTxs.reduce((sum, t) => sum + t.amount, 0), [allApprovedTxs]);

    const level = useMemo(() => {
        if (allTimeRevenue < 10000) return { name: 'BRONZE', target: 10000, color: 'text-cyan-500', bg: 'bg-cyan-500' };
        if (allTimeRevenue < 50000) return { name: 'PRATA', target: 50000, color: 'text-slate-400', bg: 'bg-slate-400' };
        if (allTimeRevenue < 150000) return { name: 'OURO', target: 150000, color: 'text-amber-500', bg: 'bg-amber-500' };
        if (allTimeRevenue < 500000) return { name: 'PLATINA', target: 500000, color: 'text-indigo-400', bg: 'bg-indigo-400' };
        return { name: 'DIAMANTE', target: allTimeRevenue || 1, color: 'text-emerald-500', bg: 'bg-emerald-500' };
    }, [allTimeRevenue]);

    const progressPercent = Math.min(100, (allTimeRevenue / level.target) * 100);

    const totalTxs = filteredTxs.length;
    const conversionRate = totalTxs > 0 ? ((approvedTxs.length / totalTxs) * 100).toFixed(1) : '0.0';
    const abandonmentRate = totalTxs > 0 ? ((failedTxs.length / totalTxs) * 100).toFixed(1) : '0.0';

    const stats = [
        {
            label: 'RECEITA TOTAL',
            value: `${totalRevenue.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} MZN`,
            borderColor: 'border-l-emerald-500',
            labelColor: 'text-emerald-400',
            textColor: 'text-emerald-500',
            icon: DollarSign,
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
            iconColor: 'text-emerald-500'
        },
        {
            label: 'APROVADAS',
            value: approvedTxs.length.toLocaleString(),
            borderColor: 'border-l-emerald-400',
            labelColor: 'text-emerald-400',
            textColor: 'text-emerald-500',
            icon: CheckCircle2,
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
            iconColor: 'text-emerald-500'
        },
        {
            label: 'PENDENTES',
            value: pendingTxs.length.toLocaleString(),
            borderColor: 'border-l-amber-400',
            labelColor: 'text-amber-400',
            textColor: 'text-amber-500',
            icon: Clock,
            iconBg: 'bg-amber-50 dark:bg-amber-500/10',
            iconColor: 'text-amber-500'
        },
        {
            label: 'CANCELADAS',
            value: failedTxs.length.toLocaleString(),
            borderColor: 'border-l-red-400',
            labelColor: 'text-red-400',
            textColor: 'text-red-500',
            icon: XCircle,
            iconBg: 'bg-red-50 dark:bg-red-500/10',
            iconColor: 'text-red-500'
        },
        {
            label: 'TAXA DE CONVERSÃO',
            value: `${conversionRate}%`,
            borderColor: 'border-l-emerald-500',
            labelColor: 'text-emerald-400',
            textColor: 'text-emerald-500',
            icon: TrendingUp,
            iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
            iconColor: 'text-emerald-500'
        },
        {
            label: 'TAXA DE ABANDONO',
            value: `${abandonmentRate}%`,
            borderColor: 'border-l-orange-400',
            labelColor: 'text-orange-400',
            textColor: 'text-orange-500',
            icon: TrendingDown,
            iconBg: 'bg-orange-50 dark:bg-orange-500/10',
            iconColor: 'text-orange-500'
        },
    ];

    // Chart data aggregation for standard/custom filters
    const chartData = useMemo(() => {
        if (period === 'HOJE' || period === 'ONTEM') {
            const hours = period === 'HOJE' ? new Date().getHours() + 1 : 24;
            return Array.from({ length: hours }, (_, i) => {
                const hourTxs = filteredTxs.filter(t => new Date(t.createdAt).getHours() === i);
                return {
                    name: `${i.toString().padStart(2, '0')}h`,
                    receita: hourTxs.reduce((acc, curr) => acc + (curr.status === 'Concluído' ? curr.amount : 0), 0)
                };
            });
        }

        const days = period === '7D' ? 7 : period === '30D' ? 30 : period === '90D' ? 90 : 30;
        return Array.from({ length: days }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dayStr = date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
            const dayTxs = filteredTxs.filter(t => new Date(t.createdAt).toDateString() === date.toDateString());
            return {
                name: dayStr,
                receita: dayTxs.reduce((acc, curr) => acc + (curr.status === 'Concluído' ? curr.amount : 0), 0)
            };
        });
    }, [period, filteredTxs]);

    // Payment methods calculation
    const mpesaCount = useMemo(() => approvedTxs.filter(t => t.method === 'M-Pesa').length, [approvedTxs]);
    const emolaCount = useMemo(() => approvedTxs.filter(t => t.method === 'e-Mola').length, [approvedTxs]);
    const totalApprovedCount = approvedTxs.length;

    const mpesaTotal = useMemo(() => filteredTxs.filter(t => t.method === 'M-Pesa').length, [filteredTxs]);
    const emolaTotal = useMemo(() => filteredTxs.filter(t => t.method === 'e-Mola').length, [filteredTxs]);

    const mpesaConvRate = useMemo(() => mpesaTotal > 0 ? ((mpesaCount / mpesaTotal) * 100).toFixed(1) : '0.0', [mpesaCount, mpesaTotal]);
    const emolaConvRate = useMemo(() => emolaTotal > 0 ? ((emolaCount / emolaTotal) * 100).toFixed(1) : '0.0', [emolaCount, emolaTotal]);



    return (
        <div className="min-h-screen p-4 md:p-8 font-sans">
            <div className="w-full space-y-8">

                {/* ─── TOP HEADER ─── */}
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-4 lg:gap-6 border-b border-slate-100 dark:border-white/5 pb-4">
                    {/* Left: Progress */}
                    <div className="flex flex-col gap-2 w-48 lg:w-56 ml-16 lg:ml-0 order-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Gem size={14} className="text-cyan-500" />
                                <span className="text-[10px] font-black text-slate-800 dark:text-brand-500 uppercase tracking-widest">{level.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-cyan-500 dark:text-cyan-400">
                                {allTimeRevenue.toLocaleString('pt-PT')} / {level.target >= 1000000 ? '1M+' : `${(level.target / 1000)}K`} MZN
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                className={cn("h-full rounded-full transition-all duration-500", level.bg)}
                            />
                        </div>
                    </div>

                    {/* Filters & Icons moved below */}

                    <div className="flex items-center gap-4 order-2 lg:order-3 ml-auto lg:ml-0 z-50">
                        <div className="relative shrink-0" ref={notificationsRef}>
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="relative h-11 w-11 flex items-center justify-center bg-white dark:bg-brand-900 rounded-full border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all"
                            >
                                <Bell size={18} className="text-slate-600 dark:text-brand-400" />
                                {recentNotifications.length > 0 && (
                                    <div className="absolute top-[10px] right-[10px] h-2 w-2 rounded-full bg-emerald-600 border-2 border-white dark:border-brand-900" />
                                )}
                            </button>

                            <AnimatePresence>
                                {notificationsOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-[calc(100%+0.5rem)] w-72 rounded-[1.5rem] bg-white dark:bg-brand-950 p-2 border border-slate-100 dark:border-white/5 shadow-2xl z-50 overflow-hidden"
                                    >
                                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 mb-2 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-slate-800 dark:text-white tracking-widest">Notificações</span>
                                            {recentNotifications.length > 0 && (
                                                <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-full">
                                                    {recentNotifications.length} RECENTES
                                                </span>
                                            )}
                                        </div>
                                        {recentNotifications.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-slate-500 font-medium h-24 flex flex-col items-center justify-center">
                                                <Bell size={24} className="text-slate-200 dark:text-brand-800 mb-2" />
                                                Nenhum alerta crítico no momento.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                                {recentNotifications.map((notif) => (
                                                    <div key={notif.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-brand-900/50 transition-colors cursor-pointer">
                                                        <div className={cn("mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0", notif.type === 'payment' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400')}>
                                                            {notif.type === 'payment' ? <Gem size={14} /> : <DollarSign size={14} />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                {notif.type === 'payment' ? 'Nova Venda' : 'Levantamento Aprovado'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-brand-400 mt-0.5 leading-tight">
                                                                {notif.type === 'payment' ? `Recebeu ${notif.amount.toLocaleString('pt-PT')} MZN de ${notif.customerName || 'Cliente'}` : `O seu saque de ${notif.amount.toLocaleString('pt-PT')} MZN foi efetuado.`}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                                                                {new Date(notif.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="relative shrink-0" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(!profileOpen)}
                                className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/20 p-1 flex items-center justify-center cursor-pointer hover:scale-105 transition-all overflow-hidden"
                            >
                                <Logo size={40} showText={false} />
                            </button>

                            <AnimatePresence>
                                {profileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-[1.5rem] bg-white dark:bg-brand-950 p-2 border border-slate-100 dark:border-white/5 shadow-2xl z-50 overflow-hidden"
                                    >
                                        <div className="px-4 py-4 bg-gradient-to-br from-emerald-50 to-fuchsia-50 dark:from-emerald-900/20 dark:to-fuchsia-900/20 rounded-xl mb-2 flex flex-col gap-2">
                                            <Logo showText size={28} textColor="text-slate-900 dark:text-white" />
                                            <div className="pl-1">
                                                <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                                                    {(user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0])}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium truncate">{user?.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setView('Configurações'); setProfileOpen(false); }}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-xs font-black text-slate-700 dark:text-brand-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 rounded-xl transition-all uppercase tracking-widest"
                                        >
                                            <UserCircle2 size={16} /> Meu Perfil
                                        </button>
                                        <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                                        <button onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-3 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all uppercase tracking-widest">
                                            <LogOut size={16} /> Encerrar Sessão
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* ─── GREETING & FILTERS ─── */}
                <div className="flex flex-col gap-1 relative z-[40]">
                    {/* Row 1: greeting + filter button */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button onClick={toggleSidebar} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-white/5 shadow-sm">
                                <BarChart3 size={20} className="text-slate-600 dark:text-brand-400" />
                            </button>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {getGreeting()}, {(user?.user_metadata?.full_name?.split(' ')[0] || user?.user_metadata?.nickname?.split(' ')[0] || user?.email?.split('@')[0])}
                            </h2>
                        </div>

                        {/* Period Filter Dropdown */}
                        <div className="relative flex items-center gap-4 z-50 shrink-0" ref={periodDropdownRef}>
                            <button
                                onClick={() => { setShowPeriodDropdown(!showPeriodDropdown); setShowDatePicker(false); }}
                                className="h-10 px-5 bg-white dark:bg-brand-900/40 border border-slate-100 dark:border-white/5 rounded-full shadow-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-brand-900/60 transition-all"
                            >
                                <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                    {showDatePicker ? 'Personalizado' : (periodOptions.find(p => p.key === period)?.label || 'Hoje')}
                                </span>
                                <ChevronDown size={14} className={cn("text-slate-400 transition-transform", showPeriodDropdown && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {showPeriodDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-[calc(100%+0.5rem)] w-48 rounded-[1.5rem] bg-white dark:bg-brand-950 p-2 border border-slate-100 dark:border-white/5 shadow-2xl z-50 flex flex-col gap-1"
                                    >
                                        {periodOptions.map((p) => (
                                            <button
                                                key={p.key}
                                                onClick={() => {
                                                    if (p.key === 'PERSONALIZADO') {
                                                        setShowDatePicker(true);
                                                    } else {
                                                        setPeriod(p.key);
                                                        setShowDatePicker(false);
                                                    }
                                                    setShowPeriodDropdown(false);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                    (period === p.key && p.key !== 'PERSONALIZADO' && !showDatePicker) || (p.key === 'PERSONALIZADO' && showDatePicker)
                                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                                                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-brand-400 dark:hover:text-white dark:hover:bg-brand-900"
                                                )}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {showDatePicker && (
                                    <motion.div
                                        ref={datePickerRef}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-[calc(100%+0.5rem)] w-72 rounded-[1.5rem] bg-white dark:bg-brand-950 p-4 border border-slate-100 dark:border-white/5 shadow-2xl z-50"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Filtro Customizado</h4>
                                            <button onClick={() => setShowDatePicker(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Data Inicial</label>
                                                <input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Data Final</label>
                                                <input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                            </div>
                                            <button onClick={() => setShowDatePicker(false)} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">Aplicar</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    {/* Row 2: subtitle */}
                    <p className="text-sm text-slate-400 dark:text-brand-400 font-medium">
                        Acompanhe as suas vendas e receitas de hoje.
                    </p>
                </div>

                {/* ─── STATS GRID ─── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                    {stats.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-brand-900/50 rounded-[1.25rem] p-3 md:p-3 border border-slate-100 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-brand-400">
                                    {item.label}
                                </span>
                                <div className="h-7 w-7 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-white/5">
                                    <item.icon size={15} className="text-slate-400 dark:text-brand-400" />
                                </div>
                            </div>
                            <p className="text-base md:text-xl font-black tracking-tighter text-slate-900 dark:text-white">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>


                {/* ─── MAIN LAYOUT ─── */}
                <div className="flex flex-col lg:flex-row gap-6 w-full">
                    {/* Gráfico de Vendas */}
                    <div className="flex-1 space-y-4 min-w-0">
                        <div className="flex items-center justify-between px-2 min-h-[56px]">
                            <div>
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Gráfico de Vendas
                                </h3>
                            </div>

                        </div>
                        <div className="bg-white rounded-[2rem] h-[300px] w-full shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
                            <div className="h-full w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorDashboard" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
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
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 5, 37, 0.95)',
                                                borderRadius: '16px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                padding: '12px'
                                            }}
                                            labelStyle={{ color: '#8b5cf6', fontSize: '9px', fontWeight: 'black' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="receita"
                                            name="Faturamento"
                                            stroke="#8b5cf6"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorDashboard)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* M-Pesa e E-Mola */}
                    <div className="w-full lg:w-[320px] space-y-4 shrink-0">
                        <div className="flex items-center justify-between px-2 min-h-[56px]">
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                Métodos de Pagamento
                            </h3>
                        </div>
                        <div className="w-full bg-white rounded-[2rem] h-[300px] shadow-sm border border-slate-100 p-6 flex flex-col justify-center gap-8">

                            <div className="flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Vendas</span>
                                <span className="text-5xl font-black text-slate-900 tracking-tighter">{totalApprovedCount}</span>
                            </div>

                            <div className="flex flex-col gap-4 w-full">
                                <div className="bg-slate-50 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <img src="/mpesa_logo.png" alt="M-Pesa" className="h-10 w-10 object-contain rounded-md" />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-900 tracking-widest">M-PESA</span>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">CONVERSÃO: {mpesaConvRate}%</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-black text-slate-900 tracking-widest uppercase">VENDAS</span>
                                        <span className="text-xl font-black text-slate-900 tracking-tight">{mpesaCount}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-[1.25rem] p-5 flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <img src="/emola_logo.png" alt="E-Mola" className="h-10 w-10 object-contain rounded-md" />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-slate-900 tracking-widest">E-MOLA</span>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">CONVERSÃO: {emolaConvRate}%</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-black text-slate-900 tracking-widest uppercase">VENDAS</span>
                                        <span className="text-xl font-black text-slate-900 tracking-tight">{emolaCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


