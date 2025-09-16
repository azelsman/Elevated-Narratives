/* js/quiz_logic.js */
(function () {
  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // ---- Form + steps ----
    const form =
      document.getElementById('impactForm') ||
      document.querySelector('.impact-quiz form') ||
      (document.querySelector('.step') && document.querySelector('.step').closest('form'));

    if (!form) {
      console.warn('[quiz] No form found. Wrap your .step blocks in a <form> or set id="impactForm".');
      return;
    }

    const totalSteps = Number(form.dataset.totalSteps || 7);
    const steps = Array.from(form.querySelectorAll('.step'));
    if (!steps.length) {
      console.warn('[quiz] No .step sections found inside the form.');
      return;
    }

    // --- TEST MODE: add a transcript box on Step 7 when ?stub=1 ---
    (function addTestTranscriptBox(){
      const params = new URLSearchParams(location.search);
      if (params.get("stub") !== "1") return;         // only show in test mode

      const step7 = document.querySelector('.step[data-step="7"]');
      if (!step7) return;

      const wrap = document.createElement('div');
      wrap.style.marginTop = "16px";
      wrap.innerHTML = `
        <h3 class="step-title">[TEST] Paste transcript to include with this submission</h3>
        <textarea name="video_transcript" rows="8" style="width:100%;">Hi, I'm Alan Zelman, a user experience leader, strategist, and storyteller. For over 20 years, I've helped teams bring clarity to complex challenges and design products people actually want to use. I work with organizations that value design as a strategic partner to drive alignment, accelerate execution, and deliver results that matter.
If you're building a product and need a design leader who can turn vision into real outcomes, check out the case studies and let's connect. Hope to hear from you soon.</textarea>
        <p class="microcopy">Only visible in test mode (?stub=1). Sent as <strong>video_transcript</strong>.</p>
      `;
      step7.appendChild(wrap);
    })();

    // ---- State ----
    let currentStep = 1;
    let branch = null; // 'audience' | 'sales' | 'authority' | 'engagement'
    let errorIdCounter = 0;

    // ---- Helpers ----
    const qs = (sel, el = document) => el.querySelector(sel);
    const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
    const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++errorIdCounter).toString(36)}`;

    // Progress fallback if template doesn’t define updateProgress
    if (typeof window.updateProgress !== 'function') {
      window.updateProgress = function (current, total) {
        const bar = document.getElementById('progress-bar');
        if (!bar) return;
        const pct = Math.round((current / (total || 7)) * 100);
        bar.style.setProperty('--progress', pct + '%');
        bar.setAttribute('aria-valuenow', String(current));

        const descId = bar.getAttribute('aria-describedby');
        if (descId) {
          const node = document.getElementById(descId);
          if (node) node.textContent = `Step ${current} of ${total}`;
        }
      };
    }

    // ---- Error UI ----
    function clearFieldA11y(fld) {
      fld.removeAttribute('aria-invalid');
      const describedby = (fld.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const keep = [];
      for (const id of describedby) {
        const node = document.getElementById(id);
        if (!node || !node.classList.contains('error-text')) keep.push(id);
      }
      if (keep.length) fld.setAttribute('aria-describedby', keep.join(' '));
      else fld.removeAttribute('aria-describedby');
      fld.classList.remove('is-invalid');
    }

    function clearErrors(scope) {
      const banner = document.getElementById('step-error');
      if (banner) banner.hidden = true, banner.textContent = '';
      qsa('.error-text', scope || form).forEach(el => el.remove());
      qsa('input.is-invalid, select.is-invalid, textarea.is-invalid', scope || form).forEach(clearFieldA11y);
    }

    function addDescribedBy(fld, id) {
      const existing = (fld.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!existing.includes(id)) {
        existing.push(id);
        fld.setAttribute('aria-describedby', existing.join(' '));
      }
    }

    function showFieldError(field, message) {
      let fld = field;
      if (field.type === 'radio') {
        const group = qsa(`input[name="${field.name}"]`, field.closest('.step') || form);
        fld = group[0] || field;
        group.forEach(r => r.classList.add('is-invalid'));
      } else {
        fld.classList.add('is-invalid');
      }
      fld.setAttribute('aria-invalid', 'true');

      const container = field.closest('.options') || field.parentElement || field;
      let msgNode = container.querySelector('.error-text');
      if (!msgNode) {
        msgNode = document.createElement('p');
        msgNode.className = 'error-text';
        msgNode.id = uid(fld.name || 'field');
        msgNode.textContent = message;
        container.appendChild(msgNode);
      } else {
        msgNode.textContent = message;
      }
      addDescribedBy(fld, msgNode.id);
    }

    function showBannerError(message) {
      const banner = document.getElementById('step-error');
      if (!banner) return;
      banner.textContent = message;
      banner.hidden = false;
    }

    // ---- Step visibility ----
    function showStep(n) {
      steps.forEach(s => {
        const isTarget = Number(s.dataset.step) === n;
        if (s.classList.contains('is-branch')) {
          const okBranch = (s.dataset.branch === branch);
          const isAllowedStep = [2, 3].includes(Number(s.dataset.step));
          s.hidden = !(isTarget && okBranch && isAllowedStep);
        } else {
          s.hidden = !isTarget;
        }
      });

      currentStep = n;
      try { window.updateProgress(currentStep, totalSteps); } catch (e) {}

      const target = steps.find(s => Number(s.dataset.step) === n && !s.hidden);
      const firstFocusable = target && target.querySelector('input, select, textarea, button[data-action="next"], [data-action="prev"]');
      if (firstFocusable) firstFocusable.focus({ preventScroll: true });

      if (target) clearErrors(target);
      console.debug('[quiz] showStep ->', n, { branch });
    }

    // ---- Branching ----
    function chosenRadio(name, scope) {
      const selected = (scope ? scope : form).querySelector(`input[name="${name}"]:checked`);
      return selected ? selected.value : null;
    }
    function applyBranch() {
      branch = chosenRadio('q1_priority') || null;
      const branchSections = qsa('.is-branch', form);
      branchSections.forEach(sec => {
        const isCurrentBranch = sec.dataset.branch === branch;
        const isAllowedStep = [2, 3].includes(Number(sec.dataset.step));
        sec.hidden = !(isCurrentBranch && isAllowedStep);
      });
      console.debug('[quiz] applyBranch ->', branch);
    }

    // ---- Validation ----
    function validateCurrentStep() {
      const stepEl = steps.find(s => Number(s.dataset.step) === currentStep && !s.hidden);
      if (!stepEl) return true;

      clearErrors(stepEl);
      const required = qsa('input[required], select[required], textarea[required]', stepEl);

      for (const fld of required) {
        if (fld.type === 'radio') {
          const name = fld.name;
          const group = qsa(`input[name="${name}"]`, stepEl);
          if (!group.some(r => r.checked)) {
            showBannerError('Please choose an option to continue.');
            group.forEach(r => r.classList.add('is-invalid'));
            group[0].focus();
            showFieldError(group[0], 'Select one option.');
            return false;
          }
        } else if (fld.type === 'checkbox') {
          if (!fld.checked) {
            showBannerError('Please check the box to proceed.');
            showFieldError(fld, 'This box needs to be checked.');
            fld.focus();
            return false;
          }
        } else {
          if (!fld.value) {
            showBannerError('Please complete the required field to continue.');
            showFieldError(fld, 'This field is required.');
            fld.focus();
            return false;
          }
          if (fld.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fld.value)) {
            showBannerError('Please enter a valid email address.');
            showFieldError(fld, 'Invalid email format.');
            fld.focus();
            return false;
          }
          if (fld.type === 'url' && !/^https?:\/\//i.test(fld.value)) {
            showBannerError('Please paste a valid public video link (starts with http/https).');
            showFieldError(fld, 'Invalid URL.');
            fld.focus();
            return false;
          }
        }
      }
      return true;
    }

    form.addEventListener('change', (e) => {
      const stepEl = steps.find(s => Number(s.dataset.step) === currentStep && !s.hidden);
      if (!stepEl) return;
      const t = e.target;
      if (t && (t.matches('input,select,textarea'))) {
        clearErrors(stepEl);
      }
    });

    // ---- Nav buttons ----
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'next') {
        if (!validateCurrentStep()) return;
        if (currentStep === 1) applyBranch();
        const next = Math.min(currentStep + 1, totalSteps);
        showStep(next);
      }

      if (action === 'prev') {
        const prev = Math.max(currentStep - 1, 1);
        showStep(prev);
      }
    });

    // ---- Submit handling ----
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateCurrentStep()) return;

      // Collect all values from the ENTIRE form (visible + hidden)
     // Collect all values from the ENTIRE form (visible + hidden)
    // Defend against overwriting a non-empty value with an empty one.
    const data = {};
    const all = Array.from(form.querySelectorAll('input, select, textarea'));

    for (const el of all) {
      if (!el.name) continue;

      // Radios: only take the checked one
      if (el.type === 'radio') {
        if (!el.checked) continue;
        data[el.name] = el.value;
        continue;
      }

      // Checkboxes: coerce to boolean
      if (el.type === 'checkbox') {
        // Only set if not already set to true, or if undefined
        if (data[el.name] === undefined) data[el.name] = !!el.checked;
        continue;
      }

      // For text/select/textarea: avoid overwriting non-empty with empty
      const val = (el.value ?? '').trim();

      // If there's already a non-empty value, don't replace it with empty
      if (data[el.name] && val === '') continue;

      // Otherwise set it (this also lets a later non-empty overwrite an earlier empty)
      if (val !== '' || data[el.name] === undefined) {
        data[el.name] = el.value; // keep original spacing/case
      }
    }

      // Branch + meta
      data.branch = branch || chosenRadio('q1_priority') || null;
      data._meta = {
        submitted_at: new Date().toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      // ---- IDs, timestamps, token, UA, auto_platform, consent ----
      const isoNow = new Date().toISOString();
      function makeResponseId() {
        const rand = Math.random().toString(36).slice(2, 7);
        return `viq_${isoNow}_${rand}`;
      }
      const urlParams = new URLSearchParams(location.search);
      const tokenFromUrl = urlParams.get("token") || "";
      function detectPlatform(url) {
        try {
          const h = new URL(url).hostname.toLowerCase();
          if (h.includes("youtube") || h.includes("youtu.be")) return "YouTube";
          if (h.includes("tiktok")) return "TikTok";
          if (h.includes("instagram")) return "Instagram";
          if (h.includes("linkedin")) return "LinkedIn";
          if (h.includes("vimeo")) return "Vimeo";
        } catch (_) {}
        return "";
      }
      const consentValue = (function () {
        const c = form.querySelector('input[name="consent"]');
        return c ? !!c.checked : "";
      })();

      // ---- Rename quiz keys to match your video_quiz_responses sheet ----
      const renameMap = {
        // Q1 → goal
        q1_priority: "goal",

        // Branch fields
        q2_platform: "platform_target",
        q3_growth_block: "growth_struggle",

        q4_conversion: "sales_cta",
        q5_sales_block: "sales_struggle",

        q6_archetype: "authority_positioning",
        q7_authority_block: "authority_struggle",

        q8_engagement_metric: "engagement_metric",
        q9_engagement_block: "engagement_struggle",

        // Common tail
        q10_ideal: "audience",
        q11_perf: "performance",
        q12_confidence: "confidence_score",
        q13_video_url: "video_link",
        q14_email: "email"
      };

      const renamed = {};
      for (const [oldKey, newKey] of Object.entries(renameMap)) {
        if (Object.prototype.hasOwnProperty.call(data, oldKey)) {
          renamed[newKey] = data[oldKey];
        }
      }
      Object.assign(data, renamed);

      // Sheet-aligned system columns
      data.response_id   = makeResponseId();                                          // response_id
      data.timestamp     = isoNow;                                                    // timestamp
      data.token         = tokenFromUrl;                                              // token (from URL)
      data.user_agent    = navigator.userAgent || "";                                 // user_agent
      data.auto_platform = detectPlatform(data.video_link || data.q13_video_url || ""); // auto_platform
      data.consent       = consentValue;                                              // consent

      // Optional placeholders (if your sheet has them and you fill later in Make)
      // data.status        = "";
      // data.ai_report_url = "";
      // data.notes         = "";
      // data.form_id       = "video_impact_quiz_v1";
      // data.respondent_id = "";
      // data.ip            = "";

      // Ensure the payload matches the sheet schema every time (all columns present)
      const SHEET_FIELDS = [
        "response_id","timestamp","token","goal","platform_target","growth_struggle",
        "sales_cta","sales_struggle","authority_positioning","authority_struggle",
        "engagement_metric","engagement_struggle","video_link","auto_platform",
        "audience","performance","confidence_score","email","status","ai_report_url",
        "notes","form_id","respondent_id","ip","user_agent","consent","video_transcript"
      ];

      // Fill any missing keys with empty strings so Make sees them in the picker
      SHEET_FIELDS.forEach(k => {
        if (data[k] === undefined || data[k] === null) data[k] = "";
      });

      console.debug('[quiz] submit payload:', data);

      // Emit payload for handler to POST to Make
      form.dispatchEvent(new CustomEvent('quiz:submit', { detail: data, bubbles: true }));
    });

    // ---- Q12 slider live text + ARIA ----
    (function setupSlider() {
      const slider = document.getElementById('confidence');
      const liveP = document.getElementById('q12-value');
      if (!slider || !liveP) return;

      const labelFor = (v) => (v <= 3 ? 'low' : v <= 7 ? 'neutral' : 'high');
      function update() {
        const v = Number(slider.value || 5);
        const text = labelFor(v);
        slider.setAttribute('aria-valuenow', String(v));
        slider.setAttribute('aria-valuetext', text);
        liveP.innerHTML = `Confidence: <strong>${v}</strong> (${text})`;
      }
      slider.addEventListener('input', update);
      slider.addEventListener('change', update);
      update();
    })();

    // ---- Init ----
    console.debug('[quiz] found steps:', steps.map(s => ({ step: s.dataset.step, branch: s.dataset.branch || null })));
    showStep(1);
  }
})();