export const CRISIS_KEYWORDS = [
  'me matar',
  'suicídio',
  'suicidio',
  'tirar minha vida',
  'acabar com tudo',
  'não quero mais viver',
  'nao quero mais viver',
  'melhor morta',
  'melhor sumir para sempre',
  'quero morrer',
  'vontade de morrer'
];

/**
 * Verifica se o texto contém palavras-chave que indicam risco iminente de vida.
 * Essa verificação é crucial para ativar o protocolo de emergência (ex: CVV 188)
 * e pausar a interação com a IA para não gerar falsos acolhimentos em situações críticas.
 */
export function containsCrisisKeywords(text: string | null | undefined): boolean {
  if (!text) return false;
  
  const normalizedText = text.toLowerCase().trim();
  
  // Verifica se alguma palavra de crise está contida no texto
  return CRISIS_KEYWORDS.some(keyword => normalizedText.includes(keyword));
}

/**
 * Função para mascarar dados sensíveis (LGPD) antes de enviá-los para a IA ou salvá-los
 * permanentemente em logs expostos.
 * Mascara: 
 * - CPFs (formato XXX.XXX.XXX-XX ou números seguidos)
 * - Números de telefone (10 a 11 dígitos numéricos com ou sem DDD/traços)
 */
export function maskSensitiveData(text: string | null | undefined): string {
  if (!text) return '';

  let maskedText = text;

  // Regex para CPF (com ou sem pontuação)
  const cpfRegex = /(?:\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})|(?:\d{11})/g;
  maskedText = maskedText.replace(cpfRegex, '[CPF PROTEGIDO]');

  // Regex para Telefones (ex: 11 98765-4321, 11987654321, (11) 98765-4321)
  // Exige no mínimo 10 dígitos agrupados de alguma forma
  const phoneRegex = /(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})-?(\d{4}))/g;
  
  // Para evitar falsos positivos com valores monetários ou anos, faremos um replace mais seguro
  // que procura padrões claros de telefone brasileiro.
  maskedText = maskedText.replace(phoneRegex, (match) => {
    // Se o match tiver menos de 8 caracteres numéricos, provável falso positivo
    const numbersOnly = match.replace(/\D/g, '');
    if (numbersOnly.length >= 8 && numbersOnly.length <= 13) {
      return '[TELEFONE PROTEGIDO]';
    }
    return match;
  });

  return maskedText;
}
