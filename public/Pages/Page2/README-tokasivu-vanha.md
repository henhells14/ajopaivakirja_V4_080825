<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
 
  <link rel="stylesheet" href="../Resources/main.css"/>
  <link rel="stylesheet" href=""/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&family=Roboto+Serif:ital,opsz,wght@0,8..144,100..900;1,8..144,100..900&display=swap" rel="stylesheet">
 <title>Ajopäiväkirja</title>
 <style>

/* Auto ja nappi */
.car-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.car {
  width: clamp(200px, 50%, 400px);  /* ei liian iso mobiilissa, ei liian pieni isolle näytölle */
  animation: bounce 2s infinite;
}


.startTripBtn {
  margin-top: 1.5rem;
  padding: 1rem 3rem;               /* enemmän sisätilaa -> isompi painike */
  font-size: 1.5rem;                /* suurempi fontti */
  background-color: black;
  color: white;
  border: none;
  border-radius: 12px;              /* hieman isommat kulmat isompaan nappiin */
  cursor: pointer;
  transition: background-color 0.3s ease;

  max-width: 100%;                 /* nappi voi kasvaa tarpeen mukaan */
  width: fit-content;              /* ei veny liian pitkäksi */
}


.start-btn:hover {
  background-color: #2edfc5;
  color: black;
  transform: scale(1.05);
}


/* Hytkyvän auton animaatio */
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

 </style>
</head>

<body>
    <header class="header">
        <div class="logo">Ajopäiväkirja</div>
      
        <nav class="navbar">
          <ul class="nav-links">
            <li><a href="/">Koti</a></li>
            <li><a href="../Page2/tokasivu.html">Aloita matka</a></li>
            <li><a href="../Page3/kolmassivu.html">Ajohistoria</a></li>
            <li><a href="../Page4/neljassivu_kirjautuminen.html">Kirjaudu/Rekisteröidy</a></li>
          </ul>
          <button class="hamburger" id="hamburger">
            &#9776;
          </button>
        </nav>
      </header>
      
      <section class="cityline-section">
        <img src="../Resources/main-kuvat/kaupunki-siluetti.png" alt="Kaupunki" class="cityline-img">
      </section>
  

<main class="hero">

  <div class="car-section">
    <img src="../Resources/main-kuvat/Auto-RED.png" alt="Piirretty auto" class="car" />
    <button class="startTripBtn">Aloita matka</button>
  </div>
  
</main>

  <footer>
    <div class="footer-links">
      <a href="#">Tietosuojaseloste</a>
    </div>
    <p>© Henri Hellsten</p>
    <div class="footer-nav">
      <a href="#">Koti</a> | 
      <a href="#">Aloita matka</a> | 
      <a href="#">Ajohistoria</a> | 
      <a href="#">Kirjaudu</a>
    </div>
  </footer>

   <script src="../Resources/main.js" defer></script>
   


</body>
</html>
