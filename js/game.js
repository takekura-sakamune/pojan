'use strict';
// ゲーム状態、局・場・4場終了の管理
let gameState;
const GameManager= {
  start(round=1, npc=NPCPool.pick(), playerCount=2, nickname='あなた',difficulty='normal') {
    if(![2, 3, 4].includes(playerCount))throw new RangeError('対戦人数は2～4人です。');
    const opponents=[npc, ...DeckManager.shuffle(NPCPool.entries.filter(p=>p.id!==npc.id))].slice(0, playerCount-1);
    const initialScore=CONFIG.initialScoreByPlayerCount[playerCount];
    gameState={
      history:[], gameOver:false, npcId:npc.id, playerCount, difficulty:difficulty==='easy'?'easy':'normal', matchId:PlayerRecords.newId(),
      roundNumber:round, handNumber:1, turnNumber:1,
      currentSuit:CONFIG.suits[(round-1)%4], dealerIndex:0, currentPlayerIndex:0,
      maxTurns:CONFIG.maxTurnsByPlayerCount[playerCount],
      players:[{name:PlayerRecords.cleanName(nickname), score:initialScore}, ...opponents.map(p=>({name:p.name, npcId:p.id, score:initialScore}))],
      logs:[], phase:'waiting', npcTimerToken:0
    };
    this.startHand();
  },
  startHand() {
    if(typeof document!=='undefined')UIManager.clearMotion();
    const s=gameState;
    s.deck=DeckManager.shuffle(CardManager.create());
    s.doraNumber=10+Math.floor(Math.random()*4);
    s.players.forEach(p=> {
      p.hand=[];
      p.draws=0;
      p.lastDrawnId=null;
      p.riichi=false;
    });
    for(let i=0; i<4; i++)s.players.forEach(p=>p.hand.push(s.deck.pop()));
    s.discardPiles=s.players.map(()=>[]);
    s.drawCount=0;
    s.turnNumber=1;
    s.currentPlayerIndex=s.dealerIndex;
    s.selected=null;
    s.pending=null;
    s.ronCandidates=[];
    s.result=null;
    s.visualEvents=[];
    s.roundOver=false;
    s.activeRole=null;
    s.players.forEach(p=>p.npcLines=[]);
    s.npcLines=s.players[1].npcLines;
    if(s.history.length===0&&s.handNumber===1)for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s, 'start', null, i);
    s.phase='draw';
    s.message=s.currentPlayerIndex===0?'ツモして手札を5枚にしてください。':s.players[s.currentPlayerIndex].name+'の手番です。';
    SoundManager.play('start');
    this.log(`${roundName(s.roundNumber)} 第${s.handNumber}局開始・ドラ${s.doraNumber}`);
    this.refresh();
  },
  log(message) {
    gameState.logs.unshift(message);
  },
  context(i, type) {
    const s=gameState;
    return {
      currentSuit:s.currentSuit,
      doraNumber:s.doraNumber,
      isFirstDraw:s.players[i].draws===1,
      isDealer:s.dealerIndex===i,
      riichi:Boolean(s.players[i].riichi),
      winType:type
    };
  },
  win(i, type, card) {
    const s=gameState,
    cards=[...s.players[i].hand];
    if(card)cards.push(card);
    const result=evaluateHand(cards, this.context(i, type));
    if(!result.isWinning)return;
    const transfers=ScoreManager.settle(s.players, i, s.currentPlayerIndex, type, result.multiplier,s.dealerIndex);
    this.finish( {
      winner:i,
      type,
      cards,
      winningCardId:card?card.id:s.players[i].lastDrawnId,
      ...result,
      transfers
    });
  },
  finish(result) {
    const s=gameState;
    s.result=result;
    if(result.type!=='draw')s.visualEvents=(s.visualEvents||[]).concat({type:result.type,player:result.winner});
    SoundManager.play(result.type==='draw'?'drawEnd':result.type);
    const bankrupt=s.players.some(p=>p.score<=0);
    s.roundOver=s.handNumber>=s.playerCount||bankrupt;
    s.endReason=bankrupt?'持ち点が0点以下になったため対戦終了':s.roundOver?`規定の${s.playerCount}局が終了しました`:'';
    if(s.roundOver&&!s.history.some(h=>h.round===s.roundNumber))s.history.push(MatchScoreManager.field(s.roundNumber, s.players));
    s.gameOver=bankrupt||(s.roundOver&&s.roundNumber>=4);
    s.phase='ended';
    s.message=result.type==='draw'?'流局 — 得点移動なし':`${s.players[result.winner].name}の${result.type==='tsumo'?'ツモ':'ロン'}！`;
    this.log(s.message);
    s.players.forEach(p=>p.npcLines=[]);
    s.npcLines=s.players[1].npcLines;
    if(result.type!=='draw') {
      if(result.winner>0)NPCDialogue.say(s, result.type==='ron'?'ronWin':'tsumoWin', result, result.winner);
      if(result.type==='ron'&&s.currentPlayerIndex>0)NPCDialogue.say(s, 'dealIn', null, s.currentPlayerIndex);
    } else {
      for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s, 'draw', null, i);
    }
    const topScore=Math.max(...s.players.map(p=>p.score));
    s.finalResultReady=s.roundOver&&s.roundNumber===4;
    if(s.finalResultReady)for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s, s.players[i].score===topScore?'finalWin':'finalLoss', null, i);
    if(s.gameOver)s.recordStatus=PlayerRecords.record(s);
    this.refresh();
  },
  nextRound() {
    const s=gameState;
    if(s.phase!=='ended'||!s.roundOver||s.gameOver)return;
    s.roundNumber++;
    s.handNumber=1;
    s.dealerIndex=0;
    s.currentSuit=CONFIG.suits[(s.roundNumber-1)%4];
    this.startHand();
  },
  nextHand() {
    if(gameState.phase!=='ended'||gameState.roundOver)return;
    gameState.handNumber++;
    gameState.dealerIndex=(gameState.dealerIndex+1)%gameState.playerCount;
    this.startHand();
  },
  refresh() {
    const s=gameState,autoAction=TurnManager.riichiAutoAction();
    if(autoAction)s.message=autoAction==='draw'?'リーチ中：自動でツモします。':'リーチ中：自動でツモ切りします。';
    else if(s.currentPlayerIndex===0&&s.players[0].riichi&&s.phase==='discard')s.message='ツモアガリできます。自動進行を停止しています。';
    if(typeof document!=='undefined')UIManager.render();
    if(autoAction){
      const token=++s.npcTimerToken,phase=s.phase,drawn=s.players[0].lastDrawnId;
      setTimeout(()=>{
        if(gameState!==s||s.npcTimerToken!==token||s.phase!==phase||s.currentPlayerIndex!==0||s.players[0].lastDrawnId!==drawn||TurnManager.riichiAutoAction()!==autoAction)return;
        if(autoAction==='draw')TurnManager.draw();
        else TurnManager.discard(s.players[0].hand.findIndex(c=>c.id===drawn));
      },450);
      return;
    }
    if(s.phase==='draw'&&s.currentPlayerIndex>0) {
      const token=++s.npcTimerToken, index=s.currentPlayerIndex;
      setTimeout(()=> {
        if(gameState===s&&s.npcTimerToken===token&&s.phase==='draw'&&s.currentPlayerIndex===index)NPCController.act();
      }, 650);
    }
  }
};
