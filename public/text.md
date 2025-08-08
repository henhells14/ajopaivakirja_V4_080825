//<script>
document.addEventListener('DOMContentLoaded', function() {
    // Tarkista onko GPS-matkan tietoja localStorage:ssa
    const tripData = localStorage.getItem('latestTripData');
    
    if (tripData) {
        try {
            const trip = JSON.parse(tripData);
            
            // Täytä lomakkeen kentät GPS-tiedoilla
            if (trip.date) {
                document.getElementById('date').value = trip.date;
            }
            
            if (trip.distance) {
                document.getElementById('distanceField').value = trip.distance + ' km';
            }
            
            if (trip.startLocation) {
                document.getElementById('from').value = trip.startLocation;
            }
            
            if (trip.endLocation) {
                document.getElementById('to').value = trip.endLocation;
            }
            
            // Näytä "GPS-matka ladattu" ilmoitus
            document.getElementById('prefilledInfo').style.display = 'block';
            
        } catch (error) {
            console.error('Virhe GPS-tietojen lataamisessa:', error);
        }
    }
});

// Funktio esitäytettyjen tietojen tyhjentämiseen
function clearPrefilledData() {
    // Tyhjennä lomakkeen kentät
    document.getElementById('date').value = '';
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    document.getElementById('distanceField').value = '';
    document.getElementById('type').value = '';
    
    // Piilota ilmoitus
    document.getElementById('prefilledInfo').style.display = 'none';
    
    // Poista GPS-tiedot localStorage:sta
    localStorage.removeItem('latestTripData');
}
