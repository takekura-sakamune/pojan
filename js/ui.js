'use strict';
// 手札と対局情報の描画、ダブルタップ操作
const UIManager= {
  colors:['#f0ca7d', '#80d8cf', '#c4a3ef'],
  lastTap:null,
  openPortrait(npcId) {
    const npc=NPCPool.entries.find(p=>p.id===npcId);
    if(!npc)return;
    this.openImagePortrait(NPC_FULL_IMAGES[npcId],npc.name);
  },
  openImagePortrait(src,name) {
    const dialog=document.getElementById('portrait-dialog');
    const image=document.getElementById('portrait-large');
    image.src=src;image.alt=name;
    document.getElementById('portrait-title').textContent=name;
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
    const bind=(image,resolve,open=id=>this.openPortrait(id))=>{
      image.setAttribute('role','button');image.setAttribute('tabindex','0');
      image.setAttribute('aria-haspopup','dialog');image.setAttribute('aria-controls','portrait-dialog');
      image.setAttribute('title','クリックして大きな画像を表示');
      image.onclick=()=>{if(!image.hidden)open(resolve());};
      image.onkeydown=event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();image.onclick();}
      };
    };
    bind(document.getElementById('npc-preview-image'),()=>MatchUI.selectedNPC);
    bind(document.getElementById('shop-keeper-image'),()=>({src:'picture/shop.png',name:'占い師'}),portrait=>this.openImagePortrait(portrait.src,portrait.name));
    bind(document.getElementById('shop-category-image'),()=>{
      const category=MatchUI.shopCategories[MatchUI.shopCategory];
      return {src:category.image,name:category.label+'のGSのキャラクター'};
    },portrait=>this.openImagePortrait(portrait.src,portrait.name));
    for(let index=1;index<=3;index++)bind(this.npcElement('npc-face',index),()=>gameState?.players[index]?.npcId);
  },
  roundLabel(round) {
    const label=document.createElement('span'),image=document.createElement('img');
    const suit=CONFIG.suits[(round-1)%CONFIG.suits.length];
    label.className='round-label';label.textContent=roundName(round);
    image.className='round-suit';image.src=CARD_IMAGES[suit];image.alt=SUITS[suit][1];image.draggable=false;
    label.append(image);return label;
  },
  gsMotion:null,
  tableLayoutLock:null,
  lockSideResultLayout() {
    const s=gameState;
    if(this.tableLayoutLock?.state===s)return;
    if(typeof window==='undefined')return;
    const table=document.getElementById('table');
    const rows=window.getComputedStyle(table).gridTemplateRows;
    if(!rows||rows==='none')return;
    const frames=['npc-area-2','player-area'].map(id=>document.getElementById(id));
    const heights=frames.map(frame=>frame.getBoundingClientRect().height);
    if(heights.some(height=>!height))return;
    // 正面と中央の行を固定し、下段は操作ボタンの高さに合わせて伸ばす。
    this.tableLayoutLock={state:s,rows:table.style.gridTemplateRows,
      paddingBottom:table.style.paddingBottom,basePadding:parseFloat(window.getComputedStyle(table).paddingBottom)||0,extraPadding:0,
      frames:frames.map(frame=>({frame,height:frame.style.height,minHeight:frame.style.minHeight}))};
    const rowSizes=rows.trim().split(/\s+/);
    table.style.gridTemplateRows=rowSizes.map((size,i)=>i<2?size:'auto').join(' ');
    frames[0].style.height=heights[0]+'px';
    frames[1].style.minHeight=heights[1]+'px';
  },
  unlockTableLayout() {
    const lock=this.tableLayoutLock;if(!lock)return;
    document.getElementById('table').style.gridTemplateRows=lock.rows||'';
    document.getElementById('table').style.paddingBottom=lock.paddingBottom||'';
    for(const {frame,height,minHeight} of lock.frames){frame.style.height=height||'';frame.style.minHeight=minHeight||'';}
    this.tableLayoutLock=null;
  },
  fitSideResultOverflow() {
    const lock=this.tableLayoutLock;if(!lock||lock.state!==gameState)return;
    const table=document.getElementById('table'),rect=table.getBoundingClientRect();
    const baseBottom=rect.top+rect.height-lock.extraPadding;
    const bottom=Math.max(...[1,3].map(i=>{
      const side=this.npcElement('npc-area',i).getBoundingClientRect();return side.top+side.height;
    }));
    const extra=Math.max(0,Math.ceil(bottom-baseBottom));
    // 下側にだけ余白を足すため、中央列の席は移動せず左右枠も切れない。
    table.style.paddingBottom=(lock.basePadding+extra)+'px';lock.extraPadding=extra;
  },
  positionMotionCard(ghost,layout) {
    // Gridの中央揃えと論理insetを持ち出すと、fixed要素が画面中央へずれる。
    // 見た目のコピー後に配置を初期化し、viewport座標だけで置く。
    Object.assign(ghost.style,{
      inset:'auto',insetBlock:'auto',insetInline:'auto',
      alignSelf:'auto',justifySelf:'auto',
      ...layout
    });
  },
  gsLocations() {
    const s=gameState,map=new Map();
    const add=(cards,zone)=>cards.forEach((card,index)=>map.set(card.id,{card:{...card},zone,index}));
    add(s.deck,'deck');s.players.forEach((p,i)=>add(p.hand,'hand:'+i));
    s.discardPiles.forEach((pile,i)=>add(pile,'discard:'+i));
    if(s.gsKeep)add([s.gsKeep],'keep');return map;
  },
  gsCardNodes() {
    const map=new Map();
    const visit=node=>{
      if(!node)return;
      const id=typeof node.getAttribute==='function'?node.getAttribute('data-card-id'):null;
      if(id&&!map.has(id))map.set(id,node);
      for(const child of Array.from(node.children||[]))visit(child);
    };
    visit(document.getElementById('playerHand'));
    for(let i=1;i<gameState.playerCount;i++)visit(this.npcElement('npcHand',i));
    visit(document.getElementById('playerDiscards'));
    for(let i=1;i<gameState.playerCount;i++)visit(this.npcElement('npcDiscards',i));
    visit(document.getElementById('gs-game'));return map;
  },
  captureGSMotion() {
    if(typeof window==='undefined')return;
    const nodes=this.gsCardNodes(),origins=new Map();
    for(const [id,node] of nodes)if(typeof node.getBoundingClientRect==='function'){
      const rect=node.getBoundingClientRect();if(rect.width&&rect.height)origins.set(id,{rect,node});
    }
    this.gsMotion={state:gameState,locations:this.gsLocations(),origins};
  },
  playGSMotion(events) {
    const snapshot=this.gsMotion;this.gsMotion=null;
    if(!snapshot||snapshot.state!==gameState||typeof window==='undefined'||
      (window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    const nodes=this.gsCardNodes(),locations=this.gsLocations();
    const center=document.getElementById('center');if(typeof center.getBoundingClientRect!=='function')return;
    const deckRect=center.getBoundingClientRect();
    for(const [id,after] of locations){
      const before=snapshot.locations.get(id);if(!before||(before.zone===after.zone&&(after.zone!=='deck'||before.index===after.index)))continue;
      // 通常打牌と同じイベントがある時は既存の演出に任せる。
      if(events.some(e=>e.cardId===id))continue;
      const origin=snapshot.origins.get(id),target=nodes.get(id);
      const source=origin?.rect||deckRect;
      const destination=after.zone==='deck'?deckRect:target?.getBoundingClientRect?.();
      if(!destination||(!origin&&!target)||!source.width||!destination.width)continue;
      const template=after.zone==='deck'?origin?.node:target;
      if(!template||typeof template.animate!=='function')continue;
      const ghost=template.cloneNode(true);
      const appearance=window.getComputedStyle(template);
      for(const property of appearance)ghost.style.setProperty(property,appearance.getPropertyValue(property));
      const width=target?.offsetWidth||origin?.node.offsetWidth||52,height=target?.offsetHeight||origin?.node.offsetHeight||72;
      const fromX=source.left+(source.width-width)/2,fromY=source.top+(source.height-height)/2;
      const toX=destination.left+(destination.width-width)/2,toY=destination.top+(destination.height-height)/2;
      ghost.className+=' motion-card';ghost.setAttribute('aria-hidden','true');ghost.setAttribute('tabindex','-1');
      this.positionMotionCard(ghost,{position:'fixed',left:fromX+'px',top:fromY+'px',width:width+'px',height:height+'px',margin:'0',pointerEvents:'none',zIndex:'1000',transform:'none'});
      document.body.append(ghost);this.motionNodes.add(ghost);
      const animation=ghost.animate([{transform:'translate(0, 0)',opacity:1},{transform:`translate(${toX-fromX}px, ${toY-fromY}px)`,opacity:after.zone==='deck'?0:1}],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)'});
      if(target&&after.zone!=='deck')target.animate([{opacity:0},{opacity:0}],{duration:360});
      const cleanup=()=>{ghost.remove();this.motionNodes.delete(ghost);};animation.onfinish=cleanup;animation.oncancel=cleanup;
    }
  },
  motionNodes:new Set(),
  clearMotion() {
    this.gsMotion=null;
    for(const node of this.motionNodes)node.remove();
    this.motionNodes.clear();
  },
  playMotion() {
    const s=gameState,events=s.visualEvents||[];
    s.visualEvents=[];
    this.playGSMotion(events);
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
      this.positionMotionCard(ghost,{position:'fixed',left:(rect.left+rect.width/2-card.offsetWidth/2)+'px',top:(rect.top+rect.height/2-card.offsetHeight/2)+'px',width:card.offsetWidth+'px',height:card.offsetHeight+'px',boxSizing:'border-box',margin:'0',pointerEvents:'none',zIndex:'1000'});
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
  renderCenterCards() {
    const s=gameState,root=document.getElementById('center-cards');
    root.hidden=s.playerCount!==4;
    if(root.hidden)return;
    // ドラは表示専用。山札のカードを取り出したり、中身を公開したりしない。
    const dora=this.card({id:'dora-display',number:s.doraNumber,isFaceCard:true,baseSuit:null});
    dora.setAttribute('aria-label',`ドラ：${SUITS[s.currentSuit][1]} ${s.doraNumber}`);
    document.getElementById('center-dora').replaceChildren(dora);
    const deck=document.getElementById('center-deck'),count=s.deck.length;
    document.getElementById('center-deck-label').textContent=`山札 ${count}枚`;
    deck.setAttribute('role','img');deck.setAttribute('aria-label',`残り山札${count}枚`);
    const backs=[];
    for(let i=0;i<Math.min(6,count);i++){
      const back=document.createElement('div');back.className='card back';back.textContent='宝';
      back.setAttribute('aria-hidden','true');back.style.left=(i*3)+'px';back.style.top=((5-i)*2)+'px';backs.push(back);
    }
    deck.replaceChildren(...backs);
  },
  render() {
    const s=gameState,
    $=id=>document.getElementById(id);
    const sideWin=s.playerCount===4&&s.phase==='ended'&&s.result&&
      s.result.type!=='draw'&&[1,3].includes(s.result.winner);
    if(sideWin)this.lockSideResultLayout();
    $('table').className='table-board players-'+s.playerCount;
    if(this.tableLayoutLock?.state===s)$('table').className+=' side-result-locked';
    $('info').replaceChildren(...[`${roundName(s.roundNumber)} / 第${s.handNumber}局 / 第${s.turnNumber}巡`, `親：${s.players[s.dealerIndex].name}`, `ドラ：${s.doraNumber}`, `山札：${s.deck.length}枚`].map(text=> {
      const span=document.createElement('span');span.className='pill';span.textContent=text;return span;
    }));
    $('info').children[0].replaceChildren(this.roundLabel(s.roundNumber),document.createTextNode(` / 第${s.handNumber}局 / 第${s.turnNumber}巡`));
    const difficulty=document.createElement('span');difficulty.className='pill';difficulty.textContent='CPU：'+(s.difficulty==='easy'?'ノーマル':'本気');$('info').append(difficulty);
    this.renderCenterCards();
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
    win=can&&s.phase==='discard'&&(s.players[0].hand.length>5?Boolean(GemSkillEngine.best()):evaluateHand(s.players[0].hand, GameManager.context(0, 'tsumo')).isWinning);
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
    GemSkillEngine.render();
    this.fitSideResultOverflow();
    this.playMotion();
  }
};
