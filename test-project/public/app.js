/**
 * Client-side JavaScript for push notification test
 */

let currentSubscription = null;
let currentSubscriptionId = null;

// Check if service workers and push notifications are supported
async function checkSupport() {
  const statusEl = document.getElementById('status');
  const subscribeBtn = document.getElementById('subscribeBtn');

  if (!('serviceWorker' in navigator)) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Service Workers are not supported in this browser';
    return false;
  }

  if (!('PushManager' in window)) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Push notifications are not supported in this browser';
    return false;
  }

  if (!('Notification' in window)) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ Notifications are not supported in this browser';
    return false;
  }

  statusEl.className = 'status success';
  statusEl.textContent = '✅ Push notifications are supported!';
  subscribeBtn.disabled = false;

  // Check if already subscribed
  await checkExistingSubscription();

  return true;
}

// Check if user is already subscribed
async function checkExistingSubscription() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      currentSubscription = subscription;
      updateUIForSubscribed();
      
      // Try to find subscription ID from server
      const response = await fetch('/api/push/subscriptions');
      const data = await response.json();
      
      if (data.subscriptions && data.subscriptions.length > 0) {
        // Find matching subscription by endpoint
        const match = data.subscriptions.find(s => s.endpoint === subscription.endpoint);
        if (match) {
          currentSubscriptionId = match.id;
          showSubscriptionInfo(match);
        }
      }
    }
  } catch (error) {
    console.error('Error checking existing subscription:', error);
  }
}

// Subscribe to push notifications
async function subscribe() {
  const statusEl = document.getElementById('status');
  const subscribeBtn = document.getElementById('subscribeBtn');

  try {
    subscribeBtn.disabled = true;
    statusEl.className = 'status info';
    statusEl.textContent = '⏳ Requesting notification permission...';

    // Request notification permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ Notification permission denied';
      subscribeBtn.disabled = false;
      return;
    }

    statusEl.textContent = '⏳ Registering service worker...';

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    statusEl.textContent = '⏳ Getting VAPID public key...';

    // Get VAPID public key from server
    const vapidResponse = await fetch('/api/vapid-public-key');
    const { publicKey } = await vapidResponse.json();

    statusEl.textContent = '⏳ Subscribing to push notifications...';

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    currentSubscription = subscription;

    statusEl.textContent = '⏳ Saving subscription to server...';

    // Send subscription to server
    const response = await fetch('/api/push/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: arrayBufferToBase64(subscription.getKey('auth')),
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription to server');
    }

    const data = await response.json();
    currentSubscriptionId = data.id;

    statusEl.className = 'status success';
    statusEl.textContent = '✅ Successfully subscribed to push notifications!';

    updateUIForSubscribed();
    showSubscriptionInfo(data);
    refreshStats();

  } catch (error) {
    console.error('Error subscribing:', error);
    statusEl.className = 'status error';
    statusEl.textContent = `❌ Error: ${error.message}`;
    subscribeBtn.disabled = false;
  }
}

// Unsubscribe from push notifications
async function unsubscribe() {
  const statusEl = document.getElementById('status');

  try {
    if (currentSubscription) {
      await currentSubscription.unsubscribe();
    }

    if (currentSubscriptionId) {
      await fetch(`/api/push/subscriptions/${currentSubscriptionId}`, {
        method: 'DELETE',
      });
    }

    currentSubscription = null;
    currentSubscriptionId = null;

    statusEl.className = 'status info';
    statusEl.textContent = '✅ Successfully unsubscribed';

    updateUIForUnsubscribed();
    refreshStats();

  } catch (error) {
    console.error('Error unsubscribing:', error);
    statusEl.className = 'status error';
    statusEl.textContent = `❌ Error: ${error.message}`;
  }
}

// Send notification to current user
async function sendNotification() {
  if (!currentSubscriptionId) {
    alert('Please subscribe first');
    return;
  }

  const title = document.getElementById('notifTitle').value;
  const body = document.getElementById('notifBody').value;
  const sendBtn = document.getElementById('sendBtn');

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId: currentSubscriptionId,
        title,
        body,
        icon: '/icon.png',
        data: { timestamp: Date.now() },
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ Notification sent successfully!');
    } else {
      alert(`❌ Failed to send: ${result.error || 'Unknown error'}`);
    }

    refreshStats();

  } catch (error) {
    console.error('Error sending notification:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send to Me';
  }
}

// Broadcast notification to all users
async function broadcast() {
  const title = document.getElementById('notifTitle').value;
  const body = document.getElementById('notifBody').value;
  const broadcastBtn = document.getElementById('broadcastBtn');

  if (!confirm('Send notification to all subscribed users?')) {
    return;
  }

  try {
    broadcastBtn.disabled = true;
    broadcastBtn.textContent = 'Broadcasting...';

    const response = await fetch('/api/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        icon: '/icon.png',
        data: { timestamp: Date.now() },
      }),
    });

    const result = await response.json();

    alert(`✅ Broadcast complete!\n\nTotal: ${result.total}\nSuccess: ${result.success}\nFailed: ${result.failed}\nRetried: ${result.retried}`);

    refreshStats();

  } catch (error) {
    console.error('Error broadcasting:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    broadcastBtn.disabled = false;
    broadcastBtn.textContent = 'Broadcast to All';
  }
}

// Refresh statistics
async function refreshStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    document.getElementById('totalSubs').textContent = data.subscriptions.total;
    document.getElementById('activeSubs').textContent = data.subscriptions.active;
    document.getElementById('queuePending').textContent = data.queue.pending;
    document.getElementById('queueFailed').textContent = data.queue.failed;

  } catch (error) {
    console.error('Error refreshing stats:', error);
  }
}

// Update UI for subscribed state
function updateUIForSubscribed() {
  document.getElementById('subscribeBtn').style.display = 'none';
  document.getElementById('unsubscribeBtn').style.display = 'inline-block';
  document.getElementById('unsubscribeBtn').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('broadcastBtn').disabled = false;
}

// Update UI for unsubscribed state
function updateUIForUnsubscribed() {
  document.getElementById('subscribeBtn').style.display = 'inline-block';
  document.getElementById('subscribeBtn').disabled = false;
  document.getElementById('unsubscribeBtn').style.display = 'none';
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('broadcastBtn').disabled = true;
  document.getElementById('subscriptionInfo').style.display = 'none';
}

// Show subscription information
function showSubscriptionInfo(subscription) {
  const infoEl = document.getElementById('subscriptionInfo');
  const detailsEl = document.getElementById('subscriptionDetails');

  detailsEl.textContent = JSON.stringify({
    id: subscription.id,
    endpoint: subscription.endpoint.substring(0, 50) + '...',
    status: subscription.status,
    createdAt: subscription.createdAt,
  }, null, 2);

  infoEl.style.display = 'block';
}

// Helper: Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Initialize on page load
window.addEventListener('load', () => {
  checkSupport();
  refreshStats();
  
  // Refresh stats every 10 seconds
  setInterval(refreshStats, 10000);
});
