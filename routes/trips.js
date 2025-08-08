const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const axios = require('axios');

// ✅ OpenRouteService API-avain (lisää .env tiedostoon)
const ORS_API_KEY = process.env.OPENROUTE_API_KEY;

if (!ORS_API_KEY) {
  console.error('❌ OPENROUTE_API_KEY puuttuu .env tiedostosta!');
}

// ✅ 1. REITITYS JA ETÄISYYSLASKENTA
router.post('/api/route', async (req, res) => {
  try {
    const { startCoords, endCoords, profile = 'driving-car', preference = 'shortest' } = req.body;
    
    if (!startCoords || !endCoords || !startCoords.lat || !startCoords.lng || !endCoords.lat || !endCoords.lng) {
      return res.status(400).json({ error: 'Virheelliset koordinaatit' });
    }

    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'OpenRouteService API-avain puuttuu' });
    }

    console.log(`🛣️ ORS reitti: ${startCoords.lat.toFixed(4)},${startCoords.lng.toFixed(4)} -> ${endCoords.lat.toFixed(4)},${endCoords.lng.toFixed(4)}`);

    const orsResponse = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${profile}`,
      {
        coordinates: [
          [startCoords.lng, startCoords.lat],
          [endCoords.lng, endCoords.lat]
        ],
        preference: preference,
        geometry: true,
        instructions: false
      },
      {
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!orsResponse.data.routes || orsResponse.data.routes.length === 0) {
      throw new Error('Ei reittejä löytynyt');
    }

    const route = orsResponse.data.routes[0];
    const summary = route.summary;

    const result = {
      distance: (summary.distance / 1000).toFixed(3), // metreistä kilometreiksi
      duration: Math.round(summary.duration / 60), // sekunneista minuutteiksi
      geometry: route.geometry,
      bbox: orsResponse.data.bbox
    };

    console.log(`✅ ORS vastaus: ${result.distance} km, ${result.duration} min`);
    res.json(result);

  } catch (error) {
    console.error('❌ ORS reititysvirhe:', error.message);
    
    if (error.response) {
      console.error('ORS API virhe:', error.response.status, error.response.data);
      return res.status(error.response.status).json({ 
        error: 'OpenRouteService API virhe',
        details: error.response.data?.error?.message || error.message
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Pyyntö aikakatkaistiin' });
    }
    
    res.status(500).json({ error: 'Reititysvirhe: ' + error.message });
  }
});

// ✅ 2. KÄÄNTEINEN GEOKOODAUS (koordinaatit -> osoite)
router.post('/api/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Virheelliset koordinaatit' });
    }

    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'OpenRouteService API-avain puuttuu' });
    }

    console.log(`🗺️ ORS reverse geocode: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

    const orsResponse = await axios.get(
      `https://api.openrouteservice.org/geocode/reverse`,
      {
        params: {
          'point.lat': lat,
          'point.lon': lng,
          'size': 1,
          'layers': 'address,street,locality'
        },
        headers: {
          'Authorization': ORS_API_KEY
        },
        timeout: 8000
      }
    );

    let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (orsResponse.data.features && orsResponse.data.features.length > 0) {
      const feature = orsResponse.data.features[0];
      const props = feature.properties;
      
      // Muodosta osoite
      let addressParts = [];
      
      if (props.name) addressParts.push(props.name);
      if (props.housenumber) addressParts.push(props.housenumber);
      if (props.street) addressParts.push(props.street);
      if (props.locality) addressParts.push(props.locality);
      if (props.region) addressParts.push(props.region);
      
      if (addressParts.length > 0) {
        address = addressParts.slice(0, 3).join(', '); // Ota max 3 osaa
      } else if (props.label) {
        address = props.label.split(',').slice(0, 2).join(',').trim();
      }
    }

    console.log(`✅ ORS osoite: ${address}`);
    res.json({ address });

  } catch (error) {
    console.error('❌ ORS geokoodausvirhe:', error.message);
    
    if (error.response) {
      console.error('ORS API virhe:', error.response.status, error.response.data);
    }
    
    // Palauta koordinaatit jos osoitehaku epäonnistuu
    const { lat, lng } = req.body;
    res.json({ address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
  }
});

// ✅ 3. MATKOJEN TALLENNUS
router.post('/api/trips', async (req, res) => {
  try {
    const {
      userId,
      date,
      startTime,
      endTime,
      duration,
      distance,
      startLocation,
      endLocation,
      purpose,
      routeAnalysis
    } = req.body;

    // Validointi
    if (!userId || !startTime || !distance || distance <= 0) {
      return res.status(400).json({ 
        error: 'Puutteelliset matkatiedot',
        required: ['userId', 'startTime', 'distance']
      });
    }

    console.log(`💾 Tallennetaan matka: ${distance} km, ${duration}s, käyttäjä: ${userId}`);

    // Luo uusi matka
    const tripData = {
      userId,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : new Date(),
      duration: duration || 0,
      distance: parseFloat(distance),
      purpose: purpose || 'työ',
      notes: ''
    };

    // Lisää sijainnit jos saatavilla
    if (startLocation) {
      tripData.startLocation = {
        lat: startLocation.coordinates?.lat,
        lng: startLocation.coordinates?.lng,
        address: startLocation.address || 'Tuntematon',
        coordinates: startLocation.coordinates
      };
    }

    if (endLocation) {
      tripData.endLocation = {
        lat: endLocation.coordinates?.lat,
        lng: endLocation.coordinates?.lng,
        address: endLocation.address || 'Tuntematon',
        coordinates: endLocation.coordinates
      };
    }

    // Lisää reittianalyysi jos saatavilla
    if (routeAnalysis) {
      tripData.routeAnalysis = routeAnalysis;
    }

    const trip = new Trip(tripData);
    const savedTrip = await trip.save();

    console.log(`✅ Matka tallennettu ID: ${savedTrip._id}`);
    
    res.status(201).json({
      success: true,
      tripId: savedTrip._id,
      message: 'Matka tallennettu onnistuneesti'
    });

  } catch (error) {
    console.error('💥 Matkan tallennusvirhe:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validointivirhe',
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    res.status(500).json({
      error: 'Matkan tallennus epäonnistui',
      message: error.message
    });
  }
});

// ✅ 4. MATKOJEN HAKU (bonus)
router.get('/api/trips/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0, startDate, endDate } = req.query;

    const query = { userId };

    // Päivämääräsuodatus
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const trips = await Trip.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-__v');

    const total = await Trip.countDocuments(query);

    res.json({
      trips,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('❌ Matkojen hakuvirhe:', error);
    res.status(500).json({ error: 'Matkojen haku epäonnistui' });
  }
});

// ✅ 5. KÄYTTÄJÄN TILASTOT (bonus)
router.get('/api/trips/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const stats = await Trip.getUserStats(userId, parseInt(days));
    
    res.json({
      period: `${days} päivää`,
      ...stats,
      // Muotoillut arvot
      formatted: {
        totalDistance: `${stats.totalDistance.toFixed(1)} km`,
        totalDuration: `${Math.round(stats.totalDuration / 3600)} h ${Math.round((stats.totalDuration % 3600) / 60)} min`,
        averageSpeed: `${stats.averageSpeed.toFixed(1)} km/h`,
        routeEfficiency: stats.routeEfficiency ? `${stats.routeEfficiency.toFixed(1)}%` : 'Ei tietoa'
      }
    });

  } catch (error) {
    console.error('❌ Tilastovirhe:', error);
    res.status(500).json({ error: 'Tilastojen haku epäonnistui' });
  }
});

module.exports = router;