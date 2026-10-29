// Runs only in the explicitly selected page, in the extension's isolated world.
export function mountDock(url) {
  const old = document.getElementById('__paperbridgeDock');
  if (old) { old.remove(); return; }
  const host = document.createElement('div');
  host.id = '__paperbridgeDock';
  host.style.cssText = 'position:fixed!important;right:0!important;top:0!important;height:100vh!important;width:min(420px,90vw)!important;z-index:2147483647!important;';
  const shadow = host.attachShadow({mode:'closed'});
  const frame = document.createElement('iframe');
  frame.allow = 'clipboard-write';
  frame.src = url; frame.title = 'Paperbridge form assistant';
  frame.style.cssText = 'width:100%;height:calc(100% - 44px);border:0;background:#f5f3ee;';
  const close = document.createElement('button');
  close.textContent = 'Close Paperbridge · stop run';
  close.style.cssText = 'height:44px;width:100%;background:#182a27;color:white;border:0;font:14px system-ui;cursor:pointer';
  shadow.append(close, frame);
  const root = document.documentElement;
  const previous = root.style.getPropertyValue('margin-right'), priority = root.style.getPropertyPriority('margin-right');
  root.style.setProperty('margin-right','min(420px,90vw)','important');
  const restore = () => { if (previous) root.style.setProperty('margin-right',previous,priority); else root.style.removeProperty('margin-right'); };
  close.onclick = () => host.remove();
  const observer = new MutationObserver(() => { if (!host.isConnected) { restore(); observer.disconnect(); } });
  observer.observe(root,{childList:true});
  root.append(host);
}
