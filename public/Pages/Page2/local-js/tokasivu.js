// ✅ AUTENTIKOINTITARKISTUS
if (!window.currentUser) {
  console.error('Käyttäjä ei ole kirjautunut - GPS-toiminnot estetty');
  window.toggleTracking = function() {
    alert('Sinun täytyy kirjautua sisään käyttääksesi GPS-toimintoja');
    window.location.href = '/kirjaudu-sisaan';
  };
  throw new Error('Authentication required');
}

console.log('GPS-toiminnot käytettävissä käyttäjälle:', window.currentUser.name);

// PERUSMUUTTUJAT
let isTracking = false;
let startTime = null;
let totalDistance = 0;
let lastPosition = null;
let watchId = null;
let timerInterval = null;
let tripStartLocation = null;
let tripEndLocation = null;

// ✅ LISÄTTY: GPS-datan puskurointi ja suodatus
let positionBuffer = [];
let lastValidTime = 0;
let speedBuffer = [];

// ✅ UUDET ORS-muuttujat (LISÄÄ NÄMÄ)
let pendingDistanceCalculation = false;
let distanceCalculationQueue = [];

// DOM elementit
const startTripBtn = document.getElementById('startTripBtn');
const tripInfo = document.getElementById('tripInfo');
const distanceDisplay = document.getElementById('distanceDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const speedDisplay = document.getElementById('speedDisplay');
const statusDisplay = document.getElementById('statusDisplay');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const carImage = document.getElementById('carImage');

function toggleTracking() {
    if (!isTracking) {
        startTracking();
    } else {
        stopTracking();
    }
}

function startTracking() {
    if (!navigator.geolocation) {
        showError('GPS ei ole käytettävissä tässä laitteessa.');
        return;
    }

    // ✅ NOLLATAAN KAIKKI TIEDOT KUNNOLLA
    totalDistance = 0;
    lastPosition = null;
    tripStartLocation = null;
    tripEndLocation = null;
    positionBuffer = [];
    speedBuffer = [];
    lastValidTime = 0;
    
    // ✅ NOLLAA UUDET ORS-muuttujat
    pendingDistanceCalculation = false;
    distanceCalculationQueue = [];
    
    startTime = Date.now();
    console.log('Matka aloitettu kello:', new Date(startTime).toLocaleTimeString());
    
   // Päivitetään UI
    isTracking = true;
    startTripBtn.textContent = 'Lopeta matka';
    startTripBtn.classList.add('stop-mode');
    tripInfo.classList.add('active');
    statusDisplay.textContent = 'Etsitään GPS-signaalia...';
    carImage.classList.add('tracking');
    hideError();
    hideSuccess();

    // ✅ MUUTETTU: Löysemmät asetukset ORS:lle
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000  // Vähän vanhempikin data käy ORS:lle
    };

    watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,  // ✅ TÄMÄ KORVATAAN UUDELLA
        handlePositionError,
        options
    );

    // Käynnistetään ajastin
     timerInterval = setInterval(updateTimer, 1000);
    console.log('🚗 GPS-seuranta + ORS käynnistetty');
}


// ✅ UUDISTETTU GPS-KÄSITTELY - KILPAILIJAN TASOLLA
function handlePositionUpdate(position) {
    const now = Date.now();
    
    // ✅ PERUSVALIDOINTI
    if (!position.coords || 
        Math.abs(position.coords.latitude) > 90 || 
        Math.abs(position.coords.longitude) > 180) {
        console.log('❌ Virheelliset koordinaatit');
        return;
    }

    const currentPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: now,
        accuracy: position.coords.accuracy || 999,
        speed: position.coords.speed, // Voi olla null
        heading: position.coords.heading
    };

    console.log(`📡 GPS: ${currentPos.accuracy.toFixed(1)}m tarkkuus, nopeus: ${currentPos.speed ? (currentPos.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}`);

    // ✅ HYVÄKSY KAIKKI KOHTUULLISET MITTAUKSET
    if (currentPos.accuracy > 300) {
        console.log('❌ Liian epätarkka GPS:', currentPos.accuracy);
        statusDisplay.textContent = `GPS-signaali heikko (${Math.round(currentPos.accuracy)}m)`;
        return;
    }

    statusDisplay.textContent = `Matka käynnissä (${Math.round(currentPos.accuracy)}m)`;

    // ✅ ENSIMMÄINEN MITTAUS
    if (!tripStartLocation) {
        tripStartLocation = currentPos;
        lastPosition = currentPos;
        lastValidTime = now;
        console.log('🚩 Aloituspiste asetettu');
        return;
    }

    // ✅ KORJATTU: Lasketaan nopeus ENNEN kuin sitä käytetään
    const distance = calculateDistanceHaversine(lastPosition, currentPos);
    const timeDiff = (now - lastValidTime) / 1000;
    const calculatedSpeed = (distance / timeDiff) * 3.6;

    // ✅ LIIAN NOPEAT MITTAUKSET - adaptiivinen väli nopeuden mukaan
    const minInterval = calculatedSpeed > 30 ? 5000 : 8000; // Nopeammin = harvemmin
    if (now - lastValidTime < minInterval) {
        return;
    }

    tripEndLocation = currentPos;

    // ✅ NOPEUSNÄYTTÖ
    let displaySpeed = 0;
    if (currentPos.speed !== null && currentPos.speed >= 0 && currentPos.accuracy < 50) {
        displaySpeed = currentPos.speed * 3.6;
    } else {
        displaySpeed = calculatedSpeed;
    }

    speedBuffer.push(Math.max(0, displaySpeed));
    if (speedBuffer.length > 5) speedBuffer.shift();
    
    const avgSpeed = speedBuffer.reduce((sum, speed) => sum + speed, 0) / speedBuffer.length;
    speedDisplay.textContent = `${Math.round(avgSpeed)} km/h`;

    // ✅ PÄÄMUUTOS: Käytä ORS:ää etäisyyslaskentaan
    calculateDistanceWithORS(lastPosition, currentPos);
}

// ✅ UUSI FUNKTIO: ORS-pohjainen etäisyyslaskenta
async function calculateDistanceWithORS(fromPos, toPos) {
    if (pendingDistanceCalculation) {
        console.log('⏳ ORS-laskenta jo käynnissä, lisätään jonoon');
        distanceCalculationQueue.push({ from: fromPos, to: toPos });
        return;
    }

    pendingDistanceCalculation = true;

    try {
        console.log('🛣️ Lasketaan etäisyys ORS:llä...');
        
        const response = await fetch('/api/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                startCoords: {
                    lat: fromPos.lat,
                    lng: fromPos.lng
                },
                endCoords: {
                    lat: toPos.lat,
                    lng: toPos.lng
                },
                profile: 'driving-car',
                preference: 'shortest' // Lyhin reitti = tarkin etäisyys
            })
        });

        if (!response.ok) {
            throw new Error(`ORS API virhe: ${response.status}`);
        }

        const routeData = await response.json();
        const orsDistance = parseFloat(routeData.distance); // kilometriä

        console.log(`✅ ORS etäisyys: ${orsDistance.toFixed(3)} km`);

        // ✅ KÄYTÄ ORS:n etäisyyttä suoraan!
        totalDistance += orsDistance;
        distanceDisplay.textContent = `${totalDistance.toFixed(2)} km`;

        // Päivitä sijainti
        lastPosition = toPos;
        lastValidTime = Date.now();

        console.log(`📈 Kokonaismatka: ${totalDistance.toFixed(3)} km`);

 } catch (error) {
        console.error('❌ ORS etäisyysvirhe:', error);
        
        // Fallback: käytä Haversine-laskentaa
        const fallbackDistance = calculateDistanceHaversine(fromPos, toPos);
        console.log(`🔄 Fallback etäisyys: ${fallbackDistance.toFixed(3)} km`);
        
        totalDistance += fallbackDistance;
        distanceDisplay.textContent = `${totalDistance.toFixed(2)} km`;
        
        lastPosition = toPos;
        lastValidTime = Date.now();
    }

    pendingDistanceCalculation = false;

    // Käsittele jono
    if (distanceCalculationQueue.length > 0) {
        const next = distanceCalculationQueue.shift();
        console.log('📋 Käsitellään jonossa ollut laskenta');
        setTimeout(() => calculateDistanceWithORS(next.from, next.to), 1000);
    }
}

// ✅ TARKENNETTU ETÄISYYSLASKENTA (Haversine)
function calculateDistanceHaversine(pos1, pos2) {
    const R = 6371000; // Maapallon säde metreinä
    const φ1 = pos1.lat * Math.PI / 180;
    const φ2 = pos2.lat * Math.PI / 180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return (R * c) / 1000; // palautetaan kilometreinä
}

async function stopTracking() {
    console.log('🛑 Pysäytetään GPS-seuranta');
    isTracking = false;
    
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    startTripBtn.textContent = 'Aloita uusi matka';
    startTripBtn.classList.remove('stop-mode');
    statusDisplay.textContent = 'Matka päättynyt';
    speedDisplay.textContent = '0 km/h';
    carImage.classList.remove('tracking');
    
    await saveTripData();
    
    setTimeout(() => {
        if (!isTracking) {
            statusDisplay.textContent = 'Valmis aloittamaan';
        }
    }, 5000);
}

function handlePositionError(error) {
    let errorMsg = 'GPS-virhe: ';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMsg += 'Sijaintilupa evätty. Salli sijainnin käyttö asetuksista.';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMsg += 'GPS ei ole käytettävissä. Varmista että GPS on päällä.';
            break;
        case error.TIMEOUT:
            errorMsg += 'GPS-haku aikakatkaistiin. Kokeile uudelleen.';
            break;
        default:
            errorMsg += `Tuntematon virhe (koodi: ${error.code}).`;
            break;
    }
    console.error('GPS-virhe:', error);
    showError(errorMsg);
}

function updateTimer() {
    if (!startTime || !isTracking) return;
    
    const now = Date.now();
    const elapsed = now - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    timeDisplay.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ✅ KORJATTU TALLENNUSFUNKTIO
async function saveTripData() {
    if (!startTime || totalDistance === 0) {
        console.log('❌ Ei tallennettavaa dataa - matka:', totalDistance, 'aloitusaika:', startTime);
        return;
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // sekunteina

    console.log('💾 Tallennetaan matka:', {
        kesto: duration + 's',
        matka: totalDistance.toFixed(2) + 'km',
        aloitus: new Date(startTime).toLocaleString(),
        lopetus: new Date(endTime).toLocaleString()
    });

    try {
        const startAddress = await getAddressFromCoords(tripStartLocation);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const endAddress = await getAddressFromCoords(tripEndLocation);

        // ✅ KORJATTU: Käytetään millisekunteja ISO-stringille
        const tripData = {
            userId: window.currentUser.id,
            date: new Date(startTime).toISOString().split('T')[0], // Päivämäärä aloitusajasta
            startTime: new Date(startTime).toISOString(),         // ✅ Korjattu
            endTime: new Date(endTime).toISOString(),             // ✅ Korjattu
            duration: duration,
            distance: parseFloat(totalDistance.toFixed(2)), // ✅ Number, ei string
            startLocation: {
                address: startAddress,
                coordinates: tripStartLocation
            },
            endLocation: {
                address: endAddress,
                coordinates: tripEndLocation
            },
            purpose: 'työ'
        };

        console.log('📤 Lähetetään API:lle:', tripData);

        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tripData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API-virhe:', response.status, errorText);
            throw new Error(`Matkan tallennus epäonnistui: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Matka tallennettu:', result);

        localStorage.setItem('latestTripData', JSON.stringify(tripData));
        showSuccess(`Matka tallennettu! ${totalDistance.toFixed(2)} km, ${Math.round(duration/60)} min`);
        
    } catch (error) {
        console.error('💥 Tallennusvirhe:', error);
        showError('Matkatietojen tallentaminen epäonnistui: ' + error.message);
    }
}

// Korvaa getAddressFromCoords-funktio tällä paremmalla versiolla
// joka käyttää ORS API:a Nominatimin sijaan

async function getAddressFromCoords(position) {
    if (!position) return 'Tuntematon sijainti';
    
    try {
        console.log('🗺️ Haetaan osoite ORS:llä:', position.lat.toFixed(4), position.lng.toFixed(4));
        
        const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lat: position.lat,
                lng: position.lng
            })
        });
        
        if (!response.ok) {
            console.log('❌ ORS reverse geocode virhe:', response.status);
            // Fallback Nominatimiin
            return await getAddressFromCoordsNominatim(position);
        }
        
        const data = await response.json();
        const address = data.address || `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
        
        console.log('✅ ORS osoite:', address);
        return address;
        
    } catch (error) {
        console.error('❌ ORS osoitevirhe:', error);
        // Fallback Nominatimiin
        return await getAddressFromCoordsNominatim(position);
    }
}

// Säilytä vanha Nominatim-funktio fallbackina
async function getAddressFromCoordsNominatim(position) {
    if (!position) return 'Tuntematon sijainti';
    
    try {
        console.log('🗺️ Fallback: Haetaan osoite Nominatimilla:', position.lat.toFixed(4), position.lng.toFixed(4));
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1&zoom=18&accept-language=fi`,
            {
                headers: {
                    'User-Agent': 'GPS-Ajopaivakirja/1.0 (https://example.com)',
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || data.error) {
            throw new Error('Ei osoitetietoja');
        }
        
        // Muodosta osoite
        let address = '';
        const addr = data.address || {};
        
        const road = addr.road || addr.pedestrian || addr.footway || addr.path;
        if (road) {
            address = road;
            if (addr.house_number) {
                address += ' ' + addr.house_number;
            }
        }
        
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
        if (city) {
            if (address) address += ', ';
            address += city;
        }
        
        if (!address && data.display_name) {
            const parts = data.display_name.split(',');
            address = parts.slice(0, 2).join(',').trim();
        }
        
        const result = address || `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
        console.log('✅ Nominatim osoite:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Nominatim osoitevirhe:', error);
        return `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
    }
}

// Lisää uusi funktio reitityksen hakemiseen
async function getOptimalRoute(startPos, endPos) {
    if (!startPos || !endPos) return null;
    
    try {
        console.log('🛣️ Haetaan optimaalinen reitti ORS:llä');
        
        const response = await fetch('/api/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                startCoords: {
                    lat: startPos.lat,
                    lng: startPos.lng
                },
                endCoords: {
                    lat: endPos.lat,
                    lng: endPos.lng
                },
                profile: 'driving-car'
            })
        });
        
        if (!response.ok) {
            console.log('❌ ORS reititys virhe:', response.status);
            return null;
        }
        
        const routeData = await response.json();
        
        console.log(`✅ ORS reitti: ${routeData.distance} km, ${routeData.duration} min`);
        
        return {
            distance: parseFloat(routeData.distance),
            duration: routeData.duration,
            geometry: routeData.geometry,
            instructions: routeData.instructions
        };
        
    } catch (error) {
        console.error('❌ Reititysvirhe:', error);
        return null;
    }
}

// Lisää funktio matkan lopussa reitin vertailuun
async function compareRouteWithActual() {
    if (!tripStartLocation || !tripEndLocation || totalDistance === 0) {
        return;
    }
    
    try {
        console.log('📊 Vertaillaan todellista matkaa optimaaliseen reittiin...');
        
        const optimalRoute = await getOptimalRoute(tripStartLocation, tripEndLocation);
        
        if (optimalRoute) {
            const actualDistance = totalDistance;
            const optimalDistance = optimalRoute.distance;
            const difference = actualDistance - optimalDistance;
            const percentDiff = ((difference / optimalDistance) * 100).toFixed(1);
            
            console.log(`📈 Reittivertailu:
                Todellinen matka: ${actualDistance.toFixed(2)} km
                Optimaalinen reitti: ${optimalDistance.toFixed(2)} km  
                Ero: ${difference > 0 ? '+' : ''}${difference.toFixed(2)} km (${percentDiff}%)
                Arvioitu aika: ${optimalRoute.duration} min`);
            
            // Näytä vertailu käyttäjälle
            if (Math.abs(difference) > 0.5) {
                const message = difference > 0 
                    ? `Ajoit ${difference.toFixed(1)} km pidemmän reitin kuin optimaalinen (${percentDiff}% enemmän)`
                    : `Ajoit ${Math.abs(difference).toFixed(1)} km lyhyemmän reitin kuin arvioitu`;
                    
                // Voit näyttää tämän käyttöliittymässä
                console.log('💡 Tieto käyttäjälle:', message);
            }
            
            return {
                actual: actualDistance,
                optimal: optimalDistance,
                difference: difference,
                percentDiff: parseFloat(percentDiff),
                estimatedDuration: optimalRoute.duration
            };
        }
        
    } catch (error) {
        console.error('❌ Reittivertailuvirhe:', error);
    }
    
    return null;
}

// Päivitä saveTripData-funktio sisältämään reittivertailu
async function saveTripDataWithRouteAnalysis() {
    if (!startTime || totalDistance === 0) {
        console.log('❌ Ei tallennettavaa dataa - matka:', totalDistance, 'aloitusaika:', startTime);
        return;
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('💾 Tallennetaan matka:', {
        kesto: duration + 's',
        matka: totalDistance.toFixed(2) + 'km',
        aloitus: new Date(startTime).toLocaleString(),
        lopetus: new Date(endTime).toLocaleString()
    });

    try {
        // Hae osoitteet ORS:llä
        const startAddress = await getAddressFromCoords(tripStartLocation);
        await new Promise(resolve => setTimeout(resolve, 500)); // Pieni tauko
        const endAddress = await getAddressFromCoords(tripEndLocation);
        
        // Hae reittivertailu
        const routeComparison = await compareRouteWithActual();

        const tripData = {
            userId: window.currentUser.id,
            date: new Date(startTime).toISOString().split('T')[0],
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            duration: duration,
            distance: parseFloat(totalDistance.toFixed(2)),
            startLocation: {
                address: startAddress,
                coordinates: tripStartLocation
            },
            endLocation: {
                address: endAddress,
                coordinates: tripEndLocation
            },
            purpose: 'työ',
            // Lisää reittivertailutiedot jos saatavilla
            routeAnalysis: routeComparison ? {
                optimalDistance: routeComparison.optimal,
                actualDistance: routeComparison.actual,
                routeDifference: routeComparison.difference,
                efficiencyPercent: routeComparison.percentDiff,
                estimatedDuration: routeComparison.estimatedDuration
            } : null
        };

        console.log('📤 Lähetetään API:lle:', tripData);

        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tripData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API-virhe:', response.status, errorText);
            throw new Error(`Matkan tallennus epäonnistui: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Matka tallennettu:', result);

        // Näytä onnistumisviesti reittivertailulla
        let successMsg = `Matka tallennettu! ${totalDistance.toFixed(2)} km, ${Math.round(duration/60)} min`;
        
        if (routeComparison && Math.abs(routeComparison.difference) > 0.5) {
            if (routeComparison.difference > 0) {
                successMsg += ` (${routeComparison.difference.toFixed(1)} km pidempi kuin optimaalinen reitti)`;
            } else {
                successMsg += ` (tehokas reittivalinta!)`;
            }
        }
        
        showSuccess(successMsg);
        
    } catch (error) {
        console.error('💥 Tallennusvirhe:', error);
        showError('Matkatietojen tallentaminen epäonnistui: ' + error.message);
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    hideSuccess();
    console.log('❌ Virhe:', message);
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    hideError();
    console.log('✅ Onnistui:', message);
}

function hideSuccess() {
    successMessage.style.display = 'none';
}

// Sivun lataus
window.addEventListener('load', function() {
    if (!navigator.geolocation) {
        showError('GPS ei ole tuettu tässä selaimessa.');
        startTripBtn.disabled = true;
    }

    console.log('🔧 GPS-seurantatyökalu ladattu');
    
    // Diagnostiikka kehityksessä
    if (window.location.hostname === 'localhost') {
        setInterval(() => {
            if (isTracking) {
                console.log('📊 TILA:', {
                    matka: totalDistance.toFixed(2) + ' km',
                    aika: timeDisplay.textContent,
                    nopeus: speedDisplay.textContent,
                    tarkkuus: lastPosition ? lastPosition.accuracy + 'm' : 'N/A',
                    aloitus: startTime ? new Date(startTime).toLocaleTimeString() : 'N/A'
                });
            }
        }, 15000);
    }
});