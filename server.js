require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Din API Nøgle er indsat her!
passport.use(new SteamStrategy({
    returnURL: `http://localhost:${PORT}/auth/steam/return`,
    realm: `http://localhost:${PORT}/`,
    apiKey: process.env.STEAM_API_KEY 
  },
  function(identifier, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return', 
    passport.authenticate('steam', { failureRedirect: '/' }),
    function(req, res) {
        res.redirect('/');
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.json({ error: "Not logged in" });
    }
});

app.get('/api/games', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not logged in" });
    }

    const steamId = req.user.id; 
    // Din API Nøgle er også indsat her!
    const apiKey = process.env.STEAM_API_KEY;
    
    const playtimeFilter = req.query.playtime || 'unplayed';
    
    try {
        const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;
        const response = await axios.get(url);
        
        if (!response.data.response.games) {
            return res.json({ error: "No games found. Is your 'Game details' set to Public on Steam?" });
        }

        const allGames = response.data.response.games;
        
        const filteredGames = allGames.filter(game => {
            if (playtimeFilter === 'unplayed') {
                return game.playtime_forever === 0;
            } else if (playtimeFilter === 'under2') {
                return game.playtime_forever > 0 && game.playtime_forever < 120;
            } else if (playtimeFilter === 'over2') {
                return game.playtime_forever >= 120;
            }
            return true;
        });
        
        res.json(filteredGames);

    } catch (error) {
        console.error("Error fetching games:", error.message);
        res.status(500).json({ error: 'Could not fetch games from Steam' });
    }
});

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running! Open your browser and go to http://localhost:${PORT}`);
});