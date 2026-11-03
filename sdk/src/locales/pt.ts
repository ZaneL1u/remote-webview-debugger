import type { ActionMessages, AgentMessages, Locale, UiMessages } from '../i18n'

// Português do Brasil (também usado como fallback para pt-PT).

const ui: UiMessages = {
  levels: {
    observe: 'Apenas visualizar',
    interact: 'Visualizar e interagir',
    advanced: 'Avançado (executar scripts, ler armazenamento)',
  },
  attachLevels: {
    observe: 'Apenas visualizar',
    interact: 'Visualizar e interagir',
    advanced: 'Avançado (também executar scripts, ler armazenamento)',
  },
  state: {
    none: 'Inativo: nenhuma IA conectada',
    observe: 'A IA está vendo esta página',
    agent: 'A IA está no controle; seus toques estão pausados',
    user: 'Você assumiu o controle; a IA está pausada',
  },
  link: {
    connecting: 'Conectando',
    online: 'Online',
    offline: 'Offline',
  },
  connecting: 'Conectando…',
  helpPending: 'Ajuda solicitada',
  copy: 'Copiar',
  copied: 'Copiado',
  noteHelp: 'Ajuda solicitada. O desenvolvedor vai encontrar você por este código do dispositivo.',
  noteAuto:
    'Permissão automática ativada: a IA se conecta sem perguntar. Você pode assumir o controle ou encerrar a qualquer momento.',
  noteShare:
    'Envie este código do dispositivo para o desenvolvedor. A IA pede sua permissão antes de se conectar, e você pode assumir o controle ou encerrar a qualquer momento.',
  help: 'Pedir ajuda',
  cancelHelp: 'Cancelar ajuda',
  collapse: 'Ocultar',
  deviceCode: 'Código do dispositivo',
  barViewing: 'IA vendo',
  barAgent: 'IA operando',
  barUser: 'Sua vez',
  connectedFor: time => `Conectado · ${time}`,
  takeover: 'Assumir',
  handback: 'Devolver à IA',
  end: 'Encerrar',
  autoTitle: 'Permitir a IA automaticamente',
  autoOn: level => `Conecta sem perguntar · ${level}`,
  autoOff: 'Perguntar sempre que a IA quiser se conectar',
  lockTitle: 'Bloquear a tela com a IA conectada',
  lockOn: 'Seus toques e deslizes ficam bloqueados enquanto a IA estiver conectada',
  lockOff: 'Você ainda pode tocar e rolar; tente não atrapalhar a IA',
  lockedToast: 'A tela será bloqueada enquanto a IA estiver conectada',
  unlockedToast: 'A tela não será bloqueada enquanto a IA estiver conectada',
  autoOffToast: 'Permissão automática desativada. A IA vai pedir antes de se conectar',
  autoDialogTitle: 'Ativar a permissão automática?',
  autoDialogText:
    'Quando a IA pedir para se conectar a este dispositivo, ela se conecta na hora com o acesso que você escolher abaixo. Você verá um aviso toda vez, pode assumir o controle ou encerrar a qualquer momento e pode desativar isso aqui.',
  turnOn: 'Ativar',
  cancel: 'Cancelar',
  autoOnToast: level => `Permissão automática ativada · ${level}`,
  countdown: seconds => `Negado automaticamente em ${seconds} s`,

  agentName: 'Assistente de IA',
  autoAllowedToast: (agent, level) => `“${agent}” permitido automaticamente · ${level}`,
  attachTitle: 'A IA quer se conectar',
  attachText: agent => `“${agent}” quer ver esta página. Permitir?`,
  confirmTitle: 'Confirme, por favor',
  confirmText: action => `A IA quer ${action}. Permitir?`,
  allow: 'Permitir',
  deny: 'Negar',
}

const agent: AgentMessages = {
  missingParam: name => `Parâmetro ausente: ${name}`,
  notString: name => `O parâmetro ${name} deve ser uma string`,
  unknownMethod: method => `Método desconhecido: ${method}`,
  needLevel: level => `Requer o nível ${level}`,
  takenOver: 'O usuário assumiu o controle; aguarde até que ele o devolva',
  userDenied: 'O usuário negou esta ação',
  confirmBusy: 'Ainda aguardando o usuário confirmar a ação anterior',

  unknownModifier: m => `Tecla modificadora desconhecida: ${m}`,
  unknownKey: key => `Tecla desconhecida: ${key}`,

  refNotInSnapshot: ref => `ref=${ref} não está no snapshot mais recente; faça um novo snapshot`,
  refDetached: ref => `O elemento de ref=${ref} não está mais na página; faça um novo snapshot`,
  queryNeedsCriteria: 'É necessário pelo menos um de text, role ou name',
  noSuchRecord: seq => `Não há registro seq=${seq} no log da sessão (ele pode ter sido removido)`,
  noSuchSession: id => `Não há log da sessão ${id} neste dispositivo (só as 3 últimas inicializações são mantidas)`,
  noSessionLog:
    'Ainda não há log da sessão neste dispositivo (o projeto pode ter desativado a gravação, ou a página passou run({ record: false }))',
  sessionLogUnavailable: 'IndexedDB não está disponível nesta página: sem log da sessão',

  readOnly: tag => `${tag} é somente leitura`,
  isSelect: tag => `${tag} é uma lista suspensa; use rwd.select`,
  notFillable: tag => `${tag} não é um campo de texto e não pode ser preenchido`,
  notSelect: tag => `${tag} não é uma lista suspensa (select); use click`,
  singleSelect: 'Esta lista suspensa permite apenas uma opção',
  noSuchOption: (value, choices) => `A lista suspensa não tem a opção “${value}”; disponíveis: ${choices.join(', ')}`,
  optionDisabled: value => `A opção “${value}” está desativada`,

  badUrl: url => `URL inválida: ${url}`,
  httpOnly: 'Só é possível abrir URLs http(s)',
  textAppearTimeout: text => `Tempo esgotado aguardando o texto “${text}” aparecer`,
  textGoneTimeout: text => `Tempo esgotado aguardando o texto “${text}” desaparecer`,
  badFunction: message => `Não foi possível analisar function: ${message}`,
  notAFunction: 'function deve ser uma expressão de função, por exemplo "() => document.title"',

  elementDetached: tag => `O elemento ${tag} não está mais na página; faça um novo snapshot`,
  notActionable: (tag, reason) => `Não é possível operar o elemento ${tag}: ${reason}`,
  notVisible: tag => `O elemento ${tag} não está visível`,
  reasonMoving: 'a posição dele continua mudando (pode estar em animação)',
  reasonOffscreen: 'ele está fora da área visível (viewport)',
  reasonObscured: (tag, ref) =>
    `o ponto do clique está coberto por ${tag} (ref=${ref}; clique nele diretamente, por exemplo no fundo de um pop-up para fechá-lo)`,

  overlayHeader:
    '[Sobreposições] Estes elementos ficam por cima da página. Quando um clique for bloqueado, clique neles diretamente (por exemplo no fundo para fechar um pop-up):',
  overlayMask: (tag, coverage, ref) => `- fundo ${tag}, cobre ${coverage}% da viewport [ref=${ref}]`,
  overlayLayer: (tag, text, coverage, ref) =>
    `- camada ${tag}${text ? ` “${text}”` : ''}, cobre ${coverage}% da viewport [ref=${ref}]`,
  reasonHidden: 'ele não está visível',
  reasonDisabled: 'ele está desativado',

  storageUnavailable: area => `${area}Storage não está disponível`,
  badStorageArea: "O parâmetro area deve ser 'local', 'session' ou 'cookie'",

  requestFailed: 'A requisição falhou',
  noSuchRequest: id => `Nenhuma requisição com id=${id} (ela pode ter sido descartada)`,
  netFailed: (what, error) => `${what} → falhou (${error})`,
  wsFailed: url => `WebSocket ${url} → falhou`,

  tapped: (role, text) => `Tocou em ${role} “${text}”`,
  tappedTag: (role, tag) => `Tocou em ${role} ${tag}`,
  roles: {
    button: 'botão',
    link: 'link',
    textbox: 'campo de texto',
    searchbox: 'campo de busca',
    checkbox: 'caixa de seleção',
    radio: 'botão de opção',
    switch: 'chave',
    combobox: 'lista suspensa',
    listbox: 'lista',
    option: 'opção',
    tab: 'aba',
    menuitem: 'item de menu',
    img: 'imagem',
    heading: 'título',
    cell: 'célula',
    row: 'linha',
    listitem: 'item de lista',
  },
  element: 'elemento',
}

const action: ActionMessages = {
  quote: name => `“${name}”`,
  click: target => `tocar em ${target}`,
  enterActivate: target => `pressionar Enter em ${target}`,
  enterSubmit: target => `pressionar Enter para enviar ${target}`,
}

const pt: Locale = { id: 'pt', name: 'Português', dir: 'ltr', ui, action, agent }

export default pt
