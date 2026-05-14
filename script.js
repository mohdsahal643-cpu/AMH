document.addEventListener('DOMContentLoaded', () => {
  const leadForms = Array.from(document.querySelectorAll('.lead-form'));
  const toastNode = document.querySelector('[data-form-toast]');
  const motionSections = Array.from(document.querySelectorAll('.motion-section'));
  const requiredFieldOrder = ['name', 'custom_company', 'email', 'custom_enquiry_type'];
  const maxFieldLengths = {
    name: 90,
    custom_company: 120,
    email: 120,
    custom_phone: 32,
    custom_message: 1200
  };
  let toastResetTimer = null;
  const submittingForms = new WeakSet();

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopMotionQuery = window.matchMedia('(min-width: 901px)');
  const shouldAnimateDesktop = () => !reducedMotionQuery.matches && desktopMotionQuery.matches;
  const bindMediaChange = (mediaQuery, listener) => {
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(listener);
    }
  };

  const clearToast = () => {
    if (!toastNode) return;
    toastNode.classList.remove('show', 'success', 'error');
    toastNode.textContent = '';
  };

  const showToast = (message, type) => {
    if (!toastNode || !message) return;
    if (toastResetTimer) window.clearTimeout(toastResetTimer);

    toastNode.classList.remove('show', 'success', 'error');
    toastNode.textContent = message;
    if (type) toastNode.classList.add(type);

    requestAnimationFrame(() => {
      toastNode.classList.add('show');
    });

    toastResetTimer = window.setTimeout(() => {
      clearToast();
      toastResetTimer = null;
    }, type === 'error' ? 3400 : 3000);
  };

  const applyMotionState = () => {
    if (!motionSections.length) return;

    if (!shouldAnimateDesktop() || !('IntersectionObserver' in window)) {
      motionSections.forEach((section) => section.classList.add('is-visible'));
      return;
    }

    motionSections.forEach((section, index) => {
      section.style.setProperty('--stagger', `${index * 42}ms`);
    });

    const motionObserver = new IntersectionObserver((entries, io) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    motionSections.forEach((section) => {
      if (!section.classList.contains('is-visible')) motionObserver.observe(section);
    });
  };

  applyMotionState();
  bindMediaChange(desktopMotionQuery, applyMotionState);
  bindMediaChange(reducedMotionQuery, applyMotionState);

  const getLeadFormAction = (form) => {
    const action = form.getAttribute('action') || '';
    if (!action || action === 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') return '';
    return action;
  };

  const getFieldLabel = (form, field) => {
    if (!field) return 'this field';
    const fieldId = field.getAttribute('id');
    if (!fieldId) return field.name || 'this field';
    const label = form.querySelector(`label[for="${fieldId}"]`);
    return label?.textContent?.trim() || field.name || 'this field';
  };

  const setupDropdown = (dropdown) => {
    const trigger = dropdown.querySelector('[data-dropdown-trigger]');
    const menu = dropdown.querySelector('[data-dropdown-menu]');
    const label = dropdown.querySelector('[data-dropdown-label]');
    const input = dropdown.querySelector('[data-dropdown-input]');
    const options = Array.from(dropdown.querySelectorAll('.enquiry-option'));
    let activeOptionIndex = -1;

    if (!trigger || !menu || !label || !input || !options.length) return null;

    const getSelectedOptionIndex = () => {
      const currentValue = input.value.trim();
      return options.findIndex((option) => (option.getAttribute('data-value') || '').trim() === currentValue);
    };

    const closeDropdown = () => {
      if (menu.contains(document.activeElement)) trigger.focus();
      dropdown.classList.remove('open', 'drop-down');
      trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      trigger.removeAttribute('aria-activedescendant');
      options.forEach((option) => option.classList.remove('is-active'));
      activeOptionIndex = -1;
    };

    const openDropdown = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(menu.scrollHeight || 360, Math.round(window.innerHeight * 0.72));
      const spaceAbove = triggerRect.top;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      dropdown.classList.toggle('drop-down', spaceBelow >= menuHeight || spaceBelow > spaceAbove);
      dropdown.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      menu.inert = false;

      const selectedIndex = getSelectedOptionIndex();
      options.forEach((option, optionIndex) => {
        option.setAttribute('aria-selected', optionIndex === selectedIndex ? 'true' : 'false');
      });
    };

    const setActiveOption = (index, shouldFocus = true) => {
      const boundedIndex = (index + options.length) % options.length;
      activeOptionIndex = boundedIndex;

      options.forEach((option, optionIndex) => {
        const isActive = optionIndex === boundedIndex;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      trigger.setAttribute('aria-activedescendant', options[boundedIndex].id);
      if (shouldFocus) options[boundedIndex].focus();
    };

    options.forEach((option, optionIndex) => {
      if (!option.id) option.id = `${menu.id || 'enquiry-option'}-${optionIndex + 1}`;
      option.setAttribute('aria-selected', 'false');

      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') || '';
        input.value = value;
        label.textContent = value;
        input.setCustomValidity('');
        setActiveOption(optionIndex, false);
        clearToast();
        closeDropdown();
      });

      option.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveOption(optionIndex + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveOption(optionIndex - 1);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closeDropdown();
          trigger.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          option.click();
          trigger.focus();
        }
      });
    });

    trigger.addEventListener('click', () => {
      if (dropdown.classList.contains('open')) closeDropdown();
      else openDropdown();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openDropdown();
        setActiveOption(event.key === 'ArrowDown' ? 0 : options.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDropdown();
        const selectedIndex = getSelectedOptionIndex();
        setActiveOption(selectedIndex >= 0 ? selectedIndex : 0);
      }
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) closeDropdown();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dropdown.classList.contains('open')) {
        closeDropdown();
        trigger.focus();
      }
    });

    return { input, label, options, trigger, openDropdown, closeDropdown };
  };

  const dropdownControllers = new WeakMap();
  document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
    const controller = setupDropdown(dropdown);
    if (controller) dropdownControllers.set(dropdown, controller);
  });

  const createSubmissionBody = (submissionData) => new URLSearchParams(submissionData);

  const submitLeadFormData = (formAction, submissionData) => {
    const submitWithResponse = () => fetch(formAction, {
      method: 'POST',
      // Forces a CORS preflight so fallback submission does not duplicate a processed POST.
      headers: { 'X-AMH-Submission': 'fetch' },
      body: createSubmissionBody(submissionData)
    }).then((response) => {
      if (!response.ok) throw new Error(`Form submission failed with status ${response.status}`);
      return { verified: true };
    });

    const submitWithoutResponse = () => fetch(formAction, {
      method: 'POST',
      mode: 'no-cors',
      body: createSubmissionBody(submissionData)
    }).then(() => ({ verified: false }));

    return submitWithResponse().catch((error) => {
      if (error instanceof TypeError) return submitWithoutResponse();
      throw error;
    });
  };

  leadForms.forEach((form) => {
    const submitButton = form.querySelector('.form-submit');
    const submitButtonLabel = submitButton?.textContent || 'Send enquiry';
    const dropdown = form.querySelector('[data-dropdown]');
    const dropdownController = dropdown ? dropdownControllers.get(dropdown) : null;

    const setSubmitState = (isBusy) => {
      if (!submitButton) return;
      submitButton.textContent = isBusy ? 'Sending...' : submitButtonLabel;
      submitButton.disabled = isBusy;
      submitButton.toggleAttribute('aria-disabled', isBusy);
    };

    const resetLeadForm = () => {
      form.reset();
      if (dropdownController) {
        dropdownController.label.textContent = form.classList.contains('snapshot-form') ? 'Type of enquiry' : 'Select one';
        dropdownController.input.value = '';
        dropdownController.input.setCustomValidity('');
        dropdownController.options.forEach((option) => option.setAttribute('aria-selected', 'false'));
        dropdownController.closeDropdown();
      }
    };

    form.addEventListener('input', () => {
      if (dropdownController?.input.value.trim()) dropdownController.input.setCustomValidity('');
      clearToast();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submittingForms.has(form)) return;

      if (form.elements.website?.value.trim()) {
        resetLeadForm();
        return;
      }

      for (const fieldName of requiredFieldOrder) {
        const field = form.elements[fieldName];
        if (!field) continue;

        const value = typeof field.value === 'string' ? field.value.trim() : '';
        if (!value) {
          if (fieldName === 'custom_enquiry_type' && dropdownController) {
            dropdownController.openDropdown();
            dropdownController.trigger.focus();
          } else if (typeof field.focus === 'function') {
            field.focus();
          }

          showToast(`Please fill ${getFieldLabel(form, field)} field.`, 'error');
          return;
        }

        if (typeof field.value === 'string' && field.value !== value) field.value = value;

        const maxLength = maxFieldLengths[fieldName];
        if (maxLength && value.length > maxLength) {
          field.focus();
          showToast(`${getFieldLabel(form, field)} is too long. Please shorten it.`, 'error');
          return;
        }

        if (fieldName === 'email' && typeof field.checkValidity === 'function' && !field.checkValidity()) {
          field.focus();
          showToast('Please fill Work email with a valid email address.', 'error');
          return;
        }
      }

      ['custom_phone', 'custom_message'].forEach((fieldName) => {
        const field = form.elements[fieldName];
        if (!field || typeof field.value !== 'string') return;
        field.value = field.value.trim();
      });

      const optionalMessage = form.elements.custom_message;
      if (optionalMessage?.value.length > maxFieldLengths.custom_message) {
        optionalMessage.focus();
        showToast('Message is too long. Please shorten it.', 'error');
        return;
      }

      const formAction = getLeadFormAction(form);
      if (!formAction) {
        showToast('This enquiry form is waiting for the Google Apps Script URL.', 'error');
        return;
      }

      if (!submitButton) return;
      submittingForms.add(form);
      setSubmitState(true);
      const submissionData = new FormData(form);
      submissionData.delete('website');

      submitLeadFormData(formAction, submissionData)
        .then(({ verified }) => {
          resetLeadForm();
          showToast(verified ? 'Thanks. Your enquiry has been sent.' : 'Thanks. Your enquiry has been submitted.', 'success');
        })
        .catch(() => {
          showToast('We could not send your enquiry. Please try again or email maja@amhtours.com.', 'error');
        })
        .finally(() => {
          setSubmitState(false);
          submittingForms.delete(form);
        });
    });
  });
});
