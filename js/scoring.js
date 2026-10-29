'use strict';
// 局の得点移動と4場の勝利点集計
const ScoreManager= {
  settle(players, winner, loser, type, multiplier, dealerIndex=-1) {
    const transfers=[];
    const payment=from=>1000*multiplier*(type==='ron'?2:1)*((winner===dealerIndex||from===dealerIndex)?1.5:1);
    if(type==='ron') {
      const amount=payment(loser);
      players[loser].score-=amount;
      players[winner].score+=amount;
      transfers.push( {
        from:loser,
        to:winner,
        amount
      });
    }
    else players.forEach((p, i)=> {
      if(i!==winner) {
        const amount=payment(i);
        p.score-=amount;
        players[winner].score+=amount;
        transfers.push( {
          from:i,
          to:winner,
          amount
        });
      }
    });
    return transfers;
  },
  rank(players) {
    return players.map((p, i)=>( {
      ...p,
      index:i,
      rank:1+players.filter(q=>q.score>p.score).length
    })).sort((a, b)=>b.score-a.score);
  }
};
const MatchScoreManager= {
  victoryPoints: {
    1:4,
    2:3,
    3:4,
    4:1
  },
  field(round, players) {
    return {
      round,
      standings:ScoreManager.rank(players).map(p=>( {
        index:p.index,
        name:p.name,
        score:p.score,
        rank:p.rank,
        victoryPoints:this.victoryPoints[p.rank]||0
      }))
    };
  },
  totals(history, players) {
    const totals=players.map((p, index)=> {
      const fields=history.map(h=>h.standings.find(row=>row.index===index)).filter(Boolean);
      return {
        index,
        name:p.name,
        victoryPoints:fields.reduce((n, f)=>n+f.victoryPoints, 0),
        remainingPoints:fields.reduce((n, f)=>n+f.score, 0),
        fields
      };
    });
    const ahead=(a, b)=>a.victoryPoints>b.victoryPoints||(a.victoryPoints===b.victoryPoints&&a.remainingPoints>b.remainingPoints);
    for(const p of totals)p.rank=1+totals.filter(q=>ahead(q, p)).length;
    return totals.sort((a, b)=>b.victoryPoints-a.victoryPoints||b.remainingPoints-a.remainingPoints);
  }
};
