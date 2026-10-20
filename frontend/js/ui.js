/**
 * VendorConnect UI Helper Library (ui.js)
 * ----------------------------------------
 * Accessible, lightweight, framework-free UI utilities:
 * - Non-blocking Toast notifications (with aria-live for screen readers)
 * - Accessible Modal Dialogs (replacing window.alert and window.confirm)
 * - Button loading indicators & double-submit protection
 * - Mobile navbar toggle with focus management
 * - Password visibility toggles
 */

(function (window) {
    'use strict';

    // ── 1. Toast Notification System ──────────────────────────────
    let toastContainer = null;

    function getOrCreateToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('aria-atomic', 'true');
            toastContainer.setAttribute('role', 'region');
            toastContainer.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    /**
     * Shows an accessible toast notification.
     * @param {string} message - Notification text
     * @param {'info'|'success'|'warning'|'error'} type
     * @param {number} duration - Milliseconds before auto-dismiss (default 4000)
     */
    function showToast(message, type = 'info', duration = 4000) {
        const container = getOrCreateToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

        // Accessible icon badge
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icons[type] || 'ℹ';
        toast.appendChild(iconEl);

        const textEl = document.createElement('div');
        textEl.className = 'toast-body';
        textEl.textContent = message;
        toast.appendChild(textEl);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => dismissToast(toast));
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        // Auto dismiss timer
        const timer = setTimeout(() => {
            dismissToast(toast);
        }, duration);

        toast.addEventListener('mouseenter', () => clearTimeout(timer));

        return toast;
    }

    function dismissToast(toast) {
        if (!toast || toast.classList.contains('dismissing')) return;
        toast.classList.add('dismissing');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 200);
    }

    // ── 2. Accessible Modal Confirm & Alert Dialogs ─────────────────
    /**
     * Replaces raw window.confirm with an accessible modal dialog returning a Promise.
     * @param {Object} options
     * @param {string} options.title - Dialog heading
     * @param {string} options.message - Explanation text
     * @param {string} [options.confirmText='Confirm']
     * @param {string} [options.cancelText='Cancel']
     * @param {boolean} [options.danger=false] - Highlights confirm button in danger red
     * @returns {Promise<boolean>}
     */
    function showConfirm({
        title = 'Please Confirm',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        danger = false
    }) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');
            backdrop.setAttribute('aria-labelledby', 'modalDialogTitle');

            const dialog = document.createElement('div');
            dialog.className = 'modal-dialog';

            const header = document.createElement('div');
            header.className = 'modal-header';

            const h3 = document.createElement('h3');
            h3.id = 'modalDialogTitle';
            h3.textContent = title;
            header.appendChild(h3);
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.className = 'modal-body';
            const p = document.createElement('p');
            p.textContent = message;
            body.appendChild(p);
            dialog.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'modal-footer';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-outline';
            cancelBtn.textContent = cancelText;

            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
            confirmBtn.textContent = confirmText;

            function cleanup(result) {
                backdrop.classList.add('closing');
                setTimeout(() => {
                    if (backdrop.parentNode) {
                        backdrop.parentNode.removeChild(backdrop);
                    }
                }, 150);
                document.removeEventListener('keydown', handleKey);
                resolve(result);
            }

            function handleKey(e) {
                if (e.key === 'Escape') cleanup(false);
            }

            cancelBtn.addEventListener('click', () => cleanup(false));
            confirmBtn.addEventListener('click', () => cleanup(true));
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);

            document.body.appendChild(backdrop);
            document.addEventListener('keydown', handleKey);
            confirmBtn.focus();
        });
    }

    /**
     * Replaces raw window.alert with a clean modal dialog returning a Promise.
     */
    function showAlert({
        title = 'Notice',
        message = '',
        buttonText = 'OK',
        type = 'info'
    }) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.setAttribute('role', 'alertdialog');
            backdrop.setAttribute('aria-modal', 'true');

            const dialog = document.createElement('div');
            dialog.className = 'modal-dialog';

            const header = document.createElement('div');
            header.className = 'modal-header';

            const h3 = document.createElement('h3');
            h3.textContent = title;
            header.appendChild(h3);
            dialog.appendChild(header);

            const body = document.createElement('div');
            body.className = 'modal-body';
            const p = document.createElement('p');
            p.textContent = message;
            body.appendChild(p);
            dialog.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'modal-footer';

            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'btn btn-primary';
            okBtn.textContent = buttonText;

            function cleanup() {
                backdrop.classList.add('closing');
                setTimeout(() => {
                    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                }, 150);
                resolve();
            }

            okBtn.addEventListener('click', cleanup);
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup();
            });

            footer.appendChild(okBtn);
            dialog.appendChild(footer);
            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);
            okBtn.focus();
        });
    }

    // ── 3. Button Loading Helper ────────────────────────────────────
    /**
     * Toggles a button's disabled state and shows a clean spinner with loading text.
     */
    function setButtonLoading(button, isLoading, loadingText = 'Processing…') {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = `<span class="spinner" aria-hidden="true"></span> <span>${loadingText}</span>`;
        } else {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    // ── 4. Responsive Mobile Navigation ─────────────────────────────
    function initMobileNav() {
        const navbars = document.querySelectorAll('.navbar');
        navbars.forEach(navbar => {
            const navActions = navbar.querySelector('.navbar-nav');
            if (!navActions || navbar.querySelector('.nav-hamburger')) return;

            const hamburger = document.createElement('button');
            hamburger.type = 'button';
            hamburger.className = 'nav-hamburger';
            hamburger.setAttribute('aria-label', 'Toggle navigation menu');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            `;

            hamburger.addEventListener('click', () => {
                const isOpen = navActions.classList.toggle('nav-open');
                hamburger.setAttribute('aria-expanded', String(isOpen));
            });

            navbar.insertBefore(hamburger, navActions);

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!navbar.contains(e.target) && navActions.classList.contains('nav-open')) {
                    navActions.classList.remove('nav-open');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    // ── 5. Password Visibility Toggle ───────────────────────────────
    function initPasswordToggles() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            if (input.dataset.hasToggle) return;
            input.dataset.hasToggle = 'true';

            const wrapper = document.createElement('div');
            wrapper.className = 'password-toggle-wrapper';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'password-toggle-btn';
            toggleBtn.setAttribute('aria-label', 'Show password');
            toggleBtn.setAttribute('aria-pressed', 'false');
            toggleBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;

            toggleBtn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggleBtn.setAttribute('aria-pressed', String(isPassword));
                toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            });

            wrapper.appendChild(toggleBtn);
        });
    }

    // Initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initMobileNav();
            initPasswordToggles();
        });
    } else {
        initMobileNav();
        initPasswordToggles();
    }

    // Expose utilities on window.VC_UI
    window.VC_UI = {
        showToast,
        showConfirm,
        showAlert,
        setButtonLoading,
        initMobileNav,
        initPasswordToggles
    };

})(window);
