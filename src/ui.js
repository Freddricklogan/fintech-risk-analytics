/** DOM helpers. No finance math lives here. */
export const $ = (id) => document.getElementById(id);
export const num = (id) => parseFloat($(id).value);
export const int = (id) => parseInt($(id).value, 10);
export const money = (v, digits = 0) => (Number.isFinite(v) ? `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : '—');
export const pct = (v, digits = 2) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '—');
export const fixed = (v, digits = 4) => (Number.isFinite(v) ? v.toFixed(digits) : '—');
export function setText(id, text, tone) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  if (tone !== undefined) {
    el.classList.remove('is-gain', 'is-loss');
    if (tone) el.classList.add(tone);
  }
}
export function initTabs(onChange) {
  const buttons = [...document.querySelectorAll('.tab-button')];
  const select = (name) => {
    for (const b of buttons) {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      const panel = $(`tab-${b.dataset.tab}`);
      if (panel) panel.hidden = !on;
    }
    onChange?.(name);
  };
  for (const b of buttons) b.addEventListener('click', () => select(b.dataset.tab));
  select(buttons[0]?.dataset.tab);
  return select;
}
/** Builds table rows with textContent only (no HTML interpolation of CSV fields). */
export function fillTable(tbody, rows, cells) {
  tbody.replaceChildren();
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const c of cells) {
      const td = document.createElement('td');
      const v = c(r);
      if (typeof v === 'object') {
        td.textContent = v.text;
        if (v.className) td.className = v.className;
      } else td.textContent = v;
      tr.append(td);
    }
    tbody.append(tr);
  }
}
