/**
 * Clipboard utilities for copying citations
 */

/**
 * Copy text to clipboard using the modern Clipboard API
 * Supports both plain text and HTML formatted text for Word compatibility
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Check if text contains HTML tags
    const hasHTML = /<[^>]+>/.test(text);
    
    // Modern Clipboard API (preferred)
    if (navigator.clipboard && navigator.clipboard.write) {
      // Create both HTML and plain text versions
      const plainText = text.replace(/<em>/g, '').replace(/<\/em>/g, '');
      
      const clipboardItems = [];
      
      if (hasHTML) {
        // Add HTML format (Word will preserve italics)
        const htmlBlob = new Blob([text], { type: 'text/html' });
        const plainBlob = new Blob([plainText], { type: 'text/plain' });
        
        clipboardItems.push(
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': plainBlob
          })
        );
      } else {
        // Plain text only
        const plainBlob = new Blob([text], { type: 'text/plain' });
        clipboardItems.push(
          new ClipboardItem({
            'text/plain': plainBlob
          })
        );
      }
      
      await navigator.clipboard.write(clipboardItems);
      return true;
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      // Fallback: writeText only supports plain text
      const plainText = text.replace(/<em>/g, '').replace(/<\/em>/g, '');
      await navigator.clipboard.writeText(plainText);
      return true;
    }
    
    // Fallback: use the legacy execCommand method
    const plainText = text.replace(/<em>/g, '').replace(/<\/em>/g, '');
    const textArea = document.createElement("textarea");
    textArea.value = plainText;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    
    return success;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Show a temporary notification message
 */
export function showNotification(message: string, duration: number = 2000): void {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.bottom = "20px";
  notification.style.right = "20px";
  notification.style.backgroundColor = "#4CAF50";
  notification.style.color = "white";
  notification.style.padding = "12px 24px";
  notification.style.borderRadius = "4px";
  notification.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  notification.style.zIndex = "10000";
  notification.style.fontFamily = "system-ui, -apple-system, sans-serif";
  notification.style.fontSize = "14px";
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transition = "opacity 0.3s";
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, duration);
}

/**
 * Copy citation and show notification
 */
export async function copyWithNotification(text: string, label: string = "Citation"): Promise<void> {
  const success = await copyToClipboard(text);
  if (success) {
    showNotification(`${label} copied to clipboard`);
  } else {
    showNotification(`Failed to copy ${label.toLowerCase()}`);
  }
}
