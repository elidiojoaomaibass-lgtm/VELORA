import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    UserCheck, UserMinus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAffiliatesStore, useProductsStore } from '../lib/store';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';

export const AfiliadosView = () => {
    const { products } = useProductsStore();
    const { requests, approveRequest, rejectRequest } = useAffiliatesStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'Todos' | 'Pendente' | 'Aprovado' | 'Rejeitado'>('Todos');
    const [selectedProductId, setSelectedProductId] = useState<string>('Todos');
    const [requestToReject, setRequestToReject] = useState<{ id: string, name: string } | null>(null);

    const handleApprove = (id: string, name: string) => {
        approveRequest(id);
        toast.success('Afiliado Aprovado!', {
            description: `O acesso para ${name} foi liberado com sucesso.`
        });
    };

    const handleReject = (id: string, name: string) => {
        setRequestToReject({ id, name });
    };

    const confirmReject = () => {
        if (requestToReject) {
            rejectRequest(requestToReject.id);
            toast.error('Pedido Recusado', {
                description: `A solicitação de ${requestToReject.name} foi removida.`
            });
            setRequestToReject(null);
        }
    };

    const filteredRequests = requests.filter(req => {
        const matchesSearch =
            req.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'Todos' || req.status === filterStatus;
        const matchesProduct = selectedProductId === 'Todos' || req.productId === selectedProductId;
        
        return matchesSearch && matchesStatus && matchesProduct;
    });

    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'Pendente').length,
        approved: requests.filter(r => r.status === 'Aprovado').length
    };

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
                        <span>Gestão de <span className="text-gradient">Afiliados</span> 🛡️</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug">
                        Controle e gira as solicitações de afiliação de parceiros.
                    </p>
                </motion.div>


            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
                {[
                    {
                        label: 'Total de Afiliados',
                        value: stats.total.toString(),
                        borderColor: 'border-l-emerald-400',
                        textColor: 'text-emerald-500',
                        labelColor: 'text-emerald-400',
                    },
                    {
                        label: 'Solicitações Pendentes',
                        value: stats.pending.toString(),
                        borderColor: 'border-l-amber-400',
                        textColor: 'text-amber-500',
                        labelColor: 'text-amber-400',
                    },
                    {
                        label: 'Afiliados Ativos',
                        value: stats.approved.toString(),
                        borderColor: 'border-l-emerald-400',
                        textColor: 'text-emerald-500',
                        labelColor: 'text-emerald-400',
                    },
                ].map((item, idx) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08, type: 'spring', stiffness: 120 }}
                        key={item.label}
                        className={cn(
                            "bg-white dark:bg-brand-900/60 rounded-2xl p-5 border border-slate-100 dark:border-white/5 shadow-sm border-l-4",
                            item.borderColor
                        )}
                    >
                        <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2", item.labelColor)}>
                            {item.label}
                        </p>
                        <p className={cn("text-2xl font-black tracking-tight", item.textColor)}>
                            {item.value}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Product Selector */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-6 w-1 bg-emerald-600 rounded-full" />
                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">Filtrar por Produto</h4>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-slate-100/30 dark:bg-brand-900/30 rounded-3xl border border-white/10 backdrop-blur-2xl overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setSelectedProductId('Todos')}
                        className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                            selectedProductId === 'Todos'
                                ? "bg-slate-900 dark:bg-white border-transparent text-white dark:text-slate-900 shadow-xl"
                                : "bg-white/50 dark:bg-brand-950/50 border-white/10 text-slate-500 hover:text-slate-900"
                        )}
                    >
                        Ver Todos
                    </button>
                    {products.filter(p => p.isMarketplaceEnabled).map((product) => (
                        <button
                            key={product.id}
                            onClick={() => setSelectedProductId(product.id)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border flex items-center gap-3",
                                selectedProductId === product.id
                                    ? "bg-slate-900 dark:bg-white border-transparent text-white dark:text-slate-900 shadow-xl"
                                    : "bg-white/50 dark:bg-brand-950/50 border-white/10 text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <div className="h-6 w-6 rounded-lg bg-slate-900/10 dark:bg-brand-950/10 overflow-hidden ring-1 ring-white/10">
                                {product.image && <img src={product.image} className="w-full h-full object-cover" />}
                            </div>
                            {product.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between px-2">
                <div className="relative w-full lg:max-w-xl">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Procurar por nome, email ou produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 pl-12 pr-6 rounded-xl border border-white/20 dark:border-white/5 bg-white/50 dark:bg-brand-900/40 backdrop-blur-3xl text-sm font-bold text-slate-700 dark:text-white focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                    />
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-brand-900/60 rounded-3xl border border-white/10 backdrop-blur-3xl overflow-x-auto w-full lg:w-auto scrollbar-hide">
                    {['Todos', 'Pendente', 'Aprovado', 'Rejeitado'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status as 'Todos' | 'Pendente' | 'Aprovado' | 'Rejeitado')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                filterStatus === status
                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                                    : "text-slate-400 hover:text-slate-700 dark:text-brand-500 dark:hover:text-white"
                            )}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="space-y-6 md:space-y-8">
                {filteredRequests.length > 0 ? (
                    <div className="glass dark:bg-brand-900/60 rounded-[2.5rem] md:rounded-[3rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-white/5">
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Utilizador</th>
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Produto</th>
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em]">Data</th>
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Comissão</th>
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Estado</th>
                                        <th className="px-10 py-2 text-[10px] font-black text-slate-400 dark:text-brand-500 uppercase tracking-[0.2em] text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <AnimatePresence>
                                        {filteredRequests.map((req, i) => (
                                            <motion.tr 
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                key={req.id} 
                                                className="group hover:bg-emerald-600/5 transition-all duration-300"
                                            >
                                                <td className="px-10 py-2.5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-brand-800 dark:to-brand-900 flex items-center justify-center text-xs font-black text-slate-500 dark:text-brand-300 border border-white/10 group-hover:rotate-6 transition-transform">
                                                            {req.userName[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-black text-slate-800 dark:text-white tracking-tight leading-tight">{req.userName}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 dark:text-brand-500 mt-0.5 lowercase tracking-tight">{req.userEmail}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[14px] font-black text-slate-900 dark:text-white leading-tight">{req.productName}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-brand-500 mt-1 uppercase tracking-tighter">Produto #{req.productId || i}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-2.5">
                                                    <span className="font-mono text-[11px] font-black text-slate-400 dark:text-brand-600 group-hover:text-emerald-500 transition-colors">
                                                        {req.requestedAt}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-2.5 text-center font-mono">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">{req.commission}%</span>
                                                </td>
                                                <td className="px-10 py-2.5">
                                                    <div className="flex justify-center">
                                                        <span className={cn(
                                                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                            req.status === 'Pendente' ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                                                                req.status === 'Aprovado' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                                                                    "bg-rose-500/10 border-rose-500/20 text-rose-600"
                                                        )}>
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-2.5">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {req.status === 'Pendente' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleReject(req.id, req.userName)}
                                                                    className="h-8 px-4 rounded-lg border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase tracking-tight hover:bg-rose-500 hover:text-white transition-all transform active:scale-95"
                                                                >
                                                                    Recusar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApprove(req.id, req.userName)}
                                                                    className="h-8 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-tight hover:scale-105 shadow-md transition-all active:scale-95"
                                                                >
                                                                    Aprovar
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 rounded-lg text-emerald-600 italic text-[9px] font-black uppercase tracking-widest">
                                                                <UserCheck size={14} />
                                                                Ativo
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 glass dark:bg-brand-900/40 rounded-[2.5rem] md:rounded-[3rem] border border-white/20">
                        <div className="h-20 w-20 rounded-2xl bg-slate-50 dark:bg-brand-950 flex items-center justify-center text-slate-200 dark:text-brand-800 shadow-inner">
                            <UserMinus size={40} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Sem Solicitações</h3>
                            <p className="text-xs md:text-sm text-slate-400 dark:text-brand-400 font-medium max-w-sm mx-auto">Novos pedidos de afiliação aparecerão aqui em breve.</p>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!requestToReject}
                onClose={() => setRequestToReject(null)}
                onConfirm={confirmReject}
                title="Recusar Afiliação?"
                description={`Tem a certeza que deseja recusar o pedido de afiliação de ${requestToReject?.name}?`}
                confirmText="Recusar Agora"
                cancelText="Cancelar"
                variant="warning"
            />
        </div >
    );
};
