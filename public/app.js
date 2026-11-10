// ApexAuto - Client Application Logic (Vanilla ES6)
(() => {
  'use strict';

  /* --- Helpers & State --- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const statusBox = $('#status');
  const alertBox = $('#alert');
  let notificationTimer = null;

  // App-level state
  const state = {
    user: null,             // Signed-in user object { name, role }
    sort: 'due_date',       // Current table sort key
    order: 'asc',           // Sort direction: 'asc' | 'desc'
    page: 1,                // Current page number
    q: '',                  // Search query string
    status: '',             // Status filter
    lastFocusedEl: null     // Restores focus after modal closes
  };

  const PAGE_SIZE = 10;

  function clearNotifications() {
    clearTimeout(notificationTimer);
    statusBox.textContent = '';
    alertBox.textContent = '';
  }

  // Announces status message; clears after 4.5 seconds to avoid stale notifications
  function announce(message, autoDismiss = true) {
    clearTimeout(notificationTimer);
    statusBox.textContent = '';
    alertBox.textContent = '';
    setTimeout(() => {
      statusBox.textContent = message;
      if (autoDismiss) {
        notificationTimer = setTimeout(() => {
          statusBox.textContent = '';
        }, 4500);
      }
    }, 80);
  }

  /**
   * Dispatches assertive screen-reader announcements for urgent errors.
   */
  function announceError(message) {
    clearTimeout(notificationTimer);
    statusBox.textContent = '';
    alertBox.textContent = '';
    setTimeout(() => {
      alertBox.textContent = message;
      notificationTimer = setTimeout(() => {
        alertBox.textContent = '';
      }, 6000);
    }, 80);
  }

  // Click to dismiss notifications immediately
  statusBox.addEventListener('click', clearNotifications);
  alertBox.addEventListener('click', clearNotifications);

  /**
   * Formats ISO 8601 date strings to readable British English (e.g. "14 Nov 2026").
   */
  function fmtDate(iso) {
    if (!iso) return '–';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // Safe DOM node builder avoiding innerHTML
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'class') {
        node.className = value;
      } else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role' || key === 'scope' || key === 'type' || key === 'value' || key === 'id' || key === 'tabindex' || key === 'href') {
        node.setAttribute(key, value);
      } else {
        node[key] = value;
      }
    }
    for (const child of children) {
      if (typeof child === 'string' || typeof child === 'number') {
        node.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        node.appendChild(child);
      }
    }
    return node;
  }

  /**
   * Wrapper for fetch API with standardized error handling and role header transmission.
   */
  async function api(endpoint, options = {}) {
    let response;
    try {
      response = await fetch('/api' + endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Role': state.user ? state.user.role : '',
          ...(options.headers || {})
        }
      });
    } catch {
      throw { errors: [{ field: 'form', message: 'Unable to reach the server. Please check network connection.' }] };
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw {
        errors: (data && data.errors) || [{ field: 'form', message: 'An unexpected server error occurred.' }]
      };
    }
    return data;
  }

  /* ==========================================================================
     2. Session Management (Simulated Authentication)
     ========================================================================== */
  function loadUser() {
    try {
      return JSON.parse(sessionStorage.getItem('apexauto-user'));
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    try {
      if (user) {
        sessionStorage.setItem('apexauto-user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('apexauto-user');
      }
    } catch {
      // Graceful fallback if storage is restricted
    }
  }

  state.user = loadUser();

  /* --- Client Router --- */
  const views = {
    signin: { el: $('#view-signin'), title: 'Staff Sign in' },
    dashboard: { el: $('#view-dashboard'), title: 'Workshop Dashboard', load: loadDashboard },
    new: { el: $('#view-new'), title: 'Book in Vehicle', load: restoreOrderDefaults },
    orders: { el: $('#view-orders'), title: 'All Service Orders', load: loadOrders }
  };

  let isInitialRoute = true;
  let currentActiveView = '';

  function route() {
    let viewName = location.hash.slice(2);
    if (!views[viewName]) {
      viewName = state.user ? 'dashboard' : 'signin';
    }

    // Auth gatekeeper
    if (!state.user && viewName !== 'signin') {
      location.hash = '#/signin';
      return;
    }
    if (state.user && viewName === 'signin') {
      location.hash = '#/dashboard';
      return;
    }

    // Clear stale notifications whenever navigating between different views
    if (currentActiveView !== viewName) {
      clearNotifications();
      currentActiveView = viewName;
    }

    // Toggle view visibility
    Object.entries(views).forEach(([name, view]) => {
      view.el.hidden = name !== viewName;
    });

    // Update Header Navigation & User Display
    const hasUser = Boolean(state.user);
    $('#main-nav').hidden = !hasUser;
    $('#user-box').hidden = !hasUser;

    if (hasUser) {
      $('#user-label').textContent = `${state.user.name} (${state.user.role})`;
    } else {
      $('#user-label').textContent = '';
    }

    $$('#main-nav a').forEach(anchor => {
      if (anchor.getAttribute('href') === '#/' + viewName) {
        anchor.setAttribute('aria-current', 'page');
      } else {
        anchor.removeAttribute('aria-current');
      }
    });

    // WCAG 2.4.2: Update page title on dynamic view change
    const activeH1 = $('h1', views[viewName].el);
    document.title = `${views[viewName].title} – ApexAuto`;

    // WCAG 2.4.3: Move focus to the primary heading of the new view
    if (!isInitialRoute) {
      activeH1.focus();
    }
    isInitialRoute = false;

    // Load dynamic data for view if required
    if (views[viewName].load) {
      views[viewName].load();
    }
  }

  window.addEventListener('hashchange', route);

  $('#signout').addEventListener('click', () => {
    state.user = null;
    saveUser(null);
    location.hash = '#/signin';
    route();
    announce('You have been signed out successfully.');
  });

  /* ==========================================================================
     4. Accessible Form Validation & Error Summary (Gov.uk & WCAG 3.3.1 / 3.3.3)
     ========================================================================== */
  function setFieldError(inputEl, message) {
    const fieldContainer = inputEl.closest('.field');
    if (!fieldContainer) return;
    const errorEl = $('.error', fieldContainer);

    if (message) {
      // WCAG 1.4.1: "Error:" prefix guarantees visual cue is not color-alone
      errorEl.textContent = 'Error: ' + message;
      inputEl.setAttribute('aria-invalid', 'true');
    } else {
      errorEl.textContent = '';
      inputEl.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(formEl) {
    const summaryEl = $('.error-summary', formEl);
    if (summaryEl) summaryEl.hidden = true;
    $$('.field .error', formEl).forEach(errSpan => {
      errSpan.textContent = '';
    });
    $$('[aria-invalid]', formEl).forEach(input => {
      input.removeAttribute('aria-invalid');
    });
  }

  // Populate and focus the top error summary
  function showErrors(formEl, errorList) {
    clearErrors(formEl);
    const summary = $('.error-summary', formEl);
    const list = $('ul', summary);
    list.replaceChildren();

    errorList.forEach(({ field, message }) => {
      const inputEl = formEl.querySelector(`[name="${field}"]`);
      if (inputEl) {
        setFieldError(inputEl, message);
        const link = el('a', { href: '#' + inputEl.id }, message);
        link.addEventListener('click', e => {
          e.preventDefault();
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        list.appendChild(el('li', {}, link));
      } else {
        list.appendChild(el('li', {}, message));
      }
    });

    const titleEl = $('h2', summary);
    titleEl.textContent = errorList.length === 1
      ? 'There is 1 problem to fix'
      : `There are ${errorList.length} problems to fix`;

    summary.hidden = false;
    summary.focus();
  }

  function setBusy(formEl, isBusy, label) {
    const submitBtn = $('button[type="submit"]', formEl);
    if (!submitBtn) return;
    if (isBusy) {
      submitBtn.dataset.originalLabel = submitBtn.textContent;
      submitBtn.textContent = label;
      submitBtn.setAttribute('aria-disabled', 'true');
    } else {
      submitBtn.textContent = submitBtn.dataset.originalLabel || submitBtn.textContent;
      submitBtn.removeAttribute('aria-disabled');
    }
    formEl.setAttribute('aria-busy', String(isBusy));
  }

  const isFormBusy = formEl => {
    const btn = $('button[type="submit"]', formEl);
    return btn && btn.getAttribute('aria-disabled') === 'true';
  };

  /* ==========================================================================
     5. Screen 1: Sign-in Logic (Simulated Authentication)
     ========================================================================== */
  const signinForm = $('#signin-form');

  signinForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (isFormBusy(signinForm)) return;

    const errors = [];
    const usernameVal = signinForm.username.value.trim();
    const passwordVal = signinForm.password.value;

    if (!usernameVal) {
      errors.push({ field: 'username', message: 'Enter your staff username.' });
    }
    if (!passwordVal) {
      errors.push({ field: 'password', message: 'Enter your account password.' });
    }

    if (errors.length > 0) {
      showErrors(signinForm, errors);
      return;
    }

    clearErrors(signinForm);
    setBusy(signinForm, true, 'Signing in…');
    announce('Verifying credentials, please wait…');

    // Simulate standard server latency
    await new Promise(resolve => setTimeout(resolve, 800));

    state.user = {
      name: usernameVal,
      role: signinForm.role.value
    };
    saveUser(state.user);

    setBusy(signinForm, false);
    signinForm.reset();
    location.hash = '#/dashboard';
    announce(`Signed in successfully as ${state.user.name}, ${state.user.role}.`);
  });

  /* ==========================================================================
     6. Screen 2: Dashboard (Triage & Direct Collection Action)
     ========================================================================== */
  async function loadDashboard() {
    $('#dash-name').textContent = state.user.name;
    try {
      const [statsData, overdueData] = await Promise.all([
        api('/stats'),
        api('/orders?status=Awaiting collection&sort=due_date&order=asc&page_size=5')
      ]);

      $('#stat-onloan').textContent = statsData.in_progress;
      $('#stat-overdue').textContent = statsData.awaiting_collection;
      $('#stat-returned').textContent = statsData.completed;

      const overdueBadge = $('#overdue-badge');
      const overdueList = $('#overdue-list');
      const overdueEmpty = $('#overdue-empty');

      overdueList.replaceChildren();

      if (overdueData.items.length === 0) {
        overdueEmpty.hidden = false;
        overdueBadge.hidden = true;
      } else {
        overdueEmpty.hidden = true;
        overdueBadge.hidden = false;
        overdueBadge.textContent = `${overdueData.total} awaiting collection`;

        const today = new Date(new Date().toDateString());

        overdueData.items.forEach(order => {
          const dueDate = new Date(order.due_date + 'T00:00:00');
          const daysPast = Math.max(1, Math.round((today - dueDate) / 86400000));

          const desc = el('div', { class: 'action-desc' },
            el('strong', {}, order.customer_name),
            ' – ',
            el('span', { class: 'reg-badge' }, order.reg_number),
            ` (${order.service}), ready since ${fmtDate(order.due_date)} `,
            el('span', { class: 'badge badge-overdue' }, `${daysPast}d ready`)
          );

          // Usability: Desk staff can mark a vehicle collected right from the dashboard
          const returnBtn = el('button', {
            type: 'button',
            class: 'btn btn-secondary btn-small',
            'data-action': 'complete-dash',
            'data-id': order.id,
            'data-reg': order.reg_number
          }, 'Mark collected', el('span', { class: 'sr-only' }, ` for ${order.reg_number}`));

          const li = el('li', { class: 'action-item' }, desc, returnBtn);
          overdueList.appendChild(li);
        });
      }
    } catch (err) {
      announceError(err.errors ? err.errors[0].message : 'Failed to load dashboard metrics.');
    }
  }

  // Dashboard collection triage action handler
  $('#overdue-list').addEventListener('click', async event => {
    const btn = event.target.closest('button[data-action="complete-dash"]');
    if (!btn) return;
    const { id, reg } = btn.dataset;

    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'Updating…';

    try {
      await api(`/orders/${id}/complete`, { method: 'PATCH' });
      announce(`Vehicle ${reg} marked as collected and job completed.`);
      await loadDashboard();
    } catch (err) {
      announceError(err.errors ? err.errors[0].message : 'Could not complete order.');
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Mark collected';
    }
  });

  /* ==========================================================================
     7. Screen 3: Book in Vehicle Form (Dynamic Disclosure & Validation)
     ========================================================================== */
  const orderForm = $('#order-form');
  const otherField = $('#service-other-field');

  // Client validation rules mirror server schema
  const validationRules = {
    customer_name: val => val.trim().length >= 2 || 'Enter customer full name (at least 2 characters).',
    phone_number: val => {
      const digits = val.replace(/\D/g, '');
      return (digits.length >= 10 && digits.length <= 13) || 'Enter a valid telephone number (at least 10 digits).';
    },
    service_type: val => Boolean(val) || 'Select a service category.',
    service_other: (val, form) => form.service_type.value !== 'Other' || val.trim().length > 0 || 'Provide a description of the custom work required.',
    reg_number: val => {
      const cleaned = val.trim().toUpperCase();
      return (cleaned.length >= 4 && cleaned.length <= 10) || 'Enter a valid vehicle registration plate (e.g. AB12 CDE).';
    }
  };

  // Reveal the custom fault description input when 'Other' is chosen
  function handleServiceTypeChange() {
    const isOther = orderForm.service_type.value === 'Other';
    otherField.hidden = !isOther;
    orderForm.service_type.setAttribute('aria-expanded', String(isOther));

    if (isOther) {
      orderForm.service_other.setAttribute('required', '');
      orderForm.service_other.setAttribute('aria-required', 'true');
      announce('Custom work description field revealed below.');
    } else {
      orderForm.service_other.removeAttribute('required');
      orderForm.service_other.removeAttribute('aria-required');
      setFieldError(orderForm.service_other, '');
    }
  }

  orderForm.service_type.addEventListener('change', handleServiceTypeChange);

  // Auto-uppercase vehicle registration plates as user types
  orderForm.reg_number.addEventListener('input', e => {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(start, end);
  });

  // Usability heuristic: Remember previous turnaround schedule choice across submissions
  function restoreOrderDefaults() {
    let savedDays = '3';
    try {
      savedDays = localStorage.getItem('apexauto-default-days') || '3';
    } catch {
      // Ignore storage restrictions
    }
    const radio = $(`input[name="turnaround_days"][value="${savedDays}"]`, orderForm);
    if (radio) radio.checked = true;
    handleServiceTypeChange();
  }

  // Inline validation on field blur (WCAG 3.3.1)
  orderForm.addEventListener('focusout', event => {
    const field = event.target;
    if (validationRules[field.name] && (field.value || field.hasAttribute('aria-invalid'))) {
      const outcome = validationRules[field.name](field.value, orderForm);
      setFieldError(field, outcome === true ? '' : outcome);
    }
  });

  // Form submission
  orderForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (isFormBusy(orderForm)) return;

    const errors = [];
    for (const [fieldName, ruleFn] of Object.entries(validationRules)) {
      const fieldInput = orderForm.elements[fieldName];
      if (fieldInput) {
        const result = ruleFn(fieldInput.value, orderForm);
        if (result !== true) {
          errors.push({ field: fieldName, message: result });
        }
      }
    }

    if (errors.length > 0) {
      showErrors(orderForm, errors);
      return;
    }

    clearErrors(orderForm);

    const payload = {
      customer_name: orderForm.customer_name.value.trim(),
      phone_number: orderForm.phone_number.value.trim(),
      service_type: orderForm.service_type.value,
      service_other: orderForm.service_other.value.trim() || null,
      reg_number: orderForm.reg_number.value.trim().toUpperCase(),
      turnaround_days: Number(orderForm.turnaround_days.value),
      intake_checklist: $$('input[name="intake_checklist"]:checked', orderForm).map(cb => cb.value),
      notes: orderForm.notes.value.trim()
    };

    setBusy(orderForm, true, 'Saving repair order…');
    announce('Saving vehicle repair order to database…');

    try {
      const savedOrder = await api('/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Persist preferred turnaround days
      try {
        localStorage.setItem('apexauto-default-days', String(payload.turnaround_days));
      } catch {
        // Ignore
      }

      orderForm.reset();
      restoreOrderDefaults();
      setBusy(orderForm, false);

      // Efficiency: Return focus to customer name field immediately for repetitive entry
      orderForm.customer_name.focus();

      announce(`Repair order booked: ${savedOrder.service} for ${savedOrder.customer_name} (${savedOrder.reg_number}), est. completion ${fmtDate(savedOrder.due_date)}.`);
    } catch (err) {
      setBusy(orderForm, false);
      showErrors(orderForm, err.errors || [{ field: 'form', message: 'Could not save repair order.' }]);
    }
  });

  /* ==========================================================================
     8. Screen 4: Data Table (Search, Filter, Sort, Pagination)
     ========================================================================== */
  const rowsBody = $('#order-rows');
  const countDisplay = $('#result-count');
  const tableWrap = $('#table-wrap');
  const loadingIndicator = $('#loading');

  const sortColumnLabels = {
    customer: 'Customer name',
    reg_number: 'Vehicle registration',
    due_date: 'Estimated completion date',
    status: 'Status'
  };

  const statusBadgeConfig = {
    'Awaiting collection': { cssClass: 'badge-overdue' },
    'In progress': { cssClass: 'badge-onloan' },
    'Completed': { cssClass: 'badge-returned' }
  };

  /**
   * Fetches paginated records and updates UI & ARIA states
   */
  async function loadOrders(customAnnouncement) {
    const queryParams = new URLSearchParams({
      q: state.q,
      status: state.status,
      sort: state.sort,
      order: state.order,
      page: state.page,
      page_size: PAGE_SIZE
    });

    tableWrap.setAttribute('aria-busy', 'true');
    loadingIndicator.hidden = false;

    try {
      const data = await api('/orders?' + queryParams);
      const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

      if (state.page > totalPages) {
        state.page = totalPages;
        return loadOrders(customAnnouncement);
      }

      renderTableRows(data, totalPages);

      if (customAnnouncement !== undefined) {
        announce(`${customAnnouncement} ${countDisplay.textContent}`.trim());
      }
    } catch (err) {
      announceError(err.errors ? err.errors[0].message : 'Could not retrieve repair orders.');
      countDisplay.textContent = 'Orders could not be loaded.';
    } finally {
      tableWrap.setAttribute('aria-busy', 'false');
      loadingIndicator.hidden = true;
    }
  }

  function renderTableRows({ items, total }, totalPages) {
    const isFiltered = Boolean(state.q || state.status);
    const startIndex = (state.page - 1) * PAGE_SIZE + 1;
    const endIndex = startIndex + items.length - 1;

    countDisplay.textContent = total === 0
      ? 'No service orders found.'
      : `Showing ${startIndex}–${endIndex} of ${total} orders${isFiltered ? ' (filtered)' : ''}.`;

    $('#empty').hidden = total !== 0;
    tableWrap.hidden = total === 0;
    $('.pager').hidden = total === 0;

    rowsBody.replaceChildren();

    items.forEach(order => {
      const badgeInfo = statusBadgeConfig[order.status] || { cssClass: 'badge-onloan' };
      const statusElement = el('span', { class: 'badge ' + badgeInfo.cssClass }, order.status);

      const actionsWrapper = el('div', { class: 'row-actions' });

      // Service advisors and managers can mark orders complete
      if (order.status !== 'Completed') {
        actionsWrapper.appendChild(
          el('button', {
            type: 'button',
            class: 'btn btn-secondary btn-small',
            'data-action': 'complete',
            'data-id': order.id,
            'data-reg': order.reg_number
          }, 'Mark complete', el('span', { class: 'sr-only' }, ` for ${order.reg_number}`))
        );
      }

      // Role check: Only workshop managers see deletion controls
      if (state.user && state.user.role === 'Manager') {
        actionsWrapper.appendChild(
          el('button', {
            type: 'button',
            class: 'btn btn-danger btn-small',
            'data-action': 'delete',
            'data-id': order.id,
            'data-reg': order.reg_number
          }, 'Delete', el('span', { class: 'sr-only' }, ` order ${order.reg_number}`))
        );
      }

      const tr = el('tr', {},
        el('th', { scope: 'row', 'data-label': 'Customer' }, order.customer_name),
        el('td', { 'data-label': 'Vehicle Reg' }, el('span', { class: 'reg-badge' }, order.reg_number)),
        el('td', { 'data-label': 'Service' }, order.service),
        el('td', { 'data-label': 'Est. Completion' }, fmtDate(order.due_date)),
        el('td', { 'data-label': 'Status' }, statusElement),
        el('td', { 'data-label': 'Actions' }, actionsWrapper)
      );

      rowsBody.appendChild(tr);
    });

    // Pagination info & disabled state
    $('#page-info').textContent = `Page ${state.page} of ${totalPages}`;
    $('#btn-prev-page').setAttribute('aria-disabled', String(state.page <= 1));
    $('#btn-next-page').setAttribute('aria-disabled', String(state.page >= totalPages));

    updateTableSortHeaders();
  }

  // Update th aria-sort and sort direction arrows
  function updateTableSortHeaders() {
    $$('.sort-btn').forEach(btn => {
      const th = btn.closest('th');
      const colName = btn.dataset.sort;
      const isActive = colName === state.sort;

      th.setAttribute('aria-sort', isActive ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none');

      // Update decorative glyph
      $('.sort-icon', btn)?.remove();
      const glyph = isActive ? (state.order === 'asc' ? ' ▲' : ' ▼') : ' ↕';
      btn.appendChild(el('span', { class: 'sort-icon', 'aria-hidden': 'true' }, glyph));
    });

    // Synchronize select dropdown
    const sortSelect = $('#sort-select');
    const sortVal = `${state.sort}:${state.order}`;
    if ($(`option[value="${sortVal}"]`, sortSelect)) {
      sortSelect.value = sortVal;
    }
  }

  // Column header click listener
  $$('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.sort;
      if (state.sort === col) {
        state.order = state.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = col;
        state.order = 'asc';
      }
      state.page = 1;
      loadOrders(`Sorted by ${sortColumnLabels[col]}, ${state.order === 'asc' ? 'ascending' : 'descending'}.`);
    });
  });

  // Sort dropdown change listener
  $('#sort-select').addEventListener('change', event => {
    const [col, dir] = event.target.value.split(':');
    state.sort = col;
    state.order = dir;
    state.page = 1;
    loadOrders(`Sorted by ${sortColumnLabels[col] || col}, ${state.order === 'asc' ? 'ascending' : 'descending'}.`);
  });

  // Debounced search input
  let searchDebounceTimer;
  $('#q').addEventListener('input', event => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.q = event.target.value.trim();
      state.page = 1;
      loadOrders('');
    }, 280);
  });

  // Status dropdown filter
  $('#status-filter').addEventListener('change', event => {
    state.status = event.target.value;
    state.page = 1;
    loadOrders('');
  });

  // Reset filters
  function resetFilters() {
    state.q = '';
    state.status = '';
    state.page = 1;
    $('#q').value = '';
    $('#status-filter').value = '';
    loadOrders('Filters cleared.');
    $('#q').focus();
  }

  $('#clear-filters').addEventListener('click', resetFilters);
  $('#empty-clear').addEventListener('click', resetFilters);
  $('#filters').addEventListener('submit', e => e.preventDefault());

  // Pagination click handler
  $('.pager').addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    state.page += Number(btn.dataset.dir);
    loadOrders('');
  });

  // Row actions (Mark complete / Delete)
  rowsBody.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id, reg } = button.dataset;

    try {
      if (action === 'complete') {
        await api(`/orders/${id}/complete`, { method: 'PATCH' });
        await loadOrders(`Vehicle ${reg} marked as complete.`);
      } else if (action === 'delete') {
        state.lastFocusedEl = button;
        const confirmed = await openConfirmDialog(`Permanently delete the repair order for ${reg}? This action cannot be undone.`);
        if (!confirmed) {
          if (state.lastFocusedEl) state.lastFocusedEl.focus();
          return;
        }
        await api(`/orders/${id}`, { method: 'DELETE' });
        await loadOrders(`Repair order for ${reg} was deleted.`);
      }
    } catch (err) {
      announceError(err.errors ? err.errors[0].message : 'Operation could not be completed.');
    }
  });

  // Delete confirmation modal dialog
  function openConfirmDialog(promptText) {
    return new Promise(resolve => {
      const dialogEl = $('#confirm-dialog');
      $('#cd-text').textContent = promptText;
      dialogEl.returnValue = '';

      dialogEl.addEventListener('close', () => {
        resolve(dialogEl.returnValue === 'ok');
      }, { once: true });

      dialogEl.showModal();
    });
  }

  // Keyboard shortcut: '/' jumps to search bar, 'Escape' clears it
  document.addEventListener('keydown', event => {
    if (event.key === '/' && location.hash === '#/orders') {
      const activeTagName = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTagName !== 'input' && activeTagName !== 'textarea' && activeTagName !== 'select') {
        event.preventDefault();
        const searchInput = $('#q');
        searchInput.focus();
        searchInput.select();
      }
    }

    if (event.key === 'Escape' && document.activeElement === $('#q') && $('#q').value) {
      event.preventDefault();
      $('#q').value = '';
      state.q = '';
      state.page = 1;
      loadOrders('Search cleared.');
    }
  });

  // Init
  restoreOrderDefaults();
  route();

})();
