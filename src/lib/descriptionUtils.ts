export function cleanProductName(description?: string): string {
  if (!description) return '';
  // Take the first segment before any '||' separator which often separates metadata
  let name = description.split('||')[0];

  // List of known prefixes and error phrases to strip out
  const removals = [
    'Compra online',
    'Compra:',
    'Compra recusada:',
    'Credenciais E2Payments (Client ID/Secret) não configuradas.',
    'Compra recusada: Credenciais E2Payments (Client ID/Secret) não configuradas.',
    'Compra recusada: Pagamento não processado. Verifique os seus dados e tentar novamente.',
    'Pagamento não processado. Verifique os seus dados e tentar novamente.',
    'Saldo insuficiente. Por favor, verifique o saldo e tentar novamente.',
    'Erro processando o pagamento',
    'Erro de rede ao processar transação na E2Payments.: fetch failed',
    'Error: Internal Server Error',
    'Test insertion from anon key',
  ];

  for (const r of removals) {
    name = name.replaceAll(r, '');
  }

  // Remove generic fallback error patterns like "(Fallback/Erro: ...)"
  name = name.replace(/\(Fallback\/Erro:[^)]+\)/g, '');
  // Remove any remaining parentheses that contain the word "Erro"
  name = name.replace(/\([^)]*Erro[^)]*\)/gi, '');
  // Remove (Falhou: ...) and (Rejected: ...) suffixes
  name = name.replace(/\(Falhou:[^)]+\)/gi, '');
  name = name.replace(/\(Rejected:[^)]+\)/gi, '');

  // Strip any trailing delimiters and whitespace
  name = name.replace(/[-_:]+/g, ' ');
  // Split on common separators and keep the first non‑empty token
  const separators = [/\s{2,}/, /\s*\|\s*/, /\s*-\s*/, /\s*\(\s*/, /\s*\)\s*/];
  for (const sep of separators) {
    const parts = name.split(sep).map(p => p.trim()).filter(p => p);
    if (parts.length) {
      name = parts[0];
      break;
    }
  }

  return name.trim();
}
