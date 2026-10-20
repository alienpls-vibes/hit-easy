/**
 * Every text the visitor reads, grouped by section.
 *
 * To change a word on the site, change it here - the section files in
 * sections/ only decide the LAYOUT and read their texts from this object
 * (CONTENT.hero, CONTENT.features, ...). The key of each group is the name of
 * the section that uses it.
 *
 * Conventions:
 *   - links accept {app} (the app) and {privacy} (privacy policy) - see
 *     lib/links.js;
 *   - icons are names from lib/icons.js;
 *   - {name}-style placeholders inside a text are filled in by the section.
 */

export const CONTENT = {
  meta: {
    year: new Date().getFullYear(),
  },

  nav: {
    links: [
      { label: 'Recursos', href: 'index.html#recursos' },
      { label: 'Como funciona', href: 'index.html#como-funciona' },
      { label: 'Estatísticas', href: 'stats.html' },
      { label: 'Baixar', href: 'download.html' },
    ],
    signIn: 'Entrar',
    account: 'Minha conta',
    cta: { label: 'Baixar grátis', href: 'download.html' },
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
  },

  hero: {
    eyebrow: 'Contador de vida para Commander',
    title: 'Commander, do jeito simples.',
    text: 'Vida, dano de comandante, veneno e turnos num toque só. Cada partida vira estatística do seu deck, guardada na sua conta.',
    primary: { label: 'Baixar grátis', href: 'download.html' },
    secondary: { label: 'Abrir no navegador', href: '{app}' },
    badges: ['Funciona offline', 'Android, iPhone e computador', 'Sem loja de aplicativos'],
    // The table drawn in the phone illustration. Colors are WUBRG letters.
    mockup: {
      turn: 'Turno 7',
      players: [
        { name: 'Ana', life: 34, colors: ['G', 'U'], active: true },
        { name: 'Bruno', life: 21, colors: ['R'] },
        { name: 'Davi', life: 12, colors: ['B', 'R'] },
        { name: 'Carla', life: 40, colors: ['W', 'B'] },
      ],
    },
  },

  features: {
    eyebrow: 'Recursos',
    title: 'Feito para a mesa, não para o manual',
    text: 'Cada gesto foi pensado para quem está com as cartas na mão.',
    items: [
      {
        icon: 'touch',
        title: 'Um toque, um ponto',
        text: 'Toque na borda para tirar ou somar vida. Segure e o número corre, acelerando. Toques seguidos viram um registro só.',
      },
      {
        icon: 'sword',
        title: 'Arraste para atacar',
        text: 'Arraste do atacante até o alvo e o dano já fica com autor. É assim que o app sabe quem bateu em quem.',
      },
      {
        icon: 'skull',
        title: 'Eliminação automática',
        text: 'Vida zerada, 21 de dano do mesmo comandante ou 10 de veneno: o app percebe e anuncia o vencedor.',
      },
      {
        icon: 'drop',
        title: 'Dano em área e drenar',
        text: 'Dois toques no centro: dano a todos, só aos oponentes ou drenar, ganhando o total ou o mesmo valor de cada um.',
      },
      {
        icon: 'clock',
        title: 'Turnos com relógio honesto',
        text: 'O relógio pausa sozinho quando ninguém está na mesa. Uma ida ao banheiro não vira o turno mais longo da noite.',
      },
      {
        icon: 'vote',
        title: 'Votações secretas',
        text: 'Para cartas de votação, cada um escolhe sem ver a escolha dos outros, passando o aparelho de mão em mão.',
      },
      {
        icon: 'layers',
        title: 'Contador de mana',
        text: 'Mana flutuante por cor, que zera ao passar o turno e avisa quando ainda sobrou alguma.',
      },
      {
        icon: 'offline',
        title: 'Funciona sem internet',
        text: 'Depois de aberto uma vez, o app roda offline. Mesa de Commander acontece em qualquer lugar.',
      },
      {
        icon: 'users',
        title: 'Partidas compartilhadas',
        text: 'Marque os amigos pelo @. A partida chega para eles como convite e entra no histórico de cada um.',
      },
    ],
  },

  how: {
    eyebrow: 'Como funciona',
    title: 'Da mesa às estatísticas em três passos',
    steps: [
      {
        title: 'Monte a mesa',
        text: 'De 2 a 6 jogadores. Escolha quem joga e o comandante de cada um: os decks que a pessoa já trouxe aparecem primeiro.',
      },
      {
        title: 'Jogue',
        text: 'O painel inteiro é área de gesto. O círculo central passa o turno, desfaz e abre o menu.',
      },
      {
        title: 'Veja os números',
        text: 'Taxa de vitória por deck e por jogador, dano causado e recebido, colocação média, rivalidades e a linha do tempo de cada partida.',
      },
    ],
  },

  'stats-teaser': {
    eyebrow: 'Estatísticas',
    title: 'Seu histórico em qualquer aparelho',
    text: 'Com uma conta, as partidas sobem para a nuvem quando terminam e aparecem no celular, no tablet e aqui no site.',
    bullets: [
      'Taxa de vitória de cada deck',
      'Rivalidades: quem bate mais em quem',
      'Como você costuma vencer',
    ],
    primary: { label: 'Criar conta grátis', href: 'account.html#criar' },
    secondary: { label: 'Ver minhas estatísticas', href: 'stats.html' },
    note: 'Criar a conta e registrar partidas é grátis. O histórico completo faz parte do acesso às estatísticas, que durante os testes é liberado manualmente.',
    // The illustration. Numbers are made up, hence the "exemplo" tag.
    sample: {
      tag: 'Exemplo',
      title: 'Seus decks',
      decks: [
        { name: 'Atraxa, Praetors\' Voice', colors: ['W', 'U', 'B', 'G'], winrate: 0.62, games: 21 },
        { name: 'Krenko, Mob Boss', colors: ['R'], winrate: 0.48, games: 25 },
        { name: 'Yuriko, the Tiger\'s Shadow', colors: ['U', 'B'], winrate: 0.35, games: 17 },
      ],
      kpis: [
        { label: 'Partidas', value: '63' },
        { label: 'Vitórias', value: '31' },
        { label: 'Colocação', value: '1,9º' },
      ],
    },
  },

  install: {
    eyebrow: 'Baixar',
    title: 'Instale em segundos',
    text: 'O Hit Easy é um app web: instala direto do navegador, sem loja e sem ocupar espaço, e se atualiza sozinho.',
    detected: 'Para o seu aparelho',
    others: 'Outros aparelhos',
    tabs: { android: 'Android', ios: 'iPhone e iPad', desktop: 'Computador' },
    installButton: 'Instalar o Hit Easy',
    installed: 'Pronto! O Hit Easy está na sua tela inicial.',
    dismissed: 'Instalação cancelada. Dá para instalar quando quiser.',
    standalone: 'Você já está usando o app instalado.',
    openApp: 'Abrir o app',
    copyLink: 'Copiar link',
    copied: 'Link copiado',
    copyFailed: 'Não deu para copiar. Segure o endereço na barra para copiar.',
    // Steps per device and browser (see lib/platform.js for the keys). When an
    // exact combination is missing, the section falls back to `${os}-default`.
    guides: {
      'ios-safari': {
        title: 'iPhone e iPad, no Safari',
        action: 'open-app',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'share', text: 'Na barra do Safari, toque no botão Compartilhar.' },
          { icon: 'plusSquare', text: 'Escolha "Adicionar à Tela de Início". Se não aparecer, role a lista para baixo.' },
          { icon: 'check', text: 'Toque em "Adicionar". O ícone do Hit Easy aparece na tela inicial.' },
        ],
      },
      'ios-default': {
        title: 'iPhone e iPad, no Chrome, Edge ou Firefox',
        action: 'open-app',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'share', text: 'Toque no botão Compartilhar, ao lado da barra de endereço.' },
          { icon: 'plusSquare', text: 'Escolha "Adicionar à Tela de Início".' },
          { icon: 'check', text: 'Confirme em "Adicionar".' },
        ],
        note: 'Precisa do iOS 16.4 ou mais novo. Em versões anteriores, abra este site no Safari.',
      },
      'ios-in-app': {
        title: 'Você está dentro de outro aplicativo',
        action: 'copy-link',
        steps: [
          { icon: 'copy', text: 'Toque em "Copiar link".' },
          { icon: 'external', text: 'Abra o Safari e cole o link na barra de endereço.' },
          { icon: 'share', text: 'No app, toque em Compartilhar e em "Adicionar à Tela de Início".' },
        ],
        note: 'Navegadores dentro do Instagram, Facebook e similares não instalam apps.',
      },
      'android-chrome': {
        title: 'Android, no Chrome',
        action: 'prompt',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'dots', text: 'Toque no menu ⋮, no canto superior direito.' },
          { icon: 'install', text: 'Escolha "Instalar app" ou "Adicionar à tela inicial".' },
          { icon: 'check', text: 'Confirme em "Instalar".' },
        ],
      },
      'android-samsung': {
        title: 'Android, no Samsung Internet',
        action: 'prompt',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'menu', text: 'Toque no menu ☰, na barra de baixo.' },
          { icon: 'plusSquare', text: 'Escolha "Adicionar página a" e depois "Tela inicial".' },
          { icon: 'check', text: 'Confirme em "Adicionar".' },
        ],
      },
      'android-firefox': {
        title: 'Android, no Firefox',
        action: 'open-app',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'dots', text: 'Toque no menu ⋮.' },
          { icon: 'install', text: 'Escolha "Instalar" ou "Adicionar à tela inicial".' },
        ],
      },
      'android-in-app': {
        title: 'Você está dentro de outro aplicativo',
        action: 'copy-link',
        steps: [
          { icon: 'copy', text: 'Toque em "Copiar link".' },
          { icon: 'external', text: 'Abra o Chrome e cole o link na barra de endereço.' },
          { icon: 'install', text: 'No menu ⋮, escolha "Instalar app".' },
        ],
        note: 'Navegadores dentro do Instagram, Facebook e similares não instalam apps.',
      },
      'android-default': {
        title: 'Android',
        action: 'prompt',
        steps: [
          { icon: 'external', text: 'Toque em "Abrir o app" aqui embaixo.' },
          { icon: 'dots', text: 'Abra o menu do navegador.' },
          { icon: 'install', text: 'Escolha "Instalar app" ou "Adicionar à tela inicial".' },
        ],
      },
      'desktop-safari': {
        title: 'Mac, no Safari',
        action: 'open-app',
        steps: [
          { icon: 'external', text: 'Clique em "Abrir o app" aqui embaixo.' },
          { icon: 'share', text: 'No menu Arquivo, escolha "Adicionar ao Dock".' },
          { icon: 'check', text: 'Confirme em "Adicionar".' },
        ],
        note: 'Precisa do macOS Sonoma ou mais novo.',
      },
      'desktop-firefox': {
        title: 'Computador, no Firefox',
        action: 'open-app',
        steps: [
          { icon: 'external', text: 'Clique em "Abrir o app": ele funciona direto no navegador.' },
          { icon: 'monitor', text: 'Para instalar como aplicativo, abra o site no Chrome ou no Edge.' },
        ],
      },
      'desktop-default': {
        title: 'Computador, no Chrome ou Edge',
        action: 'prompt',
        steps: [
          { icon: 'external', text: 'Clique em "Abrir o app" aqui embaixo.' },
          { icon: 'install', text: 'Na barra de endereço, clique no ícone de instalar, à direita.' },
          { icon: 'check', text: 'Confirme em "Instalar". O Hit Easy abre numa janela própria.' },
        ],
        note: 'O app foi feito para tablet e celular no meio da mesa, mas funciona no computador também.',
      },
    },
    // Which guide each tab shows when the visitor picks another device.
    tabGuides: { android: 'android-chrome', ios: 'ios-safari', desktop: 'desktop-default' },
  },

  faq: {
    eyebrow: 'Dúvidas',
    title: 'Perguntas frequentes',
    items: [
      {
        q: 'Quanto custa?',
        a: 'Jogar, registrar partidas e criar a conta é grátis. O histórico completo de estatísticas na nuvem faz parte do acesso premium; durante os testes, esse acesso é liberado manualmente, conta por conta.',
      },
      {
        q: 'Preciso baixar de uma loja de aplicativos?',
        a: 'Não. O Hit Easy é um app web (PWA): instala direto pelo navegador, ocupa pouco espaço e se atualiza sozinho.',
      },
      {
        q: 'Funciona sem internet?',
        a: 'Sim. Depois de aberto uma vez, a mesa funciona offline. A internet só é usada para buscar comandantes novos e sincronizar a conta.',
      },
      {
        q: 'Funciona no iPhone?',
        a: 'Sim: no Safari e também no Chrome e no Edge a partir do iOS 16.4. A instalação é pelo botão Compartilhar, em "Adicionar à Tela de Início".',
      },
      {
        q: 'Minhas partidas passam de um aparelho para outro?',
        a: 'Com a conta conectada, sim: as partidas sobem para a nuvem quando terminam. Sem conta, cada aparelho guarda o próprio histórico, e dá para exportar e importar um arquivo.',
      },
      {
        q: 'Como meus amigos entram nas estatísticas?',
        a: 'Cada pessoa cria a conta e escolhe um @. Quem monta a mesa marca o @ de cada um; a partida chega para eles como convite e só entra no histórico de quem aceitar.',
      },
      {
        q: 'O que vocês fazem com os meus dados?',
        a: 'Guardamos só o necessário para o app funcionar. Os detalhes estão na política de privacidade.',
        link: { label: 'Ler a política de privacidade', href: '{privacy}' },
      },
    ],
  },

  cta: {
    title: 'Leve para a próxima mesa',
    text: 'Grátis, sem cadastro obrigatório e pronto em segundos.',
    primary: { label: 'Baixar grátis', href: 'download.html' },
    secondary: { label: 'Abrir no navegador', href: '{app}' },
  },

  footer: {
    text: 'Contador de vida para mesas de Commander.',
    columns: [
      {
        title: 'App',
        links: [
          { label: 'Abrir o app', href: '{app}' },
          { label: 'Baixar', href: 'download.html' },
          { label: 'Recursos', href: 'index.html#recursos' },
        ],
      },
      {
        title: 'Conta',
        links: [
          { label: 'Criar conta', href: 'account.html#criar' },
          { label: 'Entrar', href: 'account.html' },
          { label: 'Estatísticas', href: 'stats.html' },
        ],
      },
      {
        title: 'Sobre',
        links: [
          { label: 'Privacidade', href: '{privacy}' },
          { label: 'Perguntas frequentes', href: 'index.html#perguntas' },
        ],
      },
    ],
    contact: 'Contato',
    legal: 'O Hit Easy é um projeto independente, sem vínculo com a Wizards of the Coast. Magic: The Gathering é marca da Wizards of the Coast.',
    copyright: '© {year} Hit Easy',
  },

  account: {
    title: 'Sua conta Hit Easy',
    text: 'A mesma conta do app. Com ela, suas partidas ficam guardadas e seus amigos podem marcar você pelo @.',
    loading: 'Carregando sua conta…',
    cloudOff: 'As contas ainda não estão disponíveis.',
    tabs: { signUp: 'Criar conta', signIn: 'Entrar' },
    email: 'E-mail',
    password: 'Senha',
    passwordHint: 'Pelo menos 8 caracteres',
    show: 'Mostrar',
    hide: 'Ocultar',
    signUpSubmit: 'Criar conta',
    signInSubmit: 'Entrar',
    forgot: 'Esqueci minha senha',
    google: 'Continuar com Google',
    apple: 'Continuar com Apple',
    or: 'ou',
    working: 'Aguarde…',
    terms: 'Ao criar a conta, você concorda com a {link}.',
    termsLink: 'política de privacidade',
    checkInboxTitle: 'Confira seu e-mail',
    checkInboxText: 'Enviamos um link de confirmação para {email}. Abra o link para concluir o cadastro.',
    backToForm: 'Voltar',
    resetSent: 'Se existir uma conta com {email}, enviamos um link para criar uma nova senha.',
    forgotNeedsEmail: 'Digite seu e-mail no campo acima e toque de novo em "Esqueci minha senha".',
    errors: {
      invalid_credentials: 'E-mail ou senha incorretos.',
      user_already_exists: 'Já existe uma conta com esse e-mail. Use "Entrar".',
      email_exists: 'Já existe uma conta com esse e-mail. Use "Entrar".',
      email_not_confirmed: 'Confirme o e-mail antes de entrar: procure o link na sua caixa de entrada.',
      weak_password: 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.',
      email_address_invalid: 'Esse e-mail não parece válido.',
      validation_failed: 'Confira o e-mail e a senha.',
      over_email_send_rate_limit: 'Muitos e-mails em pouco tempo. Espere alguns minutos e tente de novo.',
      over_request_rate_limit: 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.',
      signup_disabled: 'Novos cadastros estão fechados no momento.',
      network: 'Sem conexão com o servidor. Confira a internet e tente de novo.',
      shortPassword: 'A senha precisa de pelo menos 8 caracteres.',
      badEmail: 'Digite um e-mail válido.',
      generic: 'Algo deu errado. Tente de novo.',
    },
    recovery: {
      title: 'Crie uma nova senha',
      text: 'Escolha a senha que vai usar daqui em diante, no app e no site.',
      submit: 'Salvar nova senha',
      done: 'Senha alterada. Você já está conectado.',
    },
    profile: {
      hello: 'Olá, {name}',
      signedInAs: 'Conectado como {email}',
      handleTitle: 'Seu @',
      handleText: 'É como seus amigos marcam você na mesa, para a partida entrar no seu histórico.',
      handlePlaceholder: 'seu_nome',
      handleSave: 'Salvar @',
      handleRules: 'De 3 a 20 caracteres: letras minúsculas, números ou _.',
      handleFree: 'Disponível',
      handleTaken: 'Já está em uso',
      handleCurrent: 'É o seu @ atual',
      handleChecking: 'Conferindo…',
      handleInvalid: 'Use de 3 a 20 letras minúsculas, números ou _.',
      handleSaved: '@ salvo',
      handleTooSoon: 'O @ só pode ser trocado a cada 15 dias. Libera em {date}.',
      handleChangeInApp: 'Para trocar o @, use o app: Configurações, Conta.',
      nameTitle: 'Nome nas partidas',
      nameText: 'Como você aparece para os amigos. Em branco, aparece o @.',
      namePlaceholder: 'Como a mesa chama você',
      nameSave: 'Salvar nome',
      nameSaved: 'Nome salvo',
      accessTitle: 'Acesso às estatísticas',
      accessOn: 'Liberado',
      accessOff: 'Ainda não liberado',
      accessUntil: 'Válido até {date}',
      accessOffText: 'Suas partidas continuam sendo guardadas. Durante os testes, o acesso é liberado manualmente, conta por conta.',
      recheck: 'Já tenho acesso, conferir',
      stillLocked: 'Ainda não consta acesso para esta conta.',
      stats: 'Ver estatísticas',
      install: 'Instalar o app',
      openApp: 'Abrir o app',
      signOut: 'Sair',
      tip: 'Abrindo o app neste mesmo navegador, você já entra conectado.',
    },
  },

  stats: {
    title: 'Suas estatísticas',
    signedOutTitle: 'Entre para ver suas estatísticas',
    signedOutText: 'As estatísticas vêm das partidas guardadas na sua conta.',
    signedOutButton: 'Entrar ou criar conta',
    checking: 'Conferindo seu acesso…',
    loading: 'Carregando partidas…',
    lockedTitle: 'Estatísticas ficam na conta',
    lockedText: 'Suas partidas são guardadas com segurança assim que terminam. Com o acesso liberado, o histórico completo aparece em todos os seus aparelhos.',
    recheck: 'Já tenho acesso, conferir',
    stillLocked: 'Ainda não consta acesso para esta conta.',
    earlyAccess: 'Durante os testes, o acesso é liberado manualmente, um a um.',
    emptyTitle: 'Nenhuma partida na nuvem ainda',
    emptyText: 'Jogue no app com a conta conectada: cada partida sobe quando termina.',
    openApp: 'Abrir o app',
    noHandle: 'Escolha seu @ para sabermos quais partidas são suas.',
    noHandleButton: 'Escolher @',
    notFound: 'Seu @ ainda não aparece em nenhuma partida. Peça para quem monta a mesa marcar você pelo @. Enquanto isso, veja o resumo de todas as partidas da conta.',
    error: 'Não foi possível carregar as partidas. Confira a internet e tente de novo.',
    retry: 'Tentar de novo',
    refresh: 'Atualizar',
    kpis: {
      games: 'Partidas',
      wins: 'Vitórias',
      winrate: 'Taxa de vitória',
      avgPlace: 'Colocação média',
      avgDamage: 'Dano por partida',
      kills: 'Eliminações',
      avgTurn: 'Tempo médio de turno',
      avgMatch: 'Duração média',
    },
    decksTitle: 'Seus decks',
    decksText: 'Seu desempenho com cada comandante.',
    playersTitle: 'Jogadores',
    playersText: 'Todos que aparecem nas partidas da conta.',
    gamesOne: '1 partida',
    gamesMany: '{n} partidas',
    avgPlace: '{n}º em média',
    rivalsTitle: 'Com quem você mais joga',
    rivalsText: 'Partidas juntos e quem terminou na frente.',
    rivalScore: 'Você {a} × {b}',
    recentTitle: 'Últimas partidas',
    place: '{n}º lugar',
    youWon: 'Você venceu',
    winner: 'Venceu: {name}',
    noWinner: 'Sem vencedor',
    players: '{n} jogadores',
    moreInApp: 'A linha do tempo de cada partida, as votações e as rivalidades completas estão no app.',
    openAppStats: 'Abrir no app',
  },
};
