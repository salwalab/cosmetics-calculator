'use strict';

/* ===== الحساب الدقيق ===== */

// يحوّل النص إلى عدد عشري دقيق: { scaled: BigInt, scale: عدد الخانات }
function parseDecimal(str) {
  if (typeof str !== 'string') return null;
  str = str.trim().replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
  str = str.replace(/[٫,]/g, '.');
  if (!/^\d*\.?\d*$/.test(str) || str === '' || str === '.') return null;
  var parts = str.split('.');
  var intPart = parts[0] === '' ? '0' : parts[0];
  var fracPart = parts.length > 1 ? parts[1] : '';
  return { scaled: BigInt(intPart + fracPart), scale: fracPart.length };
}

// وزن المادة = الكمية × النسبة ÷ 100 — يعيد { num, den } كسرًا دقيقًا
function exactWeight(qty, pct) {
  return {
    num: qty.scaled * pct.scaled,
    den: 100n * (10n ** BigInt(qty.scale + pct.scale))
  };
}

// تنسيق كسر دقيق إلى عدد محدد من الخانات العشرية كحد أقصى، مع حذف الأصفار الزائدة
function formatDecimal(num, den, maxPlaces) {
  var f = 10n ** BigInt(maxPlaces);
  var n = num * f;
  var q = n / den;
  var r = n % den;
  if (r * 2n >= den) q += 1n; // تقريب لأقرب قيمة
  var s = q.toString().padStart(maxPlaces + 1, '0');
  var intPart = s.slice(0, s.length - maxPlaces);
  var frac = s.slice(s.length - maxPlaces).replace(/0+$/, '');
  return frac ? intPart + '.' + frac : intPart;
}

// أوزان بثلاث خانات عشرية ثابتة دائمًا
function formatDecimalFixed(num, den, places) {
  var f = 10n ** BigInt(places);
  var n = num * f;
  var q = n / den;
  var r = n % den;
  if (r * 2n >= den) q += 1n;
  var s = q.toString().padStart(places + 1, '0');
  return s.slice(0, s.length - places) + '.' + s.slice(s.length - places);
}

function formatWeight(w) { return formatDecimalFixed(w.num, w.den, 3); }

// مجموع النسب بدقة: يعيد { scaled, scale } بجمع كل النسب على مقام مشترك
function sumPercents(pcts) {
  var maxScale = 0, i;
  for (i = 0; i < pcts.length; i++) if (pcts[i].scale > maxScale) maxScale = pcts[i].scale;
  var total = 0n;
  for (i = 0; i < pcts.length; i++) total += pcts[i].scaled * (10n ** BigInt(maxScale - pcts[i].scale));
  return { scaled: total, scale: maxScale };
}

function percentSumEquals100(sum) {
  return sum.scaled === 100n * (10n ** BigInt(sum.scale));
}

// فرق المجموع عن 100 كنص مثل +2.5 أو -0.125
function formatPercentDiff(sum) {
  var target = 100n * (10n ** BigInt(sum.scale));
  var diff = sum.scaled - target;
  var sign = diff > 0n ? '+' : (diff < 0n ? '-' : '');
  var abs = diff < 0n ? -diff : diff;
  var s = formatDecimal(abs, 10n ** BigInt(sum.scale), 6);
  return sign + s;
}

function formatPercentSum(sum) {
  return formatDecimal(sum.scaled, 10n ** BigInt(sum.scale), 6);
}

/* للاختبار في Node */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDecimal, exactWeight, formatDecimal, formatDecimalFixed, formatWeight, sumPercents, percentSumEquals100, formatPercentDiff, formatPercentSum };
}
if (typeof document !== 'undefined') {

/* ===== واجهة الحاسبة ===== */

var STORAGE_KEY = 'naturalLabFormulas.v1';
var tbody = document.getElementById('materialsBody');
var quantityInput = document.getElementById('quantity');
var productInput = document.getElementById('productName');
var notesInput = document.getElementById('notes');
var totalPercentCell = document.getElementById('totalPercent');
var totalWeightCell = document.getElementById('totalWeight');
var sumMessage = document.getElementById('sumMessage');

function sanitizeNumeric(value) {
  // يسمح بالأرقام الإنجليزية والعربية وفاصلة عشرية واحدة فقط
  var v = value.replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
  v = v.replace(/[٫,]/g, '.').replace(/[^\d.]/g, '');
  var firstDot = v.indexOf('.');
  if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  return v;
}

function createRow(name, pct) {
  var tr = document.createElement('tr');

  var tdSelect = document.createElement('td');
  tdSelect.className = 'col-select';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'row-select';
  checkbox.setAttribute('aria-label', 'تحديد المادة');
  tdSelect.appendChild(checkbox);

  var tdNum = document.createElement('td');
  tdNum.className = 'cell-num';
  tdNum.setAttribute('data-label', 'الرقم');

  var tdName = document.createElement('td');
  tdName.className = 'col-name';
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'mat-name';
  nameInput.placeholder = 'اسم المادة';
  nameInput.value = name || '';
  tdName.appendChild(nameInput);

  var tdPct = document.createElement('td');
  tdPct.className = 'col-pct';
  tdPct.setAttribute('data-label', 'النسبة المئوية (%)');
  var pctInput = document.createElement('input');
  pctInput.type = 'text';
  pctInput.inputMode = 'decimal';
  pctInput.className = 'mat-pct';
  pctInput.placeholder = '0.0';
  pctInput.value = pct || '';
  tdPct.appendChild(pctInput);

  var tdWeight = document.createElement('td');
  tdWeight.className = 'cell-weight col-weight';
  tdWeight.setAttribute('data-label', 'الوزن بالجرام');
  tdWeight.textContent = '0.000';

  tr.appendChild(tdSelect);
  tr.appendChild(tdNum);
  tr.appendChild(tdName);
  tr.appendChild(tdPct);
  tr.appendChild(tdWeight);

  checkbox.addEventListener('change', function () {
    tr.classList.toggle('selected', checkbox.checked);
  });
  function onPctChange() {
    if (pctInput.value.indexOf('-') === -1) {
      var clean = sanitizeNumeric(pctInput.value);
      if (clean !== pctInput.value) pctInput.value = clean;
    }
    safeRecompute();
  }
  pctInput.addEventListener('input', onPctChange);
  pctInput.addEventListener('change', onPctChange);
  pctInput.addEventListener('keyup', onPctChange);
  nameInput.addEventListener('input', function () { /* الاسم لا يؤثر في الحساب */ });

  return tr;
}

function renumber() {
  var rows = tbody.querySelectorAll('tr');
  for (var i = 0; i < rows.length; i++) {
    rows[i].querySelector('.cell-num').textContent = String(i + 1);
  }
}

function addRow(name, pct) {
  tbody.appendChild(createRow(name, pct));
  renumber();
}

var quantityInvalid = false;

function getQuantity() {
  var raw = quantityInput.value.trim();
  var q = parseDecimal(quantityInput.value);
  quantityInvalid = raw !== '' && (!q || q.scaled <= 0n);
  quantityInput.classList.toggle('invalid', quantityInvalid);
  if (!q || q.scaled <= 0n) return null;
  return q;
}

function safeRecompute() {
  try { recomputeAll(); } catch (e) {
    showToast('تعذر الحساب: ' + ((e && e.message) ? e.message : 'خطأ غير متوقع'));
  }
}

function recomputeAll() {
  var qty = getQuantity();
  var rows = tbody.querySelectorAll('tr');
  var pcts = [];
  var weights = [];
  var hasInvalid = false;

  rows.forEach(function (tr) {
    var pctInput = tr.querySelector('.mat-pct');
    var weightCell = tr.querySelector('.cell-weight');
    var raw = pctInput.value.trim();
    var pct = raw === '' ? null : parseDecimal(raw);
    var invalid = raw !== '' && !pct;
    if (invalid) hasInvalid = true;

    pctInput.classList.toggle('invalid', invalid);

    if (qty && pct && pct.scaled >= 0n) {
      var w = exactWeight(qty, pct);
      weightCell.textContent = formatWeight(w);
      weights.push(w);
      pcts.push(pct);
    } else if (!invalid && raw === '') {
      weightCell.textContent = '0.000';
    } else {
      weightCell.textContent = invalid ? '—' : '0.000';
    }
  });

  // مجموع النسب
  var sum = sumPercents(pcts);
  totalPercentCell.textContent = formatPercentSum(sum) + '%';

  // مجموع الأوزان = الكمية × مجموع النسب ÷ 100 (مطابق تمامًا لجمع أوزان المواد)
  if (qty && pcts.length > 0) {
    var totalW = {
      num: qty.scaled * sum.scaled,
      den: 100n * (10n ** BigInt(qty.scale + sum.scale))
    };
    totalWeightCell.textContent = formatWeight(totalW);
  } else {
    totalWeightCell.textContent = '0.000';
  }

  // رسالة المجموع: القيم غير الصالحة تمنع أي حالة اعتماد
  sumMessage.className = 'sum-message';
  if (hasInvalid || quantityInvalid) {
    sumMessage.classList.add('bad');
    sumMessage.textContent = 'توجد قيم غير صالحة مظللة بالأحمر، صححيها قبل اعتماد المجموع';
    return;
  }
  if (pcts.length === 0) {
    sumMessage.textContent = '';
    return;
  }
  if (percentSumEquals100(sum)) {
    sumMessage.classList.add('ok');
    sumMessage.textContent = 'مجموع النسب صحيح 100%';
  } else {
    sumMessage.classList.add('bad');
    sumMessage.textContent = 'مجموع النسب لا يساوي 100% - الفرق: ' + formatPercentDiff(sum) + '%';
  }
}

/* ===== التنبيهات والنوافذ ===== */

var toastTimer = null;
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.hidden = true; }, 2600);
}

var overlay = document.getElementById('modalOverlay');
var modalTitle = document.getElementById('modalTitle');
var modalBody = document.getElementById('modalBody');
var modalActions = document.getElementById('modalActions');

function openModal(title, bodyNode, actions) {
  modalTitle.textContent = title;
  modalBody.innerHTML = '';
  if (bodyNode) modalBody.appendChild(bodyNode);
  modalActions.innerHTML = '';
  actions.forEach(function (a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (a.primary ? ' btn-primary' : '');
    b.textContent = a.label;
    b.addEventListener('click', a.onClick);
    modalActions.appendChild(b);
  });
  overlay.hidden = false;
}
function closeModal() { overlay.hidden = true; }
overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

/* ===== الحفظ والاسترجاع المحلي ===== */

window.addEventListener('error', function (e) {
  try { showToast('تنبيه تقني: ' + (e && e.message ? e.message : 'خطأ غير متوقع')); } catch (x) {}
});
var STORAGE_OK = typeof window !== 'undefined' && !!window.__nlStore;
function loadStore() {
  try {
    var v = window.__nlStore ? window.__nlStore.get() : null;
    return v && typeof v === 'object' ? v : {};
  } catch (e) { return {}; }
}
function saveStore(store) {
  if (!STORAGE_OK) return false;
  try {
    window.__nlStore.set(store);
    return true;
  } catch (e) { return false; }
}

function currentFormula(name) {
  var rows = [];
  tbody.querySelectorAll('tr').forEach(function (tr) {
    rows.push({
      name: tr.querySelector('.mat-name').value,
      pct: tr.querySelector('.mat-pct').value
    });
  });
  return {
    name: name,
    product: productInput.value,
    quantity: quantityInput.value,
    notes: notesInput.value,
    rows: rows,
    savedAt: new Date().toISOString()
  };
}

function applyFormula(f) {
  productInput.value = f.product || '';
  quantityInput.value = f.quantity || '';
  notesInput.value = f.notes || '';
  tbody.innerHTML = '';
  var rows = (f.rows && f.rows.length) ? f.rows : [{ name: '', pct: '' }];
  rows.forEach(function (r) { addRow(r.name, r.pct); });
  recomputeAll();
}

/* ===== الأزرار ===== */

document.getElementById('btnCalc').addEventListener('click', function () {
  try {
    recomputeAll();
    showToast('تم حساب التركيبة');
  } catch (e) {
    showToast('تعذر الحساب: ' + ((e && e.message) ? e.message : 'خطأ غير متوقع'));
  }
});

document.getElementById('btnAdd').addEventListener('click', function () {
  addRow('', '');
  recomputeAll();
  var rows = tbody.querySelectorAll('tr');
  rows[rows.length - 1].querySelector('.mat-name').focus();
});

document.getElementById('btnDelete').addEventListener('click', function () {
  var selected = tbody.querySelectorAll('tr.selected');
  if (selected.length === 0) {
    showToast('حدد مادة واحدة على الأقل أولًا');
    return;
  }
  var count = selected.length;
  var msg = count === 1 ? 'سيتم حذف المادة المحددة.' : 'سيتم حذف ' + count + ' مواد محددة.';
  var body = document.createElement('p');
  body.textContent = msg;
  openModal('تأكيد الحذف', body, [
    { label: 'إلغاء', onClick: closeModal },
    { label: 'حذف', primary: true, onClick: function () {
      selected.forEach(function (tr) { tr.remove(); });
      if (tbody.querySelectorAll('tr').length === 0) addRow('', '');
      renumber();
      recomputeAll();
      closeModal();
      showToast('تم الحذف');
    } }
  ]);
});

document.getElementById('btnNew').addEventListener('click', function () {
  var body = document.createElement('p');
  body.textContent = 'سيتم مسح بيانات التركيبة الحالية والبدء من جديد. هل أنت متأكد؟';
  openModal('تركيبة جديدة', body, [
    { label: 'إلغاء', onClick: closeModal },
    { label: 'نعم، تركيبة جديدة', primary: true, onClick: function () {
      productInput.value = '';
      quantityInput.value = '';
      notesInput.value = '';
      tbody.innerHTML = '';
      for (var i = 0; i < 10; i++) addRow('', '');
      recomputeAll();
      closeModal();
      showToast('بدأنا تركيبة جديدة');
    } }
  ]);
});

function hasInvalidInputs() {
  recomputeAll();
  if (quantityInput.classList.contains('invalid')) return true;
  var bad = false;
  tbody.querySelectorAll('.mat-pct').forEach(function (el) {
    if (el.classList.contains('invalid')) bad = true;
  });
  return bad;
}

function buildPrintReport() {
  var qty = getQuantity();
  document.getElementById('prProduct').textContent = productInput.value.trim() || '—';
  document.getElementById('prQuantity').textContent = qty ? (formatDecimal(qty.scaled, 10n ** BigInt(qty.scale), 6) + ' جرام') : '—';
  document.getElementById('prDate').textContent = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
  var notes = notesInput.value.trim();
  document.getElementById('prNotes').textContent = notes;
  document.getElementById('prNotesRow').style.display = notes ? '' : 'none';

  var prBody = document.getElementById('prBody');
  prBody.innerHTML = '';
  var n = 0;
  tbody.querySelectorAll('tr').forEach(function (tr) {
    var name = tr.querySelector('.mat-name').value.trim();
    var pctRaw = tr.querySelector('.mat-pct').value.trim();
    if (!name && !pctRaw) return;
    n++;
    var weight = tr.querySelector('.cell-weight').textContent;
    var row = document.createElement('tr');
    [String(n), name || '—', pctRaw ? pctRaw + '%' : '—', weight].forEach(function (text) {
      var td = document.createElement('td');
      td.textContent = text;
      row.appendChild(td);
    });
    prBody.appendChild(row);
  });

  document.getElementById('prTotalPct').textContent = totalPercentCell.textContent;
  document.getElementById('prTotalWeight').textContent = totalWeightCell.textContent;
  var prSum = document.getElementById('prSumMessage');
  prSum.textContent = sumMessage.textContent;
  prSum.className = 'pr-sum' + (sumMessage.classList.contains('ok') ? ' ok' : (sumMessage.classList.contains('bad') ? ' bad' : ''));
}

document.getElementById('btnPrint').addEventListener('click', function () {
  if (hasInvalidInputs()) {
    showToast('صححي القيم المظللة بالأحمر قبل الطباعة');
    return;
  }
  buildPrintReport();
  document.body.classList.add('print-mode');
  window.print();
  setTimeout(function () { document.body.classList.remove('print-mode'); }, 500);
});

/* ===== التهيئة ===== */

function onQuantityChange() {
  if (quantityInput.value.indexOf('-') === -1) {
    var clean = sanitizeNumeric(quantityInput.value);
    if (clean !== quantityInput.value) quantityInput.value = clean;
  }
  safeRecompute();
}
quantityInput.addEventListener('input', onQuantityChange);
quantityInput.addEventListener('change', onQuantityChange);
quantityInput.addEventListener('keyup', onQuantityChange);

for (var i = 0; i < 10; i++) addRow('', '');
recomputeAll();

}
