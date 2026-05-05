document.addEventListener('DOMContentLoaded', () => {
  const leadForm = document.querySelector('.lead-form');
  const toastNode = document.querySelector('[data-form-toast]');
  const motionSections = Array.from(document.querySelectorAll('.motion-section'));
  const dropdown = document.querySelector('[data-dropdown]');
  const dropdownTrigger = dropdown?.querySelector('[data-dropdown-trigger]');
  const dropdownMenu = dropdown?.querySelector('[data-dropdown-menu]');
  const dropdownLabel = dropdown?.querySelector('[data-dropdown-label]');
  const dropdownInput = dropdown?.querySelector('[data-dropdown-input]');
  const dropdownOptions = dropdown ? Array.from(dropdown.querySelectorAll('.enquiry-option')) : [];
  const requiredFieldOrder = ['name', 'custom_company', 'email', 'custom_phone', 'custom_enquiry_type', 'custom_message'];
  const RATE_LIMIT_KEY = 'amh_lead_form_rate_limit_v1';
  const RATE_LIMIT_MAX_SUBMISSIONS = 3;
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
  const MIN_SUBMIT_DELAY_MS = 3500;
  const pageLoadTime = Date.now();
  let submitResetTimer = null;
  let toastResetTimer = null;
  let activeOptionIndex = -1;
  let motionObserver = null;
  let isSubmitFeedbackActive = false;

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

  const getFieldLabel = (field) => {
    if (!field) return 'this field';
    const fieldId = field.getAttribute('id');
    if (!fieldId) return field.name || 'this field';
    const label = leadForm?.querySelector(`label[for="${fieldId}"]`);
    return label?.textContent?.trim() || field.name || 'this field';
  };

  const applyMotionState = () => {
    if (!motionSections.length) return;

    if (!shouldAnimateDesktop() || !('IntersectionObserver' in window)) {
      if (motionObserver) {
        motionObserver.disconnect();
        motionObserver = null;
      }
      motionSections.forEach((section) => section.classList.add('is-visible'));
      return;
    }

    motionSections.forEach((section, index) => {
      section.style.setProperty('--stagger', `${index * 42}ms`);
    });

    if (motionObserver) motionObserver.disconnect();
    motionObserver = new IntersectionObserver((entries, io) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

    motionSections.forEach((section) => {
      if (section.classList.contains('is-visible')) return;
      motionObserver.observe(section);
    });
  };

  applyMotionState();
  bindMediaChange(desktopMotionQuery, applyMotionState);
  bindMediaChange(reducedMotionQuery, applyMotionState);

  const getSelectedOptionIndex = () => {
    if (!dropdownInput) return -1;
    const currentValue = dropdownInput.value.trim();
    return dropdownOptions.findIndex((option) => (option.getAttribute('data-value') || '').trim() === currentValue);
  };

  const closeDropdown = () => {
    if (!dropdown || !dropdownTrigger || !dropdownMenu) return;
    dropdown.classList.remove('open');
    dropdownTrigger.setAttribute('aria-expanded', 'false');
    dropdownMenu.setAttribute('aria-hidden', 'true');
    dropdownOptions.forEach((option) => option.classList.remove('is-active'));
    activeOptionIndex = -1;
  };

  const openDropdown = () => {
    if (!dropdown || !dropdownTrigger || !dropdownMenu) return;
    dropdown.classList.add('open');
    dropdownTrigger.setAttribute('aria-expanded', 'true');
    dropdownMenu.setAttribute('aria-hidden', 'false');
    const selectedIndex = getSelectedOptionIndex();
    if (selectedIndex >= 0) {
      activeOptionIndex = selectedIndex;
      dropdownOptions.forEach((option, optionIndex) => {
        const isSelected = optionIndex === selectedIndex;
        option.classList.toggle('is-active', isSelected);
        option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
      dropdownOptions[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  };

  const setActiveOption = (index, shouldFocus = true) => {
    if (!dropdownOptions.length) return;
    const boundedIndex = (index + dropdownOptions.length) % dropdownOptions.length;
    activeOptionIndex = boundedIndex;

    dropdownOptions.forEach((option, optionIndex) => {
      const isActive = optionIndex === boundedIndex;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (shouldFocus) dropdownOptions[boundedIndex].focus();
  };

  if (dropdown && dropdownTrigger && dropdownMenu && dropdownInput && dropdownLabel) {
    dropdownOptions.forEach((option, optionIndex) => {
      if (!option.id) option.id = `enquiry-option-${optionIndex + 1}`;
      option.setAttribute('aria-selected', 'false');
    });

    dropdownTrigger.addEventListener('click', () => {
      if (dropdown.classList.contains('open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    dropdownTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openDropdown();
        setActiveOption(event.key === 'ArrowDown' ? 0 : dropdownOptions.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDropdown();
        const selectedIndex = getSelectedOptionIndex();
        setActiveOption(selectedIndex >= 0 ? selectedIndex : 0);
      }
    });

    dropdownOptions.forEach((option, optionIndex) => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value') || '';
        dropdownInput.value = value;
        dropdownLabel.textContent = value;
        dropdownInput.setCustomValidity('');
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
          dropdownTrigger.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          option.click();
          dropdownTrigger.focus();
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) closeDropdown();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!dropdown.classList.contains('open')) return;
      closeDropdown();
      dropdownTrigger.focus();
    });
  }

  if (!leadForm) return;
  const honeypotField = leadForm.querySelector('input[name="website"]');
  const campaignTokenField = leadForm.querySelector('input[name="campaign_token"]');
  const submitButton = leadForm.querySelector('.form-submit');

  const readRateLimitTimestamps = () => {
    try {
      const rawValue = window.localStorage.getItem(RATE_LIMIT_KEY);
      if (!rawValue) return [];
      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) return [];
      return parsedValue.filter((value) => Number.isFinite(value));
    } catch (error) {
      return [];
    }
  };

  const writeRateLimitTimestamps = (timestamps) => {
    try {
      window.localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
    } catch (error) {
      // If storage is blocked, keep graceful behavior without throwing.
    }
  };

  const getRateLimitState = () => {
    const now = Date.now();
    const recentTimestamps = readRateLimitTimestamps()
      .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
      .sort((a, b) => a - b);
    const isLimited = recentTimestamps.length >= RATE_LIMIT_MAX_SUBMISSIONS;
    const cooldownMs = isLimited ? Math.max(0, RATE_LIMIT_WINDOW_MS - (now - recentTimestamps[0])) : 0;
    return { recentTimestamps, isLimited, cooldownMs };
  };

  const formatCooldown = (cooldownMs) => {
    const totalSeconds = Math.ceil(cooldownMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const updateSubmitAvailability = () => {
    if (!submitButton) return;
    if (isSubmitFeedbackActive) return;
    const { isLimited, cooldownMs } = getRateLimitState();
    if (isLimited) {
      submitButton.disabled = true;
      submitButton.textContent = `Try again in ${formatCooldown(cooldownMs)}`;
      submitButton.setAttribute('aria-disabled', 'true');
    } else {
      submitButton.disabled = false;
      submitButton.textContent = 'Send enquiry';
      submitButton.removeAttribute('aria-disabled');
    }
  };

  updateSubmitAvailability();
  window.setInterval(updateSubmitAvailability, 1000);

  leadForm.addEventListener('input', () => {
    if (dropdownInput?.value.trim()) dropdownInput.setCustomValidity('');
    clearToast();
  });

  leadForm.addEventListener('submit', (event) => {
    const campaignToken = campaignTokenField?.value?.trim() || '';
    if (!campaignToken || campaignToken.includes('REPLACE_WITH_GETRESPONSE')) {
      event.preventDefault();
      showToast('Please set your GetResponse campaign token before submitting.', 'error');
      return;
    }

    const elapsedFromLoad = Date.now() - pageLoadTime;
    if (elapsedFromLoad < MIN_SUBMIT_DELAY_MS) {
      event.preventDefault();
      showToast('Please wait a moment before submitting the form.', 'error');
      return;
    }

    if (honeypotField && honeypotField.value.trim()) {
      event.preventDefault();
      showToast('Submission could not be processed. Please try again.', 'error');
      return;
    }

    const rateLimitState = getRateLimitState();
    if (rateLimitState.isLimited) {
      event.preventDefault();
      updateSubmitAvailability();
      showToast(`Too many submissions. Please try again in ${formatCooldown(rateLimitState.cooldownMs)}.`, 'error');
      return;
    }

    for (const fieldName of requiredFieldOrder) {
      const field = leadForm.elements[fieldName];
      if (!field) continue;

      const value = typeof field.value === 'string' ? field.value.trim() : '';
      if (!value) {
        event.preventDefault();

        if (fieldName === 'custom_enquiry_type') {
          openDropdown();
          dropdownTrigger?.focus();
        } else if (typeof field.focus === 'function') {
          field.focus();
        }

        showToast(`Please fill ${getFieldLabel(field)} field.`, 'error');
        return;
      }

      if (typeof field.value === 'string' && field.value !== value) {
        field.value = value;
      }

      if (fieldName === 'email' && typeof field.checkValidity === 'function' && !field.checkValidity()) {
        event.preventDefault();
        field.focus();
        showToast('Please fill Work email with a valid email address.', 'error');
        return;
      }
    }

    if (!submitButton) return;
    writeRateLimitTimestamps([...rateLimitState.recentTimestamps, Date.now()]);
    updateSubmitAvailability();

    showToast('Thanks for reaching out. Your enquiry is being submitted.', 'success');

    isSubmitFeedbackActive = true;
    submitButton.textContent = 'Submitting...';
    if (submitResetTimer) window.clearTimeout(submitResetTimer);
    submitResetTimer = window.setTimeout(() => {
      isSubmitFeedbackActive = false;
      updateSubmitAvailability();
      submitResetTimer = null;
    }, 2400);
  });
});
