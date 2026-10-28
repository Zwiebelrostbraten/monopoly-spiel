import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,board,active} from '../engine.js';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function invariants(s){
 assert.ok(s.players.every(p=>Number.isFinite(p.cash)&&p.cash>=0));
 assert.equal(s.houses+Object.values(s.estates).reduce((a,e)=>a+(e.level===5?0:e.level),0),32);
 assert.equal(s.hotels+Object.values(s.estates).filter(e=>e.level===5).length,12);
 for(const e of Object.values(s.estates)){assert.ok(e.level>=0&&e.level<=5);assert.ok(e.owner===null||!s.players[e.owner].out);assert.ok(!e.mortgage||e.level===0)}
 for(const k of ['chance','community']){const held=s.players.flatMap(p=>p.cards).filter(c=>c===k).length;const drawing=s.card?.deck===k?1:0;assert.equal(s.decks[k].length+held+drawing,16);assert.equal(new Set(s.decks[k]).size,s.decks[k].length)}
}
test('seeded full games: valid stock, decks, cash, elimination and terminal winner',()=>{
 for(let seed=1;seed<=24;seed++){
 const rng=random(seed);let s=createGame(Array.from({length:2+seed%3},(_,i)=>({name:'P'+i})),rng),steps=0;
 while(s.phase!=='won'&&steps++<18000){
 if(s.phase==='roll')act(s,'roll',{},rng);
 else if(s.phase==='buy')act(s,s.players[s.purchase.player].cash>=board[s.purchase.id].price&&rng()>.2?'buy':'decline',{},rng);
 else if(s.phase==='auction'){const a=s.auction;const bid=Math.max(10,a.bid+1);act(s,s.players[a.turn].cash>=bid&&rng()>.55?'bid':'pass',{amount:bid},rng)}
 else if(s.phase==='card')act(s,'ackCard',{},rng);
 else if(s.phase==='transfer')act(s,'transferKeep',{},rng);
 else if(s.phase==='debt'){
 const debtor=s.debt.from,owned=Object.entries(s.estates).filter(([,e])=>e.owner===debtor),built=owned.find(([,e])=>e.level>0);
 if(built)act(s,'sellGroup',{id:Number(built[0]),player:debtor},rng);
 else {const unmortgaged=owned.find(([,e])=>!e.mortgage);if(unmortgaged)act(s,'mortgage',{id:Number(unmortgaged[0]),player:debtor},rng);else act(s,'bankrupt',{},rng)}
 }else if(s.phase==='end'){
 // Test-only consenting consolidation trades encourage completion; no product AI.
 if(s.round%5===0){for(let g=0;g<8;g++){const ids=board.filter(b=>b.type==='street'&&b.group===g).map(b=>b.id);const target=s.estates[ids[0]].owner;if(target===null||ids.some(id=>s.estates[id].owner===null||s.estates[id].level>0))continue;const donor=ids.map(id=>s.estates[id].owner).find(i=>i!==target);if(donor!==undefined){act(s,'trade',{from:donor,to:target,give:ids.filter(id=>s.estates[id].owner===donor),take:[],cashGive:0,cashTake:0,cardsGive:[],cardsTake:[]},rng);act(s,'acceptTrade',{},rng);if(s.phase!=='end')break;}}}
 if(s.phase!=='end'){invariants(s);continue;}
 for(const [id,e] of Object.entries(s.estates))if(e.owner!==null&&e.mortgage&&s.players[e.owner].cash>450)act(s,'unmortgage',{id:Number(id),player:e.owner},rng);
 // This is a test-only policy, not an AI opponent in the product.
 for(const [id,e] of Object.entries(s.estates))if(e.owner!==null&&s.players[e.owner].cash>300&&board[id].type==='street')try{act(s,'build',{id:Number(id),player:e.owner},rng)}catch{}
 act(s,'end',{},rng);
 }else assert.fail('Unknown phase '+s.phase);
 invariants(s);
 if(steps%31===0)s=JSON.parse(JSON.stringify(s));
 }
 assert.equal(s.phase,'won',`seed ${seed} did not finish after ${steps} actions`);assert.equal(active(s).length,1);assert.equal(s.winner,active(s)[0]);
 }
});
