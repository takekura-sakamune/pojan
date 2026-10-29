'use strict';
// 画面操作の接続と初期化
if(typeof document!=='undefined') {
  SoundManager.bind();
  document.getElementById('hand-sort').onchange=event=> {
    HandSorter.mode=event.target.value;
    SoundManager.play('select');
    UIManager.render();
  };
  document.getElementById('rules').innerHTML=Object.entries(ROLE_NAMES).map(([id, name], i)=>`<tr><th>${name}</th><td>${ROLE_RULES[i]}</td></tr>`).join('');
  MatchUI.bind();
}
