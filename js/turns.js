'use strict';
// ツモ、打牌、ロン、手番の交代
const TurnManager= {
  draw() {
    const s=gameState;
    if(s.phase!=='draw')return;
    const p=s.players[s.currentPlayerIndex];
    if(!s.deck.length) {
      GameManager.finish( {
        type:'draw'
      });
      return;
    }
    p.hand.push(s.deck.pop());
    p.lastDrawnId=p.hand[p.hand.length-1].id;
    s.visualEvents=[{type:'draw',player:s.currentPlayerIndex,cardId:p.lastDrawnId}];
    SoundManager.play('draw');
    p.draws++;
    s.drawCount++;
    s.turnNumber=Math.ceil(s.drawCount/s.playerCount);
    s.phase='discard';
    s.selected=null;
    s.message='捨てるカードを選んでください。役があればツモアガリできます。';
    GameManager.refresh();
  },
  discard(index) {
    const s=gameState,
    p=s.players[s.currentPlayerIndex];
    if(s.phase!=='discard'||!Number.isInteger(index)||index<0||index>=p.hand.length)return;
    const card=p.hand.splice(index, 1)[0];
    p.lastDrawnId=null;
    SoundManager.play('discard');
    s.discardPiles[s.currentPlayerIndex].push(card);
    s.visualEvents=[{type:'discard',player:s.currentPlayerIndex,cardId:card.id}];
    s.selected=null;
    s.pending=card;
    GameManager.log(`${p.name} 打牌 ${SUITS[CardManager.suit(card,s)][0]}${card.number}`);
    // ロンの優先順位は放銃者から手番順。プレイヤーの見送り後も残りを判定。
    s.ronCandidates=[];
    for(let offset=1;offset<s.playerCount;offset++) {
      const other=(s.currentPlayerIndex+offset)%s.playerCount;
      if(evaluateHand([...s.players[other].hand, card], GameManager.context(other, 'ron')).isWinning)s.ronCandidates.push(other);
    }
    this.resolveRon();
  },
  resolveRon() {
    const s=gameState, candidate=s.ronCandidates[0];
    if(candidate===undefined){this.advance();return;}
    if(candidate>0){GameManager.win(candidate, 'ron', s.pending);return;}
    s.phase='ron';
    s.message=`${s.players[s.currentPlayerIndex].name}の捨て札 ${SUITS[CardManager.suit(s.pending,s)][1]}${s.pending.number} でロンできます。`;
    GameManager.refresh();
  },
  advance() {
    const s=gameState;
    s.pending=null;
    s.ronCandidates=[];
    if(s.drawCount>=s.maxTurns*s.playerCount) {
      GameManager.finish( {
        type:'draw'
      });
      return;
    }
    s.currentPlayerIndex=(s.currentPlayerIndex+1)%s.playerCount;
    s.phase='draw';
    s.message=s.currentPlayerIndex===0?'あなたの手番です。ツモしてください。':s.players[s.currentPlayerIndex].name+'が考えています…';
    GameManager.refresh();
  },
  tsumo() {
    const s=gameState;
    if(s.phase==='discard')GameManager.win(s.currentPlayerIndex, 'tsumo');
  },
  ron() {
    if(gameState.phase==='ron')GameManager.win(0, 'ron', gameState.pending);
  },
  skip() {
    if(gameState.phase==='ron'){gameState.ronCandidates.shift();this.resolveRon();}
  }
};
