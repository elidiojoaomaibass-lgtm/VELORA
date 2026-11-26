function extractGatewayCode(data: any): string {
    return String(
        data?.data?.response_code ||
        data?.mpesa_server_response?.output_ResponseCode ||
        data?.emola_server_response?.output_ResponseCode ||
        data?.response_code ||
        data?.output_ResponseCode ||
        data?.code ||
        ''
    ).trim().toUpperCase();
}

function formatGatewayError(data: any): string {
    // Also read emola_response / mpesa_response fields returned directly by the gateway
    const raw = String(
        data?.data?.response_description ||
        data?.mpesa_server_response?.output_ResponseDesc ||
        data?.emola_server_response?.output_ResponseDesc ||
        data?.response_description ||
        data?.message ||
        data?.error ||
        (data?.errors ? JSON.stringify(data.errors) : '') ||
        ''
    );
    // Merge emola_response into lower for matching
    const rawWithEmola = raw + ' ' + (data?.emola_response || data?.mpesa_response || '');
    const lower = rawWithEmola.toLowerCase();
    const code = extractGatewayCode(data);

    // 0. Número de telemóvel inválido (422 com errors.phone do gateway)
    if (data?.errors?.phone) {
        const phoneErr = Array.isArray(data.errors.phone) ? data.errors.phone[0] : String(data.errors.phone);
        return `Número inválido: ${phoneErr}`;
    }
    // 1. Não colocou PIN / Tempo esgotado (inclui "Customer did not enter PIN" do gateway e-Mola)
    if (
        code === 'INS-9' ||
        lower.includes('timeout') ||
        lower.includes('time out') ||
        lower.includes('expired') ||
        lower.includes('expir') ||
        lower.includes('did not enter pin') ||
        lower.includes('did not enter') ||
        lower.includes('customer did not')
    ) {
        return 'Tempo esgotado. Não introduziu o PIN no seu telemóvel a tempo. Tente novamente.';
    }
    // 2. PIN errado / falha de autenticação
    if (
        code === 'INS-2051' ||
        lower.includes('wrong pin') ||
        lower.includes('invalid pin') ||
        lower.includes('pin incorreto') ||
        lower.includes('pin inválido') ||
        lower.includes('pin invalido') ||
        lower.includes('incorrect pin') ||
        lower.includes('authentication failed')
    ) {
        return 'PIN incorreto. Verifique o seu PIN do M-Pesa/e-Mola e tente novamente.';
    }
    // 3. Saldo insuficiente
    if (
        code === 'INS-2006' ||
        code === 'INS-2001' ||
        lower.includes('insufficient') ||
        lower.includes('saldo insuficiente') ||
        lower.includes('not enough balance') ||
        lower.includes('low balance')
    ) {
        return 'Saldo insuficiente na sua conta M-Pesa/e-Mola. Recarregue e tente novamente.';
    }
    // 4. Cancelado ou recusado pelo utilizador
    if (
        code === 'INS-5' ||
        code === 'INS-17' ||
        lower.includes('cancel') ||
        lower.includes('rejected') ||
        lower.includes('declined') ||
        lower.includes('recusad')
    ) {
        return 'Pagamento cancelado ou recusado no telemóvel. Tente novamente e confirme o PIN.';
    }
    // 5. Falha geral no provedor (ex: INS-6 pode ser saldo insuficiente, PIN errado ou transação recusada no e-Mola/M-Pesa)
    if (code === 'INS-6' || lower.includes('transaction failed')) {
        return 'Transação falhou no telemóvel (verifique o saldo, o PIN ou se o pedido foi recusado) e tente novamente.';
    }
    // 6. Número inválido / inexistente
    if (code === 'INS-14' || code === 'INS-2' || code === 'INS-4' || lower.includes('invalid msisdn') || lower.includes('not found')) {
        return 'Número de telemóvel inválido ou sem conta M-Pesa/e-Mola ativa.';
    }
    if (code === 'INS-10' || lower.includes('duplicate')) {
        return 'Transação duplicada. Aguarde alguns instantes antes de tentar novamente.';
    }
    if (code === 'INS-13') {
        return 'Valor inválido para pagamento.';
    }
    if (code === 'KWK-BLOCKED') {
        return 'Comunicação temporariamente bloqueada pela operadora. Tente novamente em instantes.';
    }
    if (lower.includes('system internal error') || code === 'INS-1') {
        return 'Não foi possível concluir o pagamento (erro ou tempo esgotado no telemóvel). Tente novamente.';
    }
    return raw || 'Pagamento não concluído. Verifique o seu telemóvel e tente novamente.';
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

        // 2. Só usar fallback /api/kwikpay se o proxy falhou na rede ou não está disponível (404/502/503)
        // NÃO reenviar se o gateway já respondeu com erro de transação (400/422/etc.), para não duplicar o pedido de PIN!
        const shouldFallbackToServerless =
            !response ||
            response.status === 404 ||
            response.status === 502 ||
            response.status === 503;

        if (shouldFallbackToServerless) {
            console.log('[E2Payments] Proxy indisponível, tentando endpoint serverless /api/kwikpay...');
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
                if (kwikpayRes.ok || !response || response.status === 404) {
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

        let data: any = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch {
            console.warn('[E2Payments] Failed to parse JSON body');
        }

        const gatewayCode = extractGatewayCode(data);
        const hasGatewayErrorCode = Boolean(gatewayCode && gatewayCode !== 'INS-0' && gatewayCode !== '0' && gatewayCode !== '00' && gatewayCode !== '200');
        const isExplicitFailure = Boolean(
            (data && data.success === false) ||
            (data && (data.status === 'failed' || data.status === 'error' || data.status === 'cancelled')) ||
            hasGatewayErrorCode
        );

        if (!response.ok || isExplicitFailure) {
            // Apenas tratar como pendente se for timeout da infraestrutura/proxy (504 sem resposta JSON do gateway)
            const isInfraGatewayTimeout =
                response.status === 504 &&
                !data?.data?.response_code &&
                !data?.mpesa_server_response &&
                !data?.emola_server_response &&
                !hasGatewayErrorCode;

            // Tratar como pendente se o gateway iniciou o pagamento (enviou pedido PIN ao telemóvel)
            // mas o utilizador não entrou o PIN a tempo (HTTP 400 com emola_response/mpesa_response)
            // O pedido de PIN JÁ FOI enviado → não repetir; mostrar mensagem de timeout
            const isGatewayPinTimeout =
                (response.status === 400 || response.status === 408 || response.status === 504) &&
                (data?.emola_response || data?.mpesa_response);

            if (isInfraGatewayTimeout) {
                console.log('Timeout de proxy (504) atingido. Aguardar confirmação via webhook...');
                return { success: true, pending: true, message: 'A aguardar confirmação no telemóvel...' };
            }
            if (isGatewayPinTimeout) {
                console.log('[E2Payments] Gateway enviou pedido PIN mas utilizador não respondeu a tempo.');
                // Lançar erro com mensagem amigável de timeout
                throw new Error(formatGatewayError(data));
            }
            throw new Error(formatGatewayError(data || { error: rawText }));
        }

        return data;
    }
}

