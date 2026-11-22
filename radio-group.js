// 라디오 그룹 키보드 조작(WAI-ARIA 라디오 그룹 패턴): Tab 으로 그룹에 한 번 들어오고, 방향키로 옮기며 고른다.
// 고른 칸(없으면 첫 칸)만 tabindex=0, 나머지는 -1(roving tabindex). 칸을 다시 그려도 이어서 쓸 수 있게 이벤트는 그룹에 한 번만 건다.

/** 방향키에 따른 다음 칸 번호(끝에서는 처음으로 돈다). 해당 없는 키면 null */
export function nextIndex(len, i, key) {
  if (!len) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % len;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i - 1 + len) % len;
  if (key === 'Home') return 0;
  if (key === 'End') return len - 1;
  return null;
}

const radios = group => [...group.querySelectorAll('[role="radio"]')].filter(r => !r.disabled && !r.closest('[hidden]'));

/** 고른 칸(없으면 첫 칸)만 Tab 으로 들어올 수 있게 */
export function syncRoving(group) {
  const list = radios(group);
  const on = list.find(r => r.getAttribute('aria-checked') === 'true') ?? list[0];
  for (const r of group.querySelectorAll('[role="radio"]')) r.tabIndex = r === on ? 0 : -1;
}

/** 그룹에 방향키·Home·End 조작을 건다. 옮긴 칸은 click() 으로 골라 기존 클릭 처리(onPick)를 그대로 쓴다 */
export function bindRadioGroup(group) {
  if (!group || group.dataset.radioKeys) return;
  group.dataset.radioKeys = '1';
  group.addEventListener('keydown', e => {
    const cur = e.target.closest('[role="radio"]'); if (!cur || !group.contains(cur)) return;
    const list = radios(group), n = nextIndex(list.length, list.indexOf(cur), e.key);
    if (n == null || list.indexOf(cur) < 0) return;
    e.preventDefault();
    const next = list[n];
    // 먼저 포커스를 옮긴 뒤 고른다: 고르면서 칸을 다시 그리는 그룹(출발지)은 포커스된 칸 번호로 다시 포커스한다
    next.focus();
    if (next.getAttribute('aria-checked') !== 'true') next.click();
    if (next.isConnected) syncRoving(group);
  });
  group.addEventListener('click', () => setTimeout(() => syncRoving(group)), true);
  syncRoving(group);
}
