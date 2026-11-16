'use strict';

// Pure functions shared by the page and the Node test suite.
function calculateBudget(v) {
  const people = v.adults + v.children + v.infants;
  const paying = v.adults + v.children;
  const rate = v.costCurrency === 'TRY' ? 1 / v.exchangeRate : 1;
  const flight = Number.isFinite(v.groupFlightFare) ? v.groupFlightFare : v.adults * v.adultFare + v.children * v.childFare + v.infants * v.infantFare + v.flightExtras;
  const hotel = (v.nights * v.rooms * v.nightRate + v.hotelExtras) * rate;
  const daily = (v.adults * v.foodAdult + v.children * v.foodChild + paying * v.transportDaily + paying * v.activityDaily) * rate;
  const expenses = daily * v.expenseDays + (v.cardFee + v.simPrice * v.simCount + v.shopping + v.istTransfer + v.infantExtras + v.otherLocal) * rate + v.medTransfer;
  const tours = v.tours * rate;
  const fxFees = (hotel + expenses - v.medTransfer + tours) * v.fxFee / 100;
  const subtotal = flight + hotel + expenses + tours + v.documentsCost + (v.planExtrasSAR||0) + fxFees;
  const reserve = subtotal * v.reserve / 100;
  const total = subtotal + reserve;
  return {people, flight, hotel, expenses, daily, tours, fxFees, subtotal, reserve, total, perPerson: total / people};
}

// Same integer-cent order as the Worker. Reprice locally without a paid /plan call.
function recalculateGeneratedBudget(original,changes={}) {
  const b=JSON.parse(JSON.stringify(original)),cents=n=>Math.round(n*100),rate=b.exchange_rate;
  const money=(n,evidence)=>({SAR:n===null?null:n/100,TRY:n===null?null:Math.round(n*rate)/100,evidence});
  if(Object.hasOwn(changes,'groupFlightFare')){
    const fare=changes.groupFlightFare;if(fare!==null&&(!Number.isFinite(fare)||fare<0||fare>1000000))throw Error('invalid_fare');
    b.components.flights=money(fare===null?null:cents(fare),{source:fare===null?'طيران المجموعة غير مدخل':'مدخل من المستخدم',freshness:'user-entered',fetched_at:new Date().toISOString(),verified:false,price_basis:'group'});
  }
  if(changes.addedTicketSAR)b.components.attractions=money(cents(b.components.attractions.SAR)+cents(changes.addedTicketSAR),b.components.attractions.evidence);
  const local=['stay','food','transport','attractions'].reduce((n,key)=>n+cents(b.components[key].SAR),0);
  b.components.fx_fee=money(Math.round(local*b.fx_fee_percent/100),b.components.fx_fee.evidence);
  const subtotal=Object.entries(b.components).filter(([key])=>key!=='reserve').reduce((n,[,m])=>n+(m.SAR===null?0:cents(m.SAR)),0);
  b.components.reserve=money(Math.round(subtotal*b.reserve_percent/100),b.components.reserve.evidence);
  const known=subtotal+cents(b.components.reserve.SAR),converted=Object.values(b.components).reduce((n,m)=>n+(m.TRY===null?0:cents(m.TRY)),0)/100;
  b.complete=b.components.flights.SAR!==null;b.known_total=money(known,b.known_total.evidence);b.known_total.TRY=converted;
  b.total=money(b.complete?known:null,b.total.evidence);if(b.complete)b.total.TRY=converted;
  b.difference=b.complete?money(known-cents(b.target.SAR),{source:'حساب حتمي بعد التعديل',freshness:'derived',verified:false}):null;
  if(b.difference)b.difference.TRY=(cents(converted)-cents(b.target.TRY))/100;
  return b;
}

const placeSchedule = {
  sultan: ['المدينة التاريخية', 3], hagia: ['المدينة التاريخية', 2],
  topkapi: ['المدينة التاريخية', 4], cistern: ['المدينة التاريخية', 1],
  galata: ['غلطة وكاراكوي', 4], ortakoy: ['البوسفور الأوروبي', 3],
  dolma: ['البوسفور الأوروبي', 3], bosphorus: ['البوسفور الأوروبي', 4],
  balat: ['القرن الذهبي', 3], miniaturk: ['القرن الذهبي', 3], rahmi: ['القرن الذهبي', 4],
  asian: ['الجانب الآسيوي', 5], ferry: ['الجانب الآسيوي', 1],
  aquarium: ['فلوريا', 4], islands: ['جزر الأميرات', 8],
  bursa: ['بورصة', 10], sapanca: ['صبنجة ومعشوقية', 10]
};

function schedulePlaces(selected, days, pace, fullTrip = true, departure, rules = typeof module!=='undefined'&&module.exports?require('../../worker/data/attractions.json'):globalThis.IstanbulAttractionRules||[]) {
  const limit = pace === 'active' ? 8 : 6;
  const start=/^\d{4}-\d{2}-\d{2}$/.test(departure)?new Date(departure+'T12:00:00Z'):null;
  const dated=start&&Number.isFinite(start.getTime())&&start.toISOString().slice(0,10)===departure;
  const itinerary = Array.from({length: days}, (_, index) => ({index,date:dated?new Date(start.getTime()+index*86400000).toISOString().slice(0,10):null, places: [], hours: 0, area: '',lightDay:days>=8&&index%4===3,breakMinutes:45}));
  const catalog=new Map(rules.map(rule=>[rule.id,rule]));
  const last = fullTrip ? days - 1 : days;
  const slots = itinerary.slice(1, last);
  const groups = new Map();
  selected.forEach(place => {
    const [area, hours] = placeSchedule[place.id] || [place.area, 4];
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push({...place, hours,scheduleRule:catalog.get(place.id)});
  });
  const open=(place,day)=>day.date&&Array.isArray(place.scheduleRule?.closed_days)&&!place.scheduleRule.closed_days.includes(new Date(day.date+'T12:00:00Z').getUTCDay());
  function fits(place,day){
    const fullDay=place.hours>=8,area=placeSchedule[place.id]?.[0]||place.area;
    return open(place,day)&&(!day.area||day.area===area)&&day.places.length<3&&
      (!day.lightDay||(!day.places.length&&place.hours<=3))&&
      !(fullDay&&slots.some(other=>Math.abs(other.index-day.index)===1&&other.hours>=8))&&
      (!day.places.length||(!fullDay&&day.hours+place.hours<=limit&&day.hours<8));
  }
  const assign=(place,day)=>{day.area=placeSchedule[place.id]?.[0]||place.area;day.hours+=place.hours;day.places.push(place);};
  for (const group of groups.values()) {
    for (const place of group) {
      const day=slots.find(day=>fits(place,day));
      if(day)assign(place,day);
    }
  }
  const all=[...groups.values()].flat(),snapshot=()=>itinerary.map(day=>({...day,places:[...day.places]}));
  // If a flexible visit took the only open day, try moving visits without
  // relaxing the existing area, pace, light-day or consecutive-trip limits.
  let best=snapshot(),bestCount=best.reduce((sum,day)=>sum+day.places.length,0),states=0;
  if(bestCount<all.length){
    for(const day of slots){day.places=[];day.hours=0;day.area='';}
    function search(remaining,count){
      if(count>bestCount){best=snapshot();bestCount=count;}
      if(++states>500||bestCount===all.length||count+remaining.length<=bestCount)return;
      const choices=remaining.map(place=>({place,days:slots.filter(day=>fits(place,day))})).sort((a,b)=>a.days.length-b.days.length);
      const {place,days:available}=choices[0],rest=remaining.filter(other=>other.id!==place.id);
      for(const day of available){const hours=day.hours,area=day.area;assign(place,day);search(rest,count+1);day.places.pop();day.hours=hours;day.area=area;if(states>500||bestCount===all.length)break;}
      if(states<=500)search(rest,count);
    }
    search(all,0);
    itinerary.splice(0,itinerary.length,...best);
  }
  const scheduled=new Set(itinerary.flatMap(day=>day.places.map(place=>place.id)));
  const unscheduled=all.filter(place=>!scheduled.has(place.id)).map(place=>({...place,reason:!dated?'تاريخ بداية البرنامج غير صالح؛ لا يمكن التحقق من الإغلاق.':!Array.isArray(place.scheduleRule?.closed_days)?'قواعد الإغلاق غير متاحة في الدليل؛ راجع المصدر قبل الزيارة.':!slots.length?'لا توجد أيام زيارة بين الوصول والعودة.':!slots.some(day=>open(place,day))?'الإغلاق الأسبوعي في الدليل يشمل كل أيام الزيارة المتاحة.':'لم تتسع الأيام المفتوحة ضمن حدود الوتيرة والمنطقة والأيام الأخف والراحة؛ راجع الإغلاق أو مدّد البرنامج.'}));
  return {itinerary, unscheduled};
}

function parseAppliedItinerary(value){
  if(value==null)return null;
  const invalid=()=>{throw new Error('بيانات الجدول المطبق غير صالحة.');};
  if(typeof value!=='object'||typeof value.context!=='string'||value.context.length>1500||!Array.isArray(value.days)||value.days.length<2||value.days.length>31)invalid();
  const seen=new Set();
  const days=value.days.map((day,i)=>{
    if(!day||typeof day.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||!Number.isFinite(Date.parse(day.date))||new Date(day.date).toISOString().slice(0,10)!==day.date||!Array.isArray(day.ids)||day.ids.length>3||typeof day.light_day!=='boolean'||!Number.isFinite(day.visit_min)||day.visit_min<0||day.visit_min>1440)invalid();
    if(i&&Date.parse(day.date)-Date.parse(value.days[i-1].date)!==86400000)invalid();
    for(const id of day.ids){if(!Object.hasOwn(placeSchedule,id)||seen.has(id))invalid();seen.add(id);}
    return {date:day.date,ids:[...day.ids],visit_min:day.visit_min,light_day:day.light_day};
  });
  if(days[0].ids.length||days.at(-1).ids.length)invalid();
  return {context:value.context,days};
}

function parsePlanFile(value) {
  if (!value || value.format !== 'istanbul-trip' || value.version !== 1 ||
      !value.snapshot || !value.snapshot.fields || typeof value.snapshot.fields !== 'object' || Array.isArray(value.snapshot.fields)) {
    throw new Error('صيغة الخطة غير مدعومة. اختر ملفاً صدّرته من هذا التطبيق.');
  }
  const fields = Object.create(null);
  const entries = Object.entries(value.snapshot.fields);
  if (entries.length > 400) throw new Error('يحتوي الملف على حقول أكثر من الحد المسموح.');
  for (const [id, field] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]{0,70}$/.test(id) ||
        !['string', 'boolean', 'number'].includes(typeof field) || String(field).length > (id==='appliedHotelQuote'?512:200)) {
      throw new Error('يحتوي ملف الخطة على بيانات غير صالحة.');
    }
    fields[id] = field;
  }
  return {
    name: typeof value.name === 'string' ? value.name.trim().slice(0, 60) || 'خطة مستوردة' : 'خطة مستوردة',
    snapshot: {
      fields,
      appliedItinerary:parseAppliedItinerary(value.snapshot.appliedItinerary),
      theme: value.snapshot.theme === 'dark' ? 'dark' : 'light',
      // Imported exchange rates are treated as manual, rather than trusted API data.
      fxMeta: {source: 'manual'}
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {calculateBudget, schedulePlaces, parsePlanFile,recalculateGeneratedBudget,parseAppliedItinerary};
}
