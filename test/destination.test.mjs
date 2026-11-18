import test from 'node:test';
import assert from 'node:assert/strict';
import { detailRequest, pointOf, resultHtml, createDestinationDialog } from '../destination.js';
const origin = { lat: 37.1, lon: 127.1, label: '출발지' }, item = { lat: 37.2, lon: 127, name: '시작점' };
test('선택한 코스 시작점/관광지와 계획 출발지만 전달하고 자동차 이외에는 차량 조건 생략', () => {
  for (const mode of ['walk','transit','bike']) assert.deepEqual(detailRequest(origin,item,mode,'ev',5,300), { origin: {lat:37.1,lon:127.1}, destination: item, mode });
  assert.equal(detailRequest('  서울역 ',item,'walk').origin, '서울역');
  for (const p of [null,{}, {lat:'',lon:127},{lat:0,lon:0},{lat:91,lon:100}]) assert.equal(pointOf(p),null);
});
test('휘발유·전기차 입력, 무료 충전 및 서버 기본값 검증', () => {
  for(const type of ['gasoline','ev']) {
    const b=detailRequest(origin,item,'car',type,'4.6','0'); assert.equal(b.efficiency,4.6); assert.equal(b.unitPrice,0); assert.equal(b.vehicle,type);
    const defaults=detailRequest(origin,item,'car',type,'',''); assert.ok(!('efficiency' in defaults) && !('unitPrice' in defaults));
  }
  for(const [e,p] of [[0,1],[-1,1],[101,1],[1,10001],[1,-1],['abc',1]]) assert.throws(()=>detailRequest(origin,item,'car','ev',e,p));
});
test('편도/왕복·경로와 추정을 구분하고 주변 장소와 빈 목록·장애를 별개로 안내', () => {
  const data={travel:{mode:'car',timeSource:'estimate',minutes:45,distanceKm:29,toll:0,fuel:{type:'ev',oneWayKrw:2030,estimateKrw:4060}},radiusM:5000,attractions:[{...item,name:'<공원>',address:'한길',url:'javascript:void(0)'}],lodgings:[],nearbyStatus:{lodgings:'unavailable'}};
  const html=resultHtml(data); for(const fragment of ['45분','추정','충전비','편도 2,030원','왕복 4,060원','별도): 0원','5km 관광지','5km 숙박','&lt;공원&gt;','한길','제공처에서','https://map.kakao.com']) assert.ok(html.includes(fragment),fragment);
  assert.ok(!html.includes('javascript:')); assert.match(resultHtml({travel:{mode:'walk',minutes:null}}), /시간 정보가 없어요/); assert.match(resultHtml({}),/찾은 장소가 없어요/);
});
test('이전 목적지의 늦은 응답을 무시하고 과거 플랜 출발지 확인 전에는 조회하지 않음', async()=>{
  const m=new Map(); const el=id=>{ if(!m.has(id))m.set(id,{open:false,showModal(){this.open=true;},close(){this.open=false;this.onclose();}});return m.get(id);};
  const calls=[];const open=createDestinationDialog({getElementById:el},(path,opts)=>new Promise(resolve=>calls.push({path,body:JSON.parse(opts.body),resolve})));
  const plan={origin};open(plan,item);el('destClose').onclick();open(plan,{...item,name:'다른 공원',lat:37.3});
  assert.equal(calls.length,2);assert.equal(calls[1].path,'/v1/destination/detail');assert.equal(calls[1].body.destination.lat,37.3);
  calls[1].resolve({travel:{mode:'walk',minutes:13}});await Promise.resolve();calls[0].resolve({travel:{mode:'walk',minutes:78}});await Promise.resolve();assert.match(el('destResult').innerHTML,/13분/);assert.doesNotMatch(el('destResult').innerHTML,/78분/);
  el('destClose').onclick();open({origin:{label:'예전 동네'}},item);assert.equal(el('destOrigin').value,'예전 동네');assert.equal(calls.length,2);
  el('destForm').onsubmit({preventDefault(){}});assert.equal(calls[2].body.origin,'예전 동네');
});
