'use strict';
// 固定NPCと自動打牌
const NPCPool= {
  entries:[ {
    id:'sylis',
    name:'スィリス'
  }, {
    id:'taotao',
    name:'桃桃（タオタオ）'
  }, {
    id:'kanade',
    name:'甘美音カナデ'
  }],
  pick(rng=Math.random) {
    return this.entries[Math.floor(rng()*this.entries.length)];
  }
};
// UIの特徴説明とAIの重みを同じデータで管理する。
const NPC_PROFILES = {
  sylis: {
    style:'連番を磨く速攻派',
    description:'数字のつながりを重視し、広い待ちを作って素早いアガリを目指します。',
    traits:['得意な狙い：カラーレス・キャッツアイ・ブリリアント','ドラよりも数字のつながりを好む、攻め寄りの打ち筋。'],
    weights:{pairs:5,triples:8,adjacent:9,window:7,suit:2,faces:1,dora:3},
    favorites:{colorless:12,catseye:9,brilliant:12}, defense:4
  },
  taotao: {
    style:'重なりを育てる勝負師',
    description:'ペアと3カードを大切に残し、数字の重なりから役を育てる攻撃的な打ち筋です。',
    traits:['得意な狙い：トリリアント・アステリズム・4C','連番やスートより、ペアと3カードを好みます。'],
    weights:{pairs:13,triples:28,adjacent:1,window:1,suit:1,faces:3,dora:3},
    favorites:{trilliant:10,asterism:12,fourC:12}, defense:2
  },
  kanade: {
    style:'絵札とドラを守る慎重派',
    description:'絵札・ドラ・同スートの役を重視し、親への放銃と持ち点が尽きる危険にも気を配ります。',
    traits:['得意な狙い：トライゴン・フローレス・ブリリアント・ドラを含む役','親の受け払いと残り持ち点を考え、終盤は慎重に打牌します。'],
    weights:{pairs:5,triples:10,adjacent:2,window:2,suit:5,faces:11,dora:13},
    favorites:{trigon:12,flawless:8,brilliant:8}, defense:32, paymentAware:true
  }
};
const NPC_DEFAULT_PROFILE = {
  weights:{pairs:7,triples:12,adjacent:3,window:2,suit:2,faces:2,dora:5}, favorites:{}, defense:4
};
const NPCController = {
  // 各候補は「公開情報上でまだ見えていないカード」だけで待ちを数える。
  features(cards,state) {
    const counts={},suits={};
    for(const card of cards){
      counts[card.number]=(counts[card.number]||0)+1;
      const suit=CardManager.suit(card,state);suits[suit]=(suits[suit]||0)+1;
    }
    const numbers=Object.keys(counts).map(Number);
    let window=0;
    for(let start=1;start<=9;start++)window=Math.max(window,numbers.filter(n=>n>=start&&n<start+5).length);
    return {
      pairs:Object.values(counts).filter(n=>n>=2).length,
      triples:Object.values(counts).filter(n=>n>=3).length,
      adjacent:numbers.filter(n=>counts[n+1]).length,
      window,
      suit:Math.max(0,...Object.values(suits)),
      faces:cards.filter(c=>c.isFaceCard).length,
      dora:cards.filter(c=>c.number===state.doraNumber).length
    };
  },
  // 捨て札からの相対的な危険度。捨てた数字も安全牌とはみなさない。
  danger(card,state,paymentAware=false) {
    const actor=state.currentPlayerIndex,suit=CardManager.suit(card,state);
    let risk=0;
    state.players.forEach((_,index)=>{
      if(index===actor)return;
      const dealerFactor=actor===state.dealerIndex||index===state.dealerIndex?1.5:1;
      // A minimum ron estimate, including the discarded dora. This is a risk
      // heuristic, not knowledge of an opponent's hand or its compound roles.
      const minimumLoss=2000*dealerFactor*(card.number===state.doraNumber?2:1);
      const survival=1+Math.max(0,minimumLoss-state.players[actor].score)/minimumLoss;
      const paymentFactor=paymentAware?dealerFactor*survival:1;
      const pile=state.discardPiles[index];
      if(!pile.length){risk+=0.5*paymentFactor;return;}
      const sameNumber=pile.filter(c=>c.number===card.number).length;
      const sameSuit=pile.filter(c=>CardManager.suit(c,state)===suit).length;
      const retention=(sameNumber?0.25:0.6)*0.5+(1-sameSuit/pile.length)*0.3+(card.isFaceCard?0.2:0);
      const readiness=0.25+0.75*Math.min(1,pile.length/state.maxTurns);
      risk+=retention*readiness*paymentFactor;
    });
    return risk;
  },
  evaluateDiscard(hand,index,state,profileId) {
    const actor=state.players[state.currentPlayerIndex];
    const profile=NPC_PROFILES[profileId||actor.npcId]||NPC_DEFAULT_PROFILE;
    const visible=new Set([...hand,...state.discardPiles.flat()].map(c=>c.id));
    const possible=CardManager.create().filter(c=>!visible.has(c.id));
    const rest=hand.filter((_,i)=>i!==index);
    let outs=0,multiplierTotal=0,preference=0;
    for(const draw of possible){
      const result=evaluateHand([...rest,draw],{
        currentSuit:state.currentSuit,doraNumber:state.doraNumber,winType:'ron',isFirstDraw:false
      });
      if(!result.isWinning)continue;
      outs++;multiplierTotal+=result.multiplier;
      preference+=Math.max(0,...result.roles.map(role=>profile.favorites[role]||0));
    }
    const features=this.features(rest,state);
    const shapeScore=Object.entries(profile.weights).reduce((sum,[key,weight])=>sum+features[key]*weight,0);
    // 低い持ち点、終盤では守備を強める。第四場で首位を追う場合は少し攻める。
    const lowScore=actor.score<=CONFIG.initialScoreByPlayerCount[state.playerCount||state.players.length]*0.4?1.6:1;
    const finalChase=state.roundNumber===4&&actor.score<Math.max(...state.players.map(p=>p.score))?0.8:1;
    const late=0.5+Math.min(1,state.turnNumber/state.maxTurns);
    const defensePenalty=this.danger(hand[index],state,profile.paymentAware)*profile.defense*lowScore*finalChase*late;
    const dealerBonus=profile.paymentAware&&state.currentPlayerIndex===state.dealerIndex?multiplierTotal*15*0.5:0;
    return {index,outs,multiplierTotal,preference,features,shapeScore,defensePenalty,dealerBonus,
      score:outs*100+multiplierTotal*15+preference+shapeScore+dealerBonus-defensePenalty};
  },
  chooseDiscard(hand,state,rng=Math.random,profileId) {
    let best=-Infinity,choices=[];
    hand.forEach((_,index)=>{
      const {score}=this.evaluateDiscard(hand,index,state,profileId);
      if(score>best+1e-9){best=score;choices=[index];}
      else if(Math.abs(score-best)<=1e-9)choices.push(index);
    });
    return choices[Math.floor(rng()*choices.length)];
  },
  act() {
    if(gameState.phase!=='draw'||gameState.currentPlayerIndex===0)return;
    const index=gameState.currentPlayerIndex;
    TurnManager.draw();
    if(gameState.phase!=='discard')return;
    const s=gameState;
    if(evaluateHand(s.players[index].hand, GameManager.context(index, 'tsumo')).isWinning)TurnManager.tsumo();
    else TurnManager.discard(this.chooseDiscard(s.players[index].hand, s));
  }
};
