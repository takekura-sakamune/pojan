'use strict';
// 投稿用画像は結果表示時に準備し、共有ボタンのタップ内で直ちに渡す。
const ResultImage={
  state:null,ready:null,lastError:null,
  portraitDataPromise:null,
  localPortraitData(){
    if(typeof location==='undefined'||location.protocol!=='file:')return Promise.resolve(null);
    if(globalThis.RESULT_PORTRAITS)return Promise.resolve(globalThis.RESULT_PORTRAITS);
    if(this.portraitDataPromise)return this.portraitDataPromise;
    this.portraitDataPromise=new Promise(resolve=>{
      const script=document.createElement('script');let timer;
      const finish=data=>{
        clearTimeout(timer);script.onload=null;script.onerror=null;
        if(!data)this.portraitDataPromise=null;
        resolve(data);
      };
      timer=setTimeout(()=>finish(null),10000);
      script.onload=()=>finish(globalThis.RESULT_PORTRAITS||null);
      script.onerror=()=>finish(null);script.src='js/result-portraits.js';
      document.head.append(script);
    });
    return this.portraitDataPromise;
  },
  status(text){document.getElementById('result-image-status').textContent=text;},
  loadImage(src){
    if(typeof Image==='undefined')return Promise.resolve(null);
    return new Promise(resolve=>{
      const image=new Image();let timer;
      const finish=value=>{clearTimeout(timer);image.onload=null;image.onerror=null;resolve(value);};
      timer=setTimeout(()=>finish(null),3000);
      image.onload=()=>finish(image);image.onerror=()=>finish(null);image.src=src;
    });
  },
  async prepare(state,totals,text){
    if(this.state===state)return;
    this.state=state;
    if(this.ready)URL.revokeObjectURL(this.ready.url);
    this.ready=null;
    document.getElementById('result-image-preview').hidden=true;
    document.getElementById('save-result-image').disabled=true;
    document.getElementById('share-result-image').disabled=true;
    this.status('投稿用画像を準備しています…');
    let stage='準備';this.lastError=null;
    try {
      stage='描画の初期化';
      const canvas=document.createElement('canvas');
      if(typeof canvas.getContext!=='function')throw Error('canvas unavailable');
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas unavailable');
      const rows=totals.map(p=>({...p,npcId:state.players[p.index].npcId}));
      const count=state.playerCount,round=state.roundNumber,early=state.players.some(p=>p.score<=0);
      const embedded=await this.localPortraitData();
      const portraits=await Promise.all(rows.map(p=>p.npcId?this.loadImage(embedded?.[p.npcId]||NPC_FACE_IMAGES[p.npcId]):Promise.resolve(null)));
      if(this.state!==state)return;
      let portraitsOmitted=false;
      const render=includePortraits=>{
      // Resetting the dimensions also clears a canvas tainted by local file images.
      canvas.width=1200;canvas.height=390+rows.length*125;
      ctx.fillStyle='#10272b';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle='#d9bb7c';ctx.lineWidth=3;ctx.strokeRect(22,22,1156,canvas.height-44);
      const write=(value,x,y,size,color='#f1e3bf',align='left',maxWidth)=>{
        ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`bold ${size}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;
        ctx.fillText(String(value),x,y,maxWidth||1100);
      };
      write('宝雀 — ポージャン',60,96,48,'#f1d495');
      write('総合結果',60,153,30);
      write(`${count}人対戦${state.difficulty?'（'+(state.difficulty==='easy'?'ノーマル':'本気')+'）':''} ／ ${early?`第${round}場・持ち点0点以下で終了`:'第四場終了'}`,60,203,24,'#a9c7c3');
      rows.forEach((p,index)=>{
        const y=235+index*125;
        ctx.fillStyle=p.index===0?'#34534c':'#1d3a3e';ctx.fillRect(55,y,1090,108);
        write(`${p.rank}位`,77,y+66,34,p.rank===1?'#f1d495':'#f1e3bf');
        if(includePortraits&&portraits[index])ctx.drawImage(portraits[index],177,y+10,88,88);
        write(p.name,285,y+64,30,'#f1e3bf','left',490);
        write(`${p.finalScore.toLocaleString('ja-JP')}点`,1118,y+66,39,'#f1d495','right',320);
      });
      write('最終所持点で順位を決定 ／ 同点は同順位',60,canvas.height-94,22,'#a9c7c3');
      write('#宝雀 #宝雀ランキング',60,canvas.height-48,28,'#f1d495');
      };
      const encode=()=>new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PNG failed')),'image/png'));
      stage='画像の描画';render(true);
      stage='PNGへの変換';
      let blob;
      try {blob=await encode();}
      catch(error){
        if(error.name!=='SecurityError')throw error;
        portraitsOmitted=true;render(false);blob=await encode();
      }
      if(this.state!==state)return;
      // File sharing may be unavailable even when PNG saving works.
      let file=null;
      try {if(typeof File==='function')file=new File([blob],'pojan-result.png',{type:'image/png'});}catch(_){}
      stage='保存用画像の準備';
      this.ready={blob,file,text,url:URL.createObjectURL(blob),portraitsOmitted};
      document.getElementById('save-result-image').disabled=false;
      document.getElementById('share-result-image').disabled=false;
      this.status(portraitsOmitted?'ローカル画像の制限により、キャラクター画像を省いて作成しました。結果画像の保存・共有ができます。':'画像を保存、または共有メニューからXなどへ送れます。');
    }catch(error){
      if(this.state===state){
        this.state=null;this.lastError={stage,name:error.name||'Error',message:error.message||''};
        this.status(`画像を作成できませんでした（${stage}：${this.lastError.name}）。`);
      }
    }
  },
  preview(){
    if(!this.ready)return;
    document.getElementById('result-image-output').src=this.ready.url;
    document.getElementById('result-image-download').href=this.ready.url;
    document.getElementById('result-image-preview').hidden=false;
  },
  save(){
    if(!this.ready)return;
    this.preview();
    try {
      const link=document.createElement('a');link.href=this.ready.url;link.download='pojan-result.png';
      document.body.append(link);link.click();link.remove();
      this.status('保存を開始しました。保存されない場合は下の画像を長押ししてください。');
    }catch(_){this.status('下の画像を長押し、またはダウンロードリンクから保存してください。');}
  },
  async share(){
    if(!this.ready)return;
    const {file,text}=this.ready;
    try {
      if(!file||typeof navigator==='undefined'||!navigator.share||!navigator.canShare||!navigator.canShare({files:[file]})){
        this.preview();this.status('この環境では画像共有に対応していません。画像を保存してXに添付してください。');return;
      }
      await navigator.share({files:[file],text,title:'宝雀 総合結果'});
      this.status('画像を共有先へ渡しました。投稿内容は共有先で確認してください。');
    }catch(error){
      if(error.name==='AbortError'){this.status('共有をキャンセルしました。');return;}
      this.preview();this.status('画像を共有できませんでした。画像を保存してXに添付してください。');
    }
  }
};
// 開始画面と最終結果
const MatchUI= {
  selectedNPC:'random',
  shopCategory:'hand',
  shopCategories:{
    hand:{label:'手札',image:'picture/skill_hand.png',description:'交換・保管・数字の変更など、手札を整えるGSです。'},
    stock:{label:'山札',image:'picture/skill_stock.png',description:'引き直し・並べ替えなど、山札に働きかけるGSです。'},
    wisdom:{label:'情報',image:'picture/skill_wisdom.png',description:'相手の手札や山札などの情報を確認するGSです。'}
  },
  selectShopCategory(category) {
    if(!this.shopCategories[category])return;
    this.shopCategory=category;
    document.getElementById('progress-status').textContent='';
    this.renderProgress();
  },
  updateNPCSelection() {
    const twoPlayer=Number(document.getElementById('player-count').value)===2;
    document.getElementById('npc-selection').hidden=!twoPlayer;
    const options=[{id:'random',name:'ランダム'}, ...NPCPool.entries];
    document.getElementById('npc-options').replaceChildren(...options.map(npc=> {
      const button=document.createElement('button');
      button.type='button';
      button.className='npc-choice'+(npc.id==='random'?' npc-choice-random':'');
      button.setAttribute('aria-pressed',String(this.selectedNPC===npc.id));
      button.setAttribute('aria-label',npc.name);
      const label=document.createElement('span');label.className='npc-choice-name';label.textContent=npc.name;button.append(label);
      button.onclick=()=>{this.selectedNPC=npc.id;this.updateNPCSelection();};
      return button;
    }));
    const selected=twoPlayer?NPCPool.entries.find(npc=>npc.id===this.selectedNPC):null;
    const image=document.getElementById('npc-preview-image');
    image.hidden=!selected;
    document.getElementById('npc-preview-placeholder').hidden=Boolean(selected);
    if(selected){image.src=NPC_FULL_IMAGES[selected.id];image.alt=selected.name;}
    document.getElementById('npc-preview-name').textContent=selected?selected.name:twoPlayer?'ランダム':'NPCをランダムに選出';
  },
  hidePlayerScreens() {
    for(const name of ['shop','stats','achievements'])document.getElementById(name+'-screen').hidden=true;
  },
  showPlayerScreen(name) {
    if(!['shop','stats','achievements'].includes(name))return;
    this.equipmentSwap=null;
    this.hidePlayerScreens();
    document.getElementById('start-screen').hidden=true;
    document.getElementById('game-screen').hidden=true;
    document.getElementById('final-screen').hidden=true;
    document.getElementById(name+'-screen').hidden=false;
    this.renderRecords();
    const title=document.getElementById(name+'-title');
    if(typeof title.focus==='function')title.focus();
  },
  showStart() {
    this.equipmentSwap=null;
    this.hidePlayerScreens();
    UIManager.clearMotion();
    if(gameState) {
      gameState.phase='waiting';
      gameState.npcTimerToken++;
    }
    UIManager.lastTap=null;
    document.getElementById('start-screen').hidden=false;
    document.getElementById('game-screen').hidden=true;
    document.getElementById('game-screen').inert=false;
    document.getElementById('final-screen').hidden=true;
    this.updateNPCSelection();
    this.renderRecords();
  },
  start() {
    const count=Number(document.getElementById('player-count').value);
    if(![2,3,4].includes(count))return;
    const registration=this.registerNickname();
    if(!registration.ok)return;
    this.hidePlayerScreens();
    UIManager.clearMotion();
    document.getElementById('start-screen').hidden=true;
    document.getElementById('game-screen').hidden=false;
    document.getElementById('game-screen').inert=false;
    document.getElementById('final-screen').hidden=true;
    const selected=count===2?NPCPool.entries.find(p=>p.id===this.selectedNPC):null;
    GameManager.start(1, selected||NPCPool.pick(), count, registration.name,document.getElementById('difficulty').value);
  },
  results() {
    const s=gameState;
    if(!s.gameOver)return;
    document.getElementById('final-title').textContent=s.players.some(p=>p.score<=0)?`総合結果 — 第${s.roundNumber}場・持ち点0点以下で終了`:'総合結果 — 第四場終了';
    document.getElementById('final-title').textContent+=' ／ '+(s.difficulty==='easy'?'ノーマル':'本気');
    const totals=MatchScoreManager.totals(s.history, s.players);
    const table=this.resultTable(s.history,totals);
    document.getElementById('final-table-wrap').replaceChildren(table);
    const portraits=document.getElementById('final-portraits');
    portraits.className='result-portraits count-'+(s.playerCount-1);
    portraits.replaceChildren(...s.players.slice(1).map(npc=> {
      const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');
      image.src=NPC_FULL_IMAGES[npc.npcId];image.alt=npc.name;image.draggable=false;
      caption.textContent=npc.name;figure.append(image,caption);return figure;
    }));
    const winners=totals.filter(p=>p.rank===1);
    document.getElementById('final-winner').textContent=winners.length===1?winners[0].name+'の総合優勝！':winners.map(p=>p.name).join('・')+'が同率1位';
    document.getElementById('record-save-status').textContent=s.recordStatus?s.recordStatus.message:'記録情報がありません。';
    const reward=document.getElementById('gp-reward'),record=PlayerRecords.records.find(r=>r.id===s.matchId);
    if(reward)reward.textContent=`獲得GP：${record?.reward?.total||0} ／ 現在 ${PlayerRecords.progress.balance} GP`+(record?.reward?.achievements?.length?' ／ 新しい実績を達成！':'');
    const rewardDetails=document.getElementById('gp-reward-details');
    if(rewardDetails)rewardDetails.textContent=(record?.reward?.parts||[]).map(part=>`${part.label}：${part.amount} GP`).join(' ／ ')+(record?.reward?.achievements?.includes('hard-all')?' ／ GS装備枠が4に拡張されました！':'');
    document.getElementById('share-x').href=this.shareURL(s,totals);
    ResultImage.prepare(s,totals,this.shareText(s,totals));
    document.getElementById('final-screen').hidden=false;
    document.getElementById('game-screen').inert=true;
    const close=document.getElementById('close-results');
    if(typeof close.focus==='function')close.focus();
  },
  hideResults() {
    document.getElementById('final-screen').hidden=true;
    document.getElementById('game-screen').inert=false;
  },
  shareURL(state,totals) {
    return 'https://x.com/intent/tweet?text='+encodeURIComponent(this.shareText(state,totals));
  },
  shareText(state,totals) {
    const player=totals.find(p=>p.index===0);
    const text=[
      '宝雀（ポージャン） 総合結果',
      `${player.name} ／ ${state.playerCount}人対戦${state.difficulty?'（'+(state.difficulty==='easy'?'ノーマル':'本気')+'）':''} ／ 総合${player.rank}位`,
      `最終所持点：${player.finalScore}点`,
      '#宝雀 #宝雀ランキング'
    ].join('\n');
    return text;
  },
  registerNickname() {
    const result=PlayerRecords.registerNickname(document.getElementById('player-nickname').value);
    document.getElementById('nickname-status').textContent=result.message;
    if(result.ok)document.getElementById('player-nickname').value=result.name;
    return result;
  },
  resultTable(fields,totals) {
    const table=document.createElement('table'),
    head=document.createElement('tr');
    for(const label of ['順位', '名前', ...fields.map(h=>h.round), '最終所持点']) {
      const th=document.createElement('th');
      if(typeof label==='number')th.append(UIManager.roundLabel(label),document.createTextNode('（所持点／順位）'));
      else th.textContent=label;
      head.append(th);
    }
    table.append(head);
    for(const p of totals) {
      const row=document.createElement('tr');
      for(const value of [p.rank+'位', p.name, ...p.fields.map(f=>f.score+'点 ／ '+f.rank+'位'), p.finalScore+'点']) {
        const td=document.createElement('td');
        td.textContent=value;
        row.append(td);
      }
      table.append(row);
    }
    return table;
  },
  equipmentSwap:null,
  equipmentMessage(message){
    document.getElementById('progress-status').textContent=message;
    document.getElementById('start-equipment-status').textContent=message;
  },
  changeEquipment(id){
    const p=PlayerRecords.progress,k=GemSkills.entries.find(k=>k.id===id);
    if(!k||!p.unlocked.includes(id))return;
    const used=p.equipped.reduce((sum,id)=>sum+GemSkills.entries.find(k=>k.id===id).slots,0);
    this.equipmentSwap=null;
    if(!p.equipped.includes(id)&&used+k.slots>Progression.capacity(p)){
      this.equipmentSwap={id,remove:[]};
      document.getElementById('start-equipment-editor').open=true;
      document.getElementById('shop-equipment-editor').open=true;
      this.equipmentMessage('入れ替えるGSを選んでください。');
    }else this.equipmentMessage(Progression.equip(id).message);
    this.renderProgress();
  },
  renderSkillPicker(id,p,capacity){
    const root=document.getElementById(id),nodes=[];
    const text=message=>{const el=document.createElement('p');el.textContent=message;nodes.push(el);};
    const button=(label,action,disabled=false)=>{const el=document.createElement('button');el.textContent=label;el.type='button';el.disabled=disabled;el.onclick=action;return el;};
    text('装備枠のGSを押すと外せます。購入済みGSは種類をまたいで選べます。');
    if(!p.unlocked.length)text('購入済みのGSはまだありません。ショップで購入するとここに表示されます。');
    const list=document.createElement('div');list.className='owned-skill-list';
    for(const skill of GemSkills.entries.filter(k=>p.unlocked.includes(k.id))){
      const equipped=p.equipped.includes(skill.id),b=button(`${skill.name}・${skill.slots}枠${equipped?'【装備中】':''}`,()=>this.changeEquipment(skill.id));
      b.className='owned-skill slot-'+this.slotCategory(skill.category);b.setAttribute('aria-pressed',String(equipped));b.setAttribute('title',skill.effect);list.append(b);
    }
    nodes.push(list);
    if(p.equipped.length)nodes.push(button('すべて外す',()=>{const result=Progression.setEquipment([]);this.equipmentSwap=null;this.equipmentMessage(result.message);this.renderProgress();}));
    const swap=this.equipmentSwap;
    if(swap){
      const skill=GemSkills.entries.find(k=>k.id===swap.id);
      const remaining=p.equipped.filter(k=>!swap.remove.includes(k));
      const used=remaining.reduce((sum,k)=>sum+GemSkills.entries.find(s=>s.id===k).slots,0)+skill.slots;
      text(`${skill.name}（${skill.slots}枠）に入れ替え：外すGSを選択してください。選択後 ${used} / ${capacity}枠`);
      const choices=document.createElement('div');choices.className='equipment-replace-options';
      for(const skillId of p.equipped){
        const k=GemSkills.entries.find(k=>k.id===skillId),selected=swap.remove.includes(skillId);
        const b=button(`${selected?'外す：':'残す：'}${k.name}（${k.slots}枠）`,()=>{swap.remove=selected?swap.remove.filter(k=>k!==skillId):[...swap.remove,skillId];this.renderProgress();});
        b.setAttribute('aria-pressed',String(selected));choices.append(b);
      }
      nodes.push(choices);
      nodes.push(button('この組み合わせに入れ替える',()=>{
        const result=Progression.setEquipment([...PlayerRecords.progress.equipped.filter(k=>!swap.remove.includes(k)),swap.id]);
        if(result.ok)this.equipmentSwap=null;this.equipmentMessage(result.message);this.renderProgress();
      },used>capacity));
      nodes.push(button('入れ替えをキャンセル',()=>{this.equipmentSwap=null;this.equipmentMessage('入れ替えをキャンセルしました。');this.renderProgress();}));
    }
    root.replaceChildren(...nodes);
  },
  slotCategory(category) {return {'手札':'hand','山札':'stock','情報':'wisdom'}[category];},
  slotBadge(skill,capacity) {
    const badge=document.createElement('span'),label=document.createElement('span'),squares=document.createElement('span');
    badge.className='skill-slot-badge slot-'+this.slotCategory(skill.category);
    badge.setAttribute('aria-label',`${skill.name}は${skill.slots}枠使用`);
    label.textContent=`${skill.slots}枠使用`;squares.className='slot-squares';squares.setAttribute('aria-hidden','true');
    for(let i=0;i<capacity;i++){const square=document.createElement('span');square.className='slot-square'+(i<skill.slots?' filled':'');squares.append(square);}
    badge.append(squares,label);return badge;
  },
  renderEquipmentSlots(id,progress,capacity) {
    const root=document.getElementById(id),groups=[];
    let used=0;
    for(const skillId of progress.equipped){
      const skill=GemSkills.entries.find(k=>k.id===skillId),group=document.createElement('button'),boxes=document.createElement('div'),label=document.createElement('span');
      group.type='button';group.onclick=()=>this.changeEquipment(skillId);group.setAttribute('aria-label',skill.category+'のGS・'+skill.name+'を装備から外す');
      group.className='equipment-slot-group slot-'+this.slotCategory(skill.category);group.style.gridColumn=`span ${skill.slots}`;
      boxes.className='equipment-slot-boxes';
      for(let i=0;i<skill.slots;i++){const box=document.createElement('span');box.className='equipment-slot filled';box.textContent=String(used+i+1);box.setAttribute('aria-hidden','true');boxes.append(box);}
      label.className='equipment-slot-label';label.textContent=`${skill.name}（${skill.category}・${skill.slots}枠）`;
      group.append(boxes,label);groups.push(group);used+=skill.slots;
    }
    for(let i=used;i<capacity;i++){
      const group=document.createElement('button'),box=document.createElement('span'),label=document.createElement('span');
      group.type='button';group.setAttribute('aria-label','空き枠にGSを装備する');group.onclick=()=>{document.getElementById(id==='start-equipment-slots'?'start-equipment-editor':'shop-equipment-editor').open=true;};
      group.className='equipment-slot-group empty';box.className='equipment-slot';box.textContent=String(i+1);box.setAttribute('aria-hidden','true');
      label.className='equipment-slot-label';label.textContent='空き';group.append(box,label);groups.push(group);
    }
    root.style.gridTemplateColumns=`repeat(${capacity}, minmax(0, 1fr))`;
    root.setAttribute('role','group');root.setAttribute('aria-label',`GS装備枠：${capacity}枠中${used}枠使用、空き${capacity-used}枠`);
    root.replaceChildren(...groups);
  },
  renderProgress() {
    const $=id=>document.getElementById(id);
    if(!$('progress-panel'))return;
    const p=PlayerRecords.progress,s=PlayerStats.summarize(PlayerRecords.records,{count:$('stats-count').value,difficulty:$('stats-difficulty').value});
    const collection=`${p.unlocked.length} / ${GemSkills.entries.length}種類（${(p.unlocked.length/GemSkills.entries.length*100).toFixed(1)}%）`;
    $('gp-balance').textContent=`ジェムポイント（GP）：${p.balance}`;
    $('shop-balance').textContent=`所持GP：${p.balance}`;
    const equipment=p.equipped.length?p.equipped.map(id=>GemSkills.entries.find(k=>k.id===id).name).join(' ／ '):'なし';
    $('equipped-summary').textContent='装備GS：'+equipment;
    const slots=p.equipped.reduce((sum,id)=>sum+GemSkills.entries.find(k=>k.id===id).slots,0);
    const capacity=Progression.capacity(p);
    this.renderEquipmentSlots('start-equipment-slots',p,capacity);
    this.renderEquipmentSlots('shop-equipment-slots',p,capacity);
    this.renderSkillPicker('start-skill-picker',p,capacity);
    this.renderSkillPicker('shop-skill-picker',p,capacity);
    $('shop-equipment').textContent=`${slots} / ${capacity}枠`;
    $('collection-summary').textContent='購入済みGS：'+collection;
    const achieved=NPCPool.entries.filter(npc=>p.achievements['npc-first:'+npc.id]).length;
    const additional=Progression.achievementDefinitions.filter(def=>p.achievements[def.id]).length;
    $('achievement-summary').textContent=`実績：${achieved+additional} / ${NPCPool.entries.length+Progression.achievementDefinitions.length}達成`;
    $('reward-achievements').replaceChildren(...Progression.achievementDefinitions.map(def=>{
      const el=document.createElement('article'),title=document.createElement('h3'),status=document.createElement('p');
      const unlocked=Boolean(p.achievements[def.id]),progress=Progression.achievementProgress(def,PlayerRecords.records);
      el.className='achievement-card'+(unlocked?' achieved':'');title.textContent=def.name;
      status.textContent=`${unlocked?'達成済み':`${Math.min(progress.value,progress.target)} / ${progress.target}`} ／ ${def.reward} GP`+(def.id==='hard-all'?' ＋ 装備枠4に拡張':'');
      el.append(title,status);return el;
    }));
    $('gp-transactions').replaceChildren(...p.transactions.slice().reverse().map(t=>{const row=document.createElement('p');row.textContent=`${t.label}：${t.amount>=0?'+':''}${t.amount} GP`;return row;}));
    if(!p.transactions.length)$('gp-transactions').textContent='GPの獲得・購入履歴はまだありません。';
    const lines=[`総対戦回数：${s.matches}`,`勝利数：2人 ${s.winsByCount[2]} ／ 3人 ${s.winsByCount[3]} ／ 4人 ${s.winsByCount[4]}`,`最大所持点：${s.highest===null?'記録なし':s.highest+'点'}`];
    $('player-stats').replaceChildren(...lines.map(text=>{const el=document.createElement('p');el.textContent=text;return el;}));
    $('npc-stats').replaceChildren(...NPCPool.entries.map(npc=>{
      const el=document.createElement('p'),w=s.npcWins[npc.id]||{2:0,3:0,4:0};
      el.textContent=`${npc.name}：2人 ${w[2]}勝 ／ 3人 ${w[3]}勝 ／ 4人 ${w[4]}勝`;return el;
    }));
    $('npc-achievements').replaceChildren(...NPCPool.entries.map(npc=>{
      const el=document.createElement('article'),title=document.createElement('h3'),status=document.createElement('p');
      const unlocked=Boolean(p.achievements['npc-first:'+npc.id]);
      el.className='achievement-card'+(unlocked?' achieved':'');
      title.textContent=npc.name+'への初勝利';status.textContent=unlocked?'達成済み':'未達成';
      el.append(title,status);return el;
    }));
    const category=this.shopCategories[this.shopCategory];
    for(const key of Object.keys(this.shopCategories)){
      const tab=$('shop-tab-'+key),selected=key===this.shopCategory;
      tab.setAttribute('aria-selected',String(selected));tab.setAttribute('tabindex',selected?'0':'-1');
    }
    $('shop-category-panel').setAttribute('aria-labelledby','shop-tab-'+this.shopCategory);
    $('shop-category-image').src=category.image;
    $('shop-category-image').alt=category.label+'のGSのキャラクター';
    $('shop-category-caption').textContent=category.label+'のGS';
    $('shop-category-title').textContent=category.label+'のGS';
    $('shop-category-description').textContent=category.description;
    const requirement=Progression.heavyRequirements[category.label];
    $('shop-heavy-condition').textContent=Progression.heavyUnlocked(category.label)
      ?'重スキル：開放済み'
      :`重スキル：${requirement.name}の本気モードに単独1位で勝利すると表示されます。`;
    $('gs-catalog').replaceChildren(...GemSkills.entries.filter(skill=>skill.category===category.label&&Progression.skillVisible(skill)).map(skill=>{
      const el=document.createElement('article'),description=document.createElement('p'),buy=document.createElement('button');
      el.className='skill-card';
      description.textContent=`${skill.name}（${skill.category}・${GemSkills.ranks[skill.rank].label}／${skill.slots}枠）：${skill.effect}`;
      const owned=p.unlocked.includes(skill.id);buy.textContent=owned?'購入済み':`${skill.price} GPで購入`;
      buy.disabled=owned||p.balance<skill.price||!PlayerRecords.persisted||!PlayerRecords.writable;
      buy.onclick=()=>{const result=Progression.purchase(skill.id);$('progress-status').textContent=result.message;this.renderRecords();};
      el.append(description,buy);
      if(owned){const equip=document.createElement('button');equip.textContent=p.equipped.includes(skill.id)?'装備を外す':'装備する';equip.onclick=()=>this.changeEquipment(skill.id);el.append(equip);}
      el.append(this.slotBadge(skill,capacity));
      return el;
    }));
  },
  renderRecords() {
    this.renderProgress();
    document.getElementById('records-status').textContent=`履歴 ${PlayerRecords.records.length}件。${PlayerRecords.status}`;
    document.getElementById('saved-records').replaceChildren(...PlayerRecords.records.map(record=>{
      const details=document.createElement('details'),summary=document.createElement('summary');
      const totals=MatchScoreManager.totals(record.fields,record.players),player=totals.find(p=>p.index===0);
      const date=new Date(record.finishedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
      summary.textContent=`${date} ／ ${record.nickname} ／ ${record.playerCount}人対戦（${record.difficulty==='easy'?'ノーマル':'本気'}） ／ ${player.rank}位・最終所持点${player.finalScore}点`;
      const wrapper=document.createElement('div');wrapper.className='record-table-wrap';
      wrapper.append(this.resultTable(record.fields,totals));details.append(summary,wrapper);return details;
    }));
  },
  downloadRecords() {
    try {
      const blob=new Blob([PlayerRecords.exportJSON()],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='pojan-records-'+new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})+'.json';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(_) {
      document.getElementById('records-status').textContent='このブラウザではJSONダウンロードを開始できませんでした。';
      document.getElementById('record-save-status').textContent='JSONダウンロードを開始できませんでした。';
    }
  },
  resetData() {
    const message='ニックネーム、対戦履歴・戦績、実績、GP、購入・装備したGSをすべて削除します。\nこの操作は元に戻せません。初期所持100 GPの状態からはじめます。\n\n削除してはじめからにしますか？';
    if(typeof window==='undefined'||!window.confirm(message))return;
    const result=PlayerRecords.reset();
    if(result.ok){
      this.showStart();
      gameState=undefined;
      this.selectedNPC='random';this.shopCategory='hand';this.equipmentSwap=null;
      document.getElementById('start-equipment-status').textContent='';
      document.getElementById('player-nickname').value=PlayerRecords.nickname;
      document.getElementById('nickname-status').textContent='';
      document.getElementById('progress-status').textContent='';
      document.getElementById('player-count').value='2';
      document.getElementById('difficulty').value='easy';
      document.getElementById('stats-count').value='';
      document.getElementById('stats-difficulty').value='';
      this.updateNPCSelection();this.renderRecords();
    }
    document.getElementById('reset-status').textContent=result.message;
  },
  openShopHelp() {
    const dialog=document.getElementById('shop-help-dialog');
    if(!dialog.open)dialog.showModal();
  },
  closeShopHelp() {
    document.getElementById('shop-help-dialog').close();
    const button=document.getElementById('shop-help');if(typeof button.focus==='function')button.focus();
  },
  bind() {
    const difficulty=document.getElementById('difficulty');
    if(!['easy','normal'].includes(difficulty.value))difficulty.value='easy';
    PlayerRecords.load();
    const help=document.getElementById('shop-help-dialog');
    document.getElementById('shop-help').onclick=()=>this.openShopHelp();
    document.getElementById('close-shop-help').onclick=()=>this.closeShopHelp();
    help.oncancel=event=>{event.preventDefault();this.closeShopHelp();};
    help.onclick=event=>{
      if(event.target!==help)return;
      const rect=help.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)this.closeShopHelp();
    };
    document.getElementById('reset-data').onclick=()=>this.resetData();
    const categories=Object.keys(this.shopCategories);
    categories.forEach((category,index)=>{
      const tab=document.getElementById('shop-tab-'+category);
      tab.onclick=()=>this.selectShopCategory(category);
      tab.onkeydown=event=>{
        let next;
        if(event.key==='ArrowRight')next=(index+1)%categories.length;
        else if(event.key==='ArrowLeft')next=(index+categories.length-1)%categories.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=categories.length-1;
        else return;
        event.preventDefault();this.selectShopCategory(categories[next]);
        const target=document.getElementById('shop-tab-'+categories[next]);
        if(typeof target.focus==='function')target.focus();
      };
    });
    for(const name of ['shop','stats','achievements']){
      document.getElementById('open-'+name).onclick=()=>this.showPlayerScreen(name);
      document.getElementById(name+'-back').onclick=()=>{
        this.showStart();const button=document.getElementById('open-'+name);
        if(typeof button.focus==='function')button.focus();
      };
    }
    for(const id of ['stats-count','stats-difficulty']){
      const filter=document.getElementById(id);if(filter)filter.onchange=()=>this.renderProgress();
    }
    document.getElementById('player-nickname').value=PlayerRecords.nickname;
    document.getElementById('nickname-form').onsubmit=event=>{event.preventDefault();this.registerNickname();this.renderRecords();};
    document.getElementById('export-records').onclick=()=>this.downloadRecords();
    document.getElementById('export-final-records').onclick=()=>this.downloadRecords();
    document.getElementById('save-result-image').onclick=()=>ResultImage.save();
    document.getElementById('share-result-image').onclick=()=>ResultImage.share();
    document.getElementById('start-game').onclick=()=> {
      SoundManager.unlock();
      this.start();
    };
    document.getElementById('return-start').onclick=()=>this.showStart();
    document.getElementById('close-results').onclick=()=>this.hideResults();
    document.getElementById('final-screen').onkeydown=event=> {
      if(event.key==='Escape')this.hideResults();
    };
    document.getElementById('player-count').onchange=()=>this.updateNPCSelection();
    document.getElementById('leave-game').onclick=()=>this.showStart();
    this.showStart();
  }
};
