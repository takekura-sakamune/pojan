'use strict';
// ツモ、打牌、ロン、手番の交代
const TurnManager= {
  riichiWaits(playerIndex,discardIndex=null) {
    const s=gameState,p=s.players[playerIndex];
    let rest;
    if(discardIndex!==null){
      if(p.hand.length!==5||!Number.isInteger(discardIndex)||discardIndex<0||discardIndex>=5)return [];
      rest=p.hand.filter((_,i)=>i!==discardIndex);
    }else rest=p.hand.filter(c=>p.hand.length!==5||c.id!==p.lastDrawnId);
    if(rest.length!==4)return [];
    const visible=new Set([...p.hand,...s.discardPiles.flat()].map(c=>c.id));
    if(p.riichi&&p.hand.length===5)visible.delete(p.lastDrawnId);
    if(p.riichi&&s.phase==='ron'&&s.pending)visible.delete(s.pending.id);
    return CardManager.create().filter(c=>!visible.has(c.id)&&evaluateHand([...rest,c],{
      ...GameManager.context(playerIndex,'ron'),isFirstDraw:false,riichi:false
    }).isWinning);
  },
  canRiichi(index) {
    const s=gameState,p=s.players[s.currentPlayerIndex];
    return s.phase==='discard'&&!p.riichi&&this.riichiWaits(s.currentPlayerIndex,index).length>0;
  },
  riichiAutoAction() {
    const s=gameState;
    if(!s||s.currentPlayerIndex!==0||!s.players[0].riichi)return null;
    if(s.phase==='draw')return 'draw';
    if(s.phase==='discard'&&!evaluateHand(s.players[0].hand,GameManager.context(0,'tsumo')).isWinning)return 'discard';
    return null;
  },
  skipTsumo() {
    const s=gameState,p=s.players[0];
    if(s.currentPlayerIndex!==0||s.phase!=='discard'||!p.riichi)return;
    if(!evaluateHand(p.hand,GameManager.context(0,'tsumo')).isWinning)return;
    this.discard(p.hand.findIndex(c=>c.id===p.lastDrawnId));
  },
  declareRiichi(index) {
    const s=gameState,p=s.players[s.currentPlayerIndex];
    if(!this.canRiichi(index))return;
    p.riichi=true;
    GameManager.log(`${p.name} リーチ！`);
    // The declaration discard is unrestricted; only subsequent discards are locked.
    this.discard(index,true);
  },
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
    s.message=p.riichi?'リーチ中です。アガれない場合は引いたカードだけを捨てられます。':'捨てるカードを選んでください。役があればツモアガリできます。';
    GameManager.refresh();
  },
  discard(index,declaration=false) {
    const s=gameState,
    p=s.players[s.currentPlayerIndex];
    if(s.phase!=='discard'||!Number.isInteger(index)||index<0||index>=p.hand.length)return;
    if(p.riichi&&!declaration&&p.hand[index].id!==p.lastDrawnId)return;
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
