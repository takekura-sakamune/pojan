'use strict';
// GSの選択中は通常手番を停止し、確定後だけ再開する。
const GemSkillEngine={
  transactions:new WeakMap(),
  begin(){const s=gameState;this.transactions.set(s,JSON.parse(JSON.stringify(s)));},
  canCancel(){const s=gameState;return this.transactions.has(s)&&s.currentPlayerIndex===0&&!s.gameOver&&!['ended','waiting','ron'].includes(s.phase);},
  cancel(){
    const s=gameState;if(!this.canCancel())return;
    const snapshot=this.transactions.get(s);this.transactions.delete(s);
    if(typeof document!=='undefined')UIManager.captureGSMotion();
    const token=s.npcTimerToken+1;
    for(const key of Object.keys(s))delete s[key];Object.assign(s,snapshot);
    s.npcTimerToken=token;s.gsChoice=null;s.selected=null;s.message='GSの使用をキャンセルしました。';
    GameManager.refresh();
  },
  commit(){this.transactions.delete(gameState);},
  captureMotion(){if(typeof document!=='undefined')UIManager.captureGSMotion();},
  label(c){return SUITS[CardManager.suit(c,gameState)][1]+' '+c.number;},
  resetHand(s){this.transactions.delete(s);s.gsUsed=s.gsUsed||{};s.gsInfo=[];s.gsReveal={};s.gsChoice=null;s.gsFlow=null;s.gsCharge=false;s.gsKeep=null;},
  scope(skill,s){return skill.rank==='light'?`${s.roundNumber}:${s.handNumber}`:skill.rank==='medium'?String(s.roundNumber):'match';},
  available(id){const s=gameState,k=GemSkills.entries.find(k=>k.id===id);return Boolean(k&&s.skills.includes(id)&&s.phase==='draw'&&s.currentPlayerIndex===0&&!s.players[0].riichi&&!s.gsChoice&&!s.gsCharge&&s.players[0].hand.length===4&&s.gsUsed[id]!==this.scope(k,s));},
  prompt(text,options){gameState.phase='skill';gameState.gsChoice={text,options};gameState.selected=null;GameManager.refresh();},
  choose(index){const s=gameState,c=s.gsChoice;if(s.phase!=='skill'||!c||!Number.isInteger(index)||!c.options[index])return;this.captureMotion();s.gsChoice=null;c.options[index].run();},
  done(text=''){const s=gameState;s.gsChoice=null;s.phase='draw';if(text)s.gsInfo.push(text);s.message='GSの処理が終わりました。通常のツモへ進めます。';GameManager.refresh();},
  cards(text,cards,action){this.prompt(text,cards.map(c=>({label:this.label(c),card:{...c},run:()=>action(c)})));},
  numbers(text,action){this.prompt(text,Array.from({length:13},(_,i)=>({label:String(i+1),card:{id:'gs-number-'+(i+1),number:i+1,isFaceCard:i+1>=10,baseSuit:gameState.currentSuit},run:()=>action(i+1)})));},
  opponent(action){const s=gameState;this.prompt('対象の対戦者を選んでください。',s.players.slice(1).map((p,i)=>({label:p.name,run:()=>action(i+1)})));},
  top(n){return gameState.deck.slice(-n).reverse();},
  take(c){const s=gameState,index=s.deck.findIndex(x=>x.id===c.id);if(index<0)return null;return s.deck.splice(index,1)[0];},
  add(c){const s=gameState,p=s.players[0];p.hand.push(c);p.lastDrawnId=c.id;p.lastDrawnCard={...c};p.draws++;},
  best(){
    const s=gameState,hand=s.players[0].hand;let best=null;
    const visit=(start,cards)=>{if(cards.length===5){const r=evaluateHand(cards,GameManager.context(0,'tsumo'));if(r.isWinning&&(!best||r.multiplier>best.result.multiplier))best={cards:[...cards],result:r};return;}
      for(let i=start;i<hand.length;i++)visit(i+1,[...cards,hand[i]]);};
    if(hand.length>=5)visit(0,[]);return best;
  },
  win(){const s=gameState,b=this.best();if(!b)return;const transfers=ScoreManager.settle(s.players,0,0,'tsumo',b.result.multiplier,s.dealerIndex);
    GameManager.finish({winner:0,type:'tsumo',cards:b.cards,winningCardId:s.players[0].lastDrawnId,...b.result,transfers});},
  // 各追加ドローで和了選択を挟み、見送り時に次のドローへ進む。
  drawSequence(count,first=null){
    const s=gameState;
    if(!count||(!first&&!s.deck.length)){this.discards('draw');return;}
    this.add(first||s.deck.pop());
    const next=()=>this.drawSequence(count-1);
    if(this.best())this.prompt('GSの追加ドローで和了できます。',[{label:'ツモアガリ',run:()=>this.win()},{label:'見送って続ける',run:next}]);else next();
  },
  discards(resume){const s=gameState;if(s.players[0].hand.length<=4){this.done();return;}
    s.gsFlow={resume};s.phase='discard';s.message='GS：手札が4枚になるまで1枚ずつ打牌してください（毎回ロン判定）。';GameManager.refresh();},
  continueDiscard(){const s=gameState,f=s.gsFlow;if(!f||s.currentPlayerIndex!==0)return false;
    if(s.players[0].hand.length>4){s.phase='discard';s.message='GS：追加の打牌を選んでください。';GameManager.refresh();return true;}
    s.gsFlow=null;if(f.resume==='eject'){s.players[0].hand.push(s.deck.pop());this.eject(s.gsEjectRemaining);return true;}if(f.resume==='draw'){this.done();return true;}return false;},
  swapDiscard(pile){const s=gameState;if(!pile.length){this.done('交換できる捨て札がありません。');return;}
    this.cards('取り戻す捨て札を選んでください。',pile,c=>this.cards('交換する手札を選んでください。',s.players[0].hand,h=>{
      const pi=pile.indexOf(c),hi=s.players[0].hand.indexOf(h);pile[pi]=h;s.players[0].hand[hi]=c;this.done();}));},
  reorder(n){const s=gameState,cards=this.top(n),ordered=[];
    const next=()=>{if(!cards.length){for(const c of ordered)this.take(c);for(let i=ordered.length-1;i>=0;i--)s.deck.push(ordered[i]);this.done();return;}
      this.cards('次に引く順番で選んでください。',cards,c=>{cards.splice(cards.indexOf(c),1);ordered.push(c);next();});};
    // 選択途中は山札から除かず、全順番確定時にだけ変更する。
    next();
  },
  waits(index){const s=gameState,p=s.players[index];if(p.hand.length!==4)return [];return CardManager.create().filter(c=>evaluateHand([...p.hand,c],{...GameManager.context(index,'ron'),isFirstDraw:false}).isWinning);},
  activate(id){
    if(!this.available(id))return;
    const s=gameState,p=s.players[0],skill=GemSkills.entries.find(k=>k.id===id);
    const needsDeck=['rebirth','reverse','shatter','luck','foresight','convert','alchemy','favor','fate','shuffle','charge','keep','eject','exceed','mulligan','divination','omniscience'];
    if(needsDeck.includes(id)&&!s.deck.length){s.message='山札がないため使用できません。';GameManager.refresh();return;}
    this.begin();this.captureMotion();
    s.gsUsed[id]=this.scope(skill,s);s.gsActivations.push({id,round:s.roundNumber,hand:s.handNumber,turn:s.turnNumber});
    GameManager.log('GS：'+skill.name+'を使用');
    switch(id){
      case 'rebirth':this.cards('山札の下へ戻す手札を選んでください。',p.hand,c=>{p.hand.splice(p.hand.indexOf(c),1);s.deck.unshift(c);p.hand.push(s.deck.pop());this.done();});break;
      case 'reverse':this.reorder(2);break;
      case 'fate':this.reorder(3);break;
      case 'shatter':{const c=s.deck[s.deck.length-1];this.prompt('山札の先頭：'+this.label(c),[{label:'山札に戻す',run:()=>this.done()},{label:'捨てる（ロン判定あり）',run:()=>{this.add(s.deck.pop());this.discards('draw');TurnManager.discard(p.hand.indexOf(c));}}]);break;}
      case 'luck':case 'favor':this.cards('引くカードを選んでください。',this.top(id==='luck'?2:5),c=>this.drawSequence(1,this.take(c)));break;
      case 'foresight':this.done('未来視（使用時点・次に引く順）：'+this.top(3).map(c=>this.label(c)).join(' ／ '));break;
      case 'convert':this.prompt('先頭カードのスートを選んでください。',CONFIG.suits.map(suit=>({label:SUITS[suit][1],card:{id:'gs-suit-'+suit,number:'?',baseSuit:suit,isFaceCard:false},run:()=>{s.deck[s.deck.length-1].gsSuit=suit;this.done();}})));break;
      case 'alchemy':this.numbers('引く数字を指定してください。',number=>{const c=this.top(s.deck.length).find(c=>c.number===number);if(c)this.drawSequence(1,this.take(c));else this.done('錬成：指定した数字は山札にありませんでした。');});break;
      case 'shuffle':p.hand.push(s.deck.pop());this.cards('山札の下へ戻すカードを選んでください。',p.hand,c=>{p.hand.splice(p.hand.indexOf(c),1);s.deck.unshift(c);this.done();});break;
      case 'salvage':this.swapDiscard(s.discardPiles[0]);break;
      case 'scavenge':this.opponent(i=>this.swapDiscard(s.discardPiles[i]));break;
      case 'charge':this.add(s.deck.pop());s.gsCharge=true;this.done('チャージ：通常ツモ後に2回打牌します。');break;
      case 'keep':p.hand.push(s.deck.pop());this.cards('保管するカードを選んでください。',p.hand,c=>{p.hand.splice(p.hand.indexOf(c),1);s.gsKeep=c;s.gsKeepTurn=s.drawCount;this.done('キープ：保管 '+this.label(c));});break;
      case 'eject':this.eject(0);break;
      case 'exceed':this.drawSequence(Math.min(3,s.deck.length));break;
      case 'mulligan':this.mulligan([]);break;
      case 'wild':this.cards('数字を変更する手札を選んでください。',p.hand,c=>this.numbers('扱う数字を指定してください。',number=>{c.gsOriginal={number:c.number,isFaceCard:c.isFaceCard,baseSuit:c.baseSuit};c.gsSuit=CardManager.suit(c,s);c.number=number;c.isFaceCard=number>=10;this.done('ワイルドカード：この局の手札内で'+number+'として扱います。');}));break;
      case 'see-draw':this.opponent(i=>this.done('透視：'+s.players[i].name+'の直近ツモ '+(s.players[i].lastDrawnCard?this.label(s.players[i].lastDrawnCard):'まだありません')));break;
      case 'divination':this.opponent(i=>{const c=this.top(i+1)[i];this.done('占術：'+s.players[i].name+'が次にツモするカードは'+(c?(c.isFaceCard?'絵札':'数字札'):'山札不足で引けません')+'（通常の手番順・使用時点）。');});break;
      case 'detect':this.opponent(i=>this.numbers('確認する数字を指定してください。',number=>this.done('看破：'+s.players[i].name+'の手札に'+number+'は'+(s.players[i].hand.some(c=>c.number===number)?'あります。':'ありません。'))));break;
      case 'discern':this.opponent(i=>this.done('真贋判定：'+s.players[i].name+'は'+(this.waits(i).length?'テンパイしています。':'テンパイしていません。')));break;
      case 'prediction':this.opponent(i=>{s.gsReveal.prediction=i;this.done();});break;
      case 'appraisal':this.opponent(i=>this.done('鑑定（使用時点）：'+s.players[i].name+' '+DeckManager.shuffle([...s.players[i].hand]).slice(0,3).map(c=>this.label(c)).join(' ／ ')));break;
      case 'explore':{const waits=this.waits(0),matches=c=>waits.some(w=>w.number===c.number&&CardManager.suit(w,s)===CardManager.suit(c,s));this.done(waits.length?'探査：山札 '+s.deck.filter(matches).length+'枚 ／ 相手の手札 '+s.players.slice(1).flatMap(p=>p.hand).filter(matches).length+'枚 ／ 捨て札 '+s.discardPiles.flat().filter(matches).length+'枚':'探査：テンパイしていません。');break;}
      case 'omniscience':s.gsReveal.deck=true;this.done();break;
      case 'clairvoyance':s.gsReveal.hands=true;this.done();break;
    }
  },
  eject(count){const s=gameState,p=s.players[0];
    if(count===3||!s.deck.length){this.done();return;}
    this.prompt('イジェクト：交換する手札を選択（残り'+(3-count)+'回）。',[
      ...p.hand.map(c=>({label:this.label(c),card:{...c},run:()=>{s.gsEjectRemaining=count+1;s.gsEjectCard=c;s.gsFlow={resume:'eject'};s.phase='discard';TurnManager.discard(p.hand.indexOf(c));}})),
      {label:'交換を終える',run:()=>this.done()}]);
  },
  mulligan(selected){const s=gameState,p=s.players[0];
    const finish=()=>{const ids=new Set(selected.map(c=>c.id));p.hand=p.hand.filter(c=>!ids.has(c.id));s.deck.unshift(...selected);DeckManager.shuffle(s.deck);for(let i=0;i<selected.length;i++)p.hand.push(s.deck.pop());this.done();};
    this.prompt('マリガン：戻すカードを選んでください（'+selected.length+'枚選択）。',[
      ...p.hand.filter(c=>!selected.includes(c)).map(c=>({label:this.label(c),card:{...c},run:()=>this.mulligan([...selected,c])})),{label:'選択を確定',run:finish}]);
  },
  exchangeKeep(){const s=gameState;if(!s.gsKeep||s.phase!=='draw'||s.currentPlayerIndex!==0||s.players[0].riichi||s.gsChoice||s.gsCharge||s.drawCount<=s.gsKeepTurn)return;
    this.begin();this.captureMotion();
    this.cards('保管カードと交換する手札を選んでください。',s.players[0].hand,c=>{const old=s.gsKeep;s.gsKeep=c;s.gsKeepTurn=s.drawCount;s.players[0].hand[s.players[0].hand.indexOf(c)]=old;this.done();});},
  render(){
    const s=gameState,root=document.getElementById('gs-game');if(!root)return;
    root.hidden=!s.skills.length;root.onkeydown=event=>{if(event.key==='Escape'&&this.canCancel()){event.preventDefault();this.cancel();}};const nodes=[];
    const text=t=>{const p=document.createElement('p');p.textContent=t;nodes.push(p);};
    text('装備GS：'+s.skills.map(id=>GemSkills.entries.find(k=>k.id===id).name).join(' ／ '));
    const button=(label,run,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=run;nodes.push(b);};
    if(s.gsChoice){
      text(s.gsChoice.text);const options=document.createElement('div');options.className='gs-options';
      // 表示順だけを整列し、選択処理には元の選択肢番号を渡す。
      const entries=s.gsChoice.options.map((o,i)=>({o,i}));
      const handIds=new Set(s.players[0].hand.map(c=>c.id));
      const handOptions=entries.filter(({o})=>o.card&&handIds.has(o.card.id));
      const sorted=HandSorter.sorted(handOptions.map(({o})=>o.card),s)
        .map(card=>handOptions.find(({o})=>o.card===card));
      let next=0;
      entries.map(entry=>entry.o.card&&handIds.has(entry.o.card.id)?sorted[next++]:entry).forEach(({o,i})=>{
        if(o.card){const card=UIManager.card(o.card,true);card.classList.add('gs-choice-card');card.onclick=()=>this.choose(i);card.disabled=false;card.setAttribute('aria-label',o.label+'を選択');options.append(card);}
        else {const b=document.createElement('button');b.textContent=o.label;b.onclick=()=>this.choose(i);options.append(b);}
      });nodes.push(options);
    }
    else for(const id of s.skills){const k=GemSkills.entries.find(k=>k.id===id);button(k.name+'を使う',()=>this.activate(id),!this.available(id));}
    if(this.canCancel()){const cancel=document.createElement('button');cancel.className='gs-cancel';cancel.textContent='GS使用をキャンセル';cancel.onclick=()=>this.cancel();nodes.push(cancel);}
    if(s.gsKeep){const keep=UIManager.card(s.gsKeep);keep.setAttribute('data-gs-zone','keep');nodes.push(keep);text('保管：'+this.label(s.gsKeep));button('保管カードと交換',()=>this.exchangeKeep(),s.phase!=='draw'||s.currentPlayerIndex!==0||s.players[0].riichi||Boolean(s.gsChoice)||s.gsCharge||s.drawCount<=s.gsKeepTurn);}
    for(const info of s.gsInfo)text(info);
    if(s.phase!=='ended'&&s.phase!=='waiting'){
      if(s.gsReveal.deck)text('全知（次に引く順）：'+this.top(s.deck.length).map(c=>this.label(c)).join(' ／ '));
      if(s.gsReveal.hands)for(const p of s.players.slice(1))text('千里眼：'+p.name+' '+p.hand.map(c=>this.label(c)).join(' ／ '));
      if(s.gsReveal.prediction!==undefined){const i=s.gsReveal.prediction;const ns=[...new Set(this.waits(i).map(c=>c.number))];text('予知：'+s.players[i].name+' '+(ns.length?'待ちの数字 '+ns.join('・'):'テンパイしていません。'));}
    }
    root.replaceChildren(...nodes);
  }
};
