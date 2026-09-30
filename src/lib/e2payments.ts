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
    return raw || 'Erro no processamento do pagamento.';
}

export class E2Payments {
    private clientId: string;
    private clientSecret: string;
    private token: string | null = null;
    private baseUrl: string;

    constructor(clientId?: string, clientSecret?: string) {
        // Credentials come from env vars or KwikPay defaults
        this.clientId     = clientId     || import.meta.env.VITE_KWIKPAY_CLIENT_ID     || import.meta.env.VITE_E2_CLIENT_ID     || '';
        this.clientSecret = clientSecret || import.meta.env.VITE_KWIKPAY_CLIENT_SECRET || import.meta.env.VITE_E2_CLIENT_SECRET || '';

        // In browser, use the same-origin proxy (/api/kwikpay-proxy) to bypass CORS blocks
        this.baseUrl = typeof window !== 'undefined' ? '/api/kwikpay-proxy' : 'https://kwikpay.web.tr';
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
        // Reference must not exceed 20 characters in KwikPay
        const cleanRef = String(reference || `ORD${Date.now()}`).slice(0, 20);

        // Sanitize phone to 9 digits (e.g. 856195186)
        let cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.startsWith('258') && cleanPhone.length > 9) {
            cleanPhone = cleanPhone.substring(3);
        }
        cleanPhone = cleanPhone.slice(-9);

        // Always use the robust serverless endpoint instead of the edge proxy in production.
        // The serverless function has maxDuration 60s configured (only works in Pro).
        // For local development (Vite), we must use the Vite proxy.
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        let response;
        if (isLocalhost) {
            console.log('Using Vite /api/kwikpay-proxy for local development...');
            // First ensure we have a token
            const token = await this.authenticate();
            response = await fetch(`/api/kwikpay-proxy/api/v1/c2b/${method}-payment/${walletId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: Number(amount),
                    phone: cleanPhone,
                    reference: cleanRef
                })
            });
        } else {
            console.log('Using /api/kwikpay serverless endpoint for payment...');
            response = await fetch('/api/kwikpay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method,
                    walletId,
                    amount: Number(amount),
                    phone: cleanPhone,
                    reference: cleanRef
                })
            });
        }

        const data = await response.json().catch(() => null);

        if (!response.ok || (data && data.success === false)) {
            // WORKAROUND VERCEL PLANO GRÁTIS (10s timeout):
            // Se o Vercel cortar a ligação por demorar mais de 10s (erro 504 ou 500 sem resposta do KwikPay),
            // assumimos que o pedido M-Pesa foi disparado com sucesso e está a aguardar o PIN no telemóvel.
            // O webhook atualizará o estado via Supabase Realtime.
            if (response.status === 504 || (response.status === 500 && !isLocalhost)) {
                console.log('Vercel timeout atingido. Assumindo pagamento como pendente (aguardando webhook)...');
                return { success: true, pending: true, message: 'A aguardar confirmação no telemóvel...' };
            }
            throw new Error(formatGatewayError(data));
        }

        return data;
    }
}
