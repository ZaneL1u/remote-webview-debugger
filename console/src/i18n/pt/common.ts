import type { common as en } from '../en/common'

export const common: typeof en = {
  cancel: 'Cancelar',
  save: 'Salvar',
  create: 'Criar',
  delete: 'Excluir',
  close: 'Fechar',
  copy: 'Copiar',
  copied: 'Copiado para a área de transferência',
  copyFailed: 'Não foi possível copiar. Selecione o texto e copie manualmente.',
  retry: 'Tentar novamente',
  loadFailed: 'Não foi possível carregar',
  unknown: 'Desconhecido',
  disabled: 'Desativado',
  online: 'Online',
  offline: 'Offline',

  time: {
    justNow: 'agora mesmo',
    secondsAgo: (n) => `há ${n} s`,
    minutesAgo: (n) => `há ${n} min`,
    hoursAgo: (n) => `há ${n} h`,
    daysAgo: (n) => (n === 1 ? 'há 1 dia' : `há ${n} dias`),
    expired: 'Expirado',
    inMinutes: (n) => `em ${n} min`,
    inHours: (n) => `em ${n} h`,
    inDays: (n) => (n === 1 ? 'em 1 dia' : `em ${n} dias`),
    seconds: (n) => `${n} s`,
    minutes: (n) => `${n} min`,
    hoursMinutes: (h, m) => `${h} h ${m} min`,
    hours: (n) => `${n} h`,
    daysHours: (d, h) => `${d} d ${h} h`,
    days: (n) => (n === 1 ? '1 dia' : `${n} dias`),
  },

  unknownDevice: 'Dispositivo desconhecido',

  control: {
    none: 'Inativo',
    observe: 'IA observando',
    agent: 'IA no controle',
    user: 'Usuário assumiu',
  },

  roles: {
    owner: 'Proprietário',
    admin: 'Administrador',
    member: 'Membro',
  },
  roleDescriptions: {
    owner: 'Acesso total, incluindo convidar membros, alterar papéis e remover membros.',
    admin: 'Gerencia projetos, chaves de API, políticas de acesso, dispositivos e convites; vê o log de auditoria e a lista de membros.',
    member: 'Vê projetos e dispositivos; pode convidar usuários para se conectar, testar conexões, encerrar sessões e ver o log de auditoria.',
  },

  levels: {
    observe: {
      label: 'Apenas visualizar',
      description: 'Snapshots, capturas de tela, console, lista de requisições de rede, espera por texto. Não pode alterar a página.',
    },
    interact: {
      label: 'Visualizar e interagir',
      description: 'Tudo de Apenas visualizar, mais clicar, digitar, selecionar, rolar, arrastar, navegar, voltar e recarregar.',
    },
    advanced: {
      label: 'Avançado',
      description: 'Tudo de Visualizar e interagir, mais executar qualquer JS na página, ler cabeçalhos e corpos de requisições e localStorage / cookies.',
    },
  },
  levelTitle: (label, level, description) => `${label} (${level}): ${description}`,

  maskPresets: {
    phone: 'Número de celular (China)',
    idCard: 'Número de identidade (China)',
    bankCard: 'Número de cartão bancário',
    email: 'E-mail',
  },
  regex: {
    empty: 'Digite uma regex',
    matchesEmpty: 'Corresponde à string vazia, o que mascararia todo o texto',
    syntax: (detail) => `Regex inválida: ${detail}`,
    lookaround: 'Lookaround ((?=, (?!, (?<=, (?<!) não é suportado; o gateway usa a sintaxe RE2',
    backreference: 'Referências retroativas (\\1 etc.) não são suportadas; o gateway usa a sintaxe RE2',
  },

  badges: {
    help: 'Pedindo ajuda',
    agentWithName: (label, agent) => `${label} (${agent})`,
    waitingConfirmAction: 'Aguardando o usuário confirmar a ação',
    waitingConfirm: 'Aguardando a aprovação do usuário',
    waitingTitle: (agent) => `${agent} está aguardando o usuário aprovar no dispositivo`,
    invited: 'Convidado',
    invitedTitle: 'Conectado por um link de convite',
  },

  api: {
    network: 'Não foi possível acessar o gateway. Verifique sua rede.',
    unauthorized: 'Sua sessão expirou. Faça login novamente.',
    forbidden: 'Você não tem permissão para fazer isso.',
    notFound: 'Não encontrado',
    server: 'Erro no gateway. Tente novamente mais tarde.',
    failed: (status) => `A requisição falhou (HTTP ${status})`,
    unknown: 'Erro desconhecido',
    adminName: 'Administrador',
  },
}
