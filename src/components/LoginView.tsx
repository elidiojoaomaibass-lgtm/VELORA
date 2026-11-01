import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Zap, TrendingUp, Users, AlertCircle, Lock } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";


interface LoginViewProps {
    onLogin: (user?: any) => void;
}

const stats = [
    { label: "Vendas hoje", value: "1.543", icon: TrendingUp, color: "text-emerald-500" },
    { label: "Clientes ativos", value: "321", icon: Users, color: "text-emerald-600" },
    { label: "Conversão", value: "20,8%", icon: Zap, color: "text-emerald-400" },
];

export const LoginView = ({ onLogin }: LoginViewProps) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // 1. Autenticar com Supabase
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (signInError) throw signInError;

            const user = data?.user;
            if (!user) throw new Error("Não foi possível obter os dados do utilizador.");

            // 2. Verificar se o utilizador está aprovado na tabela approved_users
            const { data: approved, error: approvalError } = await supabase
                .from('approved_users')
                .select('email, active')
                .eq('email', user.email?.toLowerCase() ?? '')
                .maybeSingle();

            if (approvalError) {
                console.error('Erro ao verificar aprovação:', approvalError);
            }

            // Se não existe na tabela ou está inativo, bloquear acesso
            if (!approved || approved.active === false) {
                await supabase.auth.signOut();
                setError("Acesso não autorizado. A sua conta ainda não foi aprovada. Entre em contacto com o administrador.");
                return;
            }

            // 3. Acesso aprovado
            onLogin(user);

        } catch (err: any) {
            console.error("Auth error:", err);
            const msg: string = err.message || "";
            if (msg.includes("Invalid login credentials")) {
                setError("Email ou senha incorretos. Verifique os seus dados e tente novamente.");
            } else if (msg.includes("Email not confirmed")) {
                setError("O seu email ainda não foi confirmado. Verifique a sua caixa de entrada.");
            } else if (msg.includes("Too many requests")) {
                setError("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.");
            } else {
                setError(err.message || "Ocorreu um erro na autenticação.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex font-sans overflow-hidden bg-white">

            {/* LEFT PANEL: Form */}
            <div className="relative flex flex-col justify-center items-center w-full lg:w-[46%] bg-[#064e3b] px-6 md:px-12 py-10 md:py-16 overflow-hidden shrink-0 border-r border-white/10">

                <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-emerald-400/20 blur-[100px]" />
                <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-emerald-400/15 blur-[120px]" />

                <div className="relative z-10 w-full max-w-sm">

                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8 md:mb-12">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl overflow-hidden shadow-lg shadow-green-500/40 ring-1 ring-green-500/30">
                            <img
                                src="/logo.png"
                                alt="VELORA"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                        "https://ui-avatars.com/api/?name=V&background=064e3b&color=fff&bold=true&size=128";
                                }}
                            />
                        </div>
                        <p className="text-white font-black text-xl md:text-2xl leading-none tracking-tight">
                            VELORA
                        </p>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight mb-3">
                            Entrar na<br />
                            <span className="text-white">minha conta</span>
                        </h1>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit">
                            <Lock size={12} className="text-emerald-400 shrink-0" />
                            <p className="text-[11px] text-slate-400 font-medium">
                                Acesso restrito a contas aprovadas.
                            </p>
                        </div>
                    </div>

                    {/* Supabase not configured */}
                    {!isSupabaseConfigured && (
                        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-bold text-amber-400">
                            <div className="flex items-center gap-2.5">
                                <AlertCircle size={16} />
                                <span>Configuração Incompleta</span>
                            </div>
                            <p className="font-medium text-slate-400 mt-1">
                                As variáveis de ambiente do Supabase não foram detectadas.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-400">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="relative flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">acesso seguro</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-white/80 uppercase tracking-widest">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white/80 uppercase tracking-widest">Senha</label>
                                <a href="#" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                                    Esqueceu a senha?
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 pr-12 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                                    required
                                    minLength={6}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Botão único de login — sem "Acesso de Teste" */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="relative w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                    <span>A verificar acesso...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-500 font-medium">
                        Ao entrar, você concorda com os{" "}
                        <a href="#" className="text-slate-400 underline hover:text-white transition-colors">Termos de Uso</a>{" "}
                        e{" "}
                        <a href="#" className="text-slate-400 underline hover:text-white transition-colors">Política de Privacidade</a>
                    </p>
                </div>
            </div>

            {/* RIGHT PANEL: Visual */}
            <div className="hidden lg:flex flex-col justify-between w-[54%] relative overflow-hidden bg-white p-16">
                <div className="absolute top-0 right-0 h-[800px] w-[800px] rounded-full bg-emerald-500/5 blur-[140px] animate-pulse" />
                <div className="absolute bottom-0 left-0 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[140px]" />
                <div
                    className="absolute inset-0 opacity-[0.2]"
                    style={{ backgroundImage: `radial-gradient(#e2e8f0 1px, transparent 0)`, backgroundSize: '40px 40px' }}
                />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md px-5 py-2.5 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Sistema Operacional • Estável</span>
                    </div>
                </div>

                <div className="relative z-10 space-y-12">
                    <div className="max-w-xl">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-6xl font-black text-slate-900 leading-[1.05] tracking-tight mb-6"
                        >
                            Escalabilidade<br />
                            <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                                Sem Fronteiras.
                            </span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-lg text-slate-600 font-medium leading-relaxed"
                        >
                            A VELORA é a infraestrutura definitiva para criadores moçambicanos que buscam o próximo nível em vendas digitais.
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative group"
                    >
                        <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-pink-500/10 blur-3xl rounded-[3rem] opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative rounded-[2.5rem] border border-slate-200 bg-white/90 backdrop-blur-3xl p-8 shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex gap-2">
                                    <div className="h-3 w-3 rounded-full bg-rose-400" />
                                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                                </div>
                                <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Dashboard Mensal</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6 mb-10">
                                {stats.map((s, i) => (
                                    <motion.div
                                        key={s.label}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.5 + (i * 0.1) }}
                                        className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors shadow-sm"
                                    >
                                        <s.icon size={16} className={`${s.color} mb-3`} />
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                                        <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">{s.value}</p>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="relative h-48 w-full">
                                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                                    <defs>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <motion.path
                                        initial={{ d: "M 0 40 Q 25 40 50 40 Q 75 40 100 40 V 40 H 0 Z" }}
                                        animate={{ d: "M 0 35 Q 10 32 20 28 Q 30 35 40 22 Q 50 15 60 25 Q 70 8 80 18 Q 90 20 100 5 V 40 H 0 Z" }}
                                        transition={{ duration: 2, delay: 1, ease: "circOut" }}
                                        fill="url(#areaGrad)"
                                    />
                                    <motion.path
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 2.5, delay: 1, ease: "easeInOut" }}
                                        d="M 0 35 Q 10 32 20 28 Q 30 35 40 22 Q 50 15 60 25 Q 70 8 80 18 Q 90 20 100 5"
                                        fill="none" stroke="#10b981" strokeWidth="0.8" strokeLinecap="round"
                                    />
                                    <motion.circle initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} cx="100" cy="5" r="1.2" fill="#10b981" />
                                </svg>
                                <div className="absolute bottom-0 left-0 w-full flex justify-between pt-4">
                                    {['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN'].map((m) => (
                                        <span key={m} className="text-[8px] font-black text-slate-400 tracking-widest">{m}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 flex items-center gap-8">
                    {[
                        { label: "M-Pesa Integrado", color: "bg-emerald-500" },
                        { label: "e-Mola Disponível", color: "bg-orange-500" }
                    ].map((b) => (
                        <div key={b.label} className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${b.color}`} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{b.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LoginView;
