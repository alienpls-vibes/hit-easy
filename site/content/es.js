/**
 * Spanish texts. Only words live here: links, icons, colors and art come from
 * pt.js, and arrays line up with pt.js BY POSITION (see ../content.js). A
 * text left out shows in Portuguese.
 *
 * Wording follows the app's own Spanish (src/i18n/es.js): "tú", "partida",
 * "mazo", "Añadir a pantalla de inicio".
 */

export const CONTENT = {
  meta: {
    pages: {
      home: {
        title: 'Hit Easy · contador de vidas para Commander',
        description: 'Contador de vidas para mesas de Commander: vidas, daño de comandante, veneno y turnos con un toque, con estadísticas por mazo. Gratis, funciona sin internet y sin tienda de aplicaciones.',
      },
      download: {
        title: 'Descargar Hit Easy · Android, iPhone y ordenador',
        description: 'Instala Hit Easy directamente desde el navegador, sin tienda de aplicaciones: paso a paso para Android, iPhone, iPad y ordenador.',
      },
      account: {
        title: 'Tu cuenta · Hit Easy',
        description: 'Crea tu cuenta de Hit Easy o inicia sesión: tus partidas quedan guardadas y tus amigos te etiquetan por tu @.',
      },
      stats: {
        title: 'Tus estadísticas · Hit Easy',
        description: 'Porcentaje de victorias por mazo, puesto medio, rivales y últimas partidas, directamente de tu cuenta de Hit Easy.',
      },
    },
  },

  nav: {
    links: [
      { label: 'Funciones' },
      { label: 'Cómo funciona' },
      { label: 'Estadísticas' },
      { label: 'Descargar' },
    ],
    signIn: 'Entrar',
    account: 'Mi cuenta',
    cta: { label: 'Descargar gratis' },
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    menuLabel: 'Principal',
    language: 'Idioma',
  },

  hero: {
    eyebrow: 'Contador de vidas para Commander',
    title: 'Commander, fácil.',
    text: 'Vidas, daño de comandante, veneno y turnos con un solo toque. Cada partida se convierte en estadísticas de tu mazo, guardadas en tu cuenta.',
    primary: { label: 'Descargar gratis' },
    secondary: { label: 'Abrir en el navegador' },
    badges: ['Funciona sin internet', 'Android, iPhone y ordenador', 'Sin tienda de aplicaciones'],
    screenshot: {
      alt: 'Pantalla de la mesa de Hit Easy con cuatro jugadores: Ana con 34 vidas y su turno, Bruno con 21, Carla con 40 y Davi con 12, con 8 de daño de comandante. En el centro, el turno 7.',
    },
  },

  features: {
    eyebrow: 'Funciones',
    title: 'Hecho para la mesa, no para el manual',
    text: 'Cada gesto está pensado para quien tiene las cartas en la mano.',
    items: [
      {
        title: 'Un toque, un punto',
        text: 'Toca el borde para quitar o sumar vidas. Mantén pulsado y el número corre, cada vez más rápido. Los toques seguidos se guardan como uno solo.',
      },
      {
        title: 'Arrastra para atacar',
        text: 'Arrastra del atacante al objetivo y el daño queda con su autor. Así la app sabe quién golpeó a quién.',
      },
      {
        title: 'Eliminación automática',
        text: 'Vidas a cero, 21 de daño del mismo comandante o 10 de veneno: la app se da cuenta y anuncia al ganador.',
      },
      {
        title: 'Daño en área y drenar',
        text: 'Doble toque en el centro: daño a todos, solo a los rivales o drenar, ganando el total o lo mismo que perdió cada uno.',
      },
      {
        title: 'Turnos con un reloj honesto',
        text: 'El reloj se pausa solo cuando no hay nadie en la mesa. Ir al baño no se convierte en el turno más largo de la noche.',
      },
      {
        title: 'Votaciones secretas',
        text: 'Para las cartas de votación, cada uno elige sin ver lo que eligieron los demás, pasando el dispositivo de mano en mano.',
      },
      {
        title: 'Contador de maná',
        text: 'Maná flotante por color, que se vacía al pasar el turno y avisa cuando todavía queda algo.',
      },
      {
        title: 'Funciona sin internet',
        text: 'Una vez abierta, la app funciona sin conexión. Una mesa de Commander puede estar en cualquier sitio.',
      },
      {
        title: 'Partidas compartidas',
        text: 'Etiqueta a tus amigos por su @. La partida les llega como invitación y entra en el historial de cada uno.',
      },
    ],
  },

  how: {
    eyebrow: 'Cómo funciona',
    title: 'De la mesa a las estadísticas en tres pasos',
    steps: [
      {
        title: 'Prepara la mesa',
        text: 'De 2 a 6 jugadores. Elige quién juega y el comandante de cada uno: los mazos que esa persona ya trajo aparecen primero.',
      },
      {
        title: 'Juega',
        text: 'Todo el panel es zona de gestos. El círculo central pasa el turno, deshace y abre el menú.',
      },
      {
        title: 'Mira los números',
        text: 'Porcentaje de victorias por mazo y por jugador, daño hecho y recibido, puesto medio, rivalidades y la línea de tiempo de cada partida.',
      },
    ],
  },

  'stats-teaser': {
    eyebrow: 'Estadísticas',
    title: 'Tu historial en cualquier dispositivo',
    text: 'Con una cuenta, las partidas suben a la nube al terminar y aparecen en el móvil, en la tablet y aquí en la web.',
    bullets: [
      'Porcentaje de victorias de cada mazo',
      'Rivalidades: quién golpea más a quién',
      'Cómo sueles ganar',
    ],
    primary: { label: 'Crear cuenta gratis' },
    secondary: { label: 'Ver mis estadísticas' },
    note: 'Crear la cuenta y registrar partidas es gratis. El historial completo forma parte del acceso a las estadísticas, que durante las pruebas se concede a mano.',
    sample: {
      tag: 'Ejemplo',
      title: 'Tus mazos',
      gamesLabel: 'partidas',
      kpis: [
        { label: 'Partidas' },
        { label: 'Victorias' },
        { label: 'Puesto' },
      ],
    },
  },

  install: {
    eyebrow: 'Descargar',
    title: 'Instálalo en segundos',
    text: 'Hit Easy es una app web: se instala directamente desde el navegador, sin tienda y casi sin ocupar espacio, y se actualiza sola.',
    detected: 'Para tu dispositivo',
    others: 'Otros dispositivos',
    tabs: { android: 'Android', ios: 'iPhone y iPad', desktop: 'Ordenador' },
    installButton: 'Instalar Hit Easy',
    installed: '¡Listo! Hit Easy está en tu pantalla de inicio.',
    dismissed: 'Instalación cancelada. Puedes instalarlo cuando quieras.',
    standalone: 'Ya estás usando la app instalada.',
    openApp: 'Abrir la app',
    copyLink: 'Copiar enlace',
    copied: 'Enlace copiado',
    copyFailed: 'No se pudo copiar. Mantén pulsada la dirección en la barra para copiarla.',
    guides: {
      'ios-safari': {
        title: 'iPhone y iPad, en Safari',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Toca Compartir, el cuadrado con la flecha hacia arriba. En las versiones más nuevas de iOS está dentro del botón ••• de la barra.' },
          { text: 'Elige "Añadir a pantalla de inicio". Si no aparece, baja por la lista.' },
          { text: 'Toca "Añadir". El icono de Hit Easy aparece en la pantalla de inicio.' },
        ],
      },
      'ios-default': {
        title: 'iPhone y iPad, en Chrome, Edge o Firefox',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Toca el botón Compartir, junto a la barra de direcciones.' },
          { text: 'Elige "Añadir a pantalla de inicio".' },
          { text: 'Confirma con "Añadir".' },
        ],
        note: 'Necesita iOS 16.4 o posterior. En versiones anteriores, abre esta web en Safari.',
      },
      'ios-in-app': {
        title: 'Estás dentro de otra aplicación',
        steps: [
          { text: 'Toca "Copiar enlace".' },
          { text: 'Abre Safari y pega el enlace en la barra de direcciones.' },
          { text: 'En la app, toca Compartir y luego "Añadir a pantalla de inicio".' },
        ],
        note: 'Los navegadores dentro de Instagram, Facebook y similares no instalan apps.',
      },
      'android-chrome': {
        title: 'Android, en Chrome',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Toca el menú ⋮, arriba a la derecha.' },
          { text: 'Elige "Instalar aplicación" o "Añadir a pantalla de inicio".' },
          { text: 'Confirma con "Instalar".' },
        ],
      },
      'android-samsung': {
        title: 'Android, en Samsung Internet',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Toca el menú ☰, en la barra inferior.' },
          { text: 'Elige "Añadir página a" y luego "Pantalla de inicio".' },
          { text: 'Confirma con "Añadir".' },
        ],
      },
      'android-firefox': {
        title: 'Android, en Firefox',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Toca el menú ⋮.' },
          { text: 'Elige "Instalar" o "Añadir a pantalla de inicio".' },
        ],
      },
      'android-in-app': {
        title: 'Estás dentro de otra aplicación',
        steps: [
          { text: 'Toca "Copiar enlace".' },
          { text: 'Abre Chrome y pega el enlace en la barra de direcciones.' },
          { text: 'En el menú ⋮, elige "Instalar aplicación".' },
        ],
        note: 'Los navegadores dentro de Instagram, Facebook y similares no instalan apps.',
      },
      'android-default': {
        title: 'Android',
        steps: [
          { text: 'Toca "Abrir la app" aquí abajo.' },
          { text: 'Abre el menú del navegador.' },
          { text: 'Elige "Instalar aplicación" o "Añadir a pantalla de inicio".' },
        ],
      },
      'desktop-safari': {
        title: 'Mac, en Safari',
        steps: [
          { text: 'Haz clic en "Abrir la app" aquí abajo.' },
          { text: 'En el menú Archivo, elige "Añadir al Dock".' },
          { text: 'Confirma con "Añadir".' },
        ],
        note: 'Necesita macOS Sonoma o posterior.',
      },
      'desktop-firefox': {
        title: 'Ordenador, en Firefox',
        steps: [
          { text: 'Haz clic en "Abrir la app": funciona directamente en el navegador.' },
          { text: 'Para instalarlo como aplicación, abre la web en Chrome o Edge.' },
        ],
      },
      'desktop-default': {
        title: 'Ordenador, en Chrome o Edge',
        steps: [
          { text: 'Haz clic en "Abrir la app" aquí abajo.' },
          { text: 'En la barra de direcciones, haz clic en el icono de instalar, a la derecha.' },
          { text: 'Confirma con "Instalar". Hit Easy se abre en su propia ventana.' },
        ],
        note: 'La app está pensada para una tablet o un móvil en el centro de la mesa, pero también funciona en el ordenador.',
      },
    },
  },

  faq: {
    eyebrow: 'Dudas',
    title: 'Preguntas frecuentes',
    items: [
      {
        q: '¿Cuánto cuesta?',
        a: 'Jugar, registrar partidas y crear la cuenta es gratis. El historial completo de estadísticas en la nube forma parte del acceso premium; durante las pruebas, ese acceso se concede a mano, cuenta por cuenta.',
      },
      {
        q: '¿Tengo que descargarlo de una tienda de aplicaciones?',
        a: 'No. Hit Easy es una app web (PWA): se instala directamente desde el navegador, ocupa poco espacio y se actualiza sola.',
      },
      {
        q: '¿Funciona sin internet?',
        a: 'Sí. Una vez abierto, la mesa funciona sin conexión. Internet solo se usa para buscar comandantes nuevos y sincronizar la cuenta.',
      },
      {
        q: '¿Funciona en iPhone?',
        a: 'Sí: en Safari, y también en Chrome y Edge a partir de iOS 16.4. Se instala desde el botón Compartir, con "Añadir a pantalla de inicio".',
      },
      {
        q: '¿Mis partidas pasan de un dispositivo a otro?',
        a: 'Con la cuenta conectada, sí: las partidas suben a la nube al terminar. Sin cuenta, cada dispositivo guarda su propio historial, y puedes exportar e importar un archivo.',
      },
      {
        q: '¿Cómo entran mis amigos en las estadísticas?',
        a: 'Cada persona crea su cuenta y elige un @. Quien prepara la mesa etiqueta el @ de cada uno; la partida les llega como invitación y solo entra en el historial de quien la acepte.',
      },
      {
        q: '¿Qué hacéis con mis datos?',
        a: 'Guardamos solo lo necesario para que la app funcione. Los detalles están en la política de privacidad (en portugués).',
        link: { label: 'Leer la política de privacidad' },
      },
    ],
  },

  cta: {
    title: 'Llévalo a tu próxima mesa',
    text: 'Gratis, sin registro obligatorio y listo en segundos.',
    primary: { label: 'Descargar gratis' },
    secondary: { label: 'Abrir en el navegador' },
  },

  footer: {
    text: 'Contador de vidas para mesas de Commander.',
    columns: [
      {
        title: 'App',
        links: [{ label: 'Abrir la app' }, { label: 'Descargar' }, { label: 'Funciones' }],
      },
      {
        title: 'Cuenta',
        links: [{ label: 'Crear cuenta' }, { label: 'Entrar' }, { label: 'Estadísticas' }],
      },
      {
        title: 'Acerca de',
        links: [{ label: 'Privacidad' }, { label: 'Preguntas frecuentes' }],
      },
    ],
    contact: 'Contacto',
    legal: 'Hit Easy es un proyecto independiente, sin vínculo con Wizards of the Coast. Magic: The Gathering es una marca de Wizards of the Coast.',
  },

  account: {
    title: 'Tu cuenta de Hit Easy',
    text: 'La misma cuenta de la app. Con ella, tus partidas quedan guardadas y tus amigos pueden etiquetarte por tu @.',
    loading: 'Cargando tu cuenta…',
    cloudOff: 'Las cuentas todavía no están disponibles.',
    tabs: { signUp: 'Crear cuenta', signIn: 'Entrar' },
    email: 'Correo electrónico',
    password: 'Contraseña',
    passwordHint: 'Al menos 8 caracteres',
    show: 'Mostrar',
    hide: 'Ocultar',
    signUpSubmit: 'Crear cuenta',
    signInSubmit: 'Entrar',
    forgot: 'Olvidé mi contraseña',
    google: 'Continuar con Google',
    apple: 'Continuar con Apple',
    or: 'o',
    working: 'Espera…',
    terms: 'Al crear la cuenta, aceptas la {link}.',
    termsLink: 'política de privacidad',
    checkInboxTitle: 'Revisa tu correo',
    checkInboxText: 'Enviamos un enlace de confirmación a {email}. Ábrelo para terminar el registro.',
    backToForm: 'Volver',
    resetSent: 'Si existe una cuenta con {email}, enviamos un enlace para crear una contraseña nueva.',
    forgotNeedsEmail: 'Escribe tu correo en el campo de arriba y toca otra vez "Olvidé mi contraseña".',
    errors: {
      invalid_credentials: 'Correo o contraseña incorrectos.',
      user_already_exists: 'Ya existe una cuenta con ese correo. Usa "Entrar".',
      email_exists: 'Ya existe una cuenta con ese correo. Usa "Entrar".',
      email_not_confirmed: 'Confirma tu correo antes de entrar: busca el enlace en tu bandeja de entrada.',
      weak_password: 'Contraseña débil. Usa al menos 8 caracteres, mezclando letras y números.',
      email_address_invalid: 'Ese correo no parece válido.',
      validation_failed: 'Revisa el correo y la contraseña.',
      over_email_send_rate_limit: 'Demasiados correos en poco tiempo. Espera unos minutos y vuelve a intentarlo.',
      over_request_rate_limit: 'Demasiados intentos en poco tiempo. Espera unos minutos y vuelve a intentarlo.',
      signup_disabled: 'Los registros nuevos están cerrados por ahora.',
      network: 'Sin conexión con el servidor. Revisa tu internet y vuelve a intentarlo.',
      shortPassword: 'La contraseña necesita al menos 8 caracteres.',
      badEmail: 'Escribe un correo válido.',
      generic: 'Algo salió mal. Vuelve a intentarlo.',
    },
    recovery: {
      title: 'Crea una contraseña nueva',
      text: 'Elige la contraseña que usarás a partir de ahora, en la app y en la web.',
      submit: 'Guardar contraseña nueva',
      done: 'Contraseña cambiada. Ya has iniciado sesión.',
    },
    profile: {
      hello: 'Hola, {name}',
      signedInAs: 'Sesión iniciada como {email}',
      handleTitle: 'Tu @',
      handleText: 'Es como tus amigos te etiquetan en la mesa, para que la partida entre en tu historial.',
      handlePlaceholder: 'tu_nombre',
      handleSave: 'Guardar @',
      handleRules: 'De 3 a 20 caracteres: letras minúsculas, números o _.',
      handleFree: 'Disponible',
      handleTaken: 'Ya está en uso',
      handleCurrent: 'Es tu @ actual',
      handleChecking: 'Comprobando…',
      handleInvalid: 'Usa de 3 a 20 letras minúsculas, números o _.',
      handleSaved: '@ guardado',
      handleTooSoon: 'El @ solo se puede cambiar cada 15 días. Se desbloquea el {date}.',
      handleChangeInApp: 'Para cambiar tu @, usa la app: Ajustes, Cuenta.',
      nameTitle: 'Nombre en las partidas',
      nameText: 'Cómo te ven tus amigos. Si lo dejas en blanco, aparece tu @.',
      namePlaceholder: 'Cómo te llaman en la mesa',
      nameSave: 'Guardar nombre',
      nameSaved: 'Nombre guardado',
      accessTitle: 'Acceso a las estadísticas',
      accessOn: 'Concedido',
      accessOff: 'Todavía no concedido',
      accessUntil: 'Válido hasta el {date}',
      accessOffText: 'Tus partidas se siguen guardando. Durante las pruebas, el acceso se concede a mano, cuenta por cuenta.',
      recheck: 'Ya tengo acceso, comprobar',
      stillLocked: 'Todavía no hay acceso para esta cuenta.',
      stats: 'Ver estadísticas',
      install: 'Instalar la app',
      openApp: 'Abrir la app',
      signOut: 'Cerrar sesión',
      tip: 'Si abres la app en este mismo navegador, ya entras con la sesión iniciada.',
    },
  },

  stats: {
    title: 'Tus estadísticas',
    signedOutTitle: 'Entra para ver tus estadísticas',
    signedOutText: 'Las estadísticas salen de las partidas guardadas en tu cuenta.',
    signedOutButton: 'Entrar o crear cuenta',
    checking: 'Comprobando tu acceso…',
    loading: 'Cargando partidas…',
    lockedTitle: 'Las estadísticas viven en tu cuenta',
    lockedText: 'Tus partidas se guardan en cuanto terminan. Con el acceso concedido, el historial completo aparece en todos tus dispositivos.',
    recheck: 'Ya tengo acceso, comprobar',
    stillLocked: 'Todavía no hay acceso para esta cuenta.',
    earlyAccess: 'Durante las pruebas el acceso se concede a mano, uno a uno.',
    emptyTitle: 'Todavía no hay partidas en la nube',
    emptyText: 'Juega en la app con la cuenta conectada: cada partida sube al terminar.',
    openApp: 'Abrir la app',
    noHandle: 'Elige tu @ para saber qué partidas son tuyas.',
    noHandleButton: 'Elegir @',
    notFound: 'Tu @ todavía no aparece en ninguna partida. Pide a quien prepara la mesa que te etiquete por tu @. Mientras tanto, aquí tienes el resumen de todas las partidas de la cuenta.',
    error: 'No se pudieron cargar las partidas. Revisa tu internet y vuelve a intentarlo.',
    retry: 'Reintentar',
    refresh: 'Actualizar',
    kpis: {
      games: 'Partidas',
      wins: 'Victorias',
      winrate: 'Porcentaje de victorias',
      avgPlace: 'Puesto medio',
      avgDamage: 'Daño por partida',
      kills: 'Eliminaciones',
      avgTurn: 'Duración media del turno',
      avgMatch: 'Duración media',
    },
    decksTitle: 'Tus mazos',
    decksText: 'Tu rendimiento con cada comandante.',
    playersTitle: 'Jugadores',
    playersText: 'Todos los que aparecen en las partidas de la cuenta.',
    gamesOne: '1 partida',
    gamesMany: '{n} partidas',
    winsShort: '{n}V',
    placeValue: '{n}º',
    avgPlace: 'puesto medio {n}º',
    rivalsTitle: 'Con quién juegas más',
    rivalsText: 'Partidas juntos y quién terminó por delante.',
    rivalScore: 'Tú {a} × {b}',
    recentTitle: 'Últimas partidas',
    place: '{n}º puesto',
    youWon: 'Ganaste',
    winner: 'Ganó: {name}',
    noWinner: 'Sin ganador',
    players: '{n} jugadores',
    moreInApp: 'La línea de tiempo de cada partida, las votaciones y las rivalidades completas están en la app.',
    openAppStats: 'Abrir en la app',
  },
};
