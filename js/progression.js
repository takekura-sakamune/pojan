'use strict';
// 成績と報酬は完了対戦から確定し、同じ保存データにまとめる。
const PlayerStats={
  summarize(records,filters={}) {
    const selected=records.filter(r=>(!filters.count||r.playerCount===Number(filters.count))&&
      (!filters.difficulty||r.difficulty===filters.difficulty)&&
      (!filters.skills||(filters.skills==='with')===Boolean(r.skills?.length)));
    const stats={matches:selected.length,ranks:[0,0,0,0],firstRate:0,averageRank:0,highest:null,npcWins:{},winsByCount:{2:0,3:0,4:0},
      hands:0,wins:0,dealIns:0,tsumo:0,ron:0,roles:{},recordedMatches:0};
    for(const r of selected){
      const player=MatchScoreManager.totals(r.fields,r.players).find(p=>p.index===0);
      stats.ranks[player.rank-1]++;stats.averageRank+=player.rank;
      stats.highest=stats.highest===null?player.finalScore:Math.max(stats.highest,player.finalScore);
      for(const field of r.fields)stats.highest=Math.max(stats.highest,field.standings.find(p=>p.index===0).score);
      if(Number.isInteger(r.peakScore))stats.highest=Math.max(stats.highest,r.peakScore);
      if(player.rank===1&&r.players.every((_,i)=>i===0||player.finalScore>r.totals.find(p=>p.index===i).finalScore)){
        stats.winsByCount[r.playerCount]++;
        for(const npc of r.players.slice(1)){const counts=stats.npcWins[npc.npcId]||(stats.npcWins[npc.npcId]={2:0,3:0,4:0});counts[r.playerCount]++;}
      }
      if(Array.isArray(r.hands)&&r.hands.length)stats.recordedMatches++;
      for(const h of r.hands||[]){
        stats.hands++;
        if(h.winner===0){stats.wins++;stats[h.type]++;for(const role of h.roles)stats.roles[role]=(stats.roles[role]||0)+1;}
        if(h.type==='ron'&&h.loser===0)stats.dealIns++;
      }
    }
    if(stats.matches){stats.firstRate=stats.ranks[0]/stats.matches;stats.averageRank/=stats.matches;}
    return stats;
  }
};
const Progression={
  maxBalance:999999999,
  empty(){return {balance:100,transactions:[{id:"initial-gp",amount:100,label:"初期GP"}],unlocked:[],equipped:[],achievements:{}};},
  valid(p){
    return Boolean(p&&Number.isSafeInteger(p.balance)&&p.balance>=0&&p.balance<=this.maxBalance&&
      Array.isArray(p.transactions)&&p.transactions.every(t=>t&&typeof t.id==='string'&&typeof t.label==='string'&&Number.isSafeInteger(t.amount))&&
      new Set(p.transactions.map(t=>t.id)).size===p.transactions.length&&
      p.transactions.reduce((sum,t)=>sum+t.amount,0)===p.balance&&
      Array.isArray(p.unlocked)&&p.unlocked.every(id=>GemSkills.entries.some(s=>s.id===id))&&new Set(p.unlocked).size===p.unlocked.length&&
      Array.isArray(p.equipped)&&new Set(p.equipped).size===p.equipped.length&&p.equipped.every(id=>p.unlocked.includes(id))&&
      p.equipped.reduce((sum,id)=>sum+GemSkills.entries.find(s=>s.id===id).slots,0)<=3&&
      p.achievements&&typeof p.achievements==='object'&&!Array.isArray(p.achievements)&&
      Object.values(p.achievements).every(a=>a&&Number.isFinite(Date.parse(a.unlockedAt))));
  },
  migrate(records){
    const p=this.empty();
    for(const record of records){const totals=MatchScoreManager.totals(record.fields,record.players);
      if(record.playerCount===2&&totals[0].index===0&&totals[0].rank===1&&totals[1].rank!==1&&record.players[1].npcId){
        const id='npc-first:'+record.players[1].npcId,old=p.achievements[id];
        if(!old||old.unlockedAt>record.finishedAt)p.achievements[id]={unlockedAt:record.finishedAt};
      }
    }
    return p;
  },
  credit(p,id,amount,label){
    if(p.transactions.some(t=>t.id===id))return 0;
    const actual=Math.min(amount,this.maxBalance-p.balance);
    p.balance+=actual;p.transactions.push({id,amount:actual,label});return actual;
  },
  purchase(id){
    const p=PlayerRecords.progress,skill=GemSkills.entries.find(s=>s.id===id);
    if(!skill)return {ok:false,message:'GSが見つかりません。'};
    if(p.unlocked.includes(id))return {ok:false,message:'購入済みです。'};
    if(!PlayerRecords.writable||!PlayerRecords.persisted)return {ok:false,message:'保存できる状態で購入してください。先にJSONで記録を退避できます。'};
    if(p.balance<skill.price)return {ok:false,message:'GPが不足しています。'};
    const next=JSON.parse(JSON.stringify(p));
    next.balance-=skill.price;next.unlocked.push(id);
    next.transactions.push({id:'purchase:'+id,amount:-skill.price,label:skill.name+'購入'});
    return this.commit(next,skill.name+'を購入しました。');
  },
  equip(id){
    const p=PlayerRecords.progress,skill=GemSkills.entries.find(k=>k.id===id);
    if(!skill||!p.unlocked.includes(id))return {ok:false,message:'購入したGSだけを装備できます。'};
    const next=JSON.parse(JSON.stringify(p));
    if(next.equipped.includes(id))next.equipped=next.equipped.filter(k=>k!==id);
    else {const slots=next.equipped.reduce((sum,k)=>sum+GemSkills.entries.find(s=>s.id===k).slots,0);if(slots+skill.slots>3)return {ok:false,message:'装備できるのは合計3枠までです。'};next.equipped.push(id);}
    return this.commit(next,'GSの装備を更新しました。');
  },
  commit(next,message){
    const old=PlayerRecords.progress;PlayerRecords.progress=next;
    if(!PlayerRecords.write()){PlayerRecords.progress=old;return {ok:false,message:'保存できなかったため変更を取り消しました。'+PlayerRecords.status};}
    return {ok:true,message};
  },
  complete(record,records,p){
    const player=record.totals.find(row=>row.index===0),unlocked=[];
    let total=0;
    if(record.playerCount===2&&player.rank===1&&record.totals.filter(row=>row.rank===1).length===1){
      total+=this.credit(p,'win:'+record.id,100,'2人対戦勝利');
      const npc=record.players[1].npcId,id='npc-first:'+npc;
      if(npc&&!p.achievements[id]){
        p.achievements[id]={unlockedAt:record.finishedAt};unlocked.push(id);
        total+=this.credit(p,'first:'+npc,300,'NPC初勝利');
      }
    }
    return {total,achievements:unlocked};
  }
};
