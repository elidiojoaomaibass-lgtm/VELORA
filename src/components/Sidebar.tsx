import {
    LayoutDashboard, ShoppingBag, Users,
    Settings,
    Gift, Layers, ShoppingCart, Wallet,
    Wrench, Moon, Sun, Banknote, Cpu
} from "lucide-react";
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Logo } from "./Logo";
export type ViewType =
    | "ThankYou"
    | "Dashboard" | "Vendas" | "Produtos" | "Afiliados"
    | "Mercado" | "Pagamentos" | "Levantamentos" | "Premiações" | "Integrações"
    | "Análise" | "Configurações" | "Documentação" | "B2C Config";

interface SidebarProps {
    activeView: ViewType;
    setView: (view: ViewType) => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isOpen: boolean;
    onClose: () => void;
}

const menuGroups = [
    {
        label: "Principal",
        items: [
            { icon: LayoutDashboard, label: "Dashboard" as ViewType },
            { icon: ShoppingBag, label: "Produtos" as ViewType },
            { icon: ShoppingCart, label: "Vendas" as ViewType },
            { icon: Wallet, label: "Pagamentos" as ViewType },
        ],
    },
    {
        label: "Crescimento",
        items: [
            { icon: Users, label: "Afiliados" as ViewType },
            { icon: Layers, label: "Mercado" as ViewType },
            { icon: Wrench, label: "Integrações" as ViewType },
            { icon: Gift, label: "Premiações" as ViewType },
        ],
    },
    {
        label: "Finanças",
        items: [
            { icon: Banknote, label: "Levantamentos" as ViewType },
            { icon: Cpu, label: "B2C Config" as ViewType },
        ],
    },
    {
        label: "Sistema",
        items: [
            { icon: Settings, label: "Configurações" as ViewType },
        ],
    },
];

export const Sidebar = ({ activeView, setView, isDarkMode, toggleDarkMode, isOpen, onClose }: SidebarProps) => {
    // Store state not needed anymore since badge was removed



    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "fixed left-0 top-0 z-50 h-screen w-72 lg:w-64 bg-white dark:bg-[#0f0525] border-r border-slate-100 dark:border-white/5 flex flex-col overflow-hidden transition-all duration-500 ease-in-out transform shadow-xl lg:shadow-none",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                <div className="px-5 py-6 border-b border-slate-100 dark:border-white/10 flex flex-col gap-1 items-start">
                    <Logo showText size={32} textColor="text-slate-900 dark:text-white" />
                </div>

                {/* Navigation Section */}
                <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1 scrollbar-hide">
                    {
                        menuGroups.flatMap(group => group.items).map((item) => {
                            const viewTarget = item.label as ViewType;
                            const isActive = activeView === viewTarget;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => setView(viewTarget)}
                                    className={cn(
                                        "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                                        isActive
                                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.02]"
                                            : "text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-emerald-600"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeBar"
                                            className="absolute -left-3 w-1.5 h-7 bg-emerald-600 rounded-r-full"
                                        />
                                    )}
                                    <item.icon
                                        size={20}
                                        className={cn(
                                            "shrink-0 transition-transform group-hover:scale-110",
                                            isActive ? "text-white" : "text-slate-400 dark:text-white/40 group-hover:text-emerald-600"
                                        )}
                                    />
                                    <span className="flex-1 text-left tracking-tight">{item.label}</span>
                                </button>
                            );
                        })
                    }
                </nav>

                {/* Quick Access / Dark Mode */}
                <div className="px-5 py-4 border-t border-slate-100 dark:border-white/10">
                    <button
                        onClick={toggleDarkMode}
                        className="flex w-full items-center justify-between rounded-2xl bg-slate-50 dark:bg-white/5 p-2.5 transition-all hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shadow-sm text-slate-600 dark:text-white">
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </div>
                            <span className="text-[10px] font-black text-slate-500 dark:text-white/80 uppercase tracking-tighter">
                                {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                            </span>
                        </div>
                        <div className={cn(
                            "h-5 w-10 rounded-full p-1 transition-colors duration-300",
                            isDarkMode ? "bg-emerald-600" : "bg-slate-200 dark:bg-brand-800"
                        )}>
                            <div className={cn(
                                "h-3 w-3 rounded-full bg-white transition-transform duration-300 shadow-sm",
                                isDarkMode ? "translate-x-5" : "translate-x-0"
                            )} />
                        </div>
                    </button>
                </div>


            </aside >
        </>
    );
};
