/**
 * What changed in each version.
 *
 * Single source: this is both the repository changelog and the app's "what's
 * new" screen. A separate text file would drift from what the app shows the
 * first time someone was in a hurry - and wrong release notes are worse than
 * none.
 *
 * `type` is one of: 'new', 'fixed', 'changed'. The split matters because the
 * three tell users different things: one asks them to try something, one
 * apologizes, and the third warns that something that used to work now works
 * differently.
 *
 * SHORT and in every language. Each version says only its core - a title and
 * one to three items of one sentence each; the detail belongs in the commits.
 * The title and every item are `{ pt, en, es, de }`, shown in the app's
 * language: the notes used to be Portuguese only and long, and an English
 * speaker opening "what's new" got a wall of text in a language they did not
 * pick. `npm test` fails if a language is missing.
 *
 * The newest version comes first. check-syntax.js requires the current app
 * version to have an entry here - publishing without writing the notes breaks
 * the build.
 */

export const RELEASE_NOTES = [
  {
    version: '1.11.1',
    date: '2026-10-19',
    title: {
      pt: 'Aviso diário e resultado para compartilhar',
      en: 'Daily notice and a result to share',
      es: 'Aviso diario y resultado para compartir',
      de: 'Tägliche Nachricht und ein Ergebnis zum Teilen',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'A Cor do dia agora se chama Adivinhe as Cores, e dá para compartilhar o resultado no WhatsApp sem revelar a carta nem as cores.',
          en: 'Color of the day is now Guess the Colors, and you can share your result on WhatsApp without giving away the card or its colors.',
          es: 'El Color del día ahora se llama Adivina los Colores, y puedes compartir tu resultado en WhatsApp sin revelar la carta ni sus colores.',
          de: 'Farbe des Tages heißt jetzt Errate die Farben, und du kannst dein Ergebnis auf WhatsApp teilen, ohne Karte oder Farben zu verraten.',
        },
      },
      {
        type: 'fixed',
        text: {
          pt: 'O aviso de carta nova agora chega todo dia às 9h, se você ainda não tiver jogado. Antes ele quase nunca chegava.',
          en: 'The new card notice now comes every day at 9 am if you have not played yet. Before, it almost never came.',
          es: 'El aviso de carta nueva ahora llega cada día a las 9 h si todavía no has jugado. Antes casi nunca llegaba.',
          de: 'Die Nachricht zur neuen Karte kommt jetzt jeden Tag um 9 Uhr, wenn du noch nicht gespielt hast. Vorher kam sie fast nie.',
        },
      },
      {
        type: 'changed',
        text: {
          pt: 'A política de privacidade explica o que o aviso guarda no servidor, e desligar o aviso apaga esses dados.',
          en: 'The privacy policy explains what the notice keeps on the server, and turning the notice off deletes it.',
          es: 'La política de privacidad explica qué guarda el aviso en el servidor, y desactivar el aviso lo borra.',
          de: 'Die Datenschutzerklärung erklärt, was die Nachricht auf dem Server speichert, und Ausschalten löscht es.',
        },
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-10-16',
    title: {
      pt: 'Cor do dia',
      en: 'Color of the day',
      es: 'Color del día',
      de: 'Farbe des Tages',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Desafio diário: adivinhe a cor de uma carta sem nome nem mana colorida, em três tentativas.',
          en: 'Daily challenge: guess the color of a card with no name or colored mana, in three tries.',
          es: 'Desafío diario: adivina el color de una carta sin nombre ni maná de color, en tres intentos.',
          de: 'Tägliche Herausforderung: Errate in drei Versuchen die Farbe einer Karte ohne Namen und farbiges Mana.',
        },
      },
      {
        type: 'new',
        text: {
          pt: 'O texto da carta vem no idioma que você escolher, e dá para ativar um aviso de carta nova.',
          en: 'The card text comes in the language you pick, and you can turn on a notice for each new card.',
          es: 'El texto de la carta llega en el idioma que elijas, y puedes activar un aviso de carta nueva.',
          de: 'Der Kartentext kommt in der Sprache deiner Wahl, und du kannst eine Benachrichtigung für jede neue Karte einschalten.',
        },
      },
      {
        type: 'changed',
        text: {
          pt: 'As novidades ficaram mais curtas e seguem o idioma do app, assim como a política de privacidade.',
          en: "What's new is shorter and follows the app language, and so does the privacy policy.",
          es: 'Las novedades son más cortas y siguen el idioma de la app, igual que la política de privacidad.',
          de: 'Die Neuigkeiten sind kürzer und folgen der App-Sprache, ebenso die Datenschutzerklärung.',
        },
      },
    ],
  },
  {
    version: '1.10.3',
    date: '2026-10-16',
    title: {
      pt: 'Atualizar encontra a versão nova',
      en: 'Update finds the new version',
      es: 'Actualizar encuentra la versión nueva',
      de: 'Aktualisieren findet die neue Version',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'No app instalado, o botão Atualizar volta a encontrar e instalar a versão publicada.',
          en: 'In the installed app, the Update button finds and installs the published version again.',
          es: 'En la app instalada, el botón Actualizar vuelve a encontrar e instalar la versión publicada.',
          de: 'In der installierten App findet und installiert „Aktualisieren“ wieder die veröffentlichte Version.',
        },
      },
    ],
  },
  {
    version: '1.10.2',
    date: '2026-10-15',
    title: {
      pt: 'Iniciar partida voltou a funcionar',
      en: 'Starting a match works again',
      es: 'Iniciar partida vuelve a funcionar',
      de: 'Partie starten funktioniert wieder',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'O botão de iniciar partida, quebrado na 1.10.1, voltou a funcionar.',
          en: 'The start match button, broken in 1.10.1, works again.',
          es: 'El botón de iniciar partida, roto en la 1.10.1, vuelve a funcionar.',
          de: 'Der Startknopf, der in 1.10.1 nicht ging, funktioniert wieder.',
        },
      },
      {
        type: 'fixed',
        text: {
          pt: 'O último ajuste de vida não se perde mais ao bloquear o celular logo em seguida.',
          en: 'The last life change is no longer lost if you lock the phone right after.',
          es: 'El último ajuste de vida ya no se pierde al bloquear el móvil justo después.',
          de: 'Die letzte Lebensänderung geht nicht mehr verloren, wenn du das Handy direkt danach sperrst.',
        },
      },
    ],
  },
  {
    version: '1.10.1',
    date: '2026-10-15',
    title: {
      pt: 'Decks do histórico',
      en: 'Decks from your history',
      es: 'Mazos del historial',
      de: 'Decks aus dem Verlauf',
    },
    items: [
      {
        type: 'changed',
        text: {
          pt: 'Ao escolher o comandante, aparecem os decks que aquele jogador já usou.',
          en: 'When picking a commander, you see the decks that player has already used.',
          es: 'Al elegir comandante, aparecen los mazos que ese jugador ya usó.',
          de: 'Bei der Kommandeurwahl erscheinen die Decks, die dieser Spieler schon benutzt hat.',
        },
      },
      {
        type: 'fixed',
        text: {
          pt: 'O botão de instalar fica sempre visível no navegador.',
          en: 'The install button now stays visible in the browser.',
          es: 'El botón de instalar ahora siempre está visible en el navegador.',
          de: 'Der Installieren-Knopf bleibt im Browser jetzt immer sichtbar.',
        },
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-10-14',
    title: {
      pt: 'Seu histórico mora na nuvem',
      en: 'Your history lives in the cloud',
      es: 'Tu historial vive en la nube',
      de: 'Dein Verlauf liegt in der Cloud',
    },
    items: [
      {
        type: 'changed',
        text: {
          pt: 'Com conta, as partidas vão para a nuvem e saem do aparelho; sem conta, esperam nele até você entrar.',
          en: 'With an account, matches go to the cloud and leave the device; without one, they wait there until you sign in.',
          es: 'Con cuenta, las partidas van a la nube y salen del dispositivo; sin cuenta, esperan en él hasta que inicies sesión.',
          de: 'Mit Konto gehen Partien in die Cloud und verlassen das Gerät; ohne Konto warten sie dort, bis du dich anmeldest.',
        },
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-10',
    title: {
      pt: 'Mesa por código e lifelink',
      en: 'Table by code and lifelink',
      es: 'Mesa por código y vínculo vital',
      de: 'Tisch per Code und Lebensverknüpfung',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Passe a mesa para outro celular com um código de seis letras.',
          en: 'Pass the table to another phone with a six-letter code.',
          es: 'Pasa la mesa a otro móvil con un código de seis letras.',
          de: 'Gib den Tisch mit einem sechsstelligen Code an ein anderes Handy weiter.',
        },
      },
      {
        type: 'new',
        text: {
          pt: 'Lifelink no teclado de dano, e dano em todos, só nos oponentes ou dreno no duplo toque.',
          en: 'Lifelink on the damage pad, and damage to everyone, to opponents only, or drain on double tap.',
          es: 'Vínculo vital en el teclado de daño, y daño a todos, solo a oponentes o drenaje con doble toque.',
          de: 'Lebensverknüpfung im Schadensfeld, und Schaden an alle, nur an Gegner oder Entzug per Doppeltipp.',
        },
      },
      {
        type: 'new',
        text: {
          pt: 'Escolha o nome com que você aparece nas partidas.',
          en: 'Choose the name you appear under in matches.',
          es: 'Elige el nombre con el que apareces en las partidas.',
          de: 'Wähle den Namen, unter dem du in Partien erscheinst.',
        },
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-02',
    title: {
      pt: 'Passar a mesa',
      en: 'Pass the table',
      es: 'Pasar la mesa',
      de: 'Tisch weitergeben',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Bateria acabando? Passe a partida para o celular de outra pessoa e continue de onde parou.',
          en: "Battery running low? Pass the match to someone else's phone and pick up where you left off.",
          es: '¿Batería agotándose? Pasa la partida al móvil de otra persona y sigue donde lo dejaste.',
          de: 'Akku fast leer? Gib die Partie an ein anderes Handy weiter und spiel dort weiter.',
        },
      },
      {
        type: 'changed',
        text: {
          pt: 'Quem já jogou com você entra sozinho nas próximas partidas, sem novo convite.',
          en: 'People who already played with you join your next matches without a new invite.',
          es: 'Quien ya jugó contigo entra solo en las próximas partidas, sin nueva invitación.',
          de: 'Wer schon mit dir gespielt hat, kommt ohne neue Einladung in die nächsten Partien.',
        },
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-02',
    title: {
      pt: 'Ordenar as listas',
      en: 'Sort the lists',
      es: 'Ordenar las listas',
      de: 'Listen sortieren',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Decks e Jogadores podem ser ordenados por partidas, vitórias, dano e mais.',
          en: 'Decks and Players can be sorted by matches, wins, damage and more.',
          es: 'Mazos y Jugadores se pueden ordenar por partidas, victorias, daño y más.',
          de: 'Decks und Spieler lassen sich nach Partien, Siegen, Schaden und mehr sortieren.',
        },
      },
      {
        type: 'fixed',
        text: {
          pt: 'Partidas da versão de teste não se misturam mais ao histórico real.',
          en: 'Matches from the test version no longer mix into your real history.',
          es: 'Las partidas de la versión de prueba ya no se mezclan con tu historial real.',
          de: 'Partien aus der Testversion landen nicht mehr in deinem echten Verlauf.',
        },
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-02',
    title: {
      pt: 'Seus decks seguem a sua conta',
      en: 'Your decks follow your account',
      es: 'Tus mazos siguen a tu cuenta',
      de: 'Deine Decks folgen deinem Konto',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Com conta, seus decks aparecem em qualquer aparelho, sem buscar de novo.',
          en: 'Signed in, your decks show up on any device without searching again.',
          es: 'Con cuenta, tus mazos aparecen en cualquier dispositivo sin volver a buscarlos.',
          de: 'Angemeldet erscheinen deine Decks auf jedem Gerät, ohne neue Suche.',
        },
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-02',
    title: {
      pt: 'Filtrar decks por jogador',
      en: 'Filter decks by player',
      es: 'Filtrar mazos por jugador',
      de: 'Decks nach Spieler filtern',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'A aba de Decks ganhou um filtro por jogador.',
          en: 'The Decks tab now has a filter by player.',
          es: 'La pestaña Mazos ahora tiene un filtro por jugador.',
          de: 'Der Tab „Decks“ hat jetzt einen Filter nach Spieler.',
        },
      },
    ],
  },
  {
    version: '1.4.1',
    date: '2026-10-02',
    title: {
      pt: 'O voltar não fecha mais o app',
      en: 'Back no longer closes the app',
      es: 'Atrás ya no cierra la app',
      de: 'Zurück schließt die App nicht mehr',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'Nas estatísticas, o voltar do aparelho volta uma tela em vez de fechar o app.',
          en: "In the statistics, the device's back button goes back one screen instead of closing the app.",
          es: 'En las estadísticas, el botón atrás del dispositivo vuelve una pantalla en lugar de cerrar la app.',
          de: 'In der Statistik geht die Zurück-Taste eine Ansicht zurück, statt die App zu schließen.',
        },
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-02',
    title: {
      pt: 'O relógio para quando você sai',
      en: 'The clock stops when you leave',
      es: 'El reloj se detiene al salir',
      de: 'Die Uhr hält an, wenn du gehst',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'A duração da partida não conta mais o tempo fora da mesa ou com o app fechado.',
          en: 'Match duration no longer counts time away from the table or with the app closed.',
          es: 'La duración de la partida ya no cuenta el tiempo fuera de la mesa o con la app cerrada.',
          de: 'Die Partiedauer zählt keine Zeit mehr, in der du nicht am Tisch bist oder die App zu ist.',
        },
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-02',
    title: {
      pt: 'A vida conta na sua frente',
      en: 'Life counts in front of you',
      es: 'La vida cuenta frente a ti',
      de: 'Leben zählt vor deinen Augen',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Depois de dano, dreno ou cura, a vida anda até o novo valor em vez de pular.',
          en: 'After damage, drain or healing, life counts to the new value instead of jumping.',
          es: 'Tras daño, drenaje o curación, la vida avanza hasta el nuevo valor en lugar de saltar.',
          de: 'Nach Schaden, Entzug oder Heilung zählt das Leben zum neuen Wert, statt zu springen.',
        },
      },
    ],
  },
  {
    version: '1.2.3',
    date: '2026-10-02',
    title: {
      pt: 'A partida volta a encerrar',
      en: 'Matches end again',
      es: 'Las partidas vuelven a terminar',
      de: 'Partien enden wieder',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'O cartaz de vitória voltou a aparecer, e declarar o vencedor pelo menu funciona.',
          en: 'The victory screen shows again, and declaring the winner from the menu works.',
          es: 'La pantalla de victoria vuelve a aparecer, y declarar el ganador desde el menú funciona.',
          de: 'Der Siegesbildschirm erscheint wieder, und den Sieger übers Menü festzulegen funktioniert.',
        },
      },
    ],
  },
  {
    version: '1.2.2',
    date: '2026-10-01',
    title: {
      pt: 'Rolagem das estatísticas corrigida',
      en: 'Statistics scrolling fixed',
      es: 'Desplazamiento de estadísticas corregido',
      de: 'Scrollen in der Statistik repariert',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'As listas de estatísticas não pulam mais de volta para o topo ao rolar.',
          en: 'Statistics lists no longer jump back to the top while scrolling.',
          es: 'Las listas de estadísticas ya no vuelven arriba al desplazarte.',
          de: 'Statistiklisten springen beim Scrollen nicht mehr nach oben.',
        },
      },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-10-01',
    title: {
      pt: 'Segurar também no painel',
      en: 'Hold in the panel too',
      es: 'Mantener pulsado también en el panel',
      de: 'Gedrückt halten auch im Panel',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Segurar −1 ou +1 no painel do jogador repete, acelerando.',
          en: 'Holding −1 or +1 in the player panel repeats, speeding up.',
          es: 'Mantener −1 o +1 en el panel del jugador repite, cada vez más rápido.',
          de: '−1 oder +1 im Spielerpanel gedrückt halten wiederholt immer schneller.',
        },
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-01',
    title: {
      pt: 'A mesma pessoa, um histórico só',
      en: 'One person, one history',
      es: 'Una persona, un historial',
      de: 'Eine Person, ein Verlauf',
    },
    items: [
      {
        type: 'changed',
        text: {
          pt: 'Jogadores com conta aparecem pelo @, e nomes diferentes da mesma pessoa viram um histórico só.',
          en: 'Players with an account show by their @, and different names for the same person merge into one history.',
          es: 'Los jugadores con cuenta aparecen por su @, y los nombres distintos de una persona se unen en un historial.',
          de: 'Spieler mit Konto erscheinen mit ihrem @, und verschiedene Namen derselben Person werden ein Verlauf.',
        },
      },
      {
        type: 'new',
        text: {
          pt: 'Segurar a borda do painel tira ou põe vida sem parar, acelerando.',
          en: 'Holding the panel edge keeps adding or removing life, speeding up.',
          es: 'Mantener el borde del panel sigue quitando o sumando vida, cada vez más rápido.',
          de: 'Den Panelrand gedrückt halten ändert das Leben fortlaufend und immer schneller.',
        },
      },
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-28',
    title: {
      pt: 'Colocação no idioma certo',
      en: 'Placement in the right language',
      es: 'Posición en el idioma correcto',
      de: 'Platzierung in der richtigen Sprache',
    },
    items: [
      {
        type: 'fixed',
        text: {
          pt: 'A colocação aparece do jeito de cada idioma: 1º, 1st, 1.',
          en: 'Placement is written the way each language writes it: 1º, 1st, 1.',
          es: 'La posición aparece como la escribe cada idioma: 1º, 1st, 1.',
          de: 'Die Platzierung steht so da, wie jede Sprache sie schreibt: 1º, 1st, 1.',
        },
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-28',
    title: {
      pt: 'Conta, nuvem e estatísticas',
      en: 'Account, cloud and statistics',
      es: 'Cuenta, nube y estadísticas',
      de: 'Konto, Cloud und Statistik',
    },
    items: [
      {
        type: 'new',
        text: {
          pt: 'Conta opcional: seu histórico acompanha você entre aparelhos.',
          en: 'Optional account: your history follows you across devices.',
          es: 'Cuenta opcional: tu historial te acompaña entre dispositivos.',
          de: 'Optionales Konto: Dein Verlauf begleitet dich auf alle Geräte.',
        },
      },
      {
        type: 'new',
        text: {
          pt: 'Marque amigos pelo @, e a partida chega como convite para cada um.',
          en: 'Tag friends by their @, and the match reaches each of them as an invite.',
          es: 'Etiqueta a tus amigos por su @, y la partida les llega como invitación.',
          de: 'Markiere Freunde mit ihrem @, und die Partie kommt bei jedem als Einladung an.',
        },
      },
      {
        type: 'changed',
        text: {
          pt: 'As estatísticas passaram a exigir assinatura; jogar e registrar partidas continuam livres.',
          en: 'Statistics now need a subscription; playing and recording matches stay free.',
          es: 'Las estadísticas ahora requieren suscripción; jugar y registrar partidas sigue siendo gratis.',
          de: 'Die Statistik braucht jetzt ein Abo; spielen und Partien speichern bleibt kostenlos.',
        },
      },
    ],
  },
];

/** The languages every title and item must be written in. */
export const NOTE_LANGS = ['pt', 'en', 'es', 'de'];

/**
 * A title or item in a language. Portuguese is the fallback, and a plain
 * string (an old-style note) passes through as it is.
 */
export function noteIn(text, lang) {
  if (typeof text === 'string') return text;
  if (!text) return '';
  return text[lang] || text.pt || Object.values(text)[0] || '';
}

/** Only what the user has not seen yet. An unknown version returns everything. */
export function releaseNotesSince(seenBefore) {
  if (!seenBefore) return RELEASE_NOTES;
  const at = RELEASE_NOTES.findIndex((n) => n.version === seenBefore);
  return at < 0 ? RELEASE_NOTES : RELEASE_NOTES.slice(0, at);
}

/** The notes for this version, if any. */
export function releaseNotesFor(version) {
  return RELEASE_NOTES.find((n) => n.version === version) || null;
}
