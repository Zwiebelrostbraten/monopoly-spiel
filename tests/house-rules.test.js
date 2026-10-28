import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../engine.js';
const game = (n=3) => engine.createGame(Array.from({length:n},(_,i)=>({name:String(i)})));
test('decline leaves bank deed and continues for 2–4 players',()=>{
 for(let n=2;n<=4;n++) for(const cash of [0,1500]) {const s=game(n);s.players[0].cash=cash;engine.act(s,'roll',{dice:[1,2]});engine.act(s,'decline');assert.equal(s.phase,'end');assert.equal(s.estates[3].owner,null);assert.equal(s.players[0].cash,cash);for(const a of ['bid','pass','buildingAuction']) assert.throws(()=>engine.act(s,a));}
});
test('forward movement counts circuits, exact LOS bonus, zero and backward excluded',()=>{
 for(const [pos,steps,back,total] of [[39,1,false,400],[38,2,false,400],[39,2,false,200],[0,0,false,0],[0,40,false,400],[1,80,false,400],[39,81,false,800],[3,3,true,0]]) {const s=game();s.players[0].pos=pos;s.queue=[{type:'move',player:0,target:back?0:(pos+steps)%40,steps,back},{type:'finish'}];engine.run(s);assert.equal(s.players[0].cash,1500+total,JSON.stringify({pos,steps}));}
});
test('real dice exact LOS and reload do not repeat salary',()=>{const s=game();s.players[0].pos=38;engine.act(s,'roll',{dice:[1,1]});assert.equal(s.players[0].cash,1900);const copy=JSON.parse(JSON.stringify(s));assert.equal(engine.migrateSave(copy),false);assert.deepEqual(copy,s);});
test('legacy auction migration preserves resources and queued debt; idempotent',()=>{
 for(const kind of ['deed','building']) {const s=game();s.phase='auction';s.auction={kind,id:3,bid:400,leader:1,turn:2,eligible:[0,1,2],passed:[],targets:{1:1}};s.queue=kind==='building'?[{type:'resume',phase:'roll'}]:[{type:'auction',id:1},{type:'auction',id:5},{type:'pay',from:0,to:1,amount:2000},{type:'finish'}];const assets=JSON.stringify([s.players,s.estates,s.houses,s.hotels,s.decks]);const copy=JSON.parse(JSON.stringify(s));assert.equal(engine.migrateSave(copy),true);assert.equal(JSON.stringify([copy.players,copy.estates,copy.houses,copy.hotels,copy.decks]),assets);assert.equal(copy.phase,kind==='building'?'roll':'debt');assert.equal(copy.auction,null);const after=JSON.stringify(copy);assert.equal(engine.migrateSave(copy),false);assert.equal(JSON.stringify(copy),after);}
});
test('normal, dice-animation and debt saves stay byte-for-byte unchanged',()=>{for(const phase of ['roll','end','buy','card','debt']){const s=game();s.phase=phase;s.queue=[{type:'pay',from:0,to:1,amount:50},{type:'finish'}];const before=JSON.stringify(s);assert.equal(engine.migrateSave(s),false);assert.equal(JSON.stringify(s),before);}});

test('actual bbcba7d persisted bid, building and multi-deed bank bankruptcy migrate losslessly',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const name of ['deed','building','bankruptcy']) {
  const s=JSON.parse(readFileSync(new URL(`./fixtures/legacy-${name}.json`,import.meta.url)));
  const resources=JSON.stringify([s.players,s.estates,s.decks,s.houses,s.hotels,s.dice,s.current,s.extra]);
  assert.ok(s.auction.bid>0);assert.equal(engine.migrateSave(s),true);
  assert.equal(JSON.stringify([s.players,s.estates,s.decks,s.houses,s.hotels,s.dice,s.current,s.extra]),resources);
  assert.equal(s.phase,name==='building'?'roll':'end');assert.equal(s.queue.length,0);
  if(name==='bankruptcy')for(const id of [1,3,5])assert.deepEqual(s.estates[id],{owner:null,level:0,mortgage:false});
  const saved=JSON.stringify(s);assert.equal(engine.migrateSave(s),false);assert.equal(JSON.stringify(s),saved);
 }
});
test('target-only old moves and both LOS cards award exactly once',async()=>{
 for(const deck of ['chance','community']) {
  const s=game();s.players[0].pos=deck==='chance'?7:2;s.phase='card';s.queue=[{type:'applyCard',deck,index:0,player:0},{type:'finish'}];s.decks[deck]=s.decks[deck].filter(i=>i!==0);
  engine.act(s,'ackCard');assert.equal(s.players[0].cash,1900);assert.equal(s.players[0].pos,0);assert.equal(engine.migrateSave(s),false);engine.act(s,'end');assert.equal(s.players[0].cash,1900);
 }
 const s=game();s.players[0].pos=39;s.queue=[{type:'move',player:0,target:0},{type:'finish'}];engine.run(s);assert.equal(s.players[0].cash,1900);
});

test('legacy queued tasks preserve paused decisions and do not run payment early',()=>{
 const s=game();s.phase='debt';s.queue=[{type:'pay',from:0,to:1,amount:2000},{type:'auction',id:3},{type:'finish'}];s.debt=s.queue[0];const debt=s.debt;
 assert.equal(engine.migrateSave(s),true);assert.equal(s.phase,'debt');assert.equal(s.debt,debt);assert.equal(s.queue[0],debt);assert.equal(s.players[1].cash,1500);
});
test('legacy pending deed resumes extra roll without repeating prior movement or card',()=>{
 const s=game();s.phase='auction';s.extra=true;s.players[0].pos=3;s.players[0].cash=1700;s.auction={kind:'deed',id:3,bid:10,leader:1};s.queue=[{type:'finish'}];const decks=JSON.stringify(s.decks);
 engine.migrateSave(s);assert.equal(s.phase,'roll');assert.equal(s.extra,true);assert.equal(s.players[0].cash,1700);assert.equal(s.players[0].pos,3);assert.equal(JSON.stringify(s.decks),decks);
});
test('landing on go-to-jail gives no LOS salary',()=>{
 const s=game();s.players[0].pos=27;engine.act(s,'roll',{dice:[1,2]});assert.equal(s.players[0].pos,10);assert.equal(s.players[0].jail,0);assert.equal(s.players[0].cash,1500);assert.equal(s.phase,'end');
});
