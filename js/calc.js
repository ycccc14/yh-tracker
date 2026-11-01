// The calculator behind every amount: keys build an expression like "12.50+8×2", and evaluate()
// works it out with the usual order (× ÷ before + −), rounded to cents. No eval().
'use strict';
const Calc = (function () {
  const OPS = '+−×÷';
  const isOp = (c) => OPS.indexOf(c) >= 0;

  function lastNumber(expr) {
    const m = expr.match(/[0-9.]*$/);
    return m ? m[0] : '';
  }

  function round2(x) { return Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100; }

  // Plain amount text for an expression ("12.5" stays, 12.50 -> "12.5", 3 -> "3").
  function fromNumber(x) {
    if (!x) return '';
    return String(round2(x));
  }

  function press(expr, key) {
    expr = expr || '';
    const last = expr.slice(-1);
    const num = lastNumber(expr);
    if (key === 'C') return '';
    if (key === 'back') return expr.slice(0, -1);
    if (key === '=') {
      const v = evaluate(expr);
      return v === null ? expr : fromNumber(v);
    }
    if (isOp(key)) {
      if (!expr) return '';
      if (last === '.') expr = expr.slice(0, -1);
      if (isOp(expr.slice(-1))) expr = expr.slice(0, -1);
      return expr.length < 40 ? expr + key : expr;
    }
    if (expr.length >= 40) return expr;
    if (key === '.') {
      if (num.indexOf('.') >= 0) return expr;
      return expr + (num === '' ? '0.' : '.');
    }
    if (/^[0-9]$/.test(key)) {
      const dot = num.indexOf('.');
      if (dot >= 0 && num.length - dot > 2) return expr; // cents only
      if (dot < 0 && num.replace(/^0+/, '').length >= 9) return expr;
      if (num === '0') return expr.slice(0, -1) + key; // no leading zeros
      return expr + key;
    }
    return expr;
  }

  // Result of the expression, or null if it can't be worked out (e.g. ÷ 0). A trailing operator is ignored.
  function evaluate(expr) {
    expr = (expr || '').replace(/[+−×÷.]+$/, '');
    if (!expr) return 0;
    const tokens = expr.match(/[0-9.]+|[+−×÷]/g) || [];
    // × and ÷ first, into a list of terms to add or subtract.
    const terms = [];
    let sign = 1;
    let cur = null;
    let op = null;
    for (const t of tokens) {
      if (isOp(t)) {
        if (t === '+' || t === '−') { terms.push(sign * cur); cur = null; op = null; sign = t === '+' ? 1 : -1; } else op = t;
        continue;
      }
      const v = parseFloat(t);
      if (!isFinite(v)) return null;
      if (cur === null) cur = v;
      else if (op === '×') cur *= v;
      else if (op === '÷') { if (v === 0) return null; cur /= v; }
    }
    if (cur !== null) terms.push(sign * cur);
    const total = terms.reduce((a, b) => a + b, 0);
    return isFinite(total) ? round2(total) : null;
  }

  const hasOp = (expr) => /[+−×÷]/.test((expr || '').replace(/[+−×÷]$/, ''));

  return { press, evaluate, fromNumber, hasOp, round2 };
})();
if (typeof module !== 'undefined') module.exports = Calc;
