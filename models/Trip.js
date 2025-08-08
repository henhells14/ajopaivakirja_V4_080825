const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  startTime: { type: Date, required: true },
  endTime: Date,
  startLocation: {
    lat: Number,
    lng: Number,
    address: String,
    coordinates: { // Säilyttää tarkemmat koordinaatit
      lat: Number,
      lng: Number,
      accuracy: Number
    }
  },
  endLocation: {
    lat: Number,
    lng: Number,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number,
      accuracy: Number
    }
  },
  distance: { type: Number, required: true }, // Todellinen ajettu matka
  duration: Number, // Sekunteina
  purpose: String, // esim. "työ", "henkilökohtainen"
  notes: String,
  
  // ✅ UUSI: OpenRouteService analyysitiedot
  routeAnalysis: {
    optimalDistance: Number,    // ORS:n optimaalinen matka km
    actualDistance: Number,     // Todellinen ajettu matka km
    routeDifference: Number,    // Ero km (positiivinen = pidempi, negatiivinen = lyhyempi)
    efficiencyPercent: Number,  // Tehokkuus prosenttina
    estimatedDuration: Number,  // ORS:n arvioima aika minuutteina
    routeGeometry: String,      // Reitin geometria (polyline)
    waypoints: [{               // Mahdolliset välipisteet
      lat: Number,
      lng: Number,
      address: String
    }]
  },
  
  // ✅ UUSI: GPS-seurannan laatutiedot
  trackingQuality: {
    averageAccuracy: Number,    // Keskimääräinen GPS-tarkkuus metreinä
    positionCount: Number,      // GPS-mittausten määrä
    speedVariation: Number,     // Nopeuden vaihtelu (keskihajonta)
    signalLost: Number,         // Kuinka monta sekuntia signaali oli poissa
    maxSpeed: Number,           // Suurin nopeus km/h
    averageSpeed: Number        // Keskinopeus km/h
  }
}, {
  timestamps: true
});

// ✅ UUSI: Lisää indeksit hakujen nopeuttamiseksi
tripSchema.index({ userId: 1, startTime: -1 });
tripSchema.index({ 'startLocation.address': 'text', 'endLocation.address': 'text' });

// ✅ UUSI: Virtual kenttä keskiarvon laskemiseksi
tripSchema.virtual('averageSpeed').get(function() {
  if (this.duration && this.duration > 0) {
    return (this.distance / (this.duration / 3600)).toFixed(1); // km/h
  }
  return 0;
});

// ✅ UUSI: Virtual kenttä tehokkuuden laskemiseksi
tripSchema.virtual('routeEfficiency').get(function() {
  if (this.routeAnalysis && this.routeAnalysis.optimalDistance > 0) {
    const efficiency = (this.routeAnalysis.optimalDistance / this.distance) * 100;
    return Math.min(100, efficiency).toFixed(1); // Max 100%
  }
  return null;
});

// ✅ UUSI: Metodi reitin laadun arvioimiseksi
tripSchema.methods.getRouteQuality = function() {
  if (!this.routeAnalysis) return 'Ei tietoa';
  
  const diff = Math.abs(this.routeAnalysis.routeDifference);
  const percent = Math.abs(this.routeAnalysis.efficiencyPercent);
  
  if (percent <= 5) return 'Erinomainen';
  if (percent <= 15) return 'Hyvä';  
  if (percent <= 30) return 'Kohtalainen';
  if (percent <= 50) return 'Huono';
  return 'Erittäin huono';
};

// ✅ UUSI: Metodi GPS-laadun arvioimiseksi
tripSchema.methods.getGPSQuality = function() {
  if (!this.trackingQuality) return 'Ei tietoa';
  
  const accuracy = this.trackingQuality.averageAccuracy;
  if (!accuracy) return 'Ei tietoa';
  
  if (accuracy <= 5) return 'Erinomainen';
  if (accuracy <= 15) return 'Hyvä';
  if (accuracy <= 30) return 'Kohtalainen';  
  if (accuracy <= 100) return 'Huono';
  return 'Erittäin huono';
};

// ✅ UUSI: Staattinen metodi käyttäjän tilastojen hakemiseksi
tripSchema.statics.getUserStats = async function(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: since }
      }
    },
    {
      $group: {
        _id: null,
        totalTrips: { $sum: 1 },
        totalDistance: { $sum: '$distance' },
        totalDuration: { $sum: '$duration' },
        averageDistance: { $avg: '$distance' },
        averageDuration: { $avg: '$duration' },
        averageSpeed: { 
          $avg: { 
            $cond: [
              { $gt: ['$duration', 0] },
              { $multiply: [{ $divide: ['$distance', '$duration'] }, 3600] },
              0
            ]
          }
        },
        // Reittitehokkuus
        routeEfficiency: {
          $avg: {
            $cond: [
              { $and: [
                { $ne: ['$routeAnalysis', null] },
                { $gt: ['$routeAnalysis.optimalDistance', 0] }
              ]},
              { $multiply: [
                { $divide: ['$routeAnalysis.optimalDistance', '$distance'] }, 
                100
              ]},
              null
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalTrips: 0,
    totalDistance: 0,
    totalDuration: 0,
    averageDistance: 0,
    averageDuration: 0,
    averageSpeed: 0,
    routeEfficiency: null
  };
};

module.exports = mongoose.model('Trip', tripSchema);