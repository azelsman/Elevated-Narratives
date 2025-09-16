const WEBHOOK_URL = "https://hook.us2.make.com/a68ldlgujjtn7pyqa3l5b52ygun6dpq1";

(function attachBridge(){
  const form = document.getElementById("impactForm");
  if (!form) return;

  // Optional on-page debug box
  if (!document.getElementById("debug")) {
    const pre = document.createElement("pre");
    pre.id = "debug";
    pre.style.cssText = "padding:12px;border:1px solid #ccc;border-radius:8px;white-space:pre-wrap;word-break:break-word;margin-top:16px;";
    document.body.appendChild(pre);
  }

  form.addEventListener("quiz:submit", async (e) => {
    const payload = e.detail || {};
    const submitBtn = form.querySelector('button[type="submit"]');
    try {
      if (submitBtn){ submitBtn.disabled = true; submitBtn.dataset._t = submitBtn.textContent; submitBtn.textContent = "Submitting…"; }

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const txt = await res.text();
      const dbg = document.getElementById("debug");
      if (dbg) dbg.textContent = txt || "[empty response]";
      if (!res.ok) throw new Error(`Submit failed (${res.status})`);
      alert("Submitted!");
    } catch (err) {
      console.error(err);
      const banner = document.getElementById("step-error");
      if (banner){ banner.textContent = err.message || "Submit error."; banner.hidden = false; }
      else { alert(err.message || "Submit error."); }
    } finally {
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset._t || "Blast Off"; }
    }
  });
})();