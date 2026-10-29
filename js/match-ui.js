'use strict';
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
    const player=totals.find(p=>p.index===0);
    const text=[
      '宝雀（ポージャン） 総合結果',
      `${player.name} ／ ${state.playerCount}人対戦 ／ 総合${player.rank}位`,
      `勝利点合計：${player.victoryPoints}点`,
      `所持点合計：${player.remainingPoints}点`,
      '#宝雀 #宝雀ランキング'
    ].join('\n');
    return 'https://x.com/intent/tweet?text='+encodeURIComponent(text);
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
    for(const label of ['順位', '名前', ...fields.map(h=>roundName(h.round)+'（所持点／順位／勝利点）'), '所持点合計', '勝利点合計']) {
      const th=document.createElement('th');
      th.textContent=label;
      head.append(th);
    }
    table.append(head);
    for(const p of totals) {
      const row=document.createElement('tr');
      for(const [column,value] of [p.rank+'位', p.name, ...p.fields.map(f=>f.score+'点 ／ '+f.rank+'位 ／ '+f.victoryPoints+'勝利点'), p.remainingPoints+'点', p.victoryPoints+'勝利点'].entries()) {
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
      summary.textContent=`${date} ／ ${record.nickname} ／ ${record.playerCount}人対戦 ／ ${player.rank}位・${player.victoryPoints}勝利点`;
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
