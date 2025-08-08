// Tarkistetaan onko GPS-matkan tietoja tallennettuna
document.addEventListener('DOMContentLoaded', function() {
    loadTripDataIfAvailable();
});

function loadTripDataIfAvailable() {
    const tripDataJson = localStorage.getItem('latestTripData');
    
    if (tripDataJson) {
        try {
            const tripData = JSON.parse(tripDataJson);
            prefillForm(tripData);
            showPrefilledInfo();
        } catch (error) {
            console.error('Virhe GPS-tietojen lataamisessa:', error);
            localStorage.removeItem('latestTripData'); // Poistetaan viallinen data
        }
    }
}

function prefillForm(tripData) {
    // Esitäytetään lomake
    document.getElementById('date').value = tripData.date;
    document.getElementById('from').value = tripData.startLocation || 'GPS-lähtöpaikka';
    document.getElementById('to').value = tripData.endLocation || 'GPS-kohdepaikka';
    document.getElementById('distanceField').value = tripData.distance + ' km';
    
    // Väritetään esitäytetyt kentät hieman eri tavalla
    const prefilledFields = ['date', 'from', 'to', 'distanceField'];
    prefilledFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.style.backgroundColor = '#f0f8f0';
        field.style.borderColor = '#4caf50';
    });
}

function showPrefilledInfo() {
    document.getElementById('prefilledInfo').style.display = 'block';
}

function clearPrefilledData() {
    // Tyhjennetään lomake
    document.getElementById('tripForm').reset();
    
    // Palautetaan alkuperäiset tyylit
    const fields = ['date', 'from', 'to', 'distanceField'];
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.style.backgroundColor = '';
        field.style.borderColor = '';
    });
    
    // Piilotetaan ilmoitus
    document.getElementById('prefilledInfo').style.display = 'none';
    
    // Poistetaan GPS-data localStoragesta
    localStorage.removeItem('latestTripData');
    
    // Asetetaan placeholderit takaisin
    document.getElementById('from').placeholder = 'Syötä lähtöpaikka';
    document.getElementById('to').placeholder = 'Syötä kohde';
    document.getElementById('distanceField').placeholder = '0.00 km';
}

// Lisätään lomakkeen lähetyksen käsittely
document.getElementById('tripForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Kerätään lomakkeen tiedot
    const formData = new FormData(this);
    const tripData = {
        startTime: new Date(formData.get('date') + 'T' + (formData.get('startTime') || '00:00')),
        endTime: new Date(formData.get('date') + 'T' + (formData.get('endTime') || '23:59')),
        startLocation: {
            address: formData.get('from')
        },
        endLocation: {
            address: formData.get('to')
        },
        distance: parseFloat(formData.get('distance')) || 0,
        purpose: formData.get('purpose') || '',
        notes: formData.get('notes') || ''
    };

    try {
        // Lähetetään tiedot tietokantaan
        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tripData)
        });
        
        if (response.ok) {
            alert('Matka tallennettu tietokantaan onnistuneesti!');
            
            // Poistetaan GPS-data kun matka on tallennettu
            localStorage.removeItem('latestTripData');
            
            // Tyhjennetään lomake
            this.reset();
            document.getElementById('prefilledInfo').style.display = 'none';
            
            // Palautetaan kenttien tyylit
            const fields = ['date', 'from', 'to', 'distanceField'];
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                field.style.backgroundColor = '';
                field.style.borderColor = '';
            });
        } else {
            throw new Error('Virhe tallennuksessa');
        }
    } catch (error) {
        console.error('Virhe tallennuksessa:', error);
        alert('Virhe tallennuksessa. Yritä uudelleen.');
    }
});