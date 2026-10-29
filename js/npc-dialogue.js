
'use strict';

// NPC台詞管理
// アガリ・流局は局終了時、最終勝敗は第4場終了時のみ発話する。
const NPCDialogue = {
  scripts: {
    sylis: {
      start: 'お相手お願いしますね',
      tsumoWin: 'ツモ！　これもまた、神の思し召しです。',
      ronWin: 'ロン！　慈悲は有りませんよ！',
      dealIn: 'くぅ……っ',
      draw: '決着は、次に持ち越しですね',
      finalWin: '神の御加護に感謝を',
      finalLoss: 'この私が……っ！',
    },
    taotao: {
      start: 'ふむ、ちと遊んでやろう',
      tsumoWin: 'ツモじゃ！　ホホホ……、運が無かったの。',
      ronWin: 'ロンじゃ！　かかったのう！',
      dealIn: 'むぅ、やるではないか',
      draw: 'むむむ、煮え切らんのう',
      finalWin: 'ホホホ、妾の勝ちじゃな！',
      finalLoss: 'やれやれ、妾としたことが……',
    },
    kanade: {
      start: '私めがお相手いたします',
      tsumoWin: 'ツモ。おやおや、勝ってしまいました。',
      ronWin: 'ロン。申し訳ありません、いただきますね。',
      dealIn: '……不覚',
      draw: '引き分けですね。お楽しみ頂けましたか？',
      finalWin: 'お相手ありがとうございました。実に愉しいひとときでした',
      finalLoss: '完敗ですね。お見事でございました',
    },
  },

  say(state, event, result, index = 1) {
    const player = state.players[index];
    if (!player) return;

    const script = this.scripts[player.npcId || state.npcId];
    if (!script) return;

    // 最終勝敗の台詞は第4場終了時のみ許可
    if (event === 'finalWin' || event === 'finalLoss') {
      if (state.roundNumber !== 4 || !state.finalResultReady) {
        return;
      }
    }

    // 旧イベント名との互換性
    if (event === 'win') {
      event = (result?.type || result?.winType) === 'ron' ? 'ronWin' : 'tsumoWin';
    }

    // 旧fieldLossは途中で発話させない
    if (event === 'fieldLoss') return;

    let text = script[event];
    if (!text) return;

    // アガリ時は成立した役名を追加
    if (
      (event === 'tsumoWin' || event === 'ronWin') &&
      Array.isArray(result?.roles)
    ) {
      text += result.roles
        .map(role => `${ROLE_NAMES[role] || role}！`)
        .join('');
    }

    if (!Array.isArray(player.npcLines)) {
      player.npcLines = [];
    }

    player.npcLines.push(text);
    GameManager.log(`${player.name}：${text}`);
  },
};
