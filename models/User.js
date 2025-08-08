const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fname: {
    type: String,
    required: [true, 'Etunimi on pakollinen'],
    trim: true,
    maxlength: [50, 'Etunimi voi olla maksimissaan 50 merkkiä']
  },
  lname: {
    type: String,
    required: [true, 'Sukunimi on pakollinen'],
    trim: true,
    maxlength: [50, 'Sukunimi voi olla maksimissaan 50 merkkiä']
  },
  email: {
    type: String,
    required: [true, 'Sähköposti on pakollinen'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Anna kelvollinen sähköpostiosoite']
  },
  password: {
    type: String,
    required: [true, 'Salasana on pakollinen'],
    minlength: [6, 'Salasanan tulee olla vähintään 6 merkkiä pitkä']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hashaa salasana ennen tallennusta
userSchema.pre('save', async function(next) {
  // Jos salasana ei ole muuttunut, jatka
  if (!this.isModified('password')) return next();
  
  try {
    // Hashaa salasana
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Metodi salasanan vertailuun
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Metodi palauttamaan käyttäjätiedot ilman salasanaa
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);