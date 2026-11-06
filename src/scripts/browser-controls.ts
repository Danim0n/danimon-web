// Discourage opening the context menu/DevTools through page shortcuts.
// Browser menus and tools opened outside the page remain under browser control.
document.addEventListener('contextmenu', event => event.preventDefault(), { capture: true });
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  const inspectorShortcut = ((event.ctrlKey && event.shiftKey) || (event.metaKey && event.altKey)) &&
    ['i', 'j', 'c'].includes(key);
  if (key === 'f12' || inspectorShortcut) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, { capture: true });
