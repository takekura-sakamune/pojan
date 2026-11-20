'use strict';
// 5枚の手札の役と強さの判定
const HandEvaluator= {
  evaluate(cards, context) {
    const no= {
      isWinning:false,
      roles:[],
      hasDora:false, multiplier:0, paragonType:null, rank:0, maxNumber:0, maxSuit:0
    };
    if(cards.length!==5)return no;
    const counts= {};
    cards.forEach(c=>counts[c.number]=(counts[c.number]||0)+1);
    const ns=Object.keys(counts).map(Number).sort((a, b)=>a-b),
    freq=Object.values(counts),
    faces=cards.filter(c=>c.isFaceCard).length;
    const straight=ns.length===5&&ns[4]-ns[0]===4,
    flush=cards.every(c=>CardManager.suit(c, context)===CardManager.suit(cards[0], context));
    const roles=[];
    const add=(id, ok)=> {
      if(ok)roles.push(id);
    };
    add('pairshape', freq.filter(n=>n===2).length===2&&faces===1);
    add('trilliant', freq.includes(3)&&faces>=1);
    let cat=false;
    for(const n of ns)if(counts[n]>=2) {
      const rest=cards.filter(c=>c.number!==n);
      for(let k=0; k<counts[n]-2; k++)rest.push(cards.find(c=>c.number===n));
      const r=rest.map(c=>c.number).sort((a, b)=>a-b);
      if(r.length===3&&r[1]===r[0]+1&&r[2]===r[1]+1)cat=true;
    }
    add('catseye', cat);
    add('trigon', faces>=3);
    add('colorless', straight&&!flush);
    add('flawless', flush&&!straight);
    add('fordite', cards.every(c=>c.number===1||c.number===9||c.isFaceCard));
    add('asterism', freq.includes(3)&&freq.includes(2));
    add('fourC', freq.includes(4));
    add('brilliant', straight&&flush);
    if(!roles.length)return no;
    const strength=roles.slice().sort((a,b)=>ROLE_VALUES[b]-ROLE_VALUES[a])[0];
    const maxNumber=Math.max(...cards.map(c=>c.number));
    const maxSuit=Math.max(...cards.filter(c=>c.number===maxNumber).map(c=>CONFIG.suits.length-CONFIG.suits.indexOf(CardManager.suit(c,context))));
    return {
      isWinning:true, roles, strength, rank:ROLE_VALUES[strength], maxNumber, maxSuit,
      hasDora:cards.some(c=>c.number===context.doraNumber), multiplier:ROLE_VALUES[strength], roleUnits:ROLE_VALUES[strength], basePoints:0, hasRiichi:false, paragonType:null
    };
  }
};
function evaluateHand(cards, context) {
  return HandEvaluator.evaluate(cards, context);
}
