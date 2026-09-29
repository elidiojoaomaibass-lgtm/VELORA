import {
    Copy, Check, ExternalLink, Shield,
    Smartphone, Zap, Server, Key, Globe, ArrowUpRight,
    AlertCircle
} from 'lucide-react';
import { useState } from 'react';

type Lang = 'php' | 'curl' | 'js' | 'python';

const LANG_LABELS: Record<Lang, string> = {
    php: '🐘 PHP',
    curl: 'cURL',
    js: 'JS (Fetch)',
    python: '🐍 Python',
};

export const DocumentacaoView = () => {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeLang, setActiveLang] = useState<Lang>('curl');

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── Credenciais KwikPay ─────────────────────────────────────────────────────────────
    const CLIENT_ID     = import.meta.env.VITE_KWIKPAY_CLIENT_ID || import.meta.env.VITE_E2_CLIENT_ID || '11';
    const CLIENT_SECRET = import.meta.env.VITE_KWIKPAY_CLIENT_SECRET || import.meta.env.VITE_E2_CLIENT_SECRET || 'ZnET0WBSivZ7AGVJbG95N0xqirzCA7krS36ZAB7Q';
    const WALLET_UUID   = import.meta.env.VITE_KWIKPAY_WALLET_ID || import.meta.env.VITE_E2_WALLET_MPESA || '891ae33d-664c-4715-abb1-008688662a03';
    const PHONE         = '856195186'; // Joao Maibass
    const BASE          = 'https://kwikpay.web.tr';

    // ── 1. OAuth2 Token ────────────────────────────────────────────────────────────────
    const tokenSnippets: Record<Lang, string> = {
        curl: `curl -X POST ${BASE}/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "${CLIENT_ID}",
    "client_secret": "${CLIENT_SECRET}"
  }'`,
        php: `<?php
// 1. Gerar Token
$tokenResponse = file_get_contents('${BASE}/oauth/token', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode([
            'grant_type' => 'client_credentials',
            'client_id' => '${CLIENT_ID}',
            'client_secret' => '${CLIENT_SECRET}'
        ])
    ]
]));
$token = json_decode($tokenResponse, true)['access_token'];`,
        js: `// 1. Gerar Token
const tokenResponse = await fetch('${BASE}/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: '${CLIENT_ID}',
        client_secret: '${CLIENT_SECRET}'
    })
});
const { access_token } = await tokenResponse.json();`,
        python: `import requests

# 1. Gerar Token
token_response = requests.post(
    '${BASE}/oauth/token',
    json={
        'grant_type': 'client_credentials',
        'client_id': '${CLIENT_ID}',
        'client_secret': '${CLIENT_SECRET}'
    }
)
access_token = token_response.json()['access_token']`,
    };

    // ── 2. B2C (Negócio -> Cliente) ──────────────────────────────────────────────────
    const b2cSnippets: Record<Lang, string> = {
        curl: `curl -X POST ${BASE}/api/v1/b2c/mpesa-payment \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "wallet_uuid": "${WALLET_UUID}",
    "amount": 100,
    "phone": "${PHONE}",
    "reference": "PAGAMENTO_123"
  }'`,
        php: `<?php
// 2. Fazer Pagamento B2C (M-Pesa)
$b2cResponse = file_get_contents('${BASE}/api/v1/b2c/mpesa-payment', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer $token\\r\\nContent-Type: application/json",
        'content' => json_encode([
            'wallet_uuid' => '${WALLET_UUID}',
            'amount'      => 100,
            'phone'       => '${PHONE}',
            'reference'   => 'PAGAMENTO_' . time()
        ])
    ]
]));

print_r(json_decode($b2cResponse, true));`,
        js: `// 2. Fazer Pagamento B2C (M-Pesa)
const b2cResponse = await fetch('${BASE}/api/v1/b2c/mpesa-payment', {
    method: 'POST',
    headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        wallet_uuid: '${WALLET_UUID}',
        amount: 100,
        phone: '${PHONE}',
        reference: 'PAG_' + Date.now()
    })
});
const result = await b2cResponse.json();
console.log(result);`,
        python: `import requests

# 2. Fazer Pagamento B2C (M-Pesa)
headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}
payload = {
    'wallet_uuid': '${WALLET_UUID}',
    'amount': 100,
    'phone': '${PHONE}',
    'reference': 'PAGAMENTO_123'
}
response = requests.post('${BASE}/api/v1/b2c/mpesa-payment', json=payload, headers=headers)
print(response.json())`,
    };

    const b2cSuccessResponse = `{\n  "success": true,\n  "data": {\n    "transaction_id": "b2c-9575e249-65cf-4b66-b8ff-4771fb5caef1",\n    "mpesa_transaction_id": "b2c921hiyazhq45",\n    "wallet_uuid": "${WALLET_UUID}",\n    "reference": "PAGAMENTO_123",\n    "amount": 100,\n    "phone": "${PHONE}",\n    "status": "success",\n    "fees": {\n      "amount": 100,\n      "fee_percent": 7,\n      "fee_amount": 7,\n      "min_fee": 10,\n      "net_amount": 93\n    },\n    "timestamp": "2026-03-28T06:15:35+00:00"\n  },\n  "message": "Pagamento B2C processado com sucesso"\n}`;

    // ── 3. Consultar Saldo ─────────────────────────────────────────────────────────────
    const balanceSnippets: Record<Lang, string> = {
        curl: `curl -X GET ${BASE}/api/v1/wallet/${WALLET_UUID}/balance \\
  -H "Authorization: Bearer SEU_TOKEN"`,
        php: `<?php
// Consultar Saldo
$balanceResponse = file_get_contents('${BASE}/api/v1/wallet/${WALLET_UUID}/balance', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "Authorization: Bearer $token\\r\\nAccept: application/json"
    ]
]));
$balanceData = json_decode($balanceResponse, true);
print_r($balanceData);`,
        js: `// Consultar Saldo
const res = await fetch('${BASE}/api/v1/wallet/${WALLET_UUID}/balance', {
    method: 'GET',
    headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Accept': 'application/json'
    }
});
const balanceData = await res.json();
console.log('Saldo:', balanceData.data.balance, balanceData.data.currency);`,
        python: `import requests

# Consultar Saldo
headers = {'Authorization': f'Bearer {access_token}'}
res = requests.get('${BASE}/api/v1/wallet/${WALLET_UUID}/balance', headers=headers)
print(res.json())`,
    };

    const balanceSuccessResponse = `{\n  "success": true,\n  "data": {\n    "wallet_uuid": "${WALLET_UUID}",\n    "wallet_name": "Minha Carteira",\n    "balance": 1250.50,\n    "currency": "MZN",\n    "environment": "production"\n  }\n}`;

    // ── 4. Listar Transações ──────────────────────────────────────────────────────────
    const txSnippets: Record<Lang, string> = {
        curl: `curl -X GET "${BASE}/api/v1/transactions?status=success&type=b2c&per_page=10" \\
  -H "Authorization: Bearer SEU_TOKEN"`,
        php: `<?php
// Listar Transações
$txResponse = file_get_contents('${BASE}/api/v1/transactions?status=success&type=b2c&per_page=10', false, stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "Authorization: Bearer $token\\r\\nAccept: application/json"
    ]
]));
$transactions = json_decode($txResponse, true);
print_r($transactions);`,
        js: `// Listar Transações
const res = await fetch('${BASE}/api/v1/transactions?status=success&type=b2c&per_page=10', {
    headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Accept': 'application/json'
    }
});
const transactions = await res.json();
console.log(transactions);`,
        python: `import requests

# Listar Transações
headers = {'Authorization': f'Bearer {access_token}'}
params = {'status': 'success', 'type': 'b2c', 'per_page': 10}
res = requests.get('${BASE}/api/v1/transactions', headers=headers, params=params)
print(res.json())`,
    };

    // ── 5. C2B (Cliente -> Negócio) ──────────────────────────────────────────────────
    const c2bSnippets: Record<Lang, string> = {
        curl: `curl -X POST ${BASE}/api/v1/c2b/mpesa-payment/${WALLET_UUID} \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 100,
    "phone": "${PHONE}",
    "reference": "PAG_001"
  }'`,
        php: `<?php
// Fazer Pagamento C2B
$paymentResponse = file_get_contents('${BASE}/api/v1/c2b/mpesa-payment/${WALLET_UUID}', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Authorization: Bearer $token\\r\\nContent-Type: application/json",
        'content' => json_encode([
            'amount' => 100,
            'phone' => '${PHONE}',
            'reference' => 'PAG_' . time()
        ])
    ]
]));
print_r(json_decode($paymentResponse, true));`,
        js: `// Fazer Pagamento C2B
const paymentResponse = await fetch('${BASE}/api/v1/c2b/mpesa-payment/${WALLET_UUID}', {
    method: 'POST',
    headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        amount: 100,
        phone: '${PHONE}',
        reference: 'PAG_' + Date.now()
    })
});
const result = await paymentResponse.json();
console.log(result);`,
        python: `import requests

headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}
payload = {
    'amount': 100,
    'phone': '${PHONE}',
    'reference': 'PAG_001'
}
res = requests.post('${BASE}/api/v1/c2b/mpesa-payment/${WALLET_UUID}', json=payload, headers=headers)
print(res.json())`,
    };

    // ── Error Codes ──────────────────────────────────────────────────────────────────
    const errorCodes = [
        { code: 'INS-0', desc: 'Sucesso', detail: 'A transação foi concluída com êxito.', badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' },
        { code: 'INS-2', desc: 'API Key inválida', detail: 'Credenciais de autenticação incorretas ou expiradas.', badge: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
        { code: 'INS-6', desc: 'Transação falhou', detail: 'Falha genérica no processamento da operadora.', badge: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
        { code: 'INS-10', desc: 'Transação duplicada', detail: 'A referência fornecida já foi usada em outra transação.', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
        { code: 'INS-13', desc: 'Shortcode inválido', detail: 'Carteira ou código de serviço M-Pesa inexistente.', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
        { code: 'INS-15', desc: 'Valor inválido', detail: 'Valor fora dos limites permitidos (mínimo de 1 MZN).', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' },
        { code: 'INS-2006', desc: 'Saldo insuficiente', detail: 'Saldo disponível na carteira é inferior ao valor do saque + taxas.', badge: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' },
        { code: 'INS-2051', desc: 'MSISDN inválido', detail: 'Número de telefone do destinatário com formato inválido.', badge: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' },
    ];

    // ── Shared Code Block ────────────────────────────────────────────────────────────
    const CodeBlock = ({ code, id }: { code: string; id: string }) => (
        <div className="relative group">
            <div className="absolute top-3 right-3 z-20">
                <button
                    onClick={() => copyToClipboard(code, id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white/70 hover:text-white transition-all border border-white/10 text-[10px] font-bold shadow-sm"
                >
                    {copiedId === id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedId === id ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <pre className="p-5 pt-10 rounded-2xl bg-slate-950 text-slate-300 overflow-x-auto text-[11px] md:text-xs font-mono leading-relaxed border border-white/5 shadow-2xl">
                {code}
            </pre>
        </div>
    );

    // ── Language Selector ────────────────────────────────────────────────────────────
    const LangTabs = () => (
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 w-fit flex-wrap">
            {(Object.keys(LANG_LABELS) as Lang[]).map((lang) => (
                <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        activeLang === lang
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : 'text-slate-500 dark:text-brand-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    {LANG_LABELS[lang]}
                </button>
            ))}
        </div>
    );

    return (
        <div className="px-4 md:px-8 pt-2 md:pt-4 pb-20 space-y-6 md:space-y-8 w-full max-w-none mx-auto transition-all duration-700">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 xl:gap-16">
                <div className="space-y-1 md:space-y-3 mt-3 md:mt-2">
                    <div className="flex items-center gap-3 mb-1 pl-[3.5rem] md:pl-0">
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <Zap size={18} className="md:w-[22px] md:h-[22px]" />
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">
                            KwikPay · Documentação Oficial (v1)
                        </span>
                    </div>
                    <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none pl-[3.5rem] md:pl-0">
                        API & Integração <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">KwikPay</span>
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-400 dark:text-brand-400 font-medium tracking-tight pl-[3.5rem] md:pl-0 leading-snug max-w-2xl">
                        Documentação técnica oficial para emissão de saques B2C, pagamentos C2B, consulta de saldo e extrato via M-Pesa. Servidor Base: <code className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">https://kwikpay.web.tr</code>
                    </p>
                </div>
                <div className="hidden xl:block shrink-0">
                    <LangTabs />
                </div>
            </div>

            {/* Credentials Card */}
            <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 flex flex-col md:flex-row items-start gap-4 shadow-sm">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0">
                    <Key size={20} />
                </div>
                <div className="flex-1 w-full">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">
                            Credenciais Ativas — João Maibass
                        </h4>
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-200/50 dark:bg-amber-800/40 px-2 py-0.5 rounded-full">
                            Produção
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px] font-mono">
                        {[
                            { label: 'URL Base',         value: BASE },
                            { label: 'Client ID',        value: CLIENT_ID },
                            { label: 'Client Secret',    value: CLIENT_SECRET },
                            { label: 'Wallet UUID',      value: WALLET_UUID },
                            { label: 'Telefone Destino', value: PHONE + ' (João Maibass)' },
                            { label: 'Gateway Provider', value: 'M-Pesa Moçambique' },
                        ].map((r) => (
                            <div key={r.label} className="flex items-center justify-between bg-amber-100/60 dark:bg-amber-900/20 rounded-xl px-3 py-2 gap-2">
                                <span className="text-amber-700 dark:text-amber-400 font-bold text-[10px] shrink-0">{r.label}</span>
                                <span className="text-amber-950 dark:text-amber-200 truncate flex-1 font-semibold">{r.value}</span>
                                <button
                                    onClick={() => copyToClipboard(r.value, 'cred-' + r.label)}
                                    className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                                    title="Copiar"
                                >
                                    {copiedId === 'cred-' + r.label ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Lang Tabs */}
            <div className="xl:hidden">
                <LangTabs />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-12">

                    {/* 1. B2C (Negócio -> Cliente) */}
                    <section id="b2c-section" className="space-y-4">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-violet-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    POST
                                </span>
                                <code className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 rounded-lg">
                                    /api/v1/b2c/mpesa-payment
                                </code>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <ArrowUpRight className="text-violet-500" size={22} />
                                1. B2C (Negócio → Cliente)
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium leading-relaxed">
                                Envie pagamentos para clientes via M-PESA. Taxa de <b>7% (mínimo 10 MZN)</b> aplicada sobre o valor enviado.
                            </p>
                        </div>

                        {/* Code Snippet */}
                        <CodeBlock code={b2cSnippets[activeLang]} id={`b2c-${activeLang}`} />

                        {/* Parameters table */}
                        <div className="rounded-2xl border border-slate-100 dark:border-brand-800 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-brand-950 px-4 py-2.5 border-b border-slate-100 dark:border-brand-800">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Parâmetros de Requisição (Body JSON)
                                </span>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="bg-white dark:bg-brand-900 border-b border-slate-100 dark:border-brand-800">
                                    <tr>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Parâmetro</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Tipo</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Obrigatório</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Descrição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-brand-800 dark:bg-brand-900">
                                    {[
                                        { name: 'wallet_uuid', type: 'string', req: 'Obrigatório', desc: 'UUID da carteira de origem (ex: 891ae33d-664c-4715-abb1-008688662a03)' },
                                        { name: 'amount',      type: 'number', req: 'Obrigatório', desc: 'Valor a enviar (mínimo 1 MZN)' },
                                        { name: 'phone',       type: 'string', req: 'Obrigatório', desc: `Número do destinatário (formato: 842848202 ou 856195186)` },
                                        { name: 'reference',   type: 'string', req: 'Opcional',    desc: 'Referência da transação (máximo 20 caracteres)' },
                                    ].map((p, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-bold text-violet-600 dark:text-violet-400 font-mono">{p.name}</td>
                                            <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{p.type}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                    p.req === 'Obrigatório'
                                                        ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                                                        : 'bg-slate-100 text-slate-500 dark:bg-brand-800 dark:text-brand-300'
                                                }`}>{p.req}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-brand-300 font-medium">{p.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* B2C Response */}
                        <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Exemplo de Resposta de Sucesso (200 OK)
                            </span>
                            <CodeBlock code={b2cSuccessResponse} id="b2c-response" />
                        </div>

                        {/* B2C Fee structure */}
                        <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20">
                            <h4 className="text-xs font-black text-violet-900 dark:text-violet-200 uppercase tracking-tight mb-3">
                                Estrutura de Taxas B2C
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Taxa B2C',      value: '7%',       sub: 'sobre valor enviado' },
                                    { label: 'Taxa Mínima',   value: '10 MZN',   sub: 'por envio' },
                                    { label: 'Exemplo 100 MT', value: '7 MZN',    sub: 'taxa aplicada' },
                                    { label: 'Valor Líquido', value: '93 MZN',   sub: 'recebido no destino' },
                                ].map((f) => (
                                    <div key={f.label} className="bg-white dark:bg-violet-900/20 rounded-xl p-3 text-center border border-violet-100 dark:border-violet-800/20">
                                        <div className="text-base font-black text-violet-700 dark:text-violet-300">{f.value}</div>
                                        <div className="text-[9px] font-bold text-violet-500 uppercase tracking-wider mt-0.5">{f.label}</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">{f.sub}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 2. Consultar Saldo */}
                    <section id="balance-section" className="space-y-4 pt-4 border-t border-slate-100 dark:border-brand-800">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    GET
                                </span>
                                <code className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg">
                                    /api/v1/wallet/{'{wallet_uuid}'}/balance
                                </code>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Globe className="text-blue-500" size={22} />
                                2. Consultar Saldo da Carteira
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium">
                                Consulta o saldo disponível em tempo real na sua carteira KwikPay via token de autenticação.
                            </p>
                        </div>
                        <CodeBlock code={balanceSnippets[activeLang]} id={`balance-${activeLang}`} />
                        <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Exemplo de Resposta de Saldo
                            </span>
                            <CodeBlock code={balanceSuccessResponse} id="balance-res" />
                        </div>
                    </section>

                    {/* 3. Listar Transações */}
                    <section id="transactions-section" className="space-y-4 pt-4 border-t border-slate-100 dark:border-brand-800">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-teal-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    GET
                                </span>
                                <code className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg">
                                    /api/v1/transactions
                                </code>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Server className="text-teal-500" size={22} />
                                3. Listar Transações
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium">
                                Obtém o histórico detalhado de transações realizadas com filtros opcionais de status e tipo.
                            </p>
                        </div>

                        {/* Query Params table */}
                        <div className="rounded-2xl border border-slate-100 dark:border-brand-800 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 dark:bg-brand-950 px-4 py-2.5 border-b border-slate-100 dark:border-brand-800">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Parâmetros de Consulta (Query String Opcionais)
                                </span>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="bg-white dark:bg-brand-900 border-b border-slate-100 dark:border-brand-800">
                                    <tr>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Parâmetro</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Descrição</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Valores Suportados</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-brand-800 dark:bg-brand-900">
                                    {[
                                        { name: 'status',   desc: 'Filtrar por status da transação', val: 'success, failed, pending' },
                                        { name: 'type',     desc: 'Filtrar por tipo de transação',   val: 'c2b, b2c' },
                                        { name: 'per_page', desc: 'Número de itens por página',      val: 'Padrão: 15 (ex: 10, 25, 50)' },
                                    ].map((q, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-bold text-teal-600 dark:text-teal-400 font-mono">{q.name}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-brand-300 font-medium">{q.desc}</td>
                                            <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{q.val}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <CodeBlock code={txSnippets[activeLang]} id={`txs-${activeLang}`} />
                    </section>

                    {/* 4. Códigos de Erro */}
                    <section id="error-codes-section" className="space-y-4 pt-4 border-t border-slate-100 dark:border-brand-800">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <AlertCircle className="text-rose-500" size={22} />
                                4. Códigos de Erro & Respostas M-Pesa
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium">
                                Quando uma requisição falha ou é rejeitada, a API KwikPay retorna o código do provedor para tratamento:
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-100 dark:border-brand-800 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-brand-950 border-b border-slate-100 dark:border-brand-800">
                                    <tr>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider w-32">Código</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider w-48">Descrição</th>
                                        <th className="px-4 py-3 font-black text-slate-900 dark:text-white uppercase tracking-wider">Ação Recomendada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-brand-800 dark:bg-brand-900">
                                    {errorCodes.map((err) => (
                                        <tr key={err.code} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-lg font-mono text-[11px] font-black ${err.badge}`}>
                                                    {err.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                                {err.desc}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 dark:text-brand-300">
                                                {err.detail}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* 5. Autenticação OAuth2 */}
                    <section id="auth-section" className="space-y-4 pt-4 border-t border-slate-100 dark:border-brand-800">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    POST
                                </span>
                                <code className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                                    /oauth/token
                                </code>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Shield className="text-emerald-500" size={22} />
                                5. Autenticação (OAuth 2.0)
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium">
                                Todas as requisições autenticadas exigem o cabeçalho <code className="bg-slate-100 dark:bg-brand-800 px-1 py-0.5 rounded font-mono text-[11px]">Authorization: Bearer SEU_TOKEN</code>.
                            </p>
                        </div>
                        <CodeBlock code={tokenSnippets[activeLang]} id={`token-${activeLang}`} />
                    </section>

                    {/* 6. C2B Pagamentos */}
                    <section id="c2b-section" className="space-y-4 pt-4 border-t border-slate-100 dark:border-brand-800">
                        <div className="space-y-2 pl-14 lg:pl-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    POST
                                </span>
                                <code className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                                    /api/v1/c2b/mpesa-payment/{'{wallet_uuid}'}
                                </code>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Smartphone className="text-emerald-500" size={22} />
                                6. Pagamento C2B (Cliente → Negócio)
                            </h2>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-brand-300 font-medium">
                                Dispara o prompt interativo USSD/PIN no telemóvel do cliente para débito automático via M-Pesa.
                            </p>
                        </div>
                        <CodeBlock code={c2bSnippets[activeLang]} id={`c2b-${activeLang}`} />
                    </section>
                </div>

                {/* Sticky Navigation Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-8 space-y-6">
                        <div className="p-6 rounded-3xl bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                            <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                                Índice de Seções
                            </h4>
                            <nav className="space-y-3">
                                {[
                                    { id: 'b2c-section',         label: '1. Saques B2C (M-Pesa)',  icon: ArrowUpRight },
                                    { id: 'balance-section',     label: '2. Consultar Saldo',      icon: Globe },
                                    { id: 'transactions-section',label: '3. Listar Transações',    icon: Server },
                                    { id: 'error-codes-section', label: '4. Códigos de Erro',      icon: AlertCircle },
                                    { id: 'auth-section',        label: '5. Autenticação (OAuth)', icon: Shield },
                                    { id: 'c2b-section',         label: '6. Pagamento C2B',        icon: Smartphone },
                                ].map((item) => (
                                    <a
                                        key={item.id}
                                        href={`#${item.id}`}
                                        className="flex items-center gap-3 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:text-brand-400 dark:hover:text-white transition-all group py-1"
                                    >
                                        <item.icon size={15} className="group-hover:scale-110 transition-transform shrink-0" />
                                        <span>{item.label}</span>
                                    </a>
                                ))}
                            </nav>
                        </div>

                        {/* Direct Link to B2C Payout View */}
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white space-y-4 shadow-xl shadow-violet-500/20">
                            <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                <ArrowUpRight size={20} />
                            </div>
                            <h4 className="text-sm font-black uppercase tracking-tight">Área de Saques B2C</h4>
                            <p className="text-xs text-violet-100 font-medium leading-relaxed">
                                Acesse agora a área de saques interativa com saldo em tempo real e transferências imediatas via M-Pesa.
                            </p>
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'Levantamentos' }))}
                                className="w-full py-2.5 bg-white text-violet-900 rounded-xl font-black text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                            >
                                Abrir Área de Saques B2C
                            </button>
                        </div>

                        {/* Official Links */}
                        <div className="p-6 rounded-3xl bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Links Úteis
                            </h4>
                            <div className="space-y-2">
                                <a
                                    href="https://kwikpay.web.tr"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 p-2 rounded-xl bg-slate-50 dark:bg-brand-950 transition-all"
                                >
                                    Portal KwikPay <ExternalLink size={14} />
                                </a>
                                <a
                                    href="https://mpesa.vm.co.mz"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 p-2 rounded-xl bg-slate-50 dark:bg-brand-950 transition-all"
                                >
                                    M-Pesa Moçambique <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
