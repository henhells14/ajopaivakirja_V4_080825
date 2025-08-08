// Lataa ympäristömuuttujat .env-tiedostosta
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const app = express();

const PORT = 3000;
const Trip = require('./models/Trip');
const User = require('./models/User');

// MongoDB yhteys
mongoose.connect(process.env.MONGODB_URI, {});

// EJS konfiguraatio (ENNEN middlewareja)
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts); 
app.set('layout', 'layouts/main'); 

// MIDDLEWARE (oikeassa järjestyksessä)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session konfiguraatio
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-change-this-too',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true jos HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 tuntia
  }
}));

// Middleware käyttäjätietojen välittämiseen kaikille sivuille
app.use(async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId).select('fname lname email');
      
      if (user) {
        res.locals.user = {
          id: user._id,
          nimi: `${user.fname} ${user.lname}`,
          sahkoposti: user.email
        };
      } else {
        res.locals.user = null;
      }
    } else {
      res.locals.user = null;
    }
  } catch (error) {
    console.error('Virhe käyttäjätietojen haussa:', error);
    res.locals.user = null;
  }
  
  next();
});

// Middleware flash-viestien käsittelyyn
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Middleware kirjautumisen tarkistamiseen
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = 'Sinun täytyy kirjautua sisään käyttääksesi GPS-toimintoja';
    return res.redirect('/kirjaudu-sisaan');
  }
  next();
}

// Middleware joka tarkistaa kirjautumisen mutta ei ohjaa pois
function checkAuth(req, res, next) {
  res.locals.isAuthenticated = !!req.session.userId;
  next();
}

// REITIT (middlewarejen JÄLKEEN)

// Sivureitit
app.get('/', (req, res) => res.render('pages/etusivu'));

// GPS-sivu - suojattu kirjautumisella
app.get('/aloita-matka', requireAuth, (req, res) => {
  res.render('pages/gps');
});

//ajohistoria tiedot
app.get('/ajohistoria', requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.session.userId })
                           .sort({ startTime: -1 })
                           .limit(50);
    
    res.render('pages/lomake', { trips: trips });
  } catch (error) {
    console.error('Virhe matkojen haussa:', error);
    res.render('pages/lomake', { trips: [] });
  }
});

app.get('/rekisterointi', (req, res) => res.render('pages/rekisterointi'));
app.get('/kirjaudu-sisaan', (req, res) => res.render('pages/kirjautuminen')); 
app.get('/tietosuoja', (req, res) => res.render('pages/tietosuoja'));

// Kirjautuminen POST-reitti
app.post('/kirjaudu', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.error = 'Sähköposti ja salasana ovat pakollisia';
      return res.redirect('/kirjaudu-sisaan');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.session.error = 'Virheelliset kirjautumistiedot';
      return res.redirect('/kirjaudu-sisaan');
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      req.session.error = 'Virheelliset kirjautumistiedot';
      return res.redirect('/kirjaudu-sisaan');
    }

    req.session.userId = user._id;
    req.session.user = {
      id: user._id,
      fname: user.fname,
      lname: user.lname,
      email: user.email
    };

    req.session.success = `Tervetuloa takaisin, ${user.fname}!`;
    res.redirect('/');

  } catch (error) {
    console.error('Kirjautumisvirhe:', error);
    req.session.error = 'Kirjautumisessa tapahtui virhe. Yritä uudelleen.';
    res.redirect('/kirjaudu-sisaan');
  }
});

// Uloskirjautuminen-reitti
app.post('/uloskirjautuminen', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Uloskirjautumisvirhe:', err);
      return res.redirect('/');
    }
    
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// Rekisteröinti POST-reitti
app.post('/rekisteroidy', async (req, res) => {
  try {
    const { fname, lname, email, password } = req.body;

    if (!fname || !lname || !email || !password) {
      req.session.error = 'Kaikki kentät ovat pakollisia';
      return res.redirect('/rekisterointi');
    }

    if (password.length < 6) {
      req.session.error = 'Salasanan tulee olla vähintään 6 merkkiä pitkä';
      return res.redirect('/rekisterointi');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      req.session.error = 'Sähköpostiosoite on jo rekisteröity';
      return res.redirect('/rekisterointi');
    }

    const newUser = new User({
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.toLowerCase().trim(),
      password: password
    });

    await newUser.save();

    req.session.success = 'Rekisteröinti onnistui! Voit nyt kirjautua sisään.';
    res.redirect('/kirjaudu-sisaan');

  } catch (error) {
    console.error('Rekisteröintivirhe:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      req.session.error = messages.join(', ');
    } else {
      req.session.error = 'Rekisteröinnissä tapahtui virhe. Yritä uudelleen.';
    }
    
    res.redirect('/rekisterointi');
  }
});

// API-reitit
app.post('/api/trips', requireAuth, async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      userId: req.session.userId
    };
    
    const trip = new Trip(tripData);
    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.session.userId }).sort({ startTime: -1 });
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit-trip reitti
app.post('/submit-trip', requireAuth, async (req, res) => {
  try {
    const { date, from, to, distance, type, tripId, isEdit } = req.body;

    console.log('Submit-trip saapunut data:', req.body);

    if (!req.session.userId) {
      req.session.error = 'Sinun täytyy kirjautua sisään tallentaaksesi matkan';
      return res.redirect('/kirjaudu-sisaan');
    }

    if (!date || !from || !to || !type) {
      req.session.error = 'Kaikki kentät ovat pakollisia';
      return res.redirect('/ajohistoria');
    }

    let cleanDistance = 0;
    if (distance) {
      cleanDistance = parseFloat(distance.toString().replace(' km', '').replace(',', '.')) || 0;
    }

    if (isEdit === 'true' && tripId) {
      console.log('Muokataan matkaa ID:', tripId);
      
      const updatedTrip = await Trip.findOneAndUpdate(
        { 
          _id: tripId, 
          userId: req.session.userId
        },
        {
          startTime: new Date(date),
          startLocation: {
            address: from.trim()
          },
          endLocation: {
            address: to.trim()
          },
          distance: cleanDistance,
          purpose: type,
          updatedAt: new Date()
        },
        { 
          new: true,
          runValidators: true
        }
      );

      if (!updatedTrip) {
        req.session.error = 'Matkaa ei löytynyt tai sinulla ei ole oikeutta muokata sitä';
        return res.redirect('/ajohistoria');
      }

      console.log('Matka päivitetty onnistuneesti:', updatedTrip._id);
      req.session.success = 'Matka päivitetty onnistuneesti!';
      
    } else {
      console.log('Luodaan uusi matka');
      
      const newTrip = new Trip({
        userId: req.session.userId,
        startTime: new Date(date),
        startLocation: {
          address: from.trim()
        },
        endLocation: {
          address: to.trim()
        },
        distance: cleanDistance,
        purpose: type
      });

      await newTrip.save();
      console.log('Uusi matka tallennettu:', newTrip._id);
      req.session.success = 'Matka tallennettu onnistuneesti!';
    }

    res.redirect('/ajohistoria');

  } catch (error) {
    console.error('Virhe matkan tallentamisessa/päivittämisessä:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      req.session.error = `Validointivirhe: ${messages.join(', ')}`;
    } else if (error.name === 'CastError') {
      req.session.error = 'Virheellinen matka-ID';
    } else {
      req.session.error = 'Matkan tallentamisessa tapahtui virhe. Yritä uudelleen.';
    }
    
    res.redirect('/ajohistoria');
  }
});

// Delete-trip reitti
app.post('/delete-trip', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      req.session.error = 'Matka-ID puuttuu';
      return res.redirect('/ajohistoria');
    }

    const deletedTrip = await Trip.findOneAndDelete({ 
      _id: tripId, 
      userId: req.session.userId 
    });

    if (!deletedTrip) {
      req.session.error = 'Matkaa ei löytynyt tai sinulla ei ole oikeutta poistaa sitä';
    } else {
      req.session.success = 'Matka poistettu onnistuneesti!';
      console.log('Matka poistettu:', tripId);
    }

    res.redirect('/ajohistoria');

  } catch (error) {
    console.error('Virhe matkan poistossa:', error);
    req.session.error = 'Matkan poistossa tapahtui virhe';
    res.redirect('/ajohistoria');
  }
});

// OPENROUTESERVICE API REITIT
app.post('/api/route', requireAuth, async (req, res) => {
  try {
    const { startCoords, endCoords, profile = 'driving-car' } = req.body;
    
    if (!startCoords || !endCoords) {
      return res.status(400).json({ error: 'Aloitus- ja lopetuskoordinaatit vaaditaan' });
    }

    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'ORS API-avain puuttuu' });
    }

    const orsResponse = await fetch('https://api.openrouteservice.org/v2/directions/' + profile, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: [
          [startCoords.lng, startCoords.lat],
          [endCoords.lng, endCoords.lat]
        ],
        format: 'json',
        instructions: true,
        language: 'fi'
      })
    });

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error('ORS API-virhe:', orsResponse.status, errorText);
      return res.status(500).json({ error: 'Reititys epäonnistui' });
    }

    const routeData = await orsResponse.json();
    
    if (!routeData.routes || routeData.routes.length === 0) {
      return res.status(404).json({ error: 'Reittiä ei löytynyt' });
    }

    const route = routeData.routes[0];
    const summary = route.summary;

    const response = {
      distance: (summary.distance / 1000).toFixed(2),
      duration: Math.round(summary.duration / 60),
      geometry: route.geometry,
      instructions: route.segments?.[0]?.steps || [],
      summary: {
        distance: summary.distance,
        duration: summary.duration
      }
    };

    console.log(`🗺️ ORS-reitti: ${response.distance} km, ${response.duration} min`);
    res.json(response);

  } catch (error) {
    console.error('ORS-reititysvirhe:', error);
    res.status(500).json({ error: 'Reitityspalvelussa tapahtui virhe' });
  }
});

app.post('/api/route-matrix', requireAuth, async (req, res) => {
  try {
    const { locations, profile = 'driving-car' } = req.body;
    
    if (!locations || locations.length < 2) {
      return res.status(400).json({ error: 'Vähintään 2 sijaintia vaaditaan' });
    }

    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'ORS API-avain puuttuu' });
    }

    const coordinates = locations.map(loc => [loc.lng, loc.lat]);

    const orsResponse = await fetch('https://api.openrouteservice.org/v2/matrix/' + profile, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locations: coordinates,
        metrics: ['distance', 'duration'],
        units: 'km'
      })
    });

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error('ORS Matrix API-virhe:', orsResponse.status, errorText);
      return res.status(500).json({ error: 'Matka-aikamatriisi epäonnistui' });
    }

    const matrixData = await orsResponse.json();
    
    res.json({
      distances: matrixData.distances,
      durations: matrixData.durations,
      sources: locations
    });

  } catch (error) {
    console.error('ORS-matriisivirhe:', error);
    res.status(500).json({ error: 'Matka-aikapalvelussa tapahtui virhe' });
  }
});

app.post('/api/geocode', requireAuth, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Osoite vaaditaan' });
    }

    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'ORS API-avain puuttuu' });
    }

    const orsResponse = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(address)}&boundary.country=FI&size=5`);

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error('ORS Geocoding-virhe:', orsResponse.status, errorText);
      return res.status(500).json({ error: 'Osoitehaku epäonnistui' });
    }

    const geocodeData = await orsResponse.json();
    
    if (!geocodeData.features || geocodeData.features.length === 0) {
      return res.status(404).json({ error: 'Osoitetta ei löytynyt' });
    }

    const results = geocodeData.features.map(feature => ({
      address: feature.properties.label,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      },
      confidence: feature.properties.confidence || 0
    }));

    res.json({ results });

  } catch (error) {
    console.error('Geocoding-virhe:', error);
    res.status(500).json({ error: 'Osoitehaussa tapahtui virhe' });
  }
});

app.post('/api/reverse-geocode', requireAuth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Koordinaatit vaaditaan' });
    }

    const ORS_API_KEY = process.env.ORS_API_KEY;
    if (!ORS_API_KEY) {
      return res.status(500).json({ error: 'ORS API-avain puuttuu' });
    }

    const orsResponse = await fetch(`https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_API_KEY}&point.lon=${lng}&point.lat=${lat}&boundary.country=FI&size=1`);

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error('ORS Reverse Geocoding-virhe:', orsResponse.status, errorText);
      return res.status(500).json({ error: 'Käänteinen osoitehaku epäonnistui' });
    }

    const reverseData = await orsResponse.json();
    
    if (!reverseData.features || reverseData.features.length === 0) {
      return res.json({ address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
    }

    const feature = reverseData.features[0];
    const address = feature.properties.label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    res.json({ address });

  } catch (error) {
    console.error('Reverse geocoding-virhe:', error);
    res.json({ address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
  }
});

// OMASIVU REITIT
app.get('/omasivu', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('fname lname email createdAt');
    
    if (!user) {
      req.session.error = 'Käyttäjätietoja ei löytynyt';
      return res.redirect('/');
    }

    const userWithName = {
      ...user.toObject(),
      nimi: `${user.fname} ${user.lname}`
    };

    res.render('pages/omasivu', { 
      user: userWithName,
      title: 'Omasivu',
      viesti: null
    });

  } catch (error) {
    console.error('Virhe omasivun latauksessa:', error);
    req.session.error = 'Sivun latauksessa tapahtui virhe';
    res.redirect('/');
  }
});

app.post('/paivita-profiili', requireAuth, async (req, res) => {
  try {
    const { fname, lname, email } = req.body;
    const userId = req.session.userId;

    if (!fname || !lname || !email) {
      req.session.error = 'Kaikki kentät ovat pakollisia';
      return res.redirect('/omasivu');
    }

    if (fname.trim().length < 2 || lname.trim().length < 2) {
      req.session.error = 'Etu- ja sukunimen tulee olla vähintään 2 merkkiä pitkiä';
      return res.redirect('/omasivu');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.session.error = 'Virheellinen sähköpostiosoite';
      return res.redirect('/omasivu');
    }

    const existingUser = await User.findOne({ 
      email: email.toLowerCase(), 
      _id: { $ne: userId } 
    });
    
    if (existingUser) {
      req.session.error = 'Sähköpostiosoite on jo toisen käyttäjän käytössä';
      return res.redirect('/omasivu');
    }

    await User.findByIdAndUpdate(userId, {
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.toLowerCase().trim()
    });

    req.session.user = {
      id: userId,
      fname: fname.trim(),
      lname: lname.trim(),
      email: email.toLowerCase().trim()
    };

    req.session.success = 'Tiedot päivitetty onnistuneesti!';
    res.redirect('/omasivu');

  } catch (error) {
    console.error('Virhe tietojen päivityksessä:', error);
    req.session.error = 'Tietojen päivityksessä tapahtui virhe. Yritä uudelleen.';
    res.redirect('/omasivu');
  }
});

app.post('/vaihda-salasana', requireAuth, async (req, res) => {
  try {
    const { nykyinenSalasana, uusiSalasana, vahvistaSalasana } = req.body;
    const userId = req.session.userId;

    if (!nykyinenSalasana || !uusiSalasana || !vahvistaSalasana) {
      req.session.error = 'Kaikki salasanakentät ovat pakollisia';
      return res.redirect('/omasivu');
    }

    if (uusiSalasana !== vahvistaSalasana) {
      req.session.error = 'Uudet salasanat eivät täsmää';
      return res.redirect('/omasivu');
    }

    if (uusiSalasana.length < 6) {
      req.session.error = 'Uuden salasanan tulee olla vähintään 6 merkkiä pitkä';
      return res.redirect('/omasivu');
    }

    const user = await User.findById(userId);
    if (!user) {
      req.session.error = 'Käyttäjätietoja ei löytynyt';
      return res.redirect('/omasivu');
    }

    const isCurrentPasswordCorrect = await user.comparePassword(nykyinenSalasana);
    if (!isCurrentPasswordCorrect) {
      req.session.error = 'Nykyinen salasana on virheellinen';
      return res.redirect('/omasivu');
    }

    user.password = uusiSalasana;
    await user.save();

    req.session.success = 'Salasana vaihdettu onnistuneesti!';
    res.redirect('/omasivu');

  } catch (error) {
    console.error('Virhe salasanan vaihdossa:', error);
    req.session.error = 'Salasanan vaihdossa tapahtui virhe. Yritä uudelleen.';
    res.redirect('/omasivu');
  }
});

app.post('/poista-tili', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    await Trip.deleteMany({ userId: userId });
    await User.findByIdAndDelete(userId);

    req.session.destroy((err) => {
      if (err) {
        console.error('Virhe session tuhoamisessa:', err);
      }
      
      res.clearCookie('connect.sid');
      
      res.render('pages/etusivu', { 
        success: 'Tilisi on poistettu onnistuneesti. Kiitos että käytit palveluamme.',
        user: null 
      });
    });

  } catch (error) {
    console.error('Virhe tilin poistossa:', error);
    req.session.error = 'Tilin poistossa tapahtui virhe. Yritä uudelleen.';
    res.redirect('/omasivu');
  }
});

// TRIPS ROUTER - VIIMEISENÄ
const tripsRouter = require('./routes/trips');
app.use('/', tripsRouter);

// STATIC FILES - AIVAN VIIMEISENÄ
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Palvelin käynnissä http://localhost:${PORT}`);
});