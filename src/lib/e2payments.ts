function formatGatewayError(data: any): string {
    const raw = data?.data?.response_description 
        || data?.message 
        || data?.error 
        || (data?.errors ? JSON.stringify(data.errors) : '');
    const code = data?.data?.response_code || '';

    if (code === 'INS-9' || raw.toLowerCase().includes('timeout')) {
        return 'O tempo para digitar o PIN no telemóvel expirou (Request timeout). Por favor, tente novamente e digite o PIN assim que a notificação surgir no telemóvel.';
    }
    if (code === 'INS-6' || raw.toLowerCase().includes('cancelled') || raw.toLowerCase().includes('cancelada')) {
        return 'Transação cancelada ou recusada no telemóvel.';
    }
    if (code === 'INS-2006' || code === 'INS-2001' || raw.toLowerCase().includes('insufficient')) {
        return 'Saldo insuficiente na sua conta M-Pesa/e-Mola.';
    }
    if (code === 'KWK-BLOCKED') {
        return 'Comunicação temporariamente bloqueada pela Vodacom. Tente novamente em instantes.';
    }
    if (typeof raw === 'string' && raw.toLowerCase().includes('system internal error')) {
        return 'Ocorreu um erro interno na rede M-Pesa/Gateway ou tempo de espera esgotado. Verifique o seu telemóvel para confirmar se recebeu o pedido de PIN.';
    }
    return raw || 'Erro no processamento do pagamento.';
}

export class E2Payments {
    private clientId: string;
    private clientSecret: string;
    private token: string | null = null;
    private baseUrl: string;

    constructor(clientId?: string, clientSecret?: string) {
        // Credentials come from env vars
        this.clientId     = clientId     || import.meta.env.VITE_PAYMENT_CLIENT_ID     || 'a317dab6-69ec-4d2f-8014-cb3ab617fd43';
        this.clientSecret = clientSecret || import.meta.env.VITE_PAYMENT_CLIENT_SECRET || 'fVfwZkE81OhqOfneGvBJUd9CrSYtelgwZnPUGGKs';

        // In browser, use the same-origin proxy (/api/payment-proxy) to bypass CORS blocks
        this.baseUrl = typeof window !== 'undefined' ? '/api/payment-proxy' : (import.meta.env.VITE_PAYMENT_BASE_URL || '');
    }

    async authenticate(): Promise<string> {
        if (this.token) return this.token;

        const response = await fetch(`${this.baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            })
        });

        if (!response.ok) {
            const err = await response.text();
            let parsedErr = err;
            try {
                const jsonErr = JSON.parse(err);
                parsedErr = jsonErr.message || jsonErr.error_description || jsonErr.error || err;
            } catch {}
            throw new Error(`Auth failed: ${parsedErr}`);
        }

        const data = await response.json();
        this.token = data.access_token;
        return data.access_token;
    }

    async c2bPayment(method: 'mpesa' | 'emola', walletId: string, amount: number, phone: string, reference: string) {
        // Reference must not exceed 20 characters and have no spaces
        const cleanRef = String(reference || `ORD${Date.now()}`).replace(/\s+/g, '_').slice(0, 20);

        // Sanitize phone to 9 digits (e.g. 856195186)
        let cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.startsWith('258') && cleanPhone.length > 9) {
            cleanPhone = cleanPhone.substring(3);
        }
        cleanPhone = cleanPhone.slice(-9);

        // Always use the robust serverless endpoint instead of the edge proxy in production.
        // The serverless function has maxDuration 60s configured (only works in Pro).
        // For local development (Vite), we must use the Vite proxy.
        let response: Response | null = null;

        // 1. Tentar primeiro via /api/payment-proxy (Edge rewrite direto na Vercel e Vite, sem timeout de 10s de serverless)
        try {
            console.log(`[E2Payments] A iniciar pagamento ${method} para ${cleanPhone} via /api/payment-proxy...`);
            const token = await this.authenticate();
            response = await fetch(`/api/payment-proxy/v1/c2b/${method}-payment/${walletId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    client_id: this.clientId,
                    amount: Number(amount),
                    phone: cleanPhone,
                    reference: cleanRef
                })
            });
        } catch (proxyErr) {
            console.warn('[E2Payments] Falha ao conectar via /api/payment-proxy, tentando /api/kwikpay:', proxyErr);
        }

        // 2. Se /api/payment-proxy falhou na rede ou não respondeu, usar fallback serverless /api/kwikpay
        if (!response || !response.ok) {
            console.log('[E2Payments] A tentar endpoint serverless /api/kwikpay...');
            try {
                const kwikpayRes = await fetch('/api/kwikpay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method,
                        walletId,
                        amount: Number(amount),
                        phone: cleanPhone,
                        reference: cleanRef,
                        clientId: this.clientId,
                        clientSecret: this.clientSecret,
                    })
                });
                // Se o kwikpay responder com ok ou com dados válidos, usamos esta resposta
                if (kwikpayRes.ok || !response) {
                    response = kwikpayRes;
                }
            } catch (serverlessErr) {
                console.error('[E2Payments] Erro no fallback /api/kwikpay:', serverlessErr);
            }
        }

        if (!response) {
            throw new Error('Não foi possível conectar ao gateway de pagamentos. Verifique a sua ligação à internet.');
        }

        // Para debug: vamos capturar o status e o texto bruto
        const rawText = await response.text().catch(() => '');
        console.log(`[E2Payments] C2B Status: ${response.status}`);
        console.log(`[E2Payments] C2B Body: ${rawText}`);

        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            console.warn('[E2Payments] Failed to parse JSON body');
        }

        if (!response.ok || (data && data.success === false)) {
            // Timeout real da gateway enquanto aguarda PIN no telemóvel:
            const isGatewayTimeout = response.status === 504 || rawText.toLowerCase().includes('gateway timeout') || rawText.toLowerCase().includes('request timeout');

            if (isGatewayTimeout) {
                console.log('Timeout da Gateway atingido. O pedido foi enviado; aguardando PIN no telemóvel...');
                return { success: true, pending: true, message: 'A aguardar confirmação no telemóvel...' };
            }
            throw new Error(formatGatewayError(data || { error: rawText }));
        }

        return data;
    }
}

