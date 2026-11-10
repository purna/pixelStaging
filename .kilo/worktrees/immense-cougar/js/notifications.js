/**
 * Notifications Module
 * A standalone notification system that can be easily integrated into any application
 */

export class Notifications {
    /**
     * Show a notification message
     * @param {string} message - The message to display
     * @param {string} type - Type of notification: 'info', 'success', 'error'
     */
    showNotification(message, type = 'info') {
        // Remove any existing notification first
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = message;

        // Apply base styles
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '4px';
        notification.style.color = '#fff';
        notification.style.fontSize = '12px';
        notification.style.fontWeight = 'bold';
        notification.style.zIndex = '10000';
        notification.style.border = '1px solid rgba(255,255,255,0.2)';
        notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        notification.style.transition = 'all 0.3s ease';
        notification.style.transform = 'translateY(-20px)';
        notification.style.opacity = '0';

        // Set background and border color based on type
        const colors = {
            success: '#00ff41',
            error: '#ff006e',
            info: '#00d9ff'
        };
        notification.style.backgroundColor = '#1a1a2e';
        notification.style.borderLeft = `4px solid ${colors[type] || colors.info}`;

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        // Add class for styling reference
        notification.classList.add('notification');
    }

    /**
     * Show a success notification
     * @param {string} message - The success message to display
     */
    success(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show an error notification
     * @param {string} message - The error message to display
     */
    error(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show an info notification
     * @param {string} message - The info message to display
     */
    info(message) {
        this.showNotification(message, 'info');
    }
}

// Retain the global for older integrations while using a reliable ES module
// export in the application and bundled build.
if (typeof window !== 'undefined') window.Notifications = Notifications;
