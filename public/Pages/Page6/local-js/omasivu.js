document.addEventListener('DOMContentLoaded', function() {
    // Elementtien haku
    const editBtn = document.getElementById('editBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const profileDisplay = document.getElementById('profileDisplay');
    const profileForm = document.getElementById('profileForm');
    
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteModal = document.getElementById('deleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmText = document.getElementById('confirmText');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deleteForm = document.getElementById('deleteForm');
    
    // Salasanan vahvistus
    const uusiSalasana = document.getElementById('uusiSalasana');
    const vahvistaSalasana = document.getElementById('vahvistaSalasana');
    
    // Muokkaa-painike
    editBtn.addEventListener('click', function() {
        profileDisplay.style.display = 'none';
        profileForm.style.display = 'block';
        editBtn.style.display = 'none';
    });
    
    // Peruuta-painike
    cancelBtn.addEventListener('click', function() {
        profileDisplay.style.display = 'block';
        profileForm.style.display = 'none';
        editBtn.style.display = 'inline-block';
        
        // Palauta alkuperäiset arvot
        resetForm();
    });
    
    // Tilin poisto modal
    deleteAccountBtn.addEventListener('click', function() {
        deleteModal.style.display = 'block';
    });
    
    cancelDeleteBtn.addEventListener('click', function() {
        deleteModal.style.display = 'none';
        confirmText.value = '';
        confirmDeleteBtn.disabled = true;
    });
    
    // Sulke modal jos klikataan sen ulkopuolelta
    window.addEventListener('click', function(event) {
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
            confirmText.value = '';
            confirmDeleteBtn.disabled = true;
        }
    });
    
    // Vahvistus tekstin tarkistus
    confirmText.addEventListener('input', function() {
        if (this.value.toUpperCase() === 'POISTA') {
            confirmDeleteBtn.disabled = false;
        } else {
            confirmDeleteBtn.disabled = true;
        }
    });
    
    // Tilin poiston vahvistus
    deleteForm.addEventListener('submit', function(e) {
        if (confirmText.value.toUpperCase() !== 'POISTA') {
            e.preventDefault();
            alert('Kirjoita "POISTA" vahvistaaksesi tilin poiston.');
            return;
        }
        
        if (!confirm('Oletko aivan varma? Tämä toimenpide on peruuttamaton!')) {
            e.preventDefault();
        }
    });
    
    // Salasanan vahvistus
    function tarkistaSalasanat() {
        if (uusiSalasana.value !== vahvistaSalasana.value) {
            vahvistaSalasana.setCustomValidity('Salasanat eivät täsmää');
        } else {
            vahvistaSalasana.setCustomValidity('');
        }
    }
    
    if (uusiSalasana && vahvistaSalasana) {
        uusiSalasana.addEventListener('input', tarkistaSalasanat);
        vahvistaSalasana.addEventListener('input', tarkistaSalasanat);
    }
    
    // Lomakkeen lähetys vahvistus
    profileForm.addEventListener('submit', function(e) {
        if (!confirm('Haluatko varmasti tallentaa muutokset?')) {
            e.preventDefault();
        }
    });
    
    // Salasana lomakkeen lähetys vahvistus
    const passwordForm = document.querySelector('.password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            if (uusiSalasana.value !== vahvistaSalasana.value) {
                e.preventDefault();
                alert('Salasanat eivät täsmää!');
                return;
            }
            
            if (uusiSalasana.value.length < 6) {
                e.preventDefault();
                alert('Salasanan tulee olla vähintään 6 merkkiä pitkä!');
                return;
            }
            
            if (!confirm('Haluatko varmasti vaihtaa salasanan?')) {
                e.preventDefault();
            }
        });
    }
    
    // Palauta lomakkeen alkuperäiset arvot
    function resetForm() {
        const inputs = profileForm.querySelectorAll('input');
        inputs.forEach(input => {
            const originalValue = input.defaultValue;
            input.value = originalValue;
        });
    }
    
    // Automaattinen viestien piilotus
    const message = document.querySelector('.message');
    if (message) {
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000); // 5 sekunnin kuluttua
    }
    
    // Sähköpostin muodon tarkistus
    const sahkopostiInput = document.getElementById('email');
    if (sahkopostiInput) {
        sahkopostiInput.addEventListener('blur', function() {
            const email = this.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email && !emailRegex.test(email)) {
                this.setCustomValidity('Virheellinen sähköpostiosoite');
            } else {
                this.setCustomValidity('');
            }
        });
    }
});

// Funktio lomakkeen kenttien validointiin
function validoiKentat() {
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (fname.length < 2) {
        alert('Etunimen tulee olla vähintään 2 merkkiä pitkä');
        return false;
    }
    
    if (lname.length < 2) {
        alert('Sukunimen tulee olla vähintään 2 merkkiä pitkä');
        return false;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
        alert('Virheellinen sähköpostiosoite');
        return false;
    }
    
    return true;
}