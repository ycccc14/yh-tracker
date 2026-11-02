// Sample data for the preview build (config demo: true): realistic Malaysian accounts, records,
// budgets and bills, kept only on the phone. Same default categories as the server's setup.
'use strict';

function seedDemo() {
  const CATS = [
    ['expense', '🍜', 'Food & drinks', 600], ['expense', '🛒', 'Groceries', 400], ['expense', '🚗', 'Transport', 150], ['expense', '⛽', 'Petrol', 250],
    ['expense', '🏠', 'Rent & housing', 0], ['expense', '💡', 'Bills & utilities', 0], ['expense', '📱', 'Phone & internet', 0],
    ['expense', '🛍️', 'Shopping', 300], ['expense', '💊', 'Health', 0], ['expense', '🎬', 'Entertainment', 120], ['expense', '📚', 'Education', 0],
    ['expense', '🛡️', 'Insurance', 0], ['expense', '👨‍👩‍👧', 'Family', 0], ['expense', '🎁', 'Gifts', 0], ['expense', '✈️', 'Travel', 0],
    ['expense', '💳', 'Loan & credit card', 0], ['expense', '📦', 'Others', 0],
    ['income', '💼', 'Salary', 0], ['income', '🎉', 'Bonus', 0], ['income', '💻', 'Side income', 0], ['income', '🏦', 'Interest & dividends', 0],
    ['income', '🧧', 'Gift & angpao', 0], ['income', '↩️', 'Refund', 0], ['income', '📦', 'Other income', 0],
  ];
  const id = (n) => 'cat' + Shared.pad(n);
  const C = {};
  CATS.forEach((c, i) => { C[c[2].split(' ')[0]] = id(i); put('categories', { id: id(i), kind: c[0], icon: c[1], name: c[2], budget: c[3], order: i, archived: false }); });
  put('settings', { id: 'name', value: 'YH' });
  put('settings', { id: 'currency', value: 'RM' });

  const A = (key, name, type, provider, opening, extra) => {
    put('accounts', Object.assign({ id: key, name, type, provider, opening, color: (PROVIDERS[provider] || [])[1] || '#3E7D27', order: Object.keys(S.accounts).length,
      archived: false, excluded: false, last4: '', note: '' }, extra || {}));
  };
  A('d-mbb', 'Maybank Savings', 'bank', 'maybank', 3350, { last4: '4821' });
  A('d-cimb', 'CIMB OctoSavers', 'bank', 'cimb', 1200, { last4: '0937' });
  A('d-tng', 'Touch ’n Go eWallet', 'ewallet', 'tng', 145.2);
  A('d-cash', 'Cash', 'cash', '', 180, { color: '#3E7D27' });
  A('d-visa', 'Maybank Visa', 'card', 'maybank', -320, { last4: '7712', color: '#37474F' });
  A('d-atome', 'Atome', 'paylater', 'atome', 0);
  A('d-asb', 'ASB', 'savings', 'asb', 12500, { note: 'Dividend in Dec' });
  A('d-mei', 'Mei', 'lent', '', 150, { color: '#d55181', note: 'Concert ticket' });

  // A small fixed random sequence, so the sample looks the same every time.
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pickOne = (list) => list[Math.floor(rnd() * list.length)];
  const t = today();
  let n = 0;
  const T = (date, type, amount, accountId, categoryId, note, toAccountId) => {
    if (date > t) return;
    put('transactions', { id: 'd-t' + n++, date, type, amount: Calc.round2(amount), accountId, toAccountId: toAccountId || '', categoryId: categoryId || '', note: note || '' });
  };
  const thisM = thisMonth();
  const lastM = shiftMonth(thisM, -1);
  [lastM, thisM].forEach((ym) => {
    T(ym + '-01', 'expense', 900, 'd-mbb', C.Rent, 'Rent');
    T(ym + '-05', 'expense', 128.4, 'd-mbb', C.Bills, 'TNB');
    T(ym + '-08', 'expense', 129, 'd-cimb', C.Phone, 'Unifi');
    [1, 10, 20].forEach((d) => T(ym + '-' + Shared.pad(d), 'transfer', 150, 'd-mbb', '', 'Reload', 'd-tng'));
    [5, 19].forEach((d) => T(ym + '-' + Shared.pad(d), 'transfer', 200, 'd-mbb', '', 'ATM', 'd-cash'));
    T(ym + '-25', 'income', 4200, 'd-mbb', C.Salary, 'Salary');
    T(ym + '-26', 'transfer', 500, 'd-mbb', '', 'Save', 'd-cimb');
  });
  for (let back = 40; back >= 0; back--) {
    const d = Shared.addDays(t, -back);
    T(d, 'expense', 7 + rnd() * 18, rnd() < 0.6 ? 'd-tng' : 'd-cash', C.Food, pickOne(['Nasi lemak', 'Mamak', 'Lunch', 'Kopi', 'Chicken rice', '']));
    if (rnd() < 0.18) T(d, 'expense', 60 + rnd() * 110, 'd-visa', C.Groceries, pickOne(['Jaya Grocer', 'Lotus’s', 'AEON', 'Mydin']));
    if (rnd() < 0.15) T(d, 'expense', 50 + rnd() * 20, 'd-visa', C.Petrol, 'RON95');
    if (rnd() < 0.12) T(d, 'expense', 8 + rnd() * 20, 'd-tng', C.Transport, pickOne(['Grab', 'Toll', 'Parking', 'LRT']));
    if (rnd() < 0.08) T(d, 'expense', 30 + rnd() * 120, 'd-atome', C.Shopping, pickOne(['Shopee', 'Lazada', 'Uniqlo']));
    if (rnd() < 0.05) T(d, 'expense', 18 + rnd() * 40, 'd-visa', C.Entertainment, pickOne(['GSC movie', 'Netflix', 'Karaoke']));
  }
  T(Shared.addDays(t, -12), 'income', 350, 'd-cimb', C.Side, 'Tuition class');
  T(Shared.addDays(t, -3), 'income', 50, 'd-cash', C.Gift, 'Angpao');

  const R = (key, title, amount, due, repeat, before, accountId, categoryId, auto) => {
    put('reminders', { id: key, title, amount, due, repeat, before, time: '09:00', active: true, day: +due.slice(8), accountId, categoryId, note: '', lastPaid: '', auto: !!auto });
  };
  R('d-r1', 'Rent', 900, shiftMonth(thisM, 1) + '-01', 'month', 3, 'd-mbb', C.Rent);
  R('d-r2', 'TNB electricity', 130, Shared.addDays(t, 2), 'month', 3, 'd-mbb', C.Bills);
  R('d-r3', 'PTPTN', 150, Shared.addDays(t, -1), 'month', 2, 'd-cimb', C.Loan);
  R('d-r4', 'Unifi', 129, Shared.addDays(t, 6), 'month', 1, 'd-cimb', C.Phone, true);
  R('d-r5', 'Road tax & insurance', 1150, Shared.addDays(t, 40), 'year', 7, 'd-mbb', C.Insurance);
  M.lastAccount = 'd-tng';
}
