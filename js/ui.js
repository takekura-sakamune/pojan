'use strict';
// 手札と対局情報の描画、ダブルタップ操作
const UIManager= {
  colors:['#f0ca7d', '#80d8cf', '#c4a3ef'],
  lastTap:null,
  openPortrait(npcId) {
    const npc=NPCPool.entries.find(p=>p.id===npcId);
    if(!npc)return;
    const dialog=document.getElementById('portrait-dialog');
    const image=document.getElementById('portrait-large');
    image.src=NPC_FULL_IMAGES[npcId];image.alt=npc.name;
    document.getElementById('portrait-title').textContent=npc.name;
    if(!dialog.open)dialog.showModal();
  },
  bindPortraits() {
    const dialog=document.getElementById('portrait-dialog');
    document.getElementById('close-portrait').onclick=()=>dialog.close();
    dialog.onclick=event=>{
      if(event.target!==dialog)return;
      const rect=dialog.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
    };
    dialog.oncancel=event=>{event.preventDefault();dialog.close();};
    const bind=(image,resolve)=>{
      image.setAttribute('role','button');image.setAttribute('tabindex','0');
      image.setAttribute('aria-haspopup','dialog');image.setAttribute('aria-controls','portrait-dialog');
      image.setAttribute('title','クリックして大きな画像を表示');
      image.onclick=()=>{if(!image.hidden)this.openPortrait(resolve());};
      image.onkeydown=event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();image.onclick();}
      };
    };
    bind(document.getElementById('npc-preview-image'),()=>MatchUI.selectedNPC);
    for(let index=1;index<=3;index++)bind(this.npcElement('npc-face',index),()=>gameState?.players[index]?.npcId);
  },
  roundLabel(round) {
    const label=document.createElement('span'),image=document.createElement('img');
    const suit=CONFIG.suits[(round-1)%CONFIG.suits.length];
    label.className='round-label';label.textContent=roundName(round);
    image.className='round-suit';image.src=CARD_IMAGES[suit];image.alt=SUITS[suit][1];image.draggable=false;
    label.append(image);return label;
  },
  motionNodes:new Set(),
  clearMotion() {
    for(const node of this.motionNodes)node.remove();
    this.motionNodes.clear();
  },
  playMotion() {
    const s=gameState,events=s.visualEvents||[];
    s.visualEvents=[];
    if(typeof window==='undefined'||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    for(const event of events) {
      const npc=event.player>0;
      if(event.type==='tsumo'||event.type==='ron') {
        const hand=npc?this.npcElement('npcHand',event.player):document.getElementById('playerHand');
        const panel=npc?this.npcElement('npcWin',event.player):document.getElementById('playerWin');
        if(typeof hand.animate!=='function')continue;
        hand.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)',offset:.3},{filter:'brightness(1)'}],{duration:700,easing:'ease-out'});
        if(panel.firstElementChild)panel.firstElementChild.animate([
          {opacity:0,transform:'scale(.65) translateY(10px)'},
          {opacity:1,transform:'scale(1.15)',offset:.55},
          {opacity:1,transform:'scale(1)'}
        ],{duration:550,easing:'ease-out'});
        continue;
      }
      const discard=event.type==='discard';
      const container=npc?this.npcElement(discard?'npcDiscards':'npcHand',event.player):document.getElementById(discard?'playerDiscards':'playerHand');
      const card=Array.from(container.children).find(node=>node.getAttribute('data-card-id')===event.cardId);
      if(!card||typeof card.animate!=='function')continue;
      const rect=card.getBoundingClientRect(),center=document.getElementById('center').getBoundingClientRect();
      if(!rect.width||!rect.height)continue;
      // A separate visual copy survives the NPC's immediate next render. It never receives input.
      const ghost=card.cloneNode(true),seat=npc?this.seatFor(event.player,s.playerCount):'south';
      const appearance=window.getComputedStyle(card);
      for(const property of appearance)ghost.style.setProperty(property,appearance.getPropertyValue(property));
      const rotation=appearance.transform==='none'?'':appearance.transform;
      const direction={south:[0,1],north:[0,-1],west:[-1,0],east:[1,0]}[seat];
      const dx=discard?direction[0]*65:Math.max(-100,Math.min(100,center.left+center.width/2-rect.left-rect.width/2));
      const dy=discard?direction[1]*65:Math.max(-100,Math.min(100,center.top+center.height/2-rect.top-rect.height/2));
      ghost.className+=' motion-card';ghost.setAttribute('aria-hidden','true');ghost.setAttribute('tabindex','-1');
      Object.assign(ghost.style,{position:'fixed',left:(rect.left+rect.width/2-card.offsetWidth/2)+'px',top:(rect.top+rect.height/2-card.offsetHeight/2)+'px',width:card.offsetWidth+'px',height:card.offsetHeight+'px',boxSizing:'border-box',margin:'0',pointerEvents:'none',zIndex:'1000'});
      document.body.append(ghost);this.motionNodes.add(ghost);
      const duration=discard?300:360;
      const animation=ghost.animate([
        {transform:`translate(${dx}px, ${dy}px) ${rotation} scale(${discard?1.15:.8})`,opacity:0},
        {opacity:1,offset:.2},
        {transform:`translate(0, 0) ${rotation} scale(1)`,opacity:1}
      ],{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
      card.animate([{opacity:0},{opacity:0}],{duration});
      const cleanup=()=>{ghost.remove();this.motionNodes.delete(ghost);};
      animation.onfinish=cleanup;animation.oncancel=cleanup;
    }
  },
  seatFor(index, count) {
    if(count===2)return 'north';
    if(index===1)return 'west';
    return count===4&&index===2?'north':'east';
  },
  tapCard(id, event) {
    const s=gameState;
    if(s.phase!=='discard'||s.currentPlayerIndex!==0)return;
    const index=s.players[0].hand.findIndex(c=>c.id===id);
    if(index<0)return;
    if(s.players[0].riichi&&s.players[0].hand[index].id!==s.players[0].lastDrawnId)return;
    const now=Date.now(),
    last=this.lastTap,
    keyboard=event&&event.detail===0;
    const twice=!keyboard&&last&&last.state===s&&last.drawCount===s.drawCount&&last.id===id&&s.selected===index&&now-last.at<=450;
    this.lastTap=keyboard?null: {
      state:s,
      drawCount:s.drawCount,
      id,
      at:now
    };
    if(twice) {
      this.lastTap=null;
      TurnManager.discard(index);
      return;
    }
    SoundManager.play('select');
    s.selected=index;
    this.render();
  },
  card(c, selectable=false, index=0) {
    const s=gameState,
    suit=CardManager.suit(c, s),
    el=document.createElement(selectable?'button':'div');
    el.className='card'+(suit==='heart'?' red':'')+(c.number===s.doraNumber?' dora':'')+(selectable&&s.selected===index?' selected':'');
    el.classList.add('illustrated');
    if(c.isFaceCard)el.classList.add('face-card');
    const art=document.createElement('img');
    art.className='card-art';
    art.src=CARD_IMAGES[c.isFaceCard?c.number:suit];
    art.alt='';
    art.draggable=false;
    const number=document.createElement('span');
    number.className='card-number';
    number.textContent=c.number;
    el.append(art, number);
    if(c.isFaceCard) {
      const gem=document.createElement('img');
      gem.className='face-suit';
      gem.src=CARD_IMAGES[suit];
      gem.alt='';
      gem.draggable=false;
      el.append(gem);
    }
    el.setAttribute('title', SUITS[suit][1]+' '+c.number);
    el.setAttribute('data-card-id',c.id);
    el.setAttribute('aria-label', SUITS[suit][1]+c.number+(c.number===s.doraNumber?' ドラ':''));
    if(selectable) {
      el.setAttribute('aria-pressed', String(s.selected===index));
      el.onclick=event=>this.tapCard(c.id, event);
    }
    return el;
  },
  note(el, text) {
    const note=document.createElement('small');
    note.className='card-note';
    note.textContent=text;
    el.append(note);
    el.setAttribute('aria-label', el.getAttribute('aria-label')+' '+text);
  },
  npcElement(base, index) {
    return document.getElementById(index===1?base:base+'-'+index);
  },
  renderHand(idx) {
    const s=gameState,
    r=s.result,
    won=r&&r.cards&&r.winner===idx,
    hand=idx?this.npcElement('npcHand',idx):document.getElementById('playerHand'),
    panel=idx?this.npcElement('npcWin',idx):document.getElementById('playerWin');
    hand.replaceChildren();
    panel.replaceChildren();
    hand.className='row'+(won?' winning-hand':'');
    const cards=won?r.cards:s.players[idx].hand;
    const role=won?(s.activeRole||r.roles.find(role=>role!=='paragon')):null;
    const groups=won?RolePresenter.groups(cards, role):[];
    const display=idx===0||won?HandSorter.sorted(cards, s):cards;
    for(const c of display) {
      if(idx>0&&s.phase!=='ended') {
        const back=document.createElement('div');
        back.className='card back';
        back.setAttribute('data-card-id',c.id);
        back.textContent='宝';
        back.setAttribute('aria-label', '伏せたカード');
        hand.append(back);
        continue;
      }
      const i=s.players[idx].hand.indexOf(c),
      el=this.card(c, idx===0&&s.currentPlayerIndex===0&&s.phase==='discard', i);
      if(idx===0&&s.players[0].riichi&&s.phase==='discard'&&c.id!==s.players[0].lastDrawnId)el.disabled=true;
      const drawn=!won&&s.currentPlayerIndex===idx&&s.phase==='discard'&&c.id===s.players[idx].lastDrawnId;
      if(drawn||(won&&c.id===r.winningCardId)) {
        el.classList.add('drawn');
        this.note(el, won&&r.type==='ron'?'ロン牌':'ツモ牌');
      }
      if(won) {
        const g=groups.findIndex(g=>g.ids.includes(c.id));
        if(g>=0) {
          el.classList.add('role-part');
          el.style.setProperty('--group-color', this.colors[g%this.colors.length]);
          const tag=document.createElement('small');
          tag.className='group-note';
          tag.textContent=groups[g].label;
          el.append(tag);
          el.setAttribute('aria-label', el.getAttribute('aria-label')+' '+groups[g].label);
        }
        else el.classList.add('role-unused');
      }
      hand.append(el);
    }
    if(!won)return;
    const title=document.createElement('strong');
    title.textContent=(r.type==='tsumo'?'ツモ':'ロン')+'！';
    panel.append(title, document.createTextNode(`基本点${r.basePoints||r.multiplier*1000}点（役${(r.roleUnits||r.multiplier)*1000}点・ドラ${r.hasDora?'+1000点':'なし'}・リーチ${r.hasRiichi?'+1000点':'なし'}）`));
    const tabs=document.createElement('div');
    tabs.className='role-tabs';
    tabs.setAttribute('aria-label', '成立役の組み合わせ');
    for(const id of r.roles) {
      const b=document.createElement('button');
      b.textContent=ROLE_NAMES[id];
      const description=ROLE_RULES[Object.keys(ROLE_NAMES).indexOf(id)]+` ／ ${ROLE_VALUES[id]*1000}点`+(id==='brilliant'?'（フローレス＋カラーレス）':'');
      b.setAttribute('title',description);
      b.setAttribute('aria-description',description);
      b.setAttribute('aria-pressed', String(id===role));
      b.onclick=()=> {
        s.activeRole=id;
        this.render();
      };
      tabs.append(b);
    }
    panel.append(tabs);
    const legend=document.createElement('div');
    legend.className='role-legend';
    groups.forEach((g, i)=> {
      const label=document.createElement('span');
      label.style.color=this.colors[i%this.colors.length];
      label.textContent=`${g.label}：${cards.filter(c=>g.ids.includes(c.id)).map(c=>SUITS[CardManager.suit(c,s)][0]+c.number).join('・')}`;
      legend.append(label);
    });
    if(role==='paragon')legend.append(document.createTextNode('（他の成立役は役名を選んで確認できます）'));
    panel.append(legend);
    const points=document.createElement('div');
    points.textContent=r.transfers.map(t=>`${s.players[t.from].name} → ${s.players[t.to].name} ${t.amount}点`).join('、');
    panel.append(points);
  },
  render() {
    const s=gameState,
    $=id=>document.getElementById(id);
    $('table').className='table-board players-'+s.playerCount;
    $('info').replaceChildren(...[`${roundName(s.roundNumber)} / 第${s.handNumber}局 / 第${s.turnNumber}巡`, `親：${s.players[s.dealerIndex].name}`, `ドラ：${s.doraNumber}`, `山札：${s.deck.length}枚`].map(text=> {
      const span=document.createElement('span');span.className='pill';span.textContent=text;return span;
    }));
    $('info').children[0].replaceChildren(this.roundLabel(s.roundNumber),document.createTextNode(` / 第${s.handNumber}局 / 第${s.turnNumber}巡`));
    const difficulty=document.createElement('span');difficulty.className='pill';difficulty.textContent='CPU：'+(s.difficulty==='easy'?'ノーマル':'本気');$('info').append(difficulty);
    for(let index=1;index<=3;index++) {
      const area=this.npcElement('npc-area',index);
      area.hidden=index>=s.playerCount;
      if(index>=s.playerCount)continue;
      const p=s.players[index];
      area.className='npc-area seat-'+this.seatFor(index,s.playerCount)+(s.currentPlayerIndex===index&&s.phase!=='ended'?' current-npc':'');
      this.npcElement('npcTitle',index).textContent=`${p.name}　${p.score}点${index===s.dealerIndex?'（親）':''}`;
      if(p.riichi)this.npcElement('npcTitle',index).textContent+='【リーチ】';
      this.npcElement('npc-face',index).src=NPC_FACE_IMAGES[p.npcId];
      this.npcElement('npc-face',index).alt=p.name;
      this.npcElement('npc-dialogue',index).replaceChildren(...p.npcLines.map(text=> {
        const line=document.createElement('p');line.textContent=text;return line;
      }));
      this.renderHand(index);
      this.npcElement('npcDiscards',index).replaceChildren(...s.discardPiles[index].map(c=>this.card(c)));
    }
    $('playerTitle').textContent=`${s.players[0].name}　${s.players[0].score}点`;
    if(s.players[0].riichi)$('playerTitle').textContent+='【リーチ】';
    $('turn').textContent=s.phase==='ended'?'対局結果':`${s.players[s.currentPlayerIndex].name}の手番 · 最大${s.maxTurns}巡`;
    $('message').textContent=s.message;
    this.renderHand(0);
    const waitLabel=$('riichi-waits');
    waitLabel.hidden=!s.players[0].riichi;
    if(s.players[0].riichi){
      const waits=TurnManager.riichiWaits(0);
      waitLabel.textContent=waits.length?'待ち牌：'+waits.map(c=>SUITS[CardManager.suit(c,s)][1]+' '+c.number).join(' ／ '):'待ち牌：未公開のアガリ牌は残っていません。';
    }else waitLabel.textContent='';
    $('playerDiscards').replaceChildren(...s.discardPiles[0].map(c=>this.card(c)));
    const can=s.currentPlayerIndex===0,
    win=can&&s.phase==='discard'&&evaluateHand(s.players[0].hand, GameManager.context(0, 'tsumo')).isWinning;
    const buttons=[['ツモ', can&&s.phase==='draw', ()=>TurnManager.draw()], ['ツモアガリ', win, ()=>TurnManager.tsumo()], ['ロン', s.phase==='ron', ()=>TurnManager.ron()], ['アガリを見送る', s.phase==='ron', ()=>TurnManager.skip()], ['打牌確定', can&&s.phase==='discard'&&s.selected!==null, ()=>TurnManager.discard(s.selected)]];
    if(can&&s.selected!==null&&TurnManager.canRiichi(s.selected))buttons.push(['リーチ（選択牌を捨てる）',true,()=>TurnManager.declareRiichi(s.selected)]);
    if(s.players[0].riichi){
      buttons[0][1]=false;
      buttons[4][1]=Boolean(win&&s.selected!==null);
      buttons.push(['ツモを見送る（ツモ切り）',Boolean(win),()=>TurnManager.skipTsumo()]);
    }
    if(s.phase==='ended'&&!s.gameOver)buttons.push(s.roundOver?['次の場へ', true, ()=>GameManager.nextRound()]:['次局へ', true, ()=>GameManager.nextHand()]);
    if(s.gameOver)buttons.push(['総合結果', true, ()=>MatchUI.results()], ['開始画面へ', true, ()=>MatchUI.showStart()]);
    $('actions').replaceChildren(...buttons.map(([label, enabled, action])=> {
      const b=document.createElement('button');
      b.textContent=label;
      b.disabled=!enabled;
      b.onclick=action;
      return b;
    }));
    const continuation=s.gameOver?'対戦が終了しました。「総合結果」で順位を確認できます。':'持ち点を引き継いで次の場へ進みます。';
    $('settlement').textContent=s.result&&s.roundOver?`${roundName(s.roundNumber)}終了：${s.endReason}。${ScoreManager.rank(s.players).map(p=>`${p.rank}位 ${p.name} ${p.score}点`).join(' ／ ')}。${ScoreManager.rank(s.players).filter(p=>p.rank===1).map(p=>p.name).join('・')}が1位。${continuation}`:'';
    if(s.result&&s.roundOver)$('settlement').replaceChildren(this.roundLabel(s.roundNumber),document.createTextNode($('settlement').textContent.slice(roundName(s.roundNumber).length)));
    $('log').replaceChildren(...s.logs.map(t=> {
      const d=document.createElement('div');
      d.textContent=t;
      return d;
    }));
    this.playMotion();
  }
};
