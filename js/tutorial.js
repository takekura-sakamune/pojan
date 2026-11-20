'use strict';
const Tutorial={
  current:0,
  visited:new Set(),
  roleExamples:{
    pairshape:['diamond_3','heart_3','spade_7','club_7','face_10'],
    trilliant:['diamond_5','heart_5','spade_5','face_10','club_2'],
    catseye:['diamond_4','heart_4','spade_5','club_6','diamond_7'],
    trigon:['face_10','face_11','face_12','diamond_3','heart_7'],
    colorless:['diamond_1','heart_2','spade_3','club_4','diamond_5'],
    flawless:['diamond_1','diamond_3','diamond_5','diamond_7','diamond_9'],
    fordite:['diamond_1','heart_9','face_10','face_11','face_12'],
    asterism:['diamond_2','heart_2','spade_2','diamond_7','heart_7'],
    fourC:['diamond_2','heart_2','spade_2','club_2','diamond_8'],
    brilliant:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5']
  },
  scenes:[
    {label:'対局開始',title:'5枚の手札で役を作る',message:'宝雀は、最初に配られる4枚の手札を交換で整え、役の強さと数字で勝負するゲームです。このリプレイではカードと展開を固定して、1局の流れを見ていきます。',hand:['diamond_1','diamond_2','diamond_3','heart_9'],backs:4,pot:'ポット：0点'},
    {label:'あなたの交換',title:'ドロー',message:'自分の交換手番では山札から1枚引きます。手札は一時的に5枚になります。',hand:['diamond_1','diamond_2','diamond_3','heart_9','diamond_4'],backs:4,pot:'ポット：0点'},
    {label:'あなたの交換',title:'カードを捨てる',message:'引いた後、手札から1枚を選んで捨てます。ここではハートの9を捨て、手札を4枚に戻します。',hand:['diamond_1','diamond_2','diamond_3','diamond_4'],backs:4,discard:['heart_9'],discardLabel:'あなたの捨て札',pot:'ポット：0点'},
    {label:'相手の交換',title:'相手の捨て札に注目',message:'相手も1枚引いて1枚捨てます。相手が♦5を捨てました。このカードを加えて役が完成するなら、ロンできます。',hand:['diamond_1','diamond_2','diamond_3','diamond_4'],backs:4,discard:['diamond_5'],discardLabel:'相手の捨て札',pot:'ポット：0点'},
    {label:'ロン',title:'ロンして捨て札を受け取る',message:'ロンすると、対象の捨て札を手札に加えてストップします。ロンできるのは、そのカードを加えた時に役が完成する場合だけです。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,discard:[],discardLabel:'相手の捨て札',handNote:'ロンした♦5を手札に加えました',pot:'ポット：0点'},
    {label:'役の完成',title:'ブリリアントが完成',message:'♦1〜♦5の同スート連番なので、ブリリアントです。役の強さは、ペアシェイプ ＜ トリリアント ＜ キャッツアイ ＜ トライゴン ＜ カラーレス ＜ フローレス ＜ フォーダイト ＜ アステリズム ＜ 4C ＜ ブリリアント。複数の役があれば最も強い役で比べます。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,handNote:'ブリリアント（同スートの5連番）',pot:'ポット：0点'},
    {label:'役の種類',title:'役の実例をカードで確認',message:'各役の成立条件と実際のカード例を確認しましょう。ここでの絵札は、今局のスートをダイアとして表示しています。絵札のスートは局ごとに変わります。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,handNote:'下に全10役の例を表示しています',pot:'役一覧'},
    {label:'ベット',title:'ベットする',message:'ストップが全員に行き渡るか規定巡数が終わるとベットです。ここではあなたが1000点をベットします。相手は最高ベット額に合わせるか、さらに上げるか、フォールドします。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,handNote:'ブリリアント',opponentNote:'まだ応答していません',pot:'ポット：1000点 ／ あなたの投入：1000点'},
    {label:'ベット',title:'相手がレイズ',message:'相手がさらに1000点を加え、最高ベット額を2000点に上げました。あなたの必要額は「現在の最高ベット額 − 自分のラウンド投入額」なので、ここでは1000点です。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,handNote:'ブリリアント',opponentNote:'レイズ：合計2000点',pot:'ポット：3000点 ／ 最高ベット：2000点 ／ あなたの必要額：1000点'},
    {label:'コール・ショーダウン',title:'コールして勝負を決める',message:'コールで必要な1000点を追加します。ベットが終了したらショーダウンし、役の強さ・手札の最大数字・その数字のスートの順で比べます。この例ではブリリアントが完成したあなたの勝ちです。',hand:['diamond_1','diamond_2','diamond_3','diamond_4','diamond_5'],backs:4,handNote:'ブリリアント ／ コール：1000点',opponentNote:'あなたのコールに応答',pot:'ポット：4000点 ／ ショーダウン'}
  ],
  positionButton(){
    const button=document.getElementById('open-tutorial');
    if(PlayerRecords.progress.achievements['tutorial-viewed'])document.getElementById('reset-action-row').append(button);
    else document.getElementById('start-game').parentElement.insertBefore(button,document.getElementById('start-game'));
  },
  complete(){
    const id='tutorial-viewed',p=PlayerRecords.progress;
    if(p.achievements[id]||this.visited.size<this.scenes.length)return;
    const definition=Progression.achievementDefinitions.find(item=>item.id===id);
    const amount=Progression.credit(p,'achievement:'+id,definition.reward,definition.name);
    p.achievements[id]={unlockedAt:new Date().toISOString()};
    PlayerRecords.write();this.positionButton();MatchUI.renderProgress();
    document.getElementById('tutorial-progress').textContent=`リプレイ完了！ 実績解除：${definition.name}（${amount} GP）`;
  },
  makeCard(id){
    const card=CardManager.create().find(item=>item.id===id);if(!card)return document.createElement('span');
    const suit=CardManager.suit(card,{currentSuit:'diamond'}),el=document.createElement('div');
    el.className='card illustrated'+(suit==='heart'?' red':'');
    if(card.isFaceCard)el.classList.add('face-card');
    const art=document.createElement('img');art.className='card-art';art.src=CARD_IMAGES[card.isFaceCard?card.number:suit];art.alt='';art.draggable=false;
    const number=document.createElement('span');number.className='card-number';number.textContent=card.number;
    el.append(art,number);
    if(card.isFaceCard){const mark=document.createElement('img');mark.className='face-suit';mark.src=CARD_IMAGES[suit];mark.alt='';el.append(mark);}
    el.title=`${SUITS[suit][1]} ${card.number}`;el.setAttribute('aria-label',el.title);return el;
  },
  render(){
    const scene=this.scenes[this.current];
    document.getElementById('tutorial-progress').textContent=`リプレイ ${this.current+1} / ${this.scenes.length}`;
    document.getElementById('tutorial-scene-label').textContent=scene.label;
    document.getElementById('tutorial-popup-title').textContent=scene.title;
    document.getElementById('tutorial-popup-message').textContent=scene.message;
    const roleGuide=document.getElementById('tutorial-role-guide');
    roleGuide.hidden=this.current!==6;
    const dialog=document.getElementById('tutorial-dialog');dialog.scrollTop=0;
    if(this.current===6)roleGuide.scrollIntoView({block:'nearest'});
    const player=document.getElementById('tutorial-player-hand'),opponent=document.getElementById('tutorial-opponent-hand'),discard=document.getElementById('tutorial-discard');
    player.replaceChildren(...scene.hand.map(id=>this.makeCard(id)));
    opponent.replaceChildren(...Array.from({length:scene.backs},()=>{const back=document.createElement('div');back.className='card back';back.textContent='宝';back.setAttribute('aria-label','相手の手札');return back;}));
    discard.replaceChildren(...(scene.discard||[]).map(id=>this.makeCard(id)));
    document.getElementById('tutorial-discard-label').textContent=scene.discardLabel||'相手の捨て札';
    document.getElementById('tutorial-pot').textContent=scene.pot;
    document.getElementById('tutorial-deck-note').textContent='固定カード順：あなたのドロー ♦4 → 相手の捨て札 ♦5';
    document.getElementById('tutorial-hand-note').textContent=scene.handNote||'';
    document.getElementById('tutorial-opponent-note').textContent=scene.opponentNote||'';
    const next=document.getElementById('tutorial-next');
    next.textContent='次へ';next.disabled=this.current===this.scenes.length-1;
    this.visited.add(this.current);this.complete();
  },
  open(){
    if(!window.confirm('チュートリアルを始めますか？（チュートリアルを確認すると100GPが入手できます）'))return;
    const dialog=document.getElementById('tutorial-dialog');this.current=0;this.visited=new Set();this.render();
    if(!dialog.open)dialog.showModal();
  },
  close(){const dialog=document.getElementById('tutorial-dialog');if(dialog.open)dialog.close();},
  bind(){
    this.positionButton();
    document.getElementById('tutorial-role-examples').replaceChildren(...Object.entries(ROLE_NAMES).map(([id,name],index)=>{
      const item=document.createElement('li'),heading=document.createElement('strong'),rule=document.createElement('p'),cards=document.createElement('div'),example=document.createElement('p');
      heading.textContent=`${index+1}. ${name}`;
      rule.textContent=ROLE_RULES[index];
      cards.className='tutorial-example-cards';cards.setAttribute('aria-label',`${name}の手札例`);
      cards.append(...this.roleExamples[id].map(cardId=>this.makeCard(cardId)));
      example.textContent='手札の例';
      item.append(heading,rule,example,cards);
      if(id==='pairshape'||id==='trilliant'){
        const note=document.createElement('p');note.className='tutorial-role-warning';
        note.textContent=id==='pairshape'?'絵札が1枚必要です。絵札のない2ペアは役になりません。':'絵札が1枚以上必要です。絵札のない3カードは役になりません。';
        item.append(note);
      }
      return item;
    }));
    document.getElementById('open-tutorial').onclick=()=>this.open();
    document.getElementById('open-tutorial-game').onclick=()=>this.open();
    document.getElementById('close-tutorial').onclick=()=>this.close();
    document.getElementById('tutorial-next').onclick=()=>{
      if(this.current<this.scenes.length-1){this.current++;this.render();}
      else this.close();
    };
    const dialog=document.getElementById('tutorial-dialog');
    dialog.oncancel=event=>{event.preventDefault();this.close();};
  }
};
Tutorial.bind();
