'use strict';

const LIBRARY_KEY = 'istanbul-plans-v1';
let savedPlans = [], comparedPlans = new Set(), defaultFields = {};
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function captureSnapshot() {
  const fields = {};
  document.querySelectorAll('[data-save]').forEach(el => {
    fields[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return {fields, fxMeta, theme: document.documentElement.dataset.theme};
}

function restoreSnapshot(snapshot) {
  clearTimeout(saveTimer);
  const fields = {...defaultFields, ...snapshot.fields};
  for (const [id, value] of Object.entries(fields)) {
    const el = $(id);
    if (!el?.matches('[data-save]') || id.startsWith('age-')) continue;
    if (el.type === 'checkbox') el.checked = value === true;
    else el.value = String(value);
  }
  renderAges(fields);
  currency = $('costCurrency').value;
  const meta = snapshot.fxMeta;
  fxMeta = meta?.source === 'api' && Number.isFinite(meta.updated) && Number.isFinite(meta.fetched)
    ? {source:'api', updated:meta.updated, fetched:meta.fetched} : {source:'manual'};
  applyTheme(snapshot.theme === 'dark' ? 'dark' : 'light');
  updateFxUI();
  update();
}

function currentPlanSummary() {
  const ds = dateState(), error = validationError(ds);
  if (error) throw new Error('صحح المدخلات قبل حفظ الخطة: ' + error);
  const result = calculateBudget(collectBudget(ds));
  return {
    total:result.total, flight:result.flight, hotel:result.hotel, expenses:result.expenses,
    tours:result.tours, reserve:result.reserve, perPerson:result.perPerson,
    departure:$('departure').value, returnDate:$('returnDate').value,
    nights:ds.nights, people:result.people,
    selected:places.filter(p => $('pick-' + p.id).checked).length,
    exchangeRate:n('exchangeRate') || 0
  };
}

function persistLibrary(next) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); }
  catch { throw new Error('تعذر حفظ مكتبة الخطط؛ صدّر خطتك للاحتفاظ بنسخة.'); }
  savedPlans = next;
  renderLibrary();
}

function saveNamedPlan(existingId) {
  try {
    const summary = currentPlanSummary();
    const existing = savedPlans.find(plan => plan.id === existingId);
    if (!existing && savedPlans.length >= 20) throw new Error('يمكن حفظ 20 خطة. صدّر نسخة أو احذف خطة قديمة أولاً.');
    const name = existing?.name || $('planName').value.trim();
    if (!name) { $('planName').focus(); throw new Error('سمِّ الخطة أولاً ليسهل تمييزها.'); }
    const plan = {
      id:existing?.id || (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)),
      name:name.slice(0,60), updated:Date.now(), snapshot:captureSnapshot(), summary
    };
    persistLibrary(existing ? savedPlans.map(p => p.id === existing.id ? plan : p) : [...savedPlans, plan]);
    $('libraryStatus').textContent = 'حُفظت «' + plan.name + '». تعديلاتك التالية لا تغيّر النسخة إلا عند تحديثها.';
    notify(existing ? 'تم تحديث الخطة المحفوظة.' : 'أُضيفت الخطة إلى مكتبتك.');
  } catch (error) { notify(error.message); focusInvalidField(); }
}

function renderLibrary() {
  $('planLibrary').innerHTML = savedPlans.length ? savedPlans.map(plan => `
    <article class="plan-card">
      <div class="plan-card-head"><h3>${escapeHTML(plan.name)}</h3><b>${formatMoney(plan.summary.total)}</b></div>
      <small>${displayDate(plan.summary.departure)} — ${displayDate(plan.summary.returnDate)} · ${nf.format(plan.summary.people)} مسافرين · ${nf.format(plan.summary.nights)} ليالٍ</small>
      <small>آخر حفظ: ${new Intl.DateTimeFormat('ar-SA',{dateStyle:'short',timeStyle:'short',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(plan.updated))} · المبلغ وسعر الصرف وقت الحفظ</small>
      <label class="inline-check"><input type="checkbox" data-compare="${escapeHTML(plan.id)}" ${comparedPlans.has(plan.id) ? 'checked' : ''}> مقارنة «${escapeHTML(plan.name)}»</label>
      <div class="booking-links"><button type="button" class="button" data-plan-action="load" data-plan-id="${escapeHTML(plan.id)}">فتح الخطة</button><button type="button" class="button" data-plan-action="update" data-plan-id="${escapeHTML(plan.id)}">تحديث بالقيم الحالية</button><button type="button" class="button" data-plan-action="delete" data-plan-id="${escapeHTML(plan.id)}">حذف</button></div>
    </article>`).join('') : '<p class="empty-plans">خطّتك الأولى تنتظر اسماً.<br>احفظ نسختين بميزانيتين مختلفتين، ثم قارنهما هنا.</p>';
  renderComparison();
}

function renderComparison() {
  const selected = savedPlans.filter(plan => comparedPlans.has(plan.id));
  if (selected.length < 2) {
    $('planComparison').textContent = selected.length ? 'اختر خطة أخرى لعرض المقارنة.' : '';
    return;
  }
  const rows = [
    ['المسافرون', 'people', false], ['الليالي', 'nights', false],
    ['الطيران', 'flight', true], ['الإقامة', 'hotel', true],
    ['المصروف والتنقلات', 'expenses', true], ['المزارات', 'tours', true],
    ['الاحتياطي', 'reserve', true], ['الإجمالي', 'total', true], ['متوسط الفرد', 'perPerson', true]
  ];
  const baseline = selected[0].summary.total;
  $('planComparison').innerHTML = `<div class="table-scroll" tabindex="0" role="region" aria-label="جدول مقارنة الخطط"><table class="comparison-table"><caption>مقارنة ${nf.format(selected.length)} خطط · القيم بالريال وقت الحفظ</caption><thead><tr><th scope="col">البند</th>${selected.map(p => `<th scope="col">${escapeHTML(p.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,key,money]) => `<tr class="${key === 'total' ? 'comparison-total' : ''}"><th scope="row">${label}</th>${selected.map(p => `<td>${money ? formatMoney(p.summary[key]) : nf.format(p.summary[key])}</td>`).join('')}</tr>`).join('')}<tr><th scope="row">الفرق عن «${escapeHTML(selected[0].name)}»</th>${selected.map(p => `<td>${p.summary.total === baseline ? '—' : (p.summary.total > baseline ? '+ ' : '− ') + formatMoney(Math.abs(p.summary.total - baseline))}</td>`).join('')}</tr></tbody></table></div><p class="field-hint space">قد تختلف التواريخ والمسافرون وسعر الصرف بين الخطط؛ راجعها قبل المقارنة.</p>`;
}

function exportCurrentPlan() {
  try {
    currentPlanSummary();
    const plan = {format:'istanbul-trip', version:1, name:$('planName').value.trim() || 'رحلة إسطنبول', snapshot:captureSnapshot()};
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)], {type:'application/json'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'istanbul-plan-' + $('departure').value + '.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('صُدّرت الخطة. يمكنك استيراد الملف على جهاز آخر.');
  } catch (error) { notify(error.message); }
}

async function importCurrentPlan(file) {
  if (!file) return;
  const previous = captureSnapshot();
  let restored = false;
  try {
    if (file.size > 500000) throw new Error('ملف الخطة كبير جداً؛ الحد الأقصى 500 كيلوبايت.');
    const plan = parsePlanFile(JSON.parse(await file.text()));
    // Validate every supplied field on a detached control before changing the page.
    for (const [id,value] of Object.entries(plan.snapshot.fields)) {
      const original = $(id) || (/^age-\d{1,2}$/.test(id) ? Object.assign(document.createElement('input'), {type:'number',min:'2',max:'11',step:'1'}) : null);
      if (original && /^age-\d{1,2}$/.test(id)) original.setAttribute('data-save','');
      if (!original?.matches('[data-save]')) continue;
      if (original.type === 'checkbox') {
        if (typeof value !== 'boolean') throw new Error('قيمة اختيار غير صحيحة داخل الملف.');
        continue;
      }
      const clone = original.cloneNode(true);
      clone.readOnly = false;
      if (clone.type === 'date') clone.removeAttribute('min');
      clone.value = String(value);
      const optionalEmptyRate = id === 'exchangeRate' && value === '' && plan.snapshot.fields.costCurrency !== 'TRY';
      if ((!clone.value && !optionalEmptyRate) || !clone.checkValidity()) throw new Error('يحتوي الملف على قيمة غير صحيحة في «' + id + '».');
    }
    restored = true;
    restoreSnapshot(plan.snapshot);
    // Old trip dates may still be imported; show the normal date validation for editing.
    if (parseDate($('departure').value) && parseDate($('returnDate').value) && dayDiff($('departure').value,$('returnDate').value) > 0) {
      $('planName').value = plan.name;
    } else throw new Error('تواريخ الخطة المستوردة غير صالحة.');
    $('libraryStatus').textContent = 'استُوردت «' + plan.name + '» إلى المحرر. احفظ نسخة لإضافتها إلى مكتبتك.';
    notify('تم استيراد الخطة. راجع التواريخ وسعر الصرف.');
  } catch (error) {
    if (restored) restoreSnapshot(previous);
    notify(error instanceof SyntaxError ? 'ملف JSON غير صالح.' : error.message);
  } finally { $('planFile').value = ''; }
}

function initLibrary() {
  try {
    const stored = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
    savedPlans = Array.isArray(stored) ? stored.filter(plan => {
      if (!plan || typeof plan.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(plan.id) || typeof plan.name !== 'string' || plan.name.length > 60 || !Number.isFinite(plan.updated)) return false;
      try { parsePlanFile({format:'istanbul-trip',version:1,snapshot:plan.snapshot}); } catch { return false; }
      const summary = plan.summary;
      return summary && ['total','flight','hotel','expenses','tours','reserve','perPerson','nights','people'].every(key => Number.isFinite(summary[key]) && summary[key] >= 0) && parseDate(summary.departure) && parseDate(summary.returnDate);
    }).slice(0,20) : [];
  } catch { savedPlans = []; $('libraryStatus').textContent = 'تعذرت قراءة مكتبة الخطط. يمكنك تصدير الخطة الحالية.'; }
  renderLibrary();
  $('saveNamedPlan').addEventListener('click', () => saveNamedPlan());
  $('planName').addEventListener('keydown', event => { if (event.key === 'Enter') saveNamedPlan(); });
  $('exportPlan').addEventListener('click', exportCurrentPlan);
  $('importPlan').addEventListener('click', () => $('planFile').click());
  $('planFile').addEventListener('change', event => importCurrentPlan(event.target.files[0]));
  $('planLibrary').addEventListener('change', event => {
    const id = event.target.dataset.compare;
    if (!id) return;
    if (event.target.checked && comparedPlans.size >= 3) { event.target.checked = false; notify('اختر ثلاث خطط كحد أقصى.'); return; }
    if (event.target.checked) comparedPlans.add(id); else comparedPlans.delete(id);
    renderComparison();
  });
  $('planLibrary').addEventListener('click', event => {
    const button = event.target.closest('[data-plan-action]');
    if (!button) return;
    const plan = savedPlans.find(plan => plan.id === button.dataset.planId);
    if (!plan) return;
    if (button.dataset.planAction === 'load') {
      restoreSnapshot(plan.snapshot); $('planName').value = plan.name;
      $('trip').scrollIntoView({behavior:'smooth',block:'start'});
      $('libraryStatus').textContent = 'تعدل الآن نسخة من «' + plan.name + '». النسخة المحفوظة لم تتغير.';
      notify('فُتحت الخطة؛ عدّلها أو احفظ نسخة جديدة.');
    } else if (button.dataset.planAction === 'update') {
      if (confirm('استبدال «' + plan.name + '» بالقيم الموجودة حالياً في المحرر؟')) saveNamedPlan(plan.id);
    } else if (confirm('حذف «' + plan.name + '» من مكتبة هذا المتصفح؟')) {
      try { persistLibrary(savedPlans.filter(p => p.id !== plan.id)); comparedPlans.delete(plan.id); renderComparison(); notify('حُذفت الخطة المحفوظة.'); }
      catch (error) { notify(error.message); }
    }
  });
}
