'use strict';

// Pure functions shared by the page and the Node test suite.
function calculateBudget(v) {
  const people = v.adults + v.children + v.infants;
  const paying = v.adults + v.children;
  const rate = v.costCurrency === 'TRY' ? 1 / v.exchangeRate : 1;
  const flight = v.adults * v.adultFare + v.children * v.childFare + v.infants * v.infantFare + v.flightExtras;
  const hotel = (v.nights * v.rooms * v.nightRate + v.hotelExtras) * rate;
  const daily = (v.adults * v.foodAdult + v.children * v.foodChild + paying * v.transportDaily + paying * v.activityDaily) * rate;
  const expenses = daily * v.expenseDays + (v.cardFee + v.simPrice * v.simCount + v.shopping + v.istTransfer + v.infantExtras + v.otherLocal) * rate + v.medTransfer;
  const tours = v.tours * rate;
  const fxFees = (hotel + expenses - v.medTransfer + tours) * v.fxFee / 100;
  const subtotal = flight + hotel + expenses + tours + v.documentsCost + fxFees;
  const reserve = subtotal * v.reserve / 100;
  const total = subtotal + reserve;
  return {people, flight, hotel, expenses, daily, tours, fxFees, subtotal, reserve, total, perPerson: total / people};
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
  module.exports = {calculateBudget, schedulePlaces, parsePlanFile};
}
