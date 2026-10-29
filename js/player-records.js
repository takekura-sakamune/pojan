'use strict';

// 完了した4場分だけを保存。描画ではなく局終了処理から記録する。
const PlayerRecords = {
  key: 'pojan.playerRecords.v1',
  nickname: 'あなた',
  records: [],
  writable: true,
  persisted: false,
  status: '',
  sequence: 0,

  cleanName(value) { return String(value || '').trim() || 'あなた'; },
  newId() { return `${Date.now()}-${++this.sequence}-${Math.random().toString(36).slice(2, 10)}`; },
  validRecord(record) {
    if (!record || typeof record.id !== 'string' || typeof record.nickname !== 'string' ||
        !Number.isFinite(Date.parse(record.finishedAt)) || ![2,3,4].includes(record.playerCount)) return false;
    const count=record.playerCount;
    if (!Array.isArray(record.players) || record.players.length!==count ||
        !record.players.every((p,i)=>p && p.index===i && typeof p.name==='string')) return false;
    if (!Array.isArray(record.fields) || record.fields.length!==4) return false;
    return record.fields.every((field,index)=>field && field.round===index+1 &&
      Array.isArray(field.standings) && field.standings.length===count &&
      new Set(field.standings.map(p=>p&&p.index)).size===count &&
      field.standings.every(p=>p && Number.isInteger(p.index) && p.index>=0 && p.index<count &&
        Number.isInteger(p.score) && Number.isInteger(p.rank) && p.rank>=1 && p.rank<=count &&
        Number.isInteger(p.victoryPoints) && typeof p.name==='string'));
  },
  load() {
    try {
      if (typeof localStorage==='undefined') throw new Error('storage unavailable');
      const raw=localStorage.getItem(this.key);
      if (raw) {
        let data;
        try {
          data=JSON.parse(raw);
          if (!data || data.version!==1 || typeof data.nickname!=='string' || data.nickname.length>20 ||
              !Array.isArray(data.records) || !data.records.every(r=>this.validRecord(r)))throw new Error('invalid data');
        } catch(_) {
          this.writable=false;
          this.persisted=false;
          this.status='保存データを読み込めないため上書きしません。新しい記録はJSONでバックアップしてください。';
          return;
        }
        this.nickname=this.cleanName(data.nickname);
        this.records=data.records;
      }
      this.persisted=true;
      this.status='このブラウザ内に保存します。';
    } catch (_) {
      this.persisted=false;
      this.status='ブラウザ内保存を利用できません。この画面を開いている間のみ保持します。JSONでバックアップできます。';
    }
  },
  exportJSON() {
    return JSON.stringify({version:1,nickname:this.nickname,records:this.records},null,2);
  },
  write() {
    if (!this.writable) return false;
    try {
      if (typeof localStorage==='undefined') throw new Error('storage unavailable');
      localStorage.setItem(this.key,this.exportJSON());
      this.persisted=true;
      this.status='このブラウザ内に保存しました。';
      return true;
    } catch (_) {
      this.persisted=false;
      this.status='ブラウザ内に保存できませんでした。記録は画面内で保持しています。JSONでバックアップしてください。';
      return false;
    }
  },
  registerNickname(value) {
    const name=this.cleanName(value);
    if(name.length>20)return {ok:false,message:'ニックネームは20文字以内で入力してください。'};
    this.nickname=name;
    const persisted=this.write();
    return {ok:true,persisted,name,message:persisted?`${name}で登録しました。`:`${name}を使用します。${this.status}`};
  },
  record(state) {
    if(!state.gameOver || state.history.length!==4)return {ok:false,persisted:false,message:'4場すべてが終了した対戦だけを記録します。'};
    if(this.records.some(r=>r.id===state.matchId))return {ok:true,persisted:this.persisted,message:this.status};
    const record={
      id:state.matchId,
      finishedAt:new Date().toISOString(),
      nickname:state.players[0].name,
      playerCount:state.playerCount,
      players:state.players.map((p,index)=>({index,name:p.name,npcId:p.npcId||null})),
      fields:JSON.parse(JSON.stringify(state.history)),
      totals:MatchScoreManager.totals(state.history,state.players).map(p=>({
        index:p.index,name:p.name,rank:p.rank,victoryPoints:p.victoryPoints,remainingPoints:p.remainingPoints
      }))
    };
    this.records.unshift(record);
    const persisted=this.write();
    return {ok:true,persisted,message:persisted?'ニックネームと総合結果・各場の点数を保存しました。':this.status};
  },
};
