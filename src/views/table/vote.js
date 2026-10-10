/**
 * Secret vote, passing the device from hand to hand.
 *
 * On a phone it asks for the screen standing up - the device leaves the middle
 * of the table and goes into each person's hand. Rotating the screen would
 * remount the table and close the open panel, so with a vote in progress the
 * redraw WAITS for it to finish.
 */

import { el, clear, icon, openFlow, buzz, toast } from '../../ui.js';
import { accentOf } from '../../colors.js';
import { preferOrientation } from '../../orientation.js';
import { t, tn } from '../../i18n.js';
import {
  PRESETS, KIND_OPTIONS, KIND_NUMBER, createSession, cast, tally, isComplete, describe,
  pending as stillToVote,
} from '../../vote.js';

export function createVote(table) {
  /**
   * A single device, so "secret" is sequential: each one gets the screen,
   * makes the choice and passes it on without anything of it staying visible.
   * Between one voter and the next there is always the handoff screen, so
   * whoever passed does not see what the next one taps.
   *
   * That is why the steps use `noBack`: going back one screen would show the
   * vote of whoever just passed the device.
   */
  function openVote() {
    const alive = table.match.seats
      .filter((s) => !table.state.players[s.id].dead);
    if (alive.length < 2) { toast(t('vote.needTwo')); return; }

    // The device leaves the middle of the table and goes into each one's hand:
    // on a phone, standing up. On tablets and computers the request is ignored
    // on purpose, and the screen stays centered instead of stuck to the bottom.
    preferOrientation('portrait');
    openFlow(voteSetupStep(alive), {
      centered: true,
      onClose: () => preferOrientation('landscape'),
    });
  }

  function voteSetupStep(alive) {
    return {
      title: t('vote.title'),
      subtitle: t('vote.setupSub'),
      build: (pane, api) => {
        let preset = PRESETS[0];
        let question = '';
        // Did the current title come from a preset, or did the person type it?
        //
        // Without this distinction, tapping "Prisoner's Dilemma" (which titles
        // itself) and then switching to "Player" left the old title stuck - and
        // the vote went to the statistics with the wrong question, saying the
        // table played a dilemma that never happened.
        let autoTitle = true;
        let options = [...preset.options];
        const votes = new Map(alive.map((s) => [s.id, 1])); // 0 = out of the vote

        const presetRow = el('div', { class: 'vote-presets' });
        const body = el('div', { class: 'vote-body' });
        const start = el('button', { class: 'btn primary block' }, [t('vote.start')]);

        const applyPreset = (p) => {
          preset = p;
          // Only overwrites a title the app itself put there.
          if (autoTitle) question = p.title || '';
          options = p.fromPlayers ? alive.map((s) => s.name) : [...p.options];
          alive.forEach((s) => {
            const out = p.excludeActive && s.id === table.state.activeSeatId;
            votes.set(s.id, out ? 0 : 1);
          });
          paint();
        };

        const paint = () => {
          clear(presetRow);
          PRESETS.forEach((p) => {
            presetRow.append(el('button', {
              class: 'pad-mode' + (preset.id === p.id ? ' is-on' : ''),
              onClick: () => { applyPreset(p); buzz(); },
            }, [p.label]));
          });

          clear(body);
          body.append(el('input', {
            class: 'search-input',
            placeholder: t('vote.questionPlaceholder'),
            value: question,
            maxlength: '48',
            // An empty field goes back to "automatic": whoever erased it all
            // has no opinion on the title, and the next preset may fill it in.
            onInput: (e) => {
              question = e.target.value;
              autoTitle = !question.trim();
            },
          }));

          if (preset.kind === KIND_OPTIONS) {
            body.append(el('p', { class: 'sheet-legend', text: t('vote.options') }));
            const list = el('div', { class: 'vote-options' });
            options.forEach((text, i) => {
              list.append(el('div', { class: 'vote-option-row' }, [
                el('input', {
                  class: 'search-input',
                  value: text,
                  maxlength: '24',
                  'aria-label': t('vote.option', { n: i + 1 }),
                  onInput: (e) => { options[i] = e.target.value; },
                }),
                options.length > 2
                  ? el('button', {
                      class: 'seat-remove',
                      'aria-label': t('common.remove'),
                      onClick: () => { options.splice(i, 1); paint(); },
                    }, [icon('close')])
                  : null,
              ]));
            });
            if (options.length < 6) {
              list.append(el('button', {
                class: 'seat-add',
                onClick: () => { options.push(t('vote.option', { n: options.length + 1 })); paint(); },
              }, [icon('plus'), 'Adicionar opção']));
            }
            body.append(list);
          } else {
            body.append(el('p', {
              class: 'settings-note',
              text: t('vote.numberNote'),
            }));
          }

          body.append(el('p', { class: 'sheet-legend', text: t('vote.whoVotes') }));
          const who = el('div', { class: 'vote-voters' });
          alive.forEach((seat) => {
            const n = votes.get(seat.id);
            who.append(el('button', {
              class: 'vote-voter' + (n > 0 ? ' is-on' : ''),
              style: { '--accent': accentOf(seat.commanders[0] ? seat.commanders[0].colors : []) },
              // Tap to cycle: out → 1 → 2 → 3 → out. Covers the effects that
              // grant extra votes without needing another screen.
              onClick: () => { votes.set(seat.id, (n + 1) % 4); paint(); buzz(); },
            }, [
              el('span', { class: 'vote-voter-name', text: seat.name }),
              el('span', {
                class: 'vote-voter-count',
                text: n === 0 ? t('vote.out') : tn(n, 'vote.oneVote', 'vote.manyVotes'),
              }),
            ]));
          });
          body.append(who);

          const voting = alive.filter((s) => votes.get(s.id) > 0);
          start.disabled = voting.length < 2
            || (preset.kind === KIND_OPTIONS && options.filter((o) => o.trim()).length < 2);
          api.remeasure();
        };

        start.addEventListener('click', () => {
          const voters = alive
            .filter((s) => votes.get(s.id) > 0)
            .map((s) => ({ id: s.id, name: s.name, votes: votes.get(s.id) }));
          const session = createSession({
            question: question.trim(),
            // The vote's CATEGORY, which the free-form question does not keep.
            //
            // "Who gets the combo?" does not say it was a Prisoner's Dilemma,
            // and without this the statistics could only group by text - a new
            // row every time someone words the question differently.
            preset: preset.id,
            kind: preset.kind,
            options: options.map((o) => o.trim()).filter(Boolean),
            voters,
          });
          api.next(handoffStep(session));
        });

        applyPreset(PRESETS[0]);
        pane.append(presetRow, body, el('div', { class: 'sheet-actions' }, [start]));
      },
    };
  }

  /** Handoff screen: holds everything until whoever votes confirms it is them. */
  function handoffStep(session) {
    const left = stillToVote(session);
    if (!left.length) return revealStep(session);
    const next = left[0];
    const total = session.voters.length;

    return {
      title: t('vote.passTo', { name: next.name }),
      subtitle: t('vote.progress', { done: total - left.length, total }),
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
              onClick: () => api.next(ballotStep(session, next)),
            }, [t('vote.iAm', { name: next.name })]),
          ]),
        );
      },
    };
  }

  /** A player's ballot. It leaves the screen as soon as the vote closes. */
  function ballotStep(session, voter) {
    return {
      title: voter.name,
      subtitle: session.question || (session.kind === KIND_NUMBER ? t('vote.chooseNumber') : t('vote.chooseSecret')),
      noBack: true,
      build: (pane, api) => {
        const finish = (choices) => {
          cast(session, voter.id, choices);
          buzz(14);
          api.next(isComplete(session) ? revealStep(session) : handoffStep(session));
        };

        if (session.kind === KIND_NUMBER) {
          const field = el('input', {
            class: 'search-input vote-number',
            type: 'number',
            inputmode: 'numeric',
            min: '0',
            value: '0',
            'aria-label': t('vote.yourNumber'),
          });
          pane.append(field, el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn primary block',
              onClick: () => finish([Math.max(0, Math.floor(Number(field.value) || 0))]),
            }, [t('common.confirm')]),
          ]));
          setTimeout(() => field.focus(), 160);
          return;
        }

        const choices = [];
        const remaining = el('p', { class: 'sheet-legend' });
        const list = el('div', { class: 'vote-choices' });

        const paint = () => {
          clear(list);
          session.options.forEach((text, i) => {
            const count = choices.filter((x) => x === i).length;
            list.append(el('button', {
              class: 'vote-choice' + (count ? ' is-on' : ''),
              onClick: () => {
                choices.push(i);
                if (choices.length >= voter.votes) { finish(choices); return; }
                paint();
                buzz();
              },
            }, [
              el('span', { text }),
              count ? el('span', { class: 'vote-choice-count', text: '×' + count }) : null,
            ]));
          });
          remaining.textContent = voter.votes > 1
            ? t('vote.votesLeft', {
              total: voter.votes, left: voter.votes - choices.length,
            })
            : '';
          remaining.hidden = voter.votes <= 1;
          api.remeasure();
        };

        paint();
        pane.append(remaining, list);
      },
    };
  }

  /** The reveal in two screens: it gives time to put the device in the middle of the table. */
  function revealStep(session) {
    return {
      title: t('vote.allVoted'),
      subtitle: t('vote.putDown'),
      noBack: true,
      build: (pane, api) => {
        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => api.next(resultStep(session)),
          }, [t('common.reveal')]),
        ]));
      },
    };
  }

  function resultStep(session) {
    const r = tally(session);
    return {
      title: session.question || t('vote.result'),
      subtitle: describe(session, r),
      noBack: true,
      build: (pane, api) => {
        const rows = el('div', { class: 'vote-result' });

        if (r.kind === KIND_NUMBER) {
          r.rows.forEach((row) => {
            const high = r.highest.includes(row.voterId);
            const low = r.lowest.includes(row.voterId);
            rows.append(el('div', {
              class: 'vote-result-row' + (high ? ' is-high' : '') + (low ? ' is-low' : ''),
            }, [
              el('span', { class: 'vote-result-label', text: row.name }),
              el('span', {
                class: 'vote-result-tag',
                text: r.allEqual ? '' : high ? t('vote.highest') : low ? t('vote.lowest') : '',
              }),
              el('span', { class: 'vote-result-value', text: String(row.value) }),
            ]));
          });
          pane.append(rows);
          if (r.allEqual) {
            pane.append(el('p', {
              class: 'settings-note',
              text: t('vote.allEqual'),
            }));
          }
        } else {
          r.rows.forEach((row) => {
            const won = r.top.includes(row.index) && row.votes > 0;
            rows.append(el('div', { class: 'vote-result-row' + (won ? ' is-high' : '') }, [
              el('span', { class: 'vote-result-label', text: row.label }),
              el('span', { class: 'vote-result-tag', text: row.voters.join(', ') }),
              el('span', { class: 'vote-result-value', text: String(row.votes) }),
            ]));
          });
          pane.append(rows);

          // The two facts the cards actually ask about.
          if (r.unanimous) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.unanimous', { label: r.rows[0].label }),
            }));
          } else if (r.tie) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.tie', { labels: r.top.map((i) => session.options[i]).join(' / ') }),
            }));
          }
        }

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => {
              api.close();
              table.apply({
                type: 'vote',
                question: session.question,
                preset: session.preset,
                kind: session.kind,
                options: session.options,
                ballots: session.voters.map((v) => ({
                  seatId: v.id, name: v.name, choices: session.ballots[v.id] || [],
                })),
                summary: describe(session, r),
              });
              toast(t('vote.saved'), { label: t('common.undo'), onClick: table.doUndo });
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
