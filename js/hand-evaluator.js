'use strict';
// 5枚の手札の役と倍率の判定
const HandEvaluator= {
  evaluate(cards, context) {
    const no= {
      isWinning:false,
      roles:[],
      hasDora:false,
      multiplier:0,
      paragonType:null
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
    add('trigon', faces>=3);
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
    add('asterism', freq.includes(3)&&freq.includes(2));
    add('colorless', straight&&!flush);
    add('flawless', flush&&!straight);
    add('fordite', cards.every(c=>c.number===1||c.number===9||c.isFaceCard));
    add('brilliant', straight&&flush);
    add('fourC', freq.includes(4));
    if(!roles.length)return no;
    const paragon=context.isFirstDraw&&context.winType==='tsumo';
    add('paragon', paragon);
    const hasDora=cards.some(c=>c.number===context.doraNumber);
    const roleUnits=roles.reduce((sum,id)=>sum+ROLE_VALUES[id],0);
    const hasRiichi=Boolean(context.riichi);
    const multiplier=roleUnits+(hasDora?1:0)+(hasRiichi?1:0);
    return {
      isWinning:true,
      roles,
      hasDora,
      hasRiichi,
      multiplier,
      roleUnits,
      basePoints:multiplier*1000,
      paragonType:paragon?(context.isDealer?'tenhou':'chihou'):null
    };
  }
};
function evaluateHand(cards, context) {
  return HandEvaluator.evaluate(cards, context);
}
