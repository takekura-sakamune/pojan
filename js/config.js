'use strict';
// ゲームの設定、スート名、役名、場名
const CONFIG= {
  playerCount:2,
  initialScore:25000,
  initialScoreByPlayerCount:{2:25000,3:25000,4:25000},
  maxTurns:8,
  maxTurnsByPlayerCount:{2:8, 3:5, 4:4},
  openingBet:1000,
  raiseStep:1000,
  suits:['diamond', 'heart', 'spade', 'club']
};
const SUITS= {
  diamond:['♦', 'ダイア'],
  heart:['♥', 'ルビー'],
  spade:['♠', 'サファイア'],
  club:['♣', 'エメラルド']
};
const ROLE_NAMES= {
  pairshape:'ペアシェイプ',
  trilliant:'トリリアント',
  catseye:'キャッツアイ',
  trigon:'トライゴン',
  colorless:'カラーレス',
  flawless:'フローレス',
  fordite:'フォーダイト',
  asterism:'アステリズム',
  fourC:'4C',
  brilliant:'ブリリアント'
};
const ROLE_RULES=['2ペア＋絵札', '3カード＋絵札', 'ペア＋連続する数字3枚', '絵札3枚以上', '5枚の連番', '同スート5枚', '1・9・絵札のみ', '3カード＋ペア', '同じ数字4枚', '同スートで5枚の連番'];
const ROLE_VALUES={pairshape:1,trilliant:2,catseye:3,trigon:4,colorless:5,flawless:6,fordite:7,asterism:8,fourC:9,brilliant:10};
const ROUND_NAMES=['スペースオブダイアモンド', 'スペースオブルビー', 'スペースオブサファイア', 'スペースオブエメラルド'];
function roundName(round) {
  return ROUND_NAMES[(round-1)%ROUND_NAMES.length];
}
