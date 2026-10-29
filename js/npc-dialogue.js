'use strict';

// 台詞の内容とイベントを分離。1局終了時に複数の台詞があれば順に残す。
const NPCDialogue = {
  scripts: {
    sylis: {
      start: 'お相手お願いしますね',
      win: '慈悲は有りませんよ！',
      dealIn: 'くぅ……っ',
      fieldLoss: 'この私が……っ！',
    },
    taotao: {
      start: 'ふむ、ちと遊んでやろう',
      win: 'ホホホ……、運が無かったの。',
      dealIn: 'むぅ、やるではないか',
      fieldLoss: 'やれやれ、妾としたことが……',
    },
    kanade: {
      start: '私めがお相手いたします',
      win: 'おやおや、勝ってしまいました。',
      dealIn: '……不覚',
      fieldLoss: '……丁度アツくなってきた所です',
    },
  },

  say(state, event, result, index=1) {
    const script = this.scripts[state.players[index].npcId||state.npcId];
    if (!script || !script[event]) return;
    let text = script[event];
    if (event === 'win') {
      text += result.roles.map(role => `${ROLE_NAMES[role]}！`).join('');
    }
    state.players[index].npcLines.push(text);
    GameManager.log(`${state.players[index].name}：${text}`);
  },
};
