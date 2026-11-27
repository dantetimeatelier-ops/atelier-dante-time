// Stránka objednávky: opakování platby kartou a čekání na potvrzení brány
(() => {
  const btn = document.querySelector('[data-pay-again]');
  if (btn) {
    const status = document.querySelector('[data-pay-status]');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await fetch('/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: btn.dataset.payAgain }) });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || !out.redirect) throw new Error(out.error || 'Platbu se nepodařilo zahájit / Payment could not be started');
        location.href = out.redirect;
      } catch (e) {
        status.hidden = false; status.textContent = e.message; btn.disabled = false;
      }
    });
  }
  // Po návratu z brány: několikrát obnovit, dokud oznámení o platbě nedorazí (nejvýš ~1 minuta)
  if (document.querySelector('[data-pay-wait]')) {
    const n = Number(sessionStorage.getItem('dt-pay-wait') || 0);
    if (n < 6) {
      setTimeout(() => {
        try { sessionStorage.setItem('dt-pay-wait', String(n + 1)); } catch { /* soukromý režim */ }
        location.reload();
      }, 8000);
    }
  } else {
    try { sessionStorage.removeItem('dt-pay-wait'); } catch { /* soukromý režim */ }
  }
})();
