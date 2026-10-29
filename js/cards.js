'use strict';
// カード生成、手札の整列、シャッフル
const CardManager= {
  create() {
    const cards=[];
    for(const suit of CONFIG.suits)for(let n=1; n<=9; n++)cards.push( {
      id:suit+'_'+n,
      number:n,
      baseSuit:suit,
      isFaceCard:false
    });
    for(let n=10; n<=13; n++)cards.push( {
      id:'face_'+n,
      number:n,
      baseSuit:null,
      isFaceCard:true
    });
    return cards;
  },
  suit(card, state) {
    return card.isFaceCard?state.currentSuit:card.baseSuit;
  }
};
const HandSorter= {
  mode:'number',
  sorted(cards, state, mode=this.mode) {
    return [...cards].sort((a, b)=> {
      const number=a.number-b.number,
      suit=CONFIG.suits.indexOf(CardManager.suit(a, state))-CONFIG.suits.indexOf(CardManager.suit(b, state));
      return mode==='suit'?(suit||number):(number||suit);
    });
  }
};
const DeckManager= {
  shuffle(cards, rng=Math.random) {
    for(let i=cards.length-1; i>0; i--) {
      const j=Math.floor(rng()*(i+1));
      [cards[i], cards[j]]=[cards[j], cards[i]];
    }
    return cards;
  }
};
