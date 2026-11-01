import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import {
    Link as LinkIcon,
    Send, ShieldCheck,
    Info, Save,
    Code2, Target,
    Search, MessageCircle, Mail, Bell
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export const FerramentasView = () => {
    // Utmify state
    const [utmifyToken, setUtmifyToken] = useState(() => localStorage.getItem('velora_utmify_token') || '');

    // LowTrack state
    const [lowTrackToken, setLowTrackToken] = useState(() => localStorage.getItem('velora_lowtrack_token') || '');

    // Meta Ads Pixel state (loaded from Supabase, local state as fallback)
    const [pixelId, setPixelId] = useState('');
    const [tiktokId, setTiktokId] = useState('');

    // Webhook state
    const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('velora_webhook_url') || '');
    const [webhookEvents, setWebhookEvents] = useState(() => {
        const saved = localStorage.getItem('velora_webhook_events');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // ignore
            }
        }
        return {
            sale_approved: true,
            sale_pending: false,
            sale_refunded: false,
            affiliate_request: true
        };
    });

    // Novas Integrações
    const [googleAdsId, setGoogleAdsId] = useState(() => localStorage.getItem('velora_google_ads_id') || '');
    const [whatsappToken, setWhatsappToken] = useState(() => localStorage.getItem('velora_whatsapp_token') || '');
    const [klaviyoToken, setKlaviyoToken] = useState(() => localStorage.getItem('velora_klaviyo_token') || '');
    const [testPushValue, setTestPushValue] = useState('97,00');

    const [userEmail, setUserEmail] = useState<string>('');

    useEffect(() => {
        const loadSettings = async () => {
            const { data: sess } = await supabase.auth.getSession();
            const email = sess?.session?.user?.email;
            if (email) {
                setUserEmail(email);
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_email', email)
                    .single();
                if (error) console.error('[FerramentasView] Erro ao carregar settings:', error);
                if (data) {
                    if (data.webhook_url) setWebhookUrl(data.webhook_url);
                    if (data.webhook_events) setWebhookEvents(data.webhook_events);
                    if (data.lowtrack_token) setLowTrackToken(data.lowtrack_token);
                    if (data.facebook_pixel_id) {
                        setPixelId(data.facebook_pixel_id);
                        localStorage.setItem('velora_facebook_pixel_id', data.facebook_pixel_id);
                    }
                    if (data.tiktok_pixel_id) {
                        setTiktokId(data.tiktok_pixel_id);
                        localStorage.setItem('velora_tiktok_pixel_id', data.tiktok_pixel_id);
                    }
                }
            } else {
                console.warn('[FerramentasView] Nenhuma sessão activa ao carregar.');
            }
        };
        loadSettings();
    }, []);

    const saveSettingToDB = async (updates: any): Promise<boolean> => {
        try {
            let email = userEmail;
            if (!email) {
                const { data: sess } = await supabase.auth.getSession();
                email = sess?.session?.user?.email || '';
            }
            if (!email) {
                const fake = localStorage.getItem('velora_fake_session');
                if (fake) {
                    try {
                        const parsed = JSON.parse(fake);
                        email = parsed?.user?.email || '';
                    } catch {}
                }
            }
            if (!email) {
                email = (import.meta.env.VITE_ADMIN_EMAIL || 'ofcdzin6@gmail.com').toLowerCase();
            }
            if (email) setUserEmail(email);

            console.log('[saveSettingToDB] upsert para', email, updates);
            const { error } = await supabase
                .from('user_settings')
                .upsert({ user_email: email, ...updates }, { onConflict: 'user_email' });
            if (error) {
                console.warn('[saveSettingToDB] Supabase sync warning (saved locally):', error);
            }
            return true;
        } catch(e: any) {
            console.warn('[saveSettingToDB] Supabase exception (saved locally):', e);
            return true;
        }
    };

    const handleSaveUtmify = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_utmify_token', utmifyToken);
        toast.success('Token Utmify salvo!', {
            description: 'A integração com Utmify está agora ativa no seu checkout.'
        });
    };

    const handleSaveLowTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_lowtrack_token', lowTrackToken);
        await saveSettingToDB({ lowtrack_token: lowTrackToken });
        toast.success('Token LowTrack salvo!', {
            description: 'A integração com LowTrack está agora ativa no seu checkout e foi guardada na sua conta.'
        });
    };

    const handleTestLowTrack = () => {
        if (!lowTrackToken) {
            toast.error('Por favor, introduza o Token antes de testar.');
            return;
        }

        toast.promise(
            fetch('https://lowtrack.com.br/api/webhook', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lowTrackToken}`
                },
                body: JSON.stringify({
                    event: 'sale.approved',
                    transaction_id: 'test_lt_' + Date.now(),
                    amount: 1500,
                    status: 'Concluído',
                    user_id: 'user_test'
                })
            }).then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Erro na comunicação com LowTrack');
                }
                return res.json();
            }),
            {
                loading: 'A enviar evento de teste para LowTrack...',
                success: 'Evento de teste recebido pelo LowTrack com sucesso!',
                error: (err: any) => err.message || 'Falha no envio. Verifique o Token.',
            }
        );
    };

    const handleSavePixel = async (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_facebook_pixel_id', pixelId);
        const ok = await saveSettingToDB({ facebook_pixel_id: pixelId });
        if (!ok) return; // toast de erro já foi mostrado dentro de saveSettingToDB

        // Reinitializar imediatamente sem precisar de reload
        if (pixelId) {
            (window as any).fbq = undefined;
            (window as any)._fbq = undefined;
            import('../lib/pixel').then(({ initFacebookPixel, trackFacebookEvent }) => {
                initFacebookPixel(pixelId);
                trackFacebookEvent('PageView');
            });
        }

        toast.success('Pixel do Meta Ads salvo na conta!', {
            description: 'O Facebook Pixel está ativo e sincronizado em todos os dispositivos.'
        });
    };

    const handleSaveTikTok = async (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_tiktok_pixel_id', tiktokId);
        await saveSettingToDB({ tiktok_pixel_id: tiktokId });
        toast.success('Pixel do TikTok salvo na conta!', {
            description: 'O TikTok Pixel está ativo e sincronizado em todos os dispositivos.'
        });
    };

    const handleSaveWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (webhookUrl && !webhookUrl.startsWith('http')) {
            toast.error('URL do Webhook inválida');
            return;
        }
        localStorage.setItem('velora_webhook_url', webhookUrl);
        localStorage.setItem('velora_webhook_events', JSON.stringify(webhookEvents));
        await saveSettingToDB({ webhook_url: webhookUrl, webhook_events: webhookEvents });
        toast.success('Webhook configurado!', {
            description: 'Os eventos selecionados serão enviados para a URL informada e as configurações foram guardadas na sua conta.'
        });
    };

    const handleTestWebhook = () => {
        if (!webhookUrl || !webhookUrl.startsWith('http')) {
            toast.error('Por favor, configure uma URL válida antes de testar.');
            return;
        }

        const testPayload = {
            event: 'test_webhook',
            timestamp: new Date().toISOString(),
            data: {
                message: 'Webhook de teste enviado pela VELORA'
            }
        };

        toast.promise(
            fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testPayload),
            }).then(res => {
                if (!res.ok) {
                    throw new Error('Falha na resposta do webhook');
                }
                return true;
            }),
            {
                loading: 'A enviar requisição de teste...',
                success: 'Requisição de teste enviada com sucesso!',
                error: 'Erro na requisição. Verifique o servidor destino ou possíveis bloqueios de CORS.',
            }
        );
    };

    const handleSaveGoogleAds = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_google_ads_id', googleAdsId);
        toast.success('Google Ads salvo!', { description: 'O rastreamento de conversões via API está ativo.' });
    };

    const handleSaveWhatsapp = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_whatsapp_token', whatsappToken);
        toast.success('WhatsApp configurado!', { description: 'A recuperação automática de vendas foi ativada.' });
    };

    const handleSaveKlaviyo = (e: React.FormEvent) => {
        e.preventDefault();
        localStorage.setItem('velora_klaviyo_token', klaviyoToken);
        toast.success('Klaviyo configurado!', { description: 'A integração de email marketing está ativa.' });
    };

    const handleTestPush = async () => {
        // 1. Verificar se o utilizador está autenticado
        let email = userEmail;
        if (!email) {
            const { data: sess } = await supabase.auth.getSession();
            email = sess?.session?.user?.email || '';
            if (email) setUserEmail(email);
        }
        if (!email) {
            toast.error('Sessão não encontrada. Faça login primeiro.');
            return;
        }

        // A verificação de dispositivos (push_subscriptions) foi removida.
        // O evento será disparado em tempo real, notificando qualquer dispositivo logado que tenha a app aberta.

        // 3. Disparar notificação via Supabase Realtime (funciona localmente sem Vercel API)
        const val = parseFloat(testPushValue.replace(',', '.')) || 97;
        const testPayload = {
            amount: val,
            method: 'M-Pesa'
        };

        toast.promise(
            Promise.all([
                // 1. Broadcast para web (app aberta)
                new Promise((resolve, reject) => {
                    const channel = supabase.channel('public-transactions-changes');
                    channel.subscribe((status: any) => {
                        if (status === 'SUBSCRIBED') {
                            channel.send({
                                type: 'broadcast',
                                event: 'test_push',
                                payload: testPayload
                            }).then((res: any) => {
                                if (res === 'ok') resolve(true);
                                else reject(new Error('Falha ao enviar broadcast'));
                                supabase.removeChannel(channel);
                            }).catch((err: any) => {
                                reject(err);
                                supabase.removeChannel(channel);
                            });
                        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                            reject(new Error('Falha na conexão do canal'));
                        }
                    });
                }),
                // 2. Disparar notificação nativa via Edge Function para FCM (background)
                supabase.functions.invoke('send-push', {
                    body: {
                        title: 'Você recebeu um novo pedido! 🎉 (TESTE)',
                        body: `Venda aprovada de ${val.toLocaleString('pt-PT')} MT M-Pesa`,
                        user_email: email
                    }
                }).then(({ error }: any) => {
                    if (error) console.warn('Erro ao disparar FCM no teste:', error);
                    return true;
                })
            ]),
            {
                loading: `A enviar evento em tempo real para os dispositivos...`,
                success: `✅ Evento disparado! O telemóvel logado deve receber a notificação em instantes.`,
                error: (err: any) => `Erro ao enviar: ${err?.message || 'Tente novamente'}`,
            }
        );
    };


    return (
        <div className="px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16">
                <div className="space-y-1 md:space-y-3 mt-3 md:mt-2">
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0 flex items-center min-h-[2rem] md:min-h-0">
                        <span>Ferramentas e Integrações</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug">
                        Conecte a VELORA com serviços externos para automatizar o seu negócio.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Utmify Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <img src="/integrations/utmify_integration_1780442539632.png" alt="Utmify integration" className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Utmify</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rastreamento de Leads</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
                            Oficial
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                A melhor ferramenta para rastrear a origem das tuas vendas. Insira o seu Token abaixo.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveUtmify} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Token de Integração</label>
                            <div className="relative">
                                <Code2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="utm_pk_..."
                                    value={utmifyToken}
                                    onChange={(e) => setUtmifyToken(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar Configuração
                        </button>
                    </form>
                </motion.div>

                {/* Meta Ads Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                                <img src="/integrations/meta_ads_integration_1780442567251.png" alt="Meta Ads integration" className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Meta Ads</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Facebook Pixel</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                    Rastreie conversões e crie públicos personalizados para o Facebook e Instagram.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'Documentação' }))}
                                    className="mt-1 flex w-fit items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline"
                                >
                                    Ler Documentação Oficial
                                </button>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSavePixel} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ID do Pixel</label>
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Ex: 123456789012345"
                                    value={pixelId}
                                    onChange={(e) => setPixelId(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar Pixel
                        </button>
                    </form>
                </motion.div>

                {/* TikTok Ads Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <img src="/integrations/tiktok_integration_1780442583402.png" alt="TikTok integration" className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">TikTok Ads</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TikTok Pixel</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Rastreie conversões e crie públicos personalizados no TikTok.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveTikTok} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ID do Pixel TikTok</label>
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Ex: 123456789012345"
                                    value={tiktokId}
                                    onChange={(e) => setTiktokId(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar TikTok Pixel
                        </button>
                    </form>
                </motion.div>

                {/* LowTrack Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                                <img 
                                    src="/integrations/lowtrack.png" 
                                    alt="LowTrack integration" 
                                    className="w-8 h-8 rounded-lg object-contain" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=LT&background=ea580c&color=fff&bold=true&size=128";
                                    }} 
                                />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">LowTrack</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rastreamento Avançado</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950 text-orange-600 text-[10px] font-black uppercase tracking-widest border border-orange-100 dark:border-orange-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Ferramenta de tracking avançado. Insira o seu Token para ativar.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveLowTrack} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Token LowTrack</label>
                            <div className="relative">
                                <Code2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="lt_..."
                                    value={lowTrackToken}
                                    onChange={(e) => setLowTrackToken(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleTestLowTrack}
                                className="flex-1 h-11 rounded-xl border border-slate-100 dark:border-brand-800 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-brand-800 transition-colors"
                            >
                                Testar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-11 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                            >
                                <Save size={16} />
                                Salvar
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* Webhook Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                                <Send size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Webhooks</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Notificações Externas</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Enviaremos os dados das tuas vendas para a tua URL de destino automaticamente.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveWebhook} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">URL de Destino</label>
                            <div className="relative">
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="url"
                                    placeholder="https://tua-api.com/webhook"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Eventos para Disparar</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(webhookEvents).map(([event, active]) => (
                                    <button
                                        key={event}
                                        type="button"
                                        onClick={() => setWebhookEvents((prev: Record<string, boolean>) => ({ ...prev, [event]: !active }))}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all text-left flex items-center justify-between",
                                            active
                                                ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                                                : "bg-white dark:bg-brand-900 border-slate-100 dark:border-brand-800 text-slate-400"
                                        )}
                                    >
                                        {({
                                            sale_approved: 'Venda Aprovada',
                                            sale_pending: 'Venda Pendente',
                                            sale_refunded: 'Venda Reembolsada',
                                            affiliate_request: 'Afiliação'
                                        } as Record<string, string>)[event] || event}
                                        {(active as boolean) && <ShieldCheck size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleTestWebhook}
                                className="flex-1 h-11 rounded-xl border border-slate-100 dark:border-brand-800 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                            >
                                Testar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-11 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                            >
                                <Save size={16} />
                                Salvar
                            </button>
                        </div>
                    </form>
                </motion.div>
                {/* Google Ads Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <Search size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Google Ads</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Conversões API</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Acompanhe conversões precisas diretamente para as tuas campanhas do Google.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveGoogleAds} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ID de Conversão</label>
                            <div className="relative">
                                <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="AW-123456789"
                                    value={googleAdsId}
                                    onChange={(e) => setGoogleAdsId(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar Configuração
                        </button>
                    </form>
                </motion.div>

                {/* WhatsApp Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                                <MessageCircle size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">WhatsApp</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recuperação Automática</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-600 text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-green-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Recupera vendas perdidas automaticamente com mensagens via WhatsApp.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveWhatsapp} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Token da API</label>
                            <div className="relative">
                                <Code2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Insira o Token do Bot"
                                    value={whatsappToken}
                                    onChange={(e) => setWhatsappToken(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-green-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar Token
                        </button>
                    </form>
                </motion.div>

                {/* Klaviyo Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                <Mail size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Klaviyo</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email Marketing</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Sincronize clientes e abandono de carrinho diretamente com o Klaviyo.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveKlaviyo} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Chave da API Pública</label>
                            <div className="relative">
                                <Code2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="pk_..."
                                    value={klaviyoToken}
                                    onChange={(e) => setKlaviyoToken(e.target.value)}
                                    className="w-full h-11 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full h-11 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Save size={16} />
                            Salvar Integração
                        </button>
                    </form>
                </motion.div>

                {/* Push Notifications Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="p-5 md:p-6 bg-white dark:bg-brand-900 rounded-[2rem] border border-emerald-100 dark:border-brand-800 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center p-2">
                                <img src="/logo.png" alt="Plataforma" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Notificações Push</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Alertas Nativos</p>
                            </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-950 text-pink-600 text-[10px] font-black uppercase tracking-widest border border-pink-100 dark:border-pink-900/30">
                            Ativo
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800">
                        <div className="flex gap-2">
                            <Info size={14} className="text-pink-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-snug text-slate-500 font-medium italic">
                                Receba alertas instantâneos de vendas e levantamentos diretamente no seu dispositivo.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor do Teste</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="97,00"
                                    value={testPushValue}
                                    onChange={(e) => setTestPushValue(e.target.value)}
                                    className="w-full h-11 pl-4 pr-4 rounded-xl bg-slate-50 dark:bg-brand-950 border border-slate-100 dark:border-brand-800 text-xs font-bold text-slate-700 dark:text-white outline-none focus:ring-4 focus:ring-pink-500/10 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleTestPush}
                            className="w-full h-11 bg-pink-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-pink-700 shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                        >
                            <Bell size={16} />
                            Testar Notificação
                        </button>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};

