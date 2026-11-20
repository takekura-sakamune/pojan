'use strict';
// 交換・ベット・ショーダウン方式の進行管理
const ExchangeManager={
  legacyDraw:TurnManager.draw.bind(TurnManager),
  legacyDiscard:TurnManager.discard.bind(TurnManager),
  legacyAdvance:TurnManager.advance.bind(TurnManager),
  legacyResolveRon:TurnManager.resolveRon.bind(TurnManager),
  draw(){
    const s=gameState,p=s.players[s.currentPlayerIndex];if(s.phase!=='draw')return;
    if(p.stopped){
      if(!s.deck.length){BettingManager.start();return;}
      const c=s.deck.pop();SoundManager.play('draw');s.discardPiles[s.currentPlayerIndex].push(c);s.drawCount++;p.draws++;p.lastDrawnId=null;p.exchangeCount++;
      s.visualEvents=[{type:'discard',player:s.currentPlayerIndex,cardId:c.id}];
      this.advance();return;
    }
    if(p.hand.length!==4||!s.deck.length){BettingManager.start();return;}
    this.legacyDraw();
    if(s.phase==='discard'&&p.exchangeCount>=s.maxTurns-1)this.stop(true);
  },
  discard(index){
    const s=gameState,p=s.players[s.currentPlayerIndex];if(s.phase!=='discard'||p.stopped||!Number.isInteger(index)||index<0||index>=p.hand.length)return;
    if(s.gsFlow){this.legacyDiscard(index);return;}
    if(p.hand.length!==5||index>=5)return;
    s.pending=null;s.ronCandidates=[];const c=p.hand.splice(index,1)[0];p.lastDrawnId=null;
    s.discardPiles[s.currentPlayerIndex].push(c);p.exchangeCount++;p.lastDrawnId=null;s.selected=null;SoundManager.play('discard');
    s.visualEvents=[{type:'discard',player:s.currentPlayerIndex,cardId:c.id}];
    GameManager.log(`${p.name} 交換`);
    const discarder=s.currentPlayerIndex;s.pending=c;s.ronFrom=discarder;
    s.ronCandidates=[];
    for(let offset=1;offset<s.playerCount;offset++){
      const i=(discarder+offset)%s.playerCount,other=s.players[i];
      if(other.stopped||other.folded)continue;
      if(evaluateHand([...other.hand,c],GameManager.context(i,'showdown')).isWinning)s.ronCandidates.push(i);
    }
    this.resolveRon();
  },
  stop(force=false){
    const s=gameState,p=s.players[s.currentPlayerIndex];if(s.phase!=='discard'||p.stopped||p.hand.length!==5)return;
    if(!force&&!evaluateHand(p.hand,GameManager.context(s.currentPlayerIndex,'showdown')).isWinning)return;
    p.stopped=true;p.exchangeCount++;p.lastDrawnId=null;s.selected=null;
    GameManager.log(`${p.name} ストップ`);this.advance();
  },
  resolveRon(){
    const s=gameState,candidate=s.ronCandidates[0];
    if(candidate===undefined){const from=s.ronFrom;s.pending=null;s.ronFrom=null;s.ronCandidates=[];s.currentPlayerIndex=from;this.advance();return;}
    if(candidate>0){s.phase='ron';this.claimRon(candidate);return;}
    s.currentPlayerIndex=0;s.phase='ron';s.message=`${s.players[s.ronFrom].name}の捨て札で役ができます。ロンしますか？`;GameManager.refresh();
  },
  claimRon(index=0){
    const s=gameState,card=s.pending,p=s.players[index];if(s.phase!=='ron'||!card||s.ronCandidates[0]!==index||!p)return;
    const source=s.ronFrom,pile=s.discardPiles[source],at=pile.findIndex(c=>c.id===card.id);if(at>=0)pile.splice(at,1);
    p.hand.push(card);p.stopped=true;p.lastDrawnId=null;
    SoundManager.play('win');
    GameManager.log(`${p.name} ロン — 捨て札を手札に加えてストップ`);
    s.visualEvents=[];s.currentPlayerIndex=source;s.pending=null;s.ronFrom=null;s.ronCandidates=[];s.phase='draw';
    this.advance();
  },
  skipRon(){
    const s=gameState;if(s.phase!=='ron'||s.currentPlayerIndex!==0)return;
    s.ronCandidates.shift();this.resolveRon();
  },
  advance(){
    const s=gameState;
    if(s.players.every(p=>p.stopped)||s.players.every(p=>p.exchangeCount>=s.maxTurns)||!s.deck.length){BettingManager.start();return;}
    for(let offset=1;offset<=s.playerCount;offset++){
      const i=(s.currentPlayerIndex+offset)%s.playerCount,p=s.players[i];
      if(p.exchangeCount<s.maxTurns){s.currentPlayerIndex=i;s.selected=null;s.phase='draw';s.turnNumber=Math.min(s.maxTurns,Math.min(...s.players.map(x=>x.exchangeCount))+1);s.message=p.stopped?`${p.name}はストップ中。引いたカードを捨てます。`:`${p.name}の交換です。`;GameManager.refresh();return;}
    }
    BettingManager.start();
  },
  act(){
    const s=gameState,i=s.currentPlayerIndex,p=s.players[i];if(i===0)return;
    if(s.phase==='draw'){this.draw();return;}
    if(s.phase!=='discard')return;
    const value=evaluateHand(p.hand,GameManager.context(i,'showdown'));
    const last=p.exchangeCount>=s.maxTurns-1;
    if(value.isWinning){this.stop();return;}
    let index=NPCController.chooseDiscard(p.hand,s);
    if(!Number.isInteger(index)||index<0||index>=p.hand.length)index=0;
    this.discard(index);
  }
};
const BettingManager={
  start(){
    const s=gameState;if(s.phase==='betting'||s.phase==='ended')return;
    s.phase='betting';s.pot=s.carriedPot||0;s.currentBet=0;s.allInMode=false;
    s.players.forEach(p=>{p.roundContribution=0;p.contribution=0;p.folded=false;p.allIn=false;p.needsAction=true;});
    s.currentPlayerIndex=s.dealerIndex;s.message='ベットを開始します。チェック、ベット、またはオールインを選んでください。';
    GameManager.log('ベット開始');GameManager.refresh();
  },
  needs(){return gameState.players.map((p,i)=>p.needsAction&&!p.folded&&!p.allIn?i:-1).filter(i=>i>=0);},
  act(kind){
    const s=gameState,i=s.currentPlayerIndex,p=s.players[i];if(s.phase!=='betting'||!p||!p.needsAction||p.folded||p.allIn)return;
    const due=Math.max(0,s.currentBet-p.roundContribution);
    if(kind==='fold'){
      p.folded=true;p.needsAction=false;GameManager.log(`${p.name} フォールド`);
      const remaining=s.players.map((x,n)=>!x.folded?n:-1).filter(n=>n>=0);
      if(remaining.length===0){ShowdownManager.resolve('all-fold');return;}
      if(remaining.length===1&&!s.players[remaining[0]].needsAction){this.award(remaining[0],'folds');return;}
      this.advance(i);return;
    }
    let target=p.roundContribution;
    if(kind==='call')target=s.currentBet;
    else if(kind==='bet')target=Math.min(p.roundContribution+CONFIG.openingBet,p.roundContribution+p.score);
    else if(kind==='raise')target=Math.min(s.currentBet+CONFIG.raiseStep,p.roundContribution+p.score);
    else if(kind==='allin')target=p.roundContribution+p.score;
    else if(kind!=='check')return;
    if(kind==='check'&&due>0)return;
    const amount=Math.max(0,Math.min(p.score,target-p.roundContribution));
    if(amount){p.score-=amount;p.roundContribution+=amount;p.contribution+=amount;s.pot+=amount;}
    p.needsAction=false;
    if(p.score===0&&amount>0){p.allIn=true;s.allInMode=true;}
    if(p.roundContribution>s.currentBet){s.currentBet=p.roundContribution;}
    if(s.allInMode){
      s.players.forEach(x=>{if(!x.folded&&!x.allIn&&x.roundContribution<s.currentBet)x.needsAction=true;});
    }else if(p.roundContribution>s.currentBet||kind==='bet'||kind==='raise'||kind==='allin'){
      s.players.forEach(x=>{if(!x.folded&&!x.allIn&&x!==p&&x.roundContribution<s.currentBet)x.needsAction=true;});
    }
    GameManager.log(`${p.name} ${p.allIn?'オールイン':kind==='fold'?'フォールド':kind==='check'?'チェック':kind==='call'?'コール':kind==='bet'?'ベット':'レイズ'}${amount?` ${amount}点`:''}`);
    if(s.allInMode){
      if(!this.needs().length)ShowdownManager.resolve();else this.advance(i);return;
    }
    if(!this.needs().length){ShowdownManager.resolve();return;}
    this.advance(i);
  },
  advance(from){
    const s=gameState,need=this.needs();if(!need.length){ShowdownManager.resolve();return;}
    for(let step=1;step<=s.playerCount;step++){
      const n=(from+step)%s.playerCount;if(s.players[n].needsAction&&!s.players[n].folded&&!s.players[n].allIn){
        s.currentPlayerIndex=n;s.message=s.allInMode?`${s.players[n].name}はオールインに対しコールまたはフォールドを選択します。`:`${s.players[n].name}のベット判断です。`;GameManager.refresh();return;
      }
    }
    ShowdownManager.resolve();
  },
  award(winner,reason){
    ShowdownManager.resolve(reason);
  },
  npc(){
    const s=gameState,p=s.players[s.currentPlayerIndex],value=evaluateHand(p.hand,GameManager.context(s.currentPlayerIndex,'showdown'));
    const due=Math.max(0,s.currentBet-p.roundContribution),affordable=due<=p.score;
    if(s.allInMode){this.act(affordable&&value.rank>=3?'call':'fold');return;}
    if(due===0){this.act(value.rank>=7&&p.score>CONFIG.raiseStep?'raise':'check');return;}
    if(affordable&&(value.rank>=3||due<=Math.max(1,Math.floor(p.score*.04))))this.act('call');
    else this.act('fold');
  }
};
const ShowdownManager={
  compare(a,b){return a.rank-b.rank||a.maxNumber-b.maxNumber||a.maxSuit-b.maxSuit;},
  ordered(indices){const s=gameState;return indices.slice().sort((a,b)=>((a-s.dealerIndex+s.playerCount)%s.playerCount)-((b-s.dealerIndex+s.playerCount)%s.playerCount));},
  resolve(reason='showdown'){
    const s=gameState,eligible=s.players.map((p,i)=>!p.folded?i:-1).filter(i=>i>=0);
    if(!eligible.length){s.carriedPot=s.pot;GameManager.finish({type:'draw',reason:'all-fold',winners:[],transfers:[]});return;}
    const evaluations=s.players.map((p,i)=>evaluateHand(p.hand,GameManager.context(i,'showdown')));
    let best=eligible[0];for(const i of eligible.slice(1))if(this.compare(evaluations[i],evaluations[best])>0)best=i;
    const handWinners=eligible.filter(i=>this.compare(evaluations[i],evaluations[best])===0);
    const contributions=s.players.map(p=>p.contribution||0),levels=[...new Set(contributions.filter(n=>n>0))].sort((a,b)=>a-b);
    const maximum=levels[levels.length-1]||0,topPlayers=contributions.map((n,i)=>n===maximum?i:-1).filter(i=>maximum>0&&i>=0);
    if(topPlayers.length===1&&!s.players[topPlayers[0]].folded){
      const refund=maximum-(levels[levels.length-2]||0),p=s.players[topPlayers[0]];p.contribution-=refund;p.roundContribution-=refund;p.score+=refund;s.pot-=refund;contributions[topPlayers[0]]-=refund;
    }
    const pots=[];let previous=0;
    for(const level of levels){const contributors=contributions.map((n,i)=>n>=level?i:-1).filter(i=>i>=0),amount=(level-previous)*contributors.length;
      if(amount){const contenders=contributors.filter(i=>!s.players[i].folded);if(contenders.length)pots.push({amount,contenders});}
      previous=level;
    }
    const carried=s.carriedPot||0;s.carriedPot=0;
    if(carried){if(pots.length)pots[0].amount+=carried;else pots.push({amount:carried,contenders:eligible.slice()});}
    const awards=s.players.map(()=>0),winnersSet=new Set();let amount=0;
    for(const pot of pots){let best=pot.contenders[0];for(const i of pot.contenders.slice(1))if(this.compare(evaluations[i],evaluations[best])>0)best=i;
      const tied=pot.contenders.filter(i=>this.compare(evaluations[i],evaluations[best])===0),order=this.ordered(tied),share=Math.floor(pot.amount/order.length),remainder=pot.amount%order.length;
      order.forEach((i,n)=>{const award=share+(n<remainder?1:0);s.players[i].score+=award;awards[i]+=award;winnersSet.add(i);});amount+=pot.amount;
    }
    if(!winnersSet.size)handWinners.forEach(i=>winnersSet.add(i));
    const winners=this.ordered([...winnersSet]);s.pot=Math.max(0,s.pot-amount);
    s.carriedPot=s.pot>0?s.pot:0;s.pot=0;
    GameManager.finish({type:'showdown',reason,winners,winner:winners[0],cardsByPlayer:s.players.map(p=>[...p.hand]),evaluations,potAward:amount,awards,transfers:[]});
  }
};

GameManager.startHand=function(){
  const s=gameState;if(typeof document!=='undefined'){UIManager.clearMotion();UIManager.unlockTableLayout();}
  GemSkillEngine.resetHand(s);s.deck=DeckManager.shuffle(CardManager.create());s.doraNumber=null;
  s.players.forEach(p=>{p.hand=[];p.draws=0;p.exchangeCount=0;p.stopped=false;p.roundContribution=0;p.contribution=0;p.folded=false;p.allIn=false;p.needsAction=false;p.lastDrawnId=null;p.lastDrawnCard=null;p.riichi=false;});
  const events=[];for(let n=0;n<4;n++)s.players.forEach((p,i)=>{const card=s.deck.pop();p.hand.push(card);events.push({type:'deal',player:i,cardId:card.id,dealIndex:events.length});});
  s.discardPiles=s.players.map(()=>[]);s.drawCount=0;s.turnNumber=1;s.currentPlayerIndex=s.dealerIndex;s.selected=null;s.pending=null;s.ronFrom=null;s.ronCandidates=[];s.result=null;s.visualEvents=events;s.roundOver=false;s.activeRole=null;s.pot=s.carriedPot||0;s.currentBet=0;s.allInMode=false;
  s.players.forEach(p=>p.npcLines=[]);s.npcLines=s.players[1].npcLines;
  if(s.history.length===0&&s.handNumber===1)for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s,'start',null,i);
  s.phase='draw';s.message=s.currentPlayerIndex===0?'交換用のカードを引いてください。':`${s.players[s.currentPlayerIndex].name}の交換です。`;
  SoundManager.play('start');this.log(`${roundName(s.roundNumber)} 第${s.handNumber}局開始`);this.refresh();
};
GameManager.finish=function(result){
  const s=gameState,handId=`${s.matchId}:${s.roundNumber}:${s.handNumber}`;if(s.hands.some(h=>h.id===handId))return;
  if(result.type==='draw'&&result.reason!=='all-fold')s.carriedPot=s.pot||0;
  s.peakScore=Math.max(s.peakScore,...s.players.map(p=>p.score));
  const winners=result.winners|| (result.winner===undefined?[]:[result.winner]);
  s.hands.push({id:handId,round:s.roundNumber,hand:s.handNumber,dealer:s.dealerIndex,type:result.type,winner:winners[0]??null,winners,loser:null,roles:result.evaluations?.[winners[0]]?.roles||[],riichi:s.players.map(()=>false),transfers:[]});
  s.result={...result,winners};s.result.winner=result.winner??winners[0];
  s.result.roles=s.result.roles||result.evaluations?.[winners[0]]?.roles||[];
  s.result.strength=result.evaluations?.[winners[0]]?.strength||null;
  s.result.cards=s.result.cards||(winners.length?s.players[winners[0]].hand:undefined);
  s.phase='ended';s.roundOver=s.handNumber>=s.playerCount||s.players.some(p=>p.score<=0);s.endReason=s.players.some(p=>p.score<=0)?'持ち点が0点以下になったため対戦終了':s.roundOver?`規定の${s.playerCount}局が終了しました`:'';
  if(s.roundOver&&!s.history.some(h=>h.round===s.roundNumber))s.history.push(MatchScoreManager.field(s.roundNumber,s.players));
  s.gameOver=s.players.some(p=>p.score<=0)||(s.roundOver&&s.roundNumber>=4);s.gsChoice=null;s.gsFlow=null;s.gsKeep=null;s.gsCharge=false;
  s.message=result.reason==='all-fold'?'全員フォールド — ポットは次局へ持ち越し':result.type==='draw'?'ドロー — 得点移動なし':`${winners.map(i=>s.players[i].name).join('・')}がショーダウン勝利！`;
  SoundManager.play(result.type==='draw'?'drawEnd':'win');
  this.log(s.message);s.players.forEach(p=>p.npcLines=[]);s.npcLines=s.players[1].npcLines;
  if(result.type==='draw')for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s,'draw',null,i);
  else for(const i of winners)if(i>0){const handResult=result.evaluations?.[i];NPCDialogue.say(s,'tsumoWin',{roles:handResult?.strength?[handResult.strength]:[]},i);}
  const top=Math.max(...s.players.map(p=>p.score));s.finalResultReady=s.roundOver&&s.roundNumber===4;
  if(s.finalResultReady)for(let i=1;i<s.playerCount;i++)NPCDialogue.say(s,s.players[i].score===top?'finalWin':'finalLoss',null,i);
  if(s.gameOver)s.recordStatus=PlayerRecords.record(s);this.refresh();
};
GameManager.refresh=function(){
  const s=gameState;if(typeof document!=='undefined')UIManager.render();
  if(s.phase==='draw'&&s.currentPlayerIndex===0&&s.players[0].stopped){
    const token=++s.npcTimerToken;
    setTimeout(()=>{
      if(gameState!==s||s.npcTimerToken!==token||s.phase!=='draw'||s.currentPlayerIndex!==0||!s.players[0].stopped)return;
      ExchangeManager.draw();
    },350);
    return;
  }
  if((s.phase==='draw'||s.phase==='discard'||s.phase==='betting')&&s.currentPlayerIndex>0){
    const token=++s.npcTimerToken,phase=s.phase,index=s.currentPlayerIndex;
    setTimeout(()=>{
      if(gameState!==s||s.npcTimerToken!==token||s.phase!==phase||s.currentPlayerIndex!==index)return;
      if(phase==='betting')BettingManager.npc();else NPCController.act();
    },550);
  }
};
GameManager.win=()=>{};
TurnManager.draw=()=>ExchangeManager.draw();
TurnManager.discard=index=>ExchangeManager.discard(index);
TurnManager.advance=()=>gameState.gsFlow?ExchangeManager.legacyAdvance():ExchangeManager.advance();
TurnManager.resolveRon=()=>{
  if(gameState.gsFlow){gameState.ronCandidates=[];gameState.pending=null;return ExchangeManager.legacyAdvance();}
  return ExchangeManager.advance();
};
TurnManager.tsumo=()=>{};TurnManager.ron=()=>{};TurnManager.skip=()=>{};
NPCController.act=()=>ExchangeManager.act();
// Legacy gem skills may still alter cards, but winning is decided only at showdown.
GemSkillEngine.best=()=>null;

// Render phase-specific controls and reveal all eligible hands only at showdown.
const legacyRender=UIManager.render.bind(UIManager);
UIManager.render=function(){
  legacyRender();const s=gameState,$=id=>document.getElementById(id),buttons=[];
  $('info').children[2].textContent=`ポット：${s.pot||0}点`;$('info').children[3].textContent=`交換：${Math.max(...s.players.map(p=>p.exchangeCount||0))}/${s.maxTurns}`;$('center-cards').hidden=true;
  $('turn').textContent=s.phase==='ended'?'ショーダウン結果':s.phase==='betting'?'ベット判断':`${s.players[s.currentPlayerIndex].name}の交換 · 第${s.turnNumber}巡`;
  $('playerTitle').textContent=`${s.players[0].name}　${s.players[0].score}点${s.players[0].folded?'【フォールド】':s.players[0].stopped?'【ストップ】':''}${s.players[0].allIn?'【オールイン】':''}`;
  for(let i=1;i<s.playerCount;i++){const p=s.players[i];UIManager.npcElement('npcTitle',i).textContent=`${p.name}　${p.score}点${i===s.dealerIndex?'（親）':''}${p.folded?'【フォールド】':p.stopped?'【ストップ】':''}${p.allIn?'【オールイン】':''}`;}
  const mine=s.currentPlayerIndex===0,p=s.players[0];
  if(s.phase==='draw'&&mine&&!p.stopped)buttons.push(['ドロー',true,()=>ExchangeManager.draw()]);
  if(s.phase==='discard'&&mine&&!p.stopped){
    if(s.selected!==null)buttons.push(['交換して捨てる',true,()=>ExchangeManager.discard(s.selected)]);
    if(evaluateHand(p.hand,GameManager.context(0,'showdown')).isWinning)buttons.push(['ストップ',true,()=>ExchangeManager.stop()]);
  }
  if(s.phase==='ron'&&s.ronCandidates?.[0]===0)buttons.push(['ロン',true,()=>ExchangeManager.claimRon(0)],['見送る',true,()=>ExchangeManager.skipRon()]);
  if(s.phase==='betting'&&mine&&p.needsAction&&!p.folded&&!p.allIn){
    const due=Math.max(0,s.currentBet-p.roundContribution);
    if(s.allInMode){buttons.push([due?'コール（全額）':'チェック',true,()=>BettingManager.act(due?'call':'check')],['フォールド',true,()=>BettingManager.act('fold')]);}
    else if(!due){buttons.push(['チェック',true,()=>BettingManager.act('check')],['ベット '+Math.min(CONFIG.openingBet,p.score)+'点',p.score>0,()=>BettingManager.act('bet')],['オールイン',p.score>0,()=>BettingManager.act('allin')],['フォールド',true,()=>BettingManager.act('fold')]);}
    else buttons.push([`コール ${Math.min(due,p.score)}点`,true,()=>BettingManager.act('call')],['レイズ '+Math.min(CONFIG.raiseStep,p.score)+'点',p.score>0,()=>BettingManager.act('raise')],['オールイン',p.score>0,()=>BettingManager.act('allin')],['フォールド',true,()=>BettingManager.act('fold')]);
  }
  if(s.phase==='ended'&&!s.gameOver)buttons.push(s.roundOver?['次の場へ',true,()=>GameManager.nextRound()]:['次局へ',true,()=>GameManager.nextHand()]);
  if(s.gameOver)buttons.push(['総合結果',true,()=>MatchUI.results()],['開始画面へ',true,()=>MatchUI.showStart()]);
  $('actions').replaceChildren(...buttons.map(([label,enabled,action])=>{const b=document.createElement('button');b.textContent=label;b.disabled=!enabled;b.onclick=action;return b;}));
  if(s.phase==='ended'&&s.result?.cardsByPlayer){
    s.players.forEach((player,i)=>{
      const hand=i===0?$('playerHand'):UIManager.npcElement('npcHand',i),panel=i===0?$('playerWin'):UIManager.npcElement('npcWin',i);
      if(player.folded){hand.replaceChildren();panel.textContent='フォールド';return;}
      hand.replaceChildren(...player.hand.map(c=>UIManager.card(c)));
      const ev=s.result.evaluations?.[i];panel.textContent=ev?.strength?`${ROLE_NAMES[ev.strength]}（最大数 ${ev.maxNumber}）`:'';
      if(s.result.winners?.includes(i))panel.textContent+='　ポット獲得';
    });
  }
  $('settlement').textContent=s.phase==='ended'?`${s.message}　ポット ${s.potAward||s.carriedPot||0}点`:(s.phase==='betting'?`現在のベット ${s.currentBet}点 ／ 必要額 ${Math.max(0,s.currentBet-p.roundContribution)}点 ／ ポット ${s.pot}点`:s.phase==='discard'&&mine?'捨てるカードを選ぶか、ストップしてください。':'');
};
