'use strict';
// ゲームの設定、スート名、役名、場名
const CONFIG= {
  playerCount:2,
  initialScore:5,
  maxTurns:8,
  maxTurnsByPlayerCount:{2:8, 3:5, 4:4},
  suits:['diamond', 'heart', 'spade', 'club']
};
const SUITS= {
  diamond:['♦', 'ダイア'],
  heart:['♥', 'ルビー'],
  spade:['♠', 'サファイア'],
  club:['♣', 'エメラルド']
};
const ROLE_NAMES= {
  trigon:'トライゴン',
  pairshape:'ペアシェイプ',
  trilliant:'トリリアント',
  catseye:'キャッツアイ',
  asterism:'アステリズム',
  colorless:'カラーレス',
  flawless:'フローレス',
  fordite:'フォーダイト',
  brilliant:'ブリリアント',
  fourC:'4C',
  paragon:'パラゴン'
};
const ROLE_RULES=['絵札3枚以上', '2ペア＋絵札', '3カード＋絵札', 'ペア＋別の3枚で連番', '3カード＋ペア', '5枚の連番', '同スート5枚', '1・9・絵札のみ', '同スートで5枚の連番', '同じ数字4枚', '他の役を伴う初回ツモ'];
const ROUND_NAMES=['スペースオブダイアモンド', 'スペースオブルビー', 'スペースオブサファイア', 'スペースオブエメラルド'];
function roundName(round) {
  return ROUND_NAMES[(round-1)%ROUND_NAMES.length];
}
