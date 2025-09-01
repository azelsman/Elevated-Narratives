/* js/quiz_logic.js */
(function () {
  // Ensure DOM is ready even if script isn't deferred
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // ---- Find form and steps ----
    let form =
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

    // ---- State ----
    let currentStep = 1;
    let branch = null; // 'audience' | 'sales' | 'authority' | 'engagement'
    let errorIdCounter = 0;

    // ---- Helpers ----
    const qs = (sel, el = document) => el.querySelector(sel);
    const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
    const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++errorIdCounter).toString(36)}`;

    // Progress fallback if you didn't define window.updateProgress in your template
    if (typeof window.updateProgress !== 'function') {
      window.updateProgress = function (current, total) {
        const bar = document.getElementById('progress-bar');
        if (!bar) return;
        const pct = Math.round((current / (total || 7)) * 100);
        bar.style.setProperty('--progress', pct + '%');
        bar.setAttribute('aria-valuenow', String(current));

        // Optional: announce "Step X of Y" to SR via progress description
        const descId = bar.getAttribute('aria-describedby');
        if (descId) {
          const node = document.getElementById(descId);
          if (node) node.textContent = `Step ${current} of ${total}`;
        }
      };
    }

    // ---- Error handling UI (A11y) ----
    function clearFieldA11y(fld) {
      fld.removeAttribute('aria-invalid');
      // remove any id we added to error text from aria-describedby (preserve preexisting IDs)
      const describedby = (fld.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const keep = [];
      for (const id of describedby) {
        const node = document.getElementById(id);
        // If it's one of our generated error nodes, drop it; else keep it
        if (!node || !node.classList.contains('error-text')) keep.push(id);
      }
      if (keep.length) fld.setAttribute('aria-describedby', keep.join(' ')); else fld.removeAttribute('aria-describedby');
      fld.classList.remove('is-invalid');
    }

    function clearErrors(scope) {
      const banner = document.getElementById('step-error');
      if (banner) banner.hidden = true, banner.textContent = '';
      qsa('.error-text', scope).forEach(el => el.remove());
      qsa('input.is-invalid, select.is-invalid, textarea.is-invalid', scope).forEach(clearFieldA11y);
    }

    function addDescribedBy(fld, id) {
      const existing = (fld.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (!existing.includes(id)) {
        existing.push(id);
        fld.setAttribute('aria-describedby', existing.join(' '));
      }
    }

    function showFieldError(field, message) {
      // For radio groups, apply to the first radio in group
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
          s.hidden = !(isTarget && okBranch);
        } else {
          s.hidden = !isTarget;
        }
      });

      currentStep = n;
      try { window.updateProgress(currentStep, totalSteps); } catch (e) {}

      // Focus first input/button in the visible step
      const target = steps.find(s => Number(s.dataset.step) === n && !s.hidden);
      const firstFocusable = target && target.querySelector('input, select, textarea, button[data-action="next"], [data-action="prev"]');
      if (firstFocusable) firstFocusable.focus({ preventScroll: true });

      // Clear any lingering errors when changing steps
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
            // focus and errors
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

    // Clear error state when user fixes field
    form.addEventListener('change', (e) => {
      const stepEl = steps.find(s => Number(s.dataset.step) === currentStep && !s.hidden);
      if (!stepEl) return;
      const t = e.target;
      if (t && (t.matches('input,select,textarea'))) {
        clearErrors(stepEl);
      }
    });

    // ---- Navigation ----
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'next') {
        if (!validateCurrentStep()) return;

        // Leaving step 1? Apply branch now.
        if (currentStep === 1) {
          applyBranch();
        }

        let next = currentStep + 1;
        next = Math.min(next, totalSteps);
        showStep(next);
      }

      if (action === 'prev') {
        let prev = currentStep - 1;
        prev = Math.max(prev, 1);
        showStep(prev);
      }
    });

    // ---- Submit handling ----
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateCurrentStep()) return;

      // Collect all values
      const data = {};
      const all = qsa('input, select, textarea', form);
      all.forEach(el => {
        if (!el.name) return;
        if (el.type === 'radio') {
          if (el.checked) data[el.name] = el.value;
        } else if (el.type === 'checkbox') {
          data[el.name] = !!el.checked;
        } else {
          data[el.name] = el.value;
        }
      });

      data.branch = branch || chosenRadio('q1_priority') || null;
      data._meta = {
        submitted_at: new Date().toISOString(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      console.debug('[quiz] submit payload:', data);

      // Emit payload event for your Make webhook handler
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