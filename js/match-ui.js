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
      write(`${count}人対戦 ／ ${early?`第${round}場・持ち点0点以下で終了`:'第四場終了'}`,60,203,24,'#a9c7c3');
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
    const profile=selected?NPC_PROFILES[selected.id]:null;
    document.getElementById('npc-traits').hidden=!twoPlayer;
    document.getElementById('npc-style').textContent=profile?profile.style:'3人それぞれの打ち筋';
    document.getElementById('npc-description').textContent=profile?profile.description:'速攻のスィリス、重なり重視のタオタオ、絵札と守備のカナデ。相手は対戦開始時に決まります。';
    document.getElementById('npc-trait-list').replaceChildren(...(profile?profile.traits:[]).map(text=>{
      const item=document.createElement('li');item.textContent=text;return item;
    }));
  },
  showStart() {
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
    UIManager.clearMotion();
    document.getElementById('start-screen').hidden=true;
    document.getElementById('game-screen').hidden=false;
    document.getElementById('game-screen').inert=false;
    document.getElementById('final-screen').hidden=true;
    const selected=count===2?NPCPool.entries.find(p=>p.id===this.selectedNPC):null;
    GameManager.start(1, selected||NPCPool.pick(), count, registration.name);
  },
  results() {
    const s=gameState;
    if(!s.gameOver)return;
    document.getElementById('final-title').textContent=s.players.some(p=>p.score<=0)?`総合結果 — 第${s.roundNumber}場・持ち点0点以下で終了`:'総合結果 — 第四場終了';
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
      `${player.name} ／ ${state.playerCount}人対戦 ／ 総合${player.rank}位`,
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
  renderRecords() {
    document.getElementById('records-status').textContent=`履歴 ${PlayerRecords.records.length}件。${PlayerRecords.status}`;
    document.getElementById('saved-records').replaceChildren(...PlayerRecords.records.map(record=>{
      const details=document.createElement('details'),summary=document.createElement('summary');
      const totals=MatchScoreManager.totals(record.fields,record.players),player=totals.find(p=>p.index===0);
      const date=new Date(record.finishedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
      summary.textContent=`${date} ／ ${record.nickname} ／ ${record.playerCount}人対戦 ／ ${player.rank}位・最終所持点${player.finalScore}点`;
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
  bind() {
    PlayerRecords.load();
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
