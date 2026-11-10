// js/tooltip.js
export let tooltipsEnabled = true;

// Initialize window variable for settings integration
window.tooltipsEnabled = tooltipsEnabled;

export class ToolTip {
    constructor() {
        this.tooltip = null;
        this.currentTarget = null;
        this.hideTimer = null;
        this.showTimer = null;
        this.delay = 300;        // ← change this value anytime
        this.createTooltip();
        this.setupObserver();
    }

    createTooltip() {
        // ... (keep standard create logic)
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'custom-tooltip';
        Object.assign(this.tooltip.style, {
            position: 'absolute', background: 'rgba(10, 10, 30, 0.96)',
            color: '#e0e7ff', padding: '12px 16px', borderRadius: '10px',
            fontSize: '13.5px', fontFamily: "'Inter', sans-serif", lineHeight: '1.6',
            pointerEvents: 'none', zIndex: '99999', opacity: '0',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
            transform: 'translateY(8px)', maxWidth: '320px',
            boxShadow: '0 10px 40px rgba(0, 255, 65, 0.35)',
            border: '1px solid rgba(0, 255, 65, 0.5)',
            backdropFilter: 'blur(12px)', whiteSpace: 'pre-line', wordWrap: 'break-word'
        });
        document.body.appendChild(this.tooltip);

        this.tooltip.addEventListener('mouseenter', () => {
            clearTimeout(this.hideTimer);
            this.tooltip.style.pointerEvents = 'auto';
        });
        this.tooltip.addEventListener('mouseleave', () => {
            this.hide();
        });
    }

    // Inside Tooltip class – replace the existing show() method with this:
    show(text, element) {
        // Cancel any pending hide
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        // If we're already showing on the same element → just keep it visible
        if (this.currentTarget === element && this.tooltip.style.opacity === '1') {
            return;
        }

        this.currentTarget = element;

        // Set content
        this.tooltip.innerHTML = text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00ff41">$1</strong>')
            .replace(/--(.*?)--/g, '<em style="color:#00d9ff">$1</em>');

        // Position first (so transitions work correctly)
        this.positionTooltip(element);

        // Small delay before appearing (feels premium)
        clearTimeout(this.showTimer);
        this.showTimer = setTimeout(() => {
            this.tooltip.style.opacity = '1';
            this.tooltip.style.transform = 'translateY(0)';
        }, 300); // ←←← your desired delay in ms
    }

    // Also update hide() to cancel the show timer
    hide() {
        clearTimeout(this.showTimer);
        this.hideTimer = setTimeout(() => {
            this.tooltip.style.opacity = '0';
            this.tooltip.style.transform = 'translateY(8px)';
            this.currentTarget = null;
        }, 100);
    }

    positionTooltip(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let top = rect.bottom + 10 + window.scrollY;
        let left = rect.left + rect.width / 2 + window.scrollX - tooltipRect.width / 2;
        if (top + tooltipRect.height > window.innerHeight + window.scrollY - 10) {
            top = rect.top + window.scrollY - tooltipRect.height - 10;
        }
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }
        this.tooltip.style.top = top + 'px';
        this.tooltip.style.left = left + 'px';
    }

    setupObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check the added element itself
                        if (node.hasAttribute && node.hasAttribute('data-tooltip')) {
                            this.attachTooltipListeners(node);
                        }
                        // Check descendants
                        node.querySelectorAll && node.querySelectorAll('[data-tooltip]').forEach(el => {
                            this.attachTooltipListeners(el);
                        });
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    attachTooltipListeners(el) {
        el.style.cursor = 'help';
        el.addEventListener('mouseenter', () => {
            if (!window.tooltipsEnabled) return;
            const text = el.getAttribute('data-tooltip');
            if (text) this.show(text, el);
        });
        el.addEventListener('mouseleave', () => {
            if (!window.tooltipsEnabled) return;
            if (!this.tooltip.matches(':hover')) {
                this.hide();
            }
        });
    }

}

export const tooltip = new ToolTip();

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.style.cursor = 'help';
        el.addEventListener('mouseenter', () => {
            if (!window.tooltipsEnabled) return;
            const text = el.getAttribute('data-tooltip');
            if (text) tooltip.show(text, el);
        });
        el.addEventListener('mouseleave', () => {
            if (!window.tooltipsEnabled) return;
            if (!tooltip.tooltip.matches(':hover')) {
                tooltip.hide();
            }
        });
    });
});