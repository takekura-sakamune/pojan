'use strict';
// 役を構成するカードの組み合わせ
const RolePresenter= {
  groups(cards, role) {
    const byNumber=new Map();
    for(const c of cards) {
      if(!byNumber.has(c.number))byNumber.set(c.number, []);
      byNumber.get(c.number).push(c);
    }
    const group=(label, cs)=>( {
      label,
      ids:cs.map(c=>c.id)
    }),
    sets=[...byNumber.values()];
    switch(role) {
      case 'trigon':return [group('絵札', cards.filter(c=>c.isFaceCard))];
      case 'pairshape':return [...sets.filter(cs=>cs.length===2).map((cs, i)=>group('ペア'+(i+1), cs)), group('絵札', cards.filter(c=>c.isFaceCard))];
      case 'trilliant':return [group('3カード', sets.find(cs=>cs.length===3)||[]), group('絵札', cards.filter(c=>c.isFaceCard))];
      case 'catseye':for(const cs of sets) {
        if(cs.length<2)continue;
        const pair=cs.slice(0, 2),
        rest=cards.filter(c=>!pair.includes(c)).sort((a, b)=>a.number-b.number);
        if(rest[1].number===rest[0].number+1&&rest[2].number===rest[1].number+1)return [group('ペア', pair), group('連番', rest)];
      }
      return [];
      case 'asterism':return [group('3カード', sets.find(cs=>cs.length===3)||[]), group('ペア', sets.find(cs=>cs.length===2)||[])];
      case 'fourC':return [group('4カード', sets.find(cs=>cs.length===4)||[])];
      default:return [group( {
        colorless:'5枚の連番',
        flawless:'同じスート',
        fordite:'1・9・絵札',
        brilliant:'同スートの連番',
        paragon:'初回ツモ'
      }
      [role]||'', cards)];
    }
  }
};
