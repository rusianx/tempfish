const saveBtn = document.getElementById('save-btn');
const navBtn = document.getElementById('nav-btn');
const clearBtn = document.getElementById('clear-btn');
const stopBtn = document.getElementById('stop-btn');
const statusMsg = document.getElementById('status-msg');
const coordsMsg = document.getElementById('coords-msg');
const setupDiv = document.getElementById('setup');
const trackingDiv = document.getElementById('tracking');
const distanceEl = document.getElementById('distance');
const directionEl = document.getElementById('direction');
const arrowEl = document.getElementById('arrow');
const compassStatusEl = document.getElementById('compass-status');
const gpsAccuracyEl = document.getElementById('gps-accuracy');

let targetLat = null;
let targetLng = null;
let watchId = null;
let deviceHeading = null;
let currentBearing = 0;

const DEFAULT_LAT = 19.042601438159934;
const DEFAULT_LNG = 73.02652541661975;

// Initialize UI from localStorage
function init() {
  let savedLat = localStorage.getItem('targetLat');
  let savedLng = localStorage.getItem('targetLng');
  
  if (!localStorage.getItem('appInitialized')) {
    savedLat = DEFAULT_LAT.toString();
    savedLng = DEFAULT_LNG.toString();
    localStorage.setItem('targetLat', savedLat);
    localStorage.setItem('targetLng', savedLng);
    localStorage.setItem('appInitialized', 'true');
  }
  
  if (savedLat && savedLng) {
    targetLat = parseFloat(savedLat);
    targetLng = parseFloat(savedLng);
    statusMsg.textContent = "Location Saved ✓";
    statusMsg.style.color = "#4CAF50";
    coordsMsg.textContent = `Lat: ${targetLat.toFixed(6)}, Lng: ${targetLng.toFixed(6)}`;
    navBtn.style.display = 'inline-block';
    clearBtn.style.display = 'inline-block';
    // Keep saveBtn visible so user can replace default with their current GPS
    saveBtn.style.display = 'inline-block';
  } else {
    statusMsg.textContent = "";
    coordsMsg.textContent = "";
    navBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
  }
}

function toRad(degrees) {
  return degrees * Math.PI / 180;
}

function toDeg(radians) {
  return radians * 180 / Math.PI;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  
  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) -
            Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return (toDeg(brng) + 360) % 360;
}

function getCompassDirection(bearing) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function updateArrow() {
  if (deviceHeading !== null) {
    compassStatusEl.textContent = "";
    // Arrow rotation: bearing relative to device physical orientation
    let arrowRotation = currentBearing - deviceHeading;
    arrowEl.style.transform = `rotate(${arrowRotation}deg)`;
  } else {
    compassStatusEl.textContent = "Compass unavailable";
    // Always point 'up' if no compass, indicating relative heading is unknown
    arrowEl.style.transform = `rotate(0deg)`;
  }
}

// Handle Device Orientation for compass
function handleOrientation(event) {
  if (event.webkitCompassHeading !== undefined) {
    deviceHeading = event.webkitCompassHeading;
  } else if (event.absolute && event.alpha !== null) {
    // Standard absolute orientation mapping
    deviceHeading = 360 - event.alpha;
  } else {
    deviceHeading = null;
  }
  updateArrow();
}

saveBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    statusMsg.textContent = "Geolocation not supported.";
    statusMsg.style.color = "#ff6b6b";
    return;
  }
  
  saveBtn.textContent = "Getting real GPS...";
  saveBtn.disabled = true;
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      targetLat = pos.coords.latitude;
      targetLng = pos.coords.longitude;
      localStorage.setItem('targetLat', targetLat);
      localStorage.setItem('targetLng', targetLng);
      
      saveBtn.textContent = "Save Location";
      saveBtn.disabled = false;
      init();
    },
    (err) => {
      statusMsg.textContent = "GPS Error: " + err.message;
      statusMsg.style.color = "#ff6b6b";
      saveBtn.textContent = "Save Location";
      saveBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
  );
});

clearBtn.addEventListener('click', () => {
  localStorage.removeItem('targetLat');
  localStorage.removeItem('targetLng');
  targetLat = null;
  targetLng = null;
  init();
});

navBtn.addEventListener('click', () => {
  if (!targetLat || !targetLng) return;
  
  navBtn.textContent = "Starting GPS...";
  navBtn.disabled = true;

  // Request compass permissions if needed (iOS 13+)
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === 'granted') {
          window.addEventListener('deviceorientationabsolute', handleOrientation);
          window.addEventListener('deviceorientation', handleOrientation);
        }
      })
      .catch(console.error);
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
  }
  
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      setupDiv.style.display = 'none';
      trackingDiv.style.display = 'block';
      navBtn.textContent = "Navigate";
      navBtn.disabled = false;
      
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy;
      
      gpsAccuracyEl.textContent = `GPS Accuracy: ${Math.round(accuracy)} m`;
      
      const distance = calculateDistance(userLat, userLng, targetLat, targetLng);
      currentBearing = calculateBearing(userLat, userLng, targetLat, targetLng);
      
      let distStr = '';
      if (distance > 1000) {
        distStr = (distance / 1000).toFixed(2) + ' km';
      } else {
        distStr = Math.round(distance) + ' m';
      }
      
      distanceEl.textContent = distStr;
      directionEl.textContent = getCompassDirection(currentBearing);
      
      updateArrow();
    },
    (err) => {
      statusMsg.textContent = "Navigation GPS error: " + err.message + " (Try outdoors on a mobile device)";
      statusMsg.style.color = "#ff6b6b";
      navBtn.textContent = "Navigate";
      navBtn.disabled = false;
      
      if (trackingDiv.style.display === 'none') {
        setupDiv.style.display = 'block';
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 }
  );
});

stopBtn.addEventListener('click', () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  window.removeEventListener('deviceorientationabsolute', handleOrientation);
  window.removeEventListener('deviceorientation', handleOrientation);
  
  trackingDiv.style.display = 'none';
  setupDiv.style.display = 'block';
  distanceEl.textContent = '-- m';
  directionEl.textContent = '--';
  arrowEl.style.transform = `rotate(0deg)`;
  deviceHeading = null;
  compassStatusEl.textContent = "";
});

// Run init on load
init();
