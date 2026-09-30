import { VendasView } from './VendasView';
import { ProdutosView } from './ProdutosView';
import { AfiliadosView } from './AfiliadosView';
import { MercadoView } from './MercadoView';
import { SaqueView } from './SaqueView';

import { PagamentosView } from './PagamentosView';
import { PremiacoesView } from './PremiacoesView';
import { FerramentasView } from './FerramentasView';
import { AnalyticsView } from './AnalyticsView';
import { ConfiguracoesView } from './ConfiguracoesView';
import { B2CConfigView } from './B2CConfigView';
import { DocumentacaoView } from './DocumentacaoView';
import { ThankYouPage } from './ThankYouPage';
import type { User } from '@supabase/supabase-js';

export const Views = {
    Vendas: ({ user }: { user: User }) => <VendasView user={user} />,
    Produtos: () => <ProdutosView />,
    Afiliados: () => <AfiliadosView />,
    Mercado: () => <MercadoView />,

    Pagamentos: () => <PagamentosView />,
    Levantamentos: () => <SaqueView />,
    Premiações: () => <PremiacoesView />,
    Ferramentas: () => <FerramentasView />,
    Análise: () => <AnalyticsView />,
    Configuracoes: ({ onLogout }: { onLogout: () => void }) => <ConfiguracoesView onLogout={onLogout} />,
    Documentacao: () => <DocumentacaoView />,
    B2CConfig: () => <B2CConfigView />,
    // New thank‑you page after a successful purchase
    ThankYou: () => <ThankYouPage />,
};
