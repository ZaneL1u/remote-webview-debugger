import type { projects as en } from '../en/projects'

export const projects: typeof en = {
  title: 'Projetos',
  name: 'Nome do projeto',
  newProject: 'Novo projeto',
  optional: '(opcional)',
  onlineCount: (online, total) => `<n>${online}</n> online / ${total} ${total === 1 ? 'dispositivo' : 'dispositivos'}`,

  list: {
    description:
      'Cada projeto é um app ou site, com sua própria chave do app, política de acesso e convites. Todos os dispositivos aparecem na página Dispositivos.',
    emptyTitle: 'Ainda não há projetos',
    emptyManage: 'Crie um projeto para obter uma chave do app e o código de integração pronto. Seu primeiro dispositivo pode ficar online em minutos.',
    emptyMember: 'Os projetos aparecem aqui assim que um administrador os criar.',
  },

  create: {
    description: 'Criar um projeto gera uma chave do app (rwd_pk_…) e o código de integração.',
    nameRequired: 'Digite um nome para o projeto',
    invalidOrigins: (bad) => `Origem inválida: ${bad.join(', ')}`,
    namePlaceholder: 'ex.: App da loja',
    originsLabel: 'Origens permitidas',
    originsHint: 'Uma por linha. Deixe em branco para permitir qualquer origem; quando definidas, só páginas dessas origens podem ficar online.',
    created: (name) => `Projeto “${name}” criado`,
  },

  detail: {
    notFoundTitle: 'Projeto não encontrado',
    notFoundDescription: 'Ele pode ter sido excluído.',
    backToList: 'Voltar para projetos',
    tabs: {
      integration: 'Integração',
      devices: 'Dispositivos',
      invites: 'Convites',
      audit: 'Log de auditoria',
      settings: 'Configurações',
    },
  },

  keys: {
    title: 'Chaves de API',
    pageDescription:
      'Para conectar agentes via MCP. As chaves pertencem ao gateway inteiro, não a um projeto: uma chave e um servidor MCP alcançam todos os dispositivos.',
    description:
      'Os agentes usam uma chave para se conectar via MCP. Uma chave vê todos os dispositivos do gateway, de todos os projetos. Mantenha as chaves em segredo e revogue na hora qualquer uma que vazar.',
    readOnly: ' Seu papel só permite ver as chaves; criar e revogar exige um administrador.',
    createKey: 'Criar chave',
    emptyTitle: 'Ainda não há chaves de API',
    emptyDescription: 'Crie uma chave e copie o comando de configuração do MCP para o seu agente.',

    columns: {
      name: 'Nome',
      key: 'Chave',
      level: 'Nível',
      expiry: 'Validade',
      ipAllowlist: 'IPs permitidos',
      lastUsed: 'Último uso',
      status: 'Status',
      actions: 'Ações',
    },
    createdOn: (date) => `Criada em ${date}`,
    neverUsed: 'Nunca usada',
    usedAgo: (ago) => `último uso ${ago}`,

    neverExpires: 'Nunca expira',
    expiresAtTitle: (date) => `Expira em ${date}`,
    expiredOn: (date) => `Expirou em ${date}`,
    expiresIn: (until) => `Expira ${until}`,
    anyIp: 'Qualquer IP',

    revoked: 'Revogada',
    revokedTitle: (date) => `Revogada em ${date}`,
    expired: 'Expirada',
    expiredTitle: (date) => `Expirou em ${date}`,
    active: 'Ativa',

    revoke: 'Revogar',
    revokedToast: (name) => `“${name}” revogada`,
    revokeTitle: (name) => `Revogar “${name}”?`,
    revokeDescription: (prefix) => `As sessões MCP que usam <c>${prefix}…</c> param de funcionar imediatamente. Não é possível desfazer.`,

    mcpTabs: {
      hosted: 'Hospedado',
      local: 'stdio local',
      json: 'Config. JSON',
    },
    hostedHint: 'O Claude Code se conecta direto ao MCP hospedado do gateway (Streamable HTTP), sem instalar nada:',
    localHint: 'Requer o comando <c>rwd</c> na sua máquina; ele encaminha o stdio para o /mcp hospedado:',
    jsonHint: 'Para outros clientes que leem um arquivo de configuração mcpServers:',

    createdTitle: 'Chave de API criada',
    createdName: (name) => name,
    showOnce:
      '<b>Esta é a única vez que a chave completa é exibida.</b> Depois de fechar, não será possível vê-la de novo, então copie agora e guarde em um lugar seguro. Se ela se perder, revogue e crie outra.',
    maxPrefix: 'Máx. ',
    keyLabel: 'Chave de API',
    commandLabel: 'Comando de configuração do MCP (com a chave)',
    savedClose: 'Já salvei, fechar',

    createTitle: 'Criar chave de API',
    createDescription: 'Dê um nome à chave para reconhecê-la e revogá-la depois, por exemplo o nome do agente ou do colega que vai usá-la.',
    nameRequired: 'Digite um nome',
    invalidCidrs: (bad) => `Entrada inválida na lista de IPs permitidos: ${bad.join(', ')} (use notação CIDR, por exemplo 203.0.113.0/24)`,
    namePlaceholder: 'ex.: Bot de suporte',
    maxLevel: 'Nível máximo de permissão',
    advancedWarning:
      '<b>Avançado pode executar qualquer JS na página do usuário e ler cookies e corpos de requisições</b>, o que equivale a ter a sessão logada do usuário nessa página. Dê esse nível só a agentes de confiança, junto com uma lista de IPs permitidos e uma validade curta.',
    levelHint: 'O nível efetivo também é limitado pelo nível máximo do projeto ao qual a página pertence; vale o mais restritivo.',
    neverWarning:
      'Uma chave que nunca expira continua válida se vazar, até que alguém a revogue. Prefira definir uma validade e crie uma nova chave antes que ela termine.',
    expiresAround: (date) => `Expira por volta de ${date}. Depois disso, o MCP retorna 401.`,
    ipHint:
      'Um CIDR por linha; um IP único conta como /32 (/128 para IPv6). Deixe em branco para não restringir; quando definido, chamadas MCP de outros IPs recebem 401.',

    guideTitle: 'Usar no seu agente',
    guideDescription: (placeholder) =>
      `Substitua <c>${placeholder}</c> nos comandos abaixo pela sua chave de API. Um servidor MCP alcança todos os dispositivos: um celular que abre páginas de projetos diferentes mantém o mesmo código do dispositivo. Veja o <link>guia de integração</link> para a lista completa de ferramentas, os níveis de permissão e o fluxo de aprovação.`,
    commonTools: 'Ferramentas comuns',
    tools: {
      list: 'Filtrar dispositivos por status, userId ou código do dispositivo',
      connect: 'Conectar-se a um dispositivo pelo código; se estiver offline, aguardar até ficar online',
      pages: 'Listar e alternar as páginas do dispositivo (p1, p2…)',
      snapshot: 'Obter um snapshot da página (com refs) ou uma captura de tela',
      act: 'Agir na página; a primeira ação muda a página para “IA no controle”',
      logs: 'Ver a saída do console, erros e requisições de rede',
      timeline: 'Linha do tempo entre páginas que refaz os passos do usuário',
      control: 'Depois que o usuário assume o controle, aguardar até que ele o devolva',
    },
    tryTitle: 'Experimente dizer isto ao seu agente',
    tryExample: '“Liste os dispositivos online, conecte-se ao GSJH-EV2J e descubra por que o total do checkout aparece como --”',
  },

  policy: {
    title: 'Política de acesso',
    description:
      'Controla se os agentes podem se conectar, o que podem fazer e o que podem ver. As alterações valem na hora para novas conexões; as sessões existentes mantêm o nível que tinham.',
    readOnly: 'Seu papel só permite ver a política de acesso; alterá-la exige um administrador ou proprietário.',
    saved: 'Política de acesso salva. Ela vale na hora para novas conexões.',
    invalid: 'Algumas configurações são inválidas. Verifique os campos marcados em vermelho.',
    invalidSelectors: (bad) => `Seletor CSS inválido: ${bad.join(', ')}`,
    nameRequired: 'Digite um nome',
    duplicateName: 'Nome duplicado',
    intRange: (min, max) => `Digite um número inteiro de ${min} a ${max}`,
    invalidUrl: 'Deve começar com http:// ou https://',

    approval: {
      title: 'Aprovação de conexão',
      description:
        'Define se o usuário precisa aprovar no dispositivo quando um agente se conecta com um código do dispositivo. O aviso só responde a toques reais do usuário; um agente não pode tocar nele no lugar do usuário.',
      prompt: 'Perguntar ao usuário (recomendado)',
      promptDescription:
        'A página em primeiro plano mostra um aviso, e o agente só se conecta depois que o usuário escolhe um nível a permitir. Sem resposta em 30 segundos, conta como negação. Depois de 3 negações seguidas para a mesma chave, os avisos ficam pausados por 10 minutos.',
      none: 'Sem aprovação',
      noneDescription: 'Qualquer agente que saiba o código do dispositivo pode se conectar direto. Somente para ambientes de teste internos.',
    },

    maxLevel: {
      title: 'Nível máximo de permissão',
      description:
        'O nível mais alto que este projeto permite. Uma conexão recebe o menor de quatro: o que o agente pede, o que a chave de API dele permite, o que está definido aqui e o que o usuário aprova.',
      advancedWarning:
        'Avançado permite que os agentes executem qualquer JS e leiam cookies e corpos de requisições, o que equivale à sessão logada do usuário na página. Ative só quando for realmente necessário.',
    },

    masking: {
      title: 'Máscara de privacidade',
      description:
        'Campos de senha e elementos com o atributo data-rwd-mask sempre aparecem como •••• em snapshots, capturas de tela, console e logs de rede. Adicione mais regras de máscara aqui.',
      selectorsLabel: 'Elementos mascarados (seletores CSS)',
      selectorsHint: 'Um por linha, por exemplo .user-phone, #id-card.',
      patternsTitle: 'Mascarar texto por regex',
      patternsDescription:
        'O texto correspondente é substituído por •••• em snapshots, no console e em URLs de rede. Bom para números de telefone ou de documentos que aparecem em texto simples. Usa a sintaxe RE2 (sem lookaround nem referências retroativas).',
      patternsList: 'Padrões de máscara',
      ruleName: (n) => `Nome da regra ${n}`,
      ruleRegex: (n) => `Regex da regra ${n}`,
      removeRule: (n) => `Excluir regra ${n}`,
      namePlaceholder: 'Nome',
      regexPlaceholder: 'Regex, ex.: 1[3-9]\\d{9}',
      addRule: 'Adicionar regra',
      presets: 'Predefinições:',
      tryLabel: 'Teste: digite um texto de exemplo para ver a máscara',
      sample: 'Maria Silva 13812345678 maria@example.com ID 11010119900307123X',
    },

    confirm: {
      title: 'Confirmar ações sensíveis',
      description:
        'Antes que um agente clique nesses elementos (ou pressione Enter no formulário deles), a página pede a confirmação do usuário; sem confirmação em 30 segundos, conta como negação. Elementos com o atributo data-rwd-confirm sempre precisam de confirmação.',
      label: 'Elementos que precisam de confirmação (seletores CSS)',
      hint: 'Um por linha, por exemplo botões de pagar, excluir e fazer pedido.',
    },

    network: {
      title: 'Regras de exclusão de rede',
      description:
        'As requisições correspondentes ficam fora da lista de rede e da linha do tempo que os agentes veem (a página continua registrando; um agente pode passar includeExcluded para vê-las). Bom para fontes que sempre dão 404 e beacons de analytics. As regras passadas a run({ networkExclude }) na página são somadas a estas.',
      label: 'Requisições excluídas',
      hint: 'Uma por linha: um trecho de URL (sem diferenciar maiúsculas de minúsculas), curingas * ou /regex/.',
    },

    sessionLog: {
      title: 'Log da sessão',
      description:
        'A partir de cada inicialização do app, as páginas registram navegações, toques e digitação do usuário, ações do agente, console e requisições de rede (as com falha, com corpos) no IndexedDB do celular. Um agente conectado pode ler tudo o que aconteceu antes de ele chegar. São mantidas as 3 últimas inicializações, com até 10 MB cada; as regras de máscara se aplicam.',
      label: 'Manter um log da sessão',
      hint: 'Quando desativado, as páginas param de registrar e excluem os logs que já estão no celular. Uma página também pode desativá-lo com run({ record: false }).',
    },

    help: {
      title: 'Botão de assistência',
      description:
        'Um botão flutuante “Solicitar assistência” no canto inferior direito da página. Quando o usuário toca nele, o dispositivo é marcado como “em atendimento” e vai para o topo da lista de dispositivos.',
      all: 'Todos os usuários',
      allDescription: 'Toda página com o SDK mostra o botão de assistência.',
      listed: 'Usuários específicos',
      listedDescription: 'Exibido só para os userIds listados abaixo. Bom para lançamentos graduais e testes beta.',
      off: 'Desativado',
      offDescription: 'Sem botão flutuante. O app pode chamar help() a partir da própria opção de assistência.',
      usersLabel: 'userIds permitidos',
      usersHint: 'Um por linha, igual ao userId passado para run() / setUser().',
      usersEmpty: 'Com a lista vazia, ninguém vê o botão de assistência.',
    },

    devtools: {
      title: 'DevTools',
      description: 'Administradores podem abrir o Chrome DevTools em páginas online pelos detalhes do dispositivo: Elements, Console, Network, armazenamento e execução de scripts.',
      allow: 'Permitir o DevTools',
      allowDescription: 'Só proprietários e administradores podem abrir. Com a aprovação de conexão ativada, ele conecta depois que o usuário concorda no dispositivo; uma aprovação vale pela duração máxima da sessão, e o usuário pode encerrar a qualquer momento. O DevTools vê a página como ela é: o mascaramento não se aplica a ele.',
    },
    eruda: {
      title: 'Integração com o eruda',
      description: 'Como o painel de depuração eruda na página funciona com o Remote Debugger. run({ eruda }) no código da página tem prioridade sobre estas configurações.',
      dock: 'Encaixar no eruda',
      dockDescription:
        'Adiciona uma aba “Remote Debugger” ao eruda no lugar do widget flutuante. Quando a IA se conecta, a barra de controle inferior continua aparecendo para que o usuário possa assumir o controle ou encerrar a qualquer momento.',
      load: 'Carregar automaticamente o eruda mais recente',
      loadDescription:
        'Se a página não tiver eruda, carrega a versão mais recente do jsDelivr e a inicializa para que os desenvolvedores vejam o console, a rede e o código-fonte. Recomendado só para projetos de ambiente de teste.',
    },

    limits: {
      title: 'Limites de tempo e cotas',
      minutes: 'min',
      devices: '',
      agents: '',
      idle: 'Tempo limite de IA ociosa',
      idleHint: 'Depois desse tempo sem nenhuma ação da IA, a página volta para “IA vendo” e a sobreposição é removida. Padrão: 2.',
      attach: 'Duração máxima da sessão',
      attachHint: 'O agente é desconectado automaticamente depois disso, caso ninguém encerre a sessão. Padrão: 60.',
      onlineDevices: 'Máximo de dispositivos online',
      onlineDevicesHint: 'Acima disso, novos dispositivos são recusados (código de fechamento 4429). 0 significa sem limite.',
      agentsLabel: 'Máximo de agentes simultâneos',
      agentsHint: 'Agentes conectados a dispositivos em todo o projeto ao mesmo tempo. 0 significa sem limite.',
    },

    invite: {
      title: 'Página de convite',
      description: 'Os links de convite abrem esta página por padrão (com o parâmetro rwd_invite adicionado automaticamente). A página precisa ter o SDK integrado.',
      label: 'URL H5 que os links de convite abrem',
      hint: 'Deixe em branco para informá-la toda vez que criar um convite.',
    },

    unsaved: 'Alterações não salvas',
    allSaved: 'Todas as alterações foram salvas',
    revert: 'Reverter',
    save: 'Salvar política',
  },

  settings: {
    renamed: 'Nome do projeto salvo',
    disabledToast: 'Projeto desativado',
    enabledToast: 'Projeto ativado',
    deleted: (name) => `Projeto “${name}” excluído`,
    general: 'Geral',
    meta: (date, id) => `Criado em ${date} · ID do projeto <c>${id}</c>`,
    disableTitle: 'Desativar projeto',
    disableDescription: 'Enquanto o projeto estiver desativado, as páginas que usam a chave do app dele não conseguem ficar online. Você pode reativá-lo a qualquer momento.',
    running: 'Ativo',
    deleteTitle: 'Excluir projeto',
    deleteDescription: 'A chave do app para de funcionar na hora e os convites do projeto são excluídos. Não é possível desfazer.',
    deleteConfirmTitle: (name) => `Excluir o projeto “${name}”?`,
    deleteConfirmDescription:
      'A chave do app e os convites serão excluídos, e as páginas que usam essa chave do app não poderão mais ficar online. Não é possível desfazer.',
  },
}
