/**
 * Votacao secreta, passando o aparelho de mao em mao.
 *
 * No celular ela pede a tela em pe - o aparelho sai do meio da mesa e vai para
 * a mao de cada um. Girar a tela remontaria a mesa e fecharia o painel aberto,
 * entao com uma votacao em curso o redesenho ESPERA ela terminar.
 */

import { el, clear, icon, openFlow, buzz, toast } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { preferOrientation } from '../../orientation.js';
import { t, tn } from '../../i18n.js';
import {
  PRESETS, createSession, cast, tally, isComplete, describe,
  pending as faltamVotar,
} from '../../vote.js';

export function criarVotacao(mesa) {
  /* ---------------------------------------------------------------- */
  /* Voto secreto                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Um aparelho so, entao "secreto" e sequencial: cada um recebe a tela, faz a
   * escolha e passa adiante sem que nada dela fique visivel. Entre um votante e
   * o proximo entra sempre a tela de entrega, para que quem passou nao veja o
   * que o seguinte toca.
   *
   * Por isso os passos usam `noBack`: voltar uma tela mostraria o voto de quem
   * acabou de passar o aparelho.
   */
  function openVote() {
    const vivos = mesa.match.seats
      .filter((s) => !mesa.state.players[s.id].dead);
    if (vivos.length < 2) { toast(t('vote.needTwo')); return; }

    // O aparelho sai do meio da mesa e vai para a mão de cada um: no celular,
    // em pé. Em tablet e computador o pedido é ignorado de propósito, e a tela
    // fica centralizada em vez de colada embaixo.
    preferOrientation('portrait');
    openFlow(voteSetupStep(vivos), {
      centered: true,
      onClose: () => preferOrientation('landscape'),
    });
  }

  function voteSetupStep(vivos) {
    return {
      title: t('vote.title'),
      subtitle: t('vote.setupSub'),
      build: (pane, api) => {
        let preset = PRESETS[0];
        let pergunta = '';
        // O titulo atual veio de um preset, ou foi a pessoa que digitou?
        //
        // Sem esta distincao, tocar em "Prisoner's Dilemma" (que se auto-
        // intitula) e depois trocar para "Jogador" deixava o titulo antigo
        // grudado - e a votacao ia para a estatistica com a pergunta errada,
        // dizendo que a mesa jogou um dilema que nunca aconteceu.
        let tituloAutomatico = true;
        let opcoes = [...preset.options];
        const votos = new Map(vivos.map((s) => [s.id, 1])); // 0 = fora da votação

        const presetRow = el('div', { class: 'vote-presets' });
        const corpo = el('div', { class: 'vote-body' });
        const iniciar = el('button', { class: 'btn primary block' }, [t('vote.start')]);

        const aplicarPreset = (p) => {
          preset = p;
          // So sobrescreve titulo que o proprio app pos ali.
          if (tituloAutomatico) pergunta = p.title || '';
          opcoes = p.fromPlayers ? vivos.map((s) => s.name) : [...p.options];
          vivos.forEach((s) => {
            const fora = p.excludeActive && s.id === mesa.state.activeSeatId;
            votos.set(s.id, fora ? 0 : 1);
          });
          pintar();
        };

        const pintar = () => {
          clear(presetRow);
          PRESETS.forEach((p) => {
            presetRow.append(el('button', {
              class: 'pad-mode' + (preset.id === p.id ? ' is-on' : ''),
              onClick: () => { aplicarPreset(p); buzz(); },
            }, [p.label]));
          });

          clear(corpo);
          corpo.append(el('input', {
            class: 'search-input',
            placeholder: t('vote.questionPlaceholder'),
            value: pergunta,
            maxlength: '48',
            // Campo vazio volta a ser "automatico": quem apagou tudo nao tem
            // opiniao sobre o titulo, e o proximo preset pode preencher.
            onInput: (e) => {
              pergunta = e.target.value;
              tituloAutomatico = !pergunta.trim();
            },
          }));

          if (preset.kind === 'opcoes') {
            corpo.append(el('p', { class: 'sheet-legend', text: t('vote.options') }));
            const lista = el('div', { class: 'vote-options' });
            opcoes.forEach((texto, i) => {
              lista.append(el('div', { class: 'vote-option-row' }, [
                el('input', {
                  class: 'search-input',
                  value: texto,
                  maxlength: '24',
                  'aria-label': t('vote.option', { n: i + 1 }),
                  onInput: (e) => { opcoes[i] = e.target.value; },
                }),
                opcoes.length > 2
                  ? el('button', {
                      class: 'seat-remove',
                      'aria-label': t('common.remove'),
                      onClick: () => { opcoes.splice(i, 1); pintar(); },
                    }, [icon('close')])
                  : null,
              ]));
            });
            if (opcoes.length < 6) {
              lista.append(el('button', {
                class: 'seat-add',
                onClick: () => { opcoes.push(t('vote.option', { n: opcoes.length + 1 })); pintar(); },
              }, [icon('plus'), 'Adicionar opção']));
            }
            corpo.append(lista);
          } else {
            corpo.append(el('p', {
              class: 'settings-note',
              text: t('vote.numberNote'),
            }));
          }

          corpo.append(el('p', { class: 'sheet-legend', text: t('vote.whoVotes') }));
          const quem = el('div', { class: 'vote-voters' });
          vivos.forEach((seat) => {
            const n = votos.get(seat.id);
            quem.append(el('button', {
              class: 'vote-voter' + (n > 0 ? ' is-on' : ''),
              style: { '--accent': accentOf(seat.commanders[0] ? seat.commanders[0].colors : []) },
              // Toca e cicla: fora → 1 → 2 → 3 → fora. Cobre os efeitos que dão
              // voto extra sem precisar de outra tela.
              onClick: () => { votos.set(seat.id, (n + 1) % 4); pintar(); buzz(); },
            }, [
              el('span', { class: 'vote-voter-name', text: seat.name }),
              el('span', {
                class: 'vote-voter-count',
                text: n === 0 ? t('vote.out') : tn(n, 'vote.oneVote', 'vote.manyVotes'),
              }),
            ]));
          });
          corpo.append(quem);

          const ativos = vivos.filter((s) => votos.get(s.id) > 0);
          iniciar.disabled = ativos.length < 2
            || (preset.kind === 'opcoes' && opcoes.filter((o) => o.trim()).length < 2);
          api.remeasure();
        };

        iniciar.addEventListener('click', () => {
          const votantes = vivos
            .filter((s) => votos.get(s.id) > 0)
            .map((s) => ({ id: s.id, name: s.name, votes: votos.get(s.id) }));
          const sessao = createSession({
            question: pergunta.trim(),
            // A CATEGORIA da votacao, que a pergunta livre nao guarda.
            //
            // "Quem leva o combo?" nao diz que aquilo era um Prisoner's
            // Dilemma, e sem isso a estatistica so podia agrupar por texto -
            // uma linha nova a cada vez que alguem escreve a pergunta com
            // outras palavras.
            preset: preset.id,
            kind: preset.kind,
            options: opcoes.map((o) => o.trim()).filter(Boolean),
            voters: votantes,
          });
          api.next(handoffStep(sessao));
        });

        aplicarPreset(PRESETS[0]);
        pane.append(presetRow, corpo, el('div', { class: 'sheet-actions' }, [iniciar]));
      },
    };
  }

  /** Tela de entrega: segura tudo até quem vai votar confirmar que é ele. */
  function handoffStep(sessao) {
    const faltam = faltamVotar(sessao);
    if (!faltam.length) return revealStep(sessao);
    const proximo = faltam[0];
    const total = sessao.voters.length;

    return {
      title: t('vote.passTo', { name: proximo.name }),
      subtitle: t('vote.progress', { done: total - faltam.length, total }),
      noBack: true,
      build: (pane, api) => {
        pane.append(
          el('p', {
            class: 'settings-note',
            text: t('vote.handoffNote'),
          }),
          el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn primary block',
              onClick: () => api.next(ballotStep(sessao, proximo)),
            }, [t('vote.iAm', { name: proximo.name })]),
          ]),
        );
      },
    };
  }

  /** A cédula de um jogador. Sai da tela assim que o voto fecha. */
  function ballotStep(sessao, votante) {
    return {
      title: votante.name,
      subtitle: sessao.question || (sessao.kind === 'numero' ? t('vote.chooseNumber') : t('vote.chooseSecret')),
      noBack: true,
      build: (pane, api) => {
        const fechar = (escolhas) => {
          cast(sessao, votante.id, escolhas);
          buzz(14);
          api.next(isComplete(sessao) ? revealStep(sessao) : handoffStep(sessao));
        };

        if (sessao.kind === 'numero') {
          const campo = el('input', {
            class: 'search-input vote-number',
            type: 'number',
            inputmode: 'numeric',
            min: '0',
            value: '0',
            'aria-label': t('vote.yourNumber'),
          });
          pane.append(campo, el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn primary block',
              onClick: () => fechar([Math.max(0, Math.floor(Number(campo.value) || 0))]),
            }, [t('common.confirm')]),
          ]));
          setTimeout(() => campo.focus(), 160);
          return;
        }

        const escolhas = [];
        const restam = el('p', { class: 'sheet-legend' });
        const lista = el('div', { class: 'vote-choices' });

        const pintar = () => {
          clear(lista);
          sessao.options.forEach((texto, i) => {
            const quantos = escolhas.filter((x) => x === i).length;
            lista.append(el('button', {
              class: 'vote-choice' + (quantos ? ' is-on' : ''),
              onClick: () => {
                escolhas.push(i);
                if (escolhas.length >= votante.votes) { fechar(escolhas); return; }
                pintar();
                buzz();
              },
            }, [
              el('span', { text: texto }),
              quantos ? el('span', { class: 'vote-choice-count', text: '×' + quantos }) : null,
            ]));
          });
          restam.textContent = votante.votes > 1
            ? t('vote.votesLeft', {
              total: votante.votes, left: votante.votes - escolhas.length,
            })
            : '';
          restam.hidden = votante.votes <= 1;
          api.remeasure();
        };

        pintar();
        pane.append(restam, lista);
      },
    };
  }

  /** Revelação em duas telas: dá tempo de pôr o aparelho no meio da mesa. */
  function revealStep(sessao) {
    return {
      title: t('vote.allVoted'),
      subtitle: t('vote.putDown'),
      noBack: true,
      build: (pane, api) => {
        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => api.next(resultStep(sessao)),
          }, [t('common.reveal')]),
        ]));
      },
    };
  }

  function resultStep(sessao) {
    const r = tally(sessao);
    return {
      title: sessao.question || t('vote.result'),
      subtitle: describe(sessao, r),
      noBack: true,
      build: (pane, api) => {
        const linhas = el('div', { class: 'vote-result' });

        if (r.kind === 'numero') {
          r.rows.forEach((row) => {
            const alto = r.highest.includes(row.voterId);
            const baixo = r.lowest.includes(row.voterId);
            linhas.append(el('div', {
              class: 'vote-result-row' + (alto ? ' is-high' : '') + (baixo ? ' is-low' : ''),
            }, [
              el('span', { class: 'vote-result-label', text: row.name }),
              el('span', {
                class: 'vote-result-tag',
                text: r.allEqual ? '' : alto ? t('vote.highest') : baixo ? t('vote.lowest') : '',
              }),
              el('span', { class: 'vote-result-value', text: String(row.value) }),
            ]));
          });
          pane.append(linhas);
          if (r.allEqual) {
            pane.append(el('p', {
              class: 'settings-note',
              text: t('vote.allEqual'),
            }));
          }
        } else {
          r.rows.forEach((row) => {
            const venceu = r.top.includes(row.index) && row.votes > 0;
            linhas.append(el('div', { class: 'vote-result-row' + (venceu ? ' is-high' : '') }, [
              el('span', { class: 'vote-result-label', text: row.label }),
              el('span', { class: 'vote-result-tag', text: row.voters.join(', ') }),
              el('span', { class: 'vote-result-value', text: String(row.votes) }),
            ]));
          });
          pane.append(linhas);

          // Os dois fatos que as cartas realmente perguntam.
          if (r.unanimous) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.unanimous', { label: r.rows[0].label }),
            }));
          } else if (r.tie) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.tie', { labels: r.top.map((i) => sessao.options[i]).join(' / ') }),
            }));
          }
        }

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => {
              api.close();
              mesa.apply({
                type: 'vote',
                question: sessao.question,
                preset: sessao.preset,
                kind: sessao.kind,
                options: sessao.options,
                ballots: sessao.voters.map((v) => ({
                  seatId: v.id, name: v.name, choices: sessao.ballots[v.id] || [],
                })),
                summary: describe(sessao, r),
              });
              toast(t('vote.saved'), { label: t('common.undo'), onClick: mesa.doUndo });
            },
          }, [t('vote.save')]),
        ]));
      },
    };
  }

  return {
    openVote, voteSetupStep, handoffStep, ballotStep, revealStep, resultStep,
  };
}
