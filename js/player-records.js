'use strict';

// 第四場完了・持ち点0点以下による対戦終了を保存。
const PlayerRecords = {
  key: 'pojan.playerRecords.v2',
  legacyKey: 'pojan.playerRecords.v1',
  progress: {balance:0,transactions:[],unlocked:[],equipped:[],achievements:{}},
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
    if (!Array.isArray(record.fields) || record.fields.length<1 || record.fields.length>4) return false;
    if(record.fields.length<4&&(!['negative-score','nonpositive-score'].includes(record.termination)||
      !record.fields[record.fields.length-1]?.standings?.some(p=>p&&p.score<=0)))return false;
    if(record.peakScore!==undefined&&(!Number.isInteger(record.peakScore)||record.peakScore<0))return false;
    if(record.skills!==undefined&&(!Array.isArray(record.skills)||!record.skills.every(id=>GemSkills.entries.some(s=>s.id===id))))return false;
    if(record.hands!==undefined){
      const player=i=>Number.isInteger(i)&&i>=0&&i<count;
      if(!Array.isArray(record.hands)||new Set(record.hands.map(h=>h&&h.id)).size!==record.hands.length||
        !record.hands.every(h=>h&&typeof h.id==='string'&&Number.isInteger(h.round)&&h.round>=1&&h.round<=4&&
          Number.isInteger(h.hand)&&h.hand>=1&&h.hand<=count&&player(h.dealer)&&['draw','tsumo','ron'].includes(h.type)&&
          (h.type==='draw'?h.winner===null:player(h.winner))&&
          (h.type==='ron'?player(h.loser)&&h.loser!==h.winner:h.loser===null)&&
          Array.isArray(h.roles)&&h.roles.every(id=>Object.hasOwn(ROLE_NAMES,id))&&
          Array.isArray(h.riichi)&&h.riichi.length===count&&h.riichi.every(v=>typeof v==='boolean')&&
          Array.isArray(h.transfers)&&h.transfers.every(t=>t&&player(t.from)&&player(t.to)&&t.from!==t.to&&Number.isInteger(t.amount)&&t.amount>0)))return false;
    }
    return record.fields.every((field,index)=>field && field.round===index+1 &&
      Array.isArray(field.standings) && field.standings.length===count &&
      new Set(field.standings.map(p=>p&&p.index)).size===count &&
      field.standings.every(p=>p && Number.isInteger(p.index) && p.index>=0 && p.index<count &&
        Number.isInteger(p.score) && Number.isInteger(p.rank) && p.rank>=1 && p.rank<=count &&
        typeof p.name==='string'));
  },
  load() {
    try {
      if (typeof localStorage==='undefined') throw new Error('storage unavailable');
      const current=localStorage.getItem(this.key);
      const raw=current===null?localStorage.getItem(this.legacyKey):current;
      if (raw) {
        let data;
        try {
          data=JSON.parse(raw);
          if (!data || ![1,2].includes(data.version) || typeof data.nickname!=='string' || data.nickname.length>20 ||
              !Array.isArray(data.records) || !data.records.every(r=>this.validRecord(r)) ||
              (data.version===2&&!Progression.valid(data.progress)))throw new Error('invalid data');
        } catch(_) {
          this.writable=false;
          this.persisted=false;
          this.status='保存データを読み込めないため上書きしません。新しい記録はJSONでバックアップしてください。';
          return;
        }
        this.progress=data.version===2?data.progress:Progression.migrate(data.records);
        this.nickname=this.cleanName(data.nickname);
        this.records=data.records.map(record=>{
          const fields=record.fields.map(field=>({...field,standings:field.standings.map(({victoryPoints,...row})=>row)}));
          const totals=MatchScoreManager.totals(fields,record.players).map(p=>({index:p.index,name:p.name,rank:p.rank,finalScore:p.finalScore}));
          return {...record,fields,totals};
        });
      }
      this.persisted=true;
      this.status='このブラウザ内に保存します。';
      if(raw&&current===null)this.write();
    } catch (_) {
      this.persisted=false;
      this.status='ブラウザ内保存を利用できません。この画面を開いている間のみ保持します。JSONでバックアップできます。';
    }
  },
  exportJSON() {
    return JSON.stringify({version:2,nickname:this.nickname,records:this.records,progress:this.progress},null,2);
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
    const bankrupt=state.players.some(p=>p.score<=0);
    if(!state.gameOver || !state.history.length || state.history.length>4 ||
      (state.history.length<4&&!bankrupt))return {ok:false,persisted:false,message:'終了した対戦だけを記録します。'};
    if(this.records.some(r=>r.id===state.matchId))return {ok:true,persisted:this.persisted,message:this.status};
    const record={
      id:state.matchId,
      finishedAt:new Date().toISOString(),
      nickname:state.players[0].name,
      playerCount:state.playerCount,
      gsActivations:JSON.parse(JSON.stringify(state.gsActivations||[])),
      peakScore:state.peakScore,
      ruleVersion:state.ruleVersion||1,
      skills:[...(state.skills||[])],
      hands:JSON.parse(JSON.stringify(state.hands||[])),
      difficulty:state.difficulty||'normal',
      termination:bankrupt?'nonpositive-score':'four-fields',
      players:state.players.map((p,index)=>({index,name:p.name,npcId:p.npcId||null})),
      fields:JSON.parse(JSON.stringify(state.history)),
      totals:MatchScoreManager.totals(state.history,state.players).map(p=>({
        index:p.index,name:p.name,rank:p.rank,finalScore:p.finalScore
      }))
    };
    this.records.unshift(record);
    record.reward=Progression.complete(record,this.records,this.progress);
    const persisted=this.write();
    return {ok:true,persisted,message:persisted?'ニックネームと総合結果・各場の点数を保存しました。':this.status};
  },
};
