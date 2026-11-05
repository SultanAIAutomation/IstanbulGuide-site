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

function schedulePlaces(selected, days, pace, fullTrip = true) {
  const limit = pace === 'active' ? 8 : 6;
  const itinerary = Array.from({length: days}, (_, index) => ({index, places: [], hours: 0, area: '',lightDay:days>=8&&index%4===3,breakMinutes:45}));
  const last = fullTrip ? days - 1 : days;
  const slots = itinerary.slice(1, last);
  const groups = new Map();
  selected.forEach(place => {
    const [area, hours] = placeSchedule[place.id] || [place.area, 4];
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push({...place, hours});
  });
  const unscheduled = [];
  for (const [area, group] of groups) {
    for (const place of group) {
      const fullDay = place.hours >= 8;
      const day = slots.find(day => (!day.area || day.area === area) && day.places.length<3 && (!day.lightDay || (!day.places.length&&place.hours<=3)) &&
        !(fullDay&&slots.some(other=>Math.abs(other.index-day.index)===1&&other.hours>=8)) &&
        (!day.places.length || (!fullDay && day.hours + place.hours <= limit && day.hours < 8)));
      if (!day) { unscheduled.push(place); continue; }
      day.area = area;
      day.hours += place.hours;
      day.places.push(place);
    }
  }
  return {itinerary, unscheduled};
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
        !['string', 'boolean', 'number'].includes(typeof field) || String(field).length > 200) {
      throw new Error('يحتوي ملف الخطة على بيانات غير صالحة.');
    }
    fields[id] = field;
  }
  return {
    name: typeof value.name === 'string' ? value.name.trim().slice(0, 60) || 'خطة مستوردة' : 'خطة مستوردة',
    snapshot: {
      fields,
      theme: value.snapshot.theme === 'dark' ? 'dark' : 'light',
      // Imported exchange rates are treated as manual, rather than trusted API data.
      fxMeta: {source: 'manual'}
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {calculateBudget, schedulePlaces, parsePlanFile,recalculateGeneratedBudget};
}
