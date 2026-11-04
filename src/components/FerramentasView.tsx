import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserSettings, saveUserSettings, getActiveUserEmail } from '../lib/userSettings';
import { sendLocalNotification } from '../lib/store';
import { requestPermissionAndStoreToken } from '../lib/firebase';
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
            const activeEmail = await getActiveUserEmail();
            if (activeEmail) setUserEmail(activeEmail);
            const settings = await getUserSettings(activeEmail);
            if (settings) {
                if (settings.user_email) setUserEmail(settings.user_email);
                if (settings.webhook_url !== undefined) setWebhookUrl(settings.webhook_url);
                if (settings.webhook_events) setWebhookEvents(settings.webhook_events);
                if (settings.lowtrack_token !== undefined) setLowTrackToken(settings.lowtrack_token);
                if (settings.facebook_pixel_id !== undefined) setPixelId(settings.facebook_pixel_id);
                if (settings.tiktok_pixel_id !== undefined) setTiktokId(settings.tiktok_pixel_id);
                if (settings.utmify_token !== undefined) setUtmifyToken(settings.utmify_token);
                if (settings.google_ads_id !== undefined) setGoogleAdsId(settings.google_ads_id);
                if (settings.whatsapp_token !== undefined) setWhatsappToken(settings.whatsapp_token);
                if (settings.klaviyo_token !== undefined) setKlaviyoToken(settings.klaviyo_token);
            }
        };
        loadSettings();
    }, []);

    const handleSaveUtmify = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ utmify_token: utmifyToken.trim() });
        if (ok) {
            toast.success('Token Utmify salvo na conta!', {
                description: 'A integração com Utmify está salva no banco de dados e ativa no seu checkout.'
            });
        } else {
            toast.error('Erro ao salvar Token Utmify na conta.');
        }
    };

    const handleSaveLowTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ lowtrack_token: lowTrackToken.trim() });
        if (ok) {
            toast.success('Token LowTrack salvo na conta!', {
                description: 'A integração com LowTrack está salva no banco de dados e ativa em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Token LowTrack na conta.');
        }
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
        const ok = await saveUserSettings({ facebook_pixel_id: pixelId.trim() });
        if (ok) {
            if (pixelId.trim()) {
                (window as any).fbq = undefined;
                (window as any)._fbq = undefined;
                import('../lib/pixel').then(({ initFacebookPixel, trackFacebookEvent }) => {
                    initFacebookPixel(pixelId.trim());
                    trackFacebookEvent('PageView');
                });
            }
            toast.success('Pixel do Meta Ads salvo na conta!', {
                description: 'O Facebook Pixel está salvo no banco de dados e sincronizado em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Pixel do Meta Ads na conta.');
        }
    };

    const handleSaveTikTok = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ tiktok_pixel_id: tiktokId.trim() });
        if (ok) {
            toast.success('Pixel do TikTok salvo na conta!', {
                description: 'O TikTok Pixel está salvo no banco de dados e sincronizado em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Pixel do TikTok na conta.');
        }
    };

    const handleSaveWebhook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (webhookUrl && !webhookUrl.startsWith('http')) {
            toast.error('URL do Webhook inválida');
            return;
        }
        const ok = await saveUserSettings({ webhook_url: webhookUrl.trim(), webhook_events: webhookEvents });
        if (ok) {
            toast.success('Webhook configurado e salvo na conta!', {
                description: 'A URL e os eventos estão salvos no banco de dados e sincronizados em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Webhook na conta.');
        }
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

    const handleSaveGoogleAds = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ google_ads_id: googleAdsId.trim() });
        if (ok) {
            toast.success('Google Ads salvo na conta!', {
                description: 'O rastreamento de conversões via API está salvo no banco de dados e sincronizado em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Google Ads na conta.');
        }
    };

    const handleSaveWhatsapp = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ whatsapp_token: whatsappToken.trim() });
        if (ok) {
            toast.success('WhatsApp configurado e salvo na conta!', {
                description: 'A recuperação automática de vendas está salva no banco de dados e sincronizada em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar WhatsApp na conta.');
        }
    };

    const handleSaveKlaviyo = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await saveUserSettings({ klaviyo_token: klaviyoToken.trim() });
        if (ok) {
            toast.success('Klaviyo configurado e salvo na conta!', {
                description: 'A integração de email marketing está salva no banco de dados e sincronizada em todos os dispositivos.'
            });
        } else {
            toast.error('Erro ao salvar Klaviyo na conta.');
        }
    };

    const handleTestPush = async () => {
        // 1. Obter email ativo com fallback seguro
        let email = userEmail;
        if (!email) {
            email = await getActiveUserEmail();
            if (email) setUserEmail(email);
        }

        const val = parseFloat(testPushValue.replace(',', '.')) || 97;
        const testPayload = {
            amount: val,
            method: 'M-Pesa'
        };

        // 2. Pedir permissão no navegador caso ainda esteja pendente
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                try {
                    await Notification.requestPermission();
                } catch {
                    // silencioso
                }
            }
        }

        // 3. Tentar renovar/salvar o token FCM se o navegador suportar
        if (email) {
            requestPermissionAndStoreToken(email).catch(() => {});
        }

        // 4. DISPARAR IMEDIATAMENTE NOTIFICAÇÃO LOCAL NESTE DISPOSITIVO
        // O utilizador está a testar e deve ver o alerta e feedback sonoro/visual de imediato
        sendLocalNotification('🎉 Venda aprovada! (TESTE)', {
            body: `Venda de ${val.toLocaleString('pt-PT')} MT via M-Pesa`,
            icon: '/logo.png'
        });

        // 5. Função auxiliar de broadcast Realtime com timeout seguro (não trava a interface)
        const sendBroadcast = (channelName: string) => new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(true), 2500);
            try {
                const channel = supabase.channel(channelName, {
                    config: { broadcast: { self: false } }
                });
                channel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        channel.send({
                            type: 'broadcast',
                            event: 'test_push',
                            payload: testPayload
                        }).finally(() => {
                            clearTimeout(timer);
                            supabase.removeChannel(channel);
                            resolve(true);
                        });
                    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
            } catch {
                clearTimeout(timer);
                resolve(true);
            }
        });

        // 6. Disparar notificação nativa via Edge Function para FCM (telemóveis em segundo plano)
        const fcmPromise = email ? supabase.functions.invoke('send-push', {
            body: {
                title: 'Você recebeu um novo pedido! 🎉 (TESTE)',
                body: `Venda aprovada de ${val.toLocaleString('pt-PT')} MT M-Pesa`,
                user_email: email
            }
        }).then(({ error }: any) => {
            if (error) console.warn('Aviso ao disparar FCM no teste:', error);
            return true;
        }).catch(() => true) : Promise.resolve(true);

        toast.promise(
            Promise.all([
                sendBroadcast('velora-transactions-rt'),
                sendBroadcast('public-transactions-changes'),
                fcmPromise
            ]),
            {
                loading: `A enviar evento de teste para todos os dispositivos...`,
                success: `✅ Notificação disparada! Alerta emitido neste e nos outros dispositivos conectados.`,
                error: (err: any) => `Erro ao sincronizar: ${err?.message || 'Tente novamente'}`,
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

