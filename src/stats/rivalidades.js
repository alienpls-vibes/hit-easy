/**
 * Rivalidades: o mesmo log lido por PAR de jogadores.
 *
 * Nada disto precisou ser gravado. Desde que o dano virou direcional, cada
 * evento ja carrega quem causou e quem levou - aqui a agregacao so olha de
 * outro angulo. Dano sem autor (vida paga) nao cria rivalidade com ninguem.
 */

import { replay } from '../engine.js';
import { identityOf, labelOf } from './agregar.js';

function parVazio() {
  return { damage: 0, cmdDamage: 0, poison: 0, kills: 0, hits: 0 };
}

/**
 * Quem bate em quem, somado por par de JOGADORES ao longo de todas as
 * partidas.
 *
 * Nada disso precisa ser gravado: cada evento de dano ja carrega quem causou e
 * quem levou desde que o dano virou direcional. Aqui so lemos o log de outro
 * angulo - por par, e nao por pessoa.
 *
 * O par e guardado em ordem alfabetica para que A-B e B-A caiam na mesma
 * linha, e cada sentido soma no seu proprio lado.
 */
export function rivalries(matches, apelidos = null) {
  const pares = new Map();

  const chave = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

  for (const match of matches) {
    if (!match || !match.seats) continue;

    // Rivalidade e entre PESSOAS. Parear por nome faria "Alex contra Bruno" e
    // "Alexandre contra Bruno" virarem duas rivalidades separadas, cada uma
    // contando metade da historia.
    const quem = {};
    const rotulo = {};
    for (const seat of match.seats) {
      quem[seat.id] = identityOf(seat, apelidos);
      rotulo[seat.id] = labelOf(seat, apelidos);
    }

    const par = (deId, paraId) => {
      const de = quem[deId];
      const para = quem[paraId];
      if (!de || !para || de === para) return null;

      const k = chave(de, para);
      if (!pares.has(k)) {
        const [ka, kb] = de < para ? [de, para] : [para, de];
        const [primeiro, segundo] = de < para
          ? [rotulo[deId], rotulo[paraId]]
          : [rotulo[paraId], rotulo[deId]];
        pares.set(k, {
          a: primeiro, b: segundo, keyA: ka, keyB: kb,
          games: 0, total: 0,
          aToB: parVazio(), bToA: parVazio(),
          _partidas: new Set(),
        });
      }
      const linha = pares.get(k);
      linha._partidas.add(match.id);
      return { linha, lado: de === linha.keyA ? linha.aToB : linha.bToA };
    };

    const somar = (deId, paraId, campo, quanto) => {
      const alvo = par(deId, paraId);
      if (!alvo) return;
      alvo.lado[campo] += quanto;
      alvo.lado.hits += 1;
      if (campo !== 'kills') alvo.linha.total += quanto;
    };

    for (const ev of match.events || []) {
      switch (ev.type) {
        case 'life':
          if (ev.sourceId && ev.delta < 0) somar(ev.sourceId, ev.targetId, 'damage', -ev.delta);
          break;
        case 'cmd':
          if (ev.sourceId && ev.delta > 0) {
            somar(ev.sourceId, ev.targetId, 'damage', ev.delta);
            const alvo = par(ev.sourceId, ev.targetId);
            if (alvo) alvo.lado.cmdDamage += ev.delta;
          }
          break;
        case 'poison':
          if (ev.sourceId && ev.delta > 0) somar(ev.sourceId, ev.targetId, 'poison', ev.delta);
          break;
        case 'sweep':
          for (const id of ev.targets || []) {
            if (ev.sourceId) somar(ev.sourceId, id, 'damage', ev.amount);
          }
          break;
        default:
          break;
      }
    }

    // Eliminacoes: quem deu o golpe final em quem.
    const estado = replay(match);
    for (const seat of match.seats) {
      const p = estado.players[seat.id];
      if (p.elim && p.elim.byId) somar(p.elim.byId, seat.id, 'kills', 1);
    }
  }

  return [...pares.values()]
    .map((linha) => {
      const { _partidas, ...resto } = linha;
      return { ...resto, games: _partidas.size };
    })
    .sort((x, y) => y.total - x.total);
}

/**
 * Quem aparece em alguma rivalidade, para popular os filtros.
 *
 * Sai das PROPRIAS rivalidades e nao da lista de jogadores: oferecer alguem que
 * nunca cruzou com ninguem so produziria combinacoes vazias, e a pessoa ficaria
 * caçando um par que existe entre opcoes que nao levam a lugar nenhum.
 */
export function rivalPeople(pares) {
  const vistos = new Map();
  for (const r of pares || []) {
    if (!vistos.has(r.keyA)) vistos.set(r.keyA, { key: r.keyA, label: r.a });
    if (!vistos.has(r.keyB)) vistos.set(r.keyB, { key: r.keyB, label: r.b });
  }
  return [...vistos.values()].sort((x, y) => x.label.localeCompare(y.label));
}

/** A rivalidade entre duas pessoas, em qualquer ordem. */
export function rivalBetween(pares, a, b) {
  if (!a || !b || a === b) return null;
  return (pares || []).find(
    (r) => (r.keyA === a && r.keyB === b) || (r.keyA === b && r.keyB === a),
  ) || null;
}

/**
 * O mesmo par, visto com uma pessoa especifica a esquerda.
 *
 * A rivalidade e guardada numa ordem interna (a chave menor primeiro), que e o
 * que faz "A contra B" e "B contra A" serem a mesma linha. Mas na tela quem
 * manda e o filtro: se a pessoa escolheu Bruno no campo da esquerda, e do lado
 * esquerdo do grafico que Bruno tem de aparecer - senao o desenho contradiz o
 * controle logo acima dele, e a barra parece dizer o contrario do que diz.
 *
 * Troca os dois lados por inteiro: nome, chave e o que cada um fez ao outro.
 * Trocar so o nome inverteria a leitura do dano, que e pior que nao trocar.
 */
export function orientarRival(par, chaveEsquerda) {
  if (!par) return null;
  if (!chaveEsquerda || par.keyA === chaveEsquerda) return par;
  if (par.keyB !== chaveEsquerda) return par; // nao e deste par: deixa como esta
  return {
    ...par,
    a: par.b, keyA: par.keyB, aToB: par.bToA,
    b: par.a, keyB: par.keyA, bToA: par.aToB,
  };
}
